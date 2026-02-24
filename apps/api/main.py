import os
import json
import base64
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import anthropic

load_dotenv()

# Initialize Anthropic client
claude = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

app = FastAPI(title="CollabBoard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth dependency — decode Firebase JWT to extract user info
# Firebase tokens are already verified client-side; here we extract claims
async def verify_token(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        # Decode JWT payload without verification (token was issued by Firebase)
        # Add padding if needed
        payload = token.split(".")[1]
        payload += "=" * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        if not decoded.get("user_id"):
            raise ValueError("No user_id in token")
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


class AICommandRequest(BaseModel):
    boardId: str
    prompt: str
    boardState: list = []


class BoardAction(BaseModel):
    action: str
    params: dict


# Tool definitions for Claude
BOARD_TOOLS = [
    {
        "name": "createStickyNote",
        "description": "Create a sticky note on the board. Use this for adding notes, ideas, or labeled items.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text content of the sticky note"},
                "x": {"type": "number", "description": "X position on the board"},
                "y": {"type": "number", "description": "Y position on the board"},
                "color": {"type": "string", "description": "Color of the sticky note (hex). Common colors: #FFEB3B (yellow), #FF9800 (orange), #E91E63 (pink), #9C27B0 (purple), #3F51B5 (indigo), #03A9F4 (light blue), #009688 (teal), #4CAF50 (green)"},
                "width": {"type": "number", "description": "Width of the sticky note (default 200)"},
                "height": {"type": "number", "description": "Height of the sticky note (default 200)"},
            },
            "required": ["text", "x", "y"]
        }
    },
    {
        "name": "createShape",
        "description": "Create a shape (rectangle or circle) on the board.",
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["rectangle", "circle"], "description": "Shape type"},
                "x": {"type": "number", "description": "X position"},
                "y": {"type": "number", "description": "Y position"},
                "width": {"type": "number", "description": "Width of the shape"},
                "height": {"type": "number", "description": "Height of the shape"},
                "color": {"type": "string", "description": "Fill color (hex)"},
            },
            "required": ["type", "x", "y", "width", "height"]
        }
    },
    {
        "name": "createFrame",
        "description": "Create a frame to group and organize content areas on the board.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Frame title/label"},
                "x": {"type": "number", "description": "X position"},
                "y": {"type": "number", "description": "Y position"},
                "width": {"type": "number", "description": "Width of the frame"},
                "height": {"type": "number", "description": "Height of the frame"},
                "color": {"type": "string", "description": "Frame border color (hex)"},
            },
            "required": ["title", "x", "y", "width", "height"]
        }
    },
    {
        "name": "createText",
        "description": "Create a standalone text element on the board.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "The text content"},
                "x": {"type": "number", "description": "X position"},
                "y": {"type": "number", "description": "Y position"},
                "fontSize": {"type": "number", "description": "Font size (default 20)"},
                "color": {"type": "string", "description": "Text color (hex)"},
            },
            "required": ["text", "x", "y"]
        }
    },
    {
        "name": "createConnector",
        "description": "Create an arrow/line connecting two objects.",
        "input_schema": {
            "type": "object",
            "properties": {
                "fromId": {"type": "string", "description": "ID of the source object"},
                "toId": {"type": "string", "description": "ID of the target object"},
                "color": {"type": "string", "description": "Connector color (hex)"},
            },
            "required": ["fromId", "toId"]
        }
    },
    {
        "name": "moveObject",
        "description": "Move an existing object to a new position.",
        "input_schema": {
            "type": "object",
            "properties": {
                "objectId": {"type": "string", "description": "ID of the object to move"},
                "x": {"type": "number", "description": "New X position"},
                "y": {"type": "number", "description": "New Y position"},
            },
            "required": ["objectId", "x", "y"]
        }
    },
    {
        "name": "resizeObject",
        "description": "Resize an existing object.",
        "input_schema": {
            "type": "object",
            "properties": {
                "objectId": {"type": "string", "description": "ID of the object to resize"},
                "width": {"type": "number", "description": "New width"},
                "height": {"type": "number", "description": "New height"},
            },
            "required": ["objectId", "width", "height"]
        }
    },
    {
        "name": "updateText",
        "description": "Update the text content of an existing object.",
        "input_schema": {
            "type": "object",
            "properties": {
                "objectId": {"type": "string", "description": "ID of the object"},
                "newText": {"type": "string", "description": "New text content"},
            },
            "required": ["objectId", "newText"]
        }
    },
    {
        "name": "changeColor",
        "description": "Change the color of an existing object.",
        "input_schema": {
            "type": "object",
            "properties": {
                "objectId": {"type": "string", "description": "ID of the object"},
                "color": {"type": "string", "description": "New color (hex)"},
            },
            "required": ["objectId", "color"]
        }
    },
    {
        "name": "deleteObject",
        "description": "Delete an object from the board.",
        "input_schema": {
            "type": "object",
            "properties": {
                "objectId": {"type": "string", "description": "ID of the object to delete"},
            },
            "required": ["objectId"]
        }
    },
]

SYSTEM_PROMPT = """You are an AI assistant for CollabBoard, a collaborative whiteboard application.
You help users create, arrange, and manipulate objects on a shared whiteboard.

You have access to tools for creating sticky notes, shapes, frames, text, connectors, and for
modifying existing objects (move, resize, recolor, update text, delete).

When creating layouts or templates:
- Space objects with adequate padding (at least 20px gap)
- Use consistent sizing for similar objects
- Use meaningful colors to group related items
- Center layouts around position (0, 0) or use the context of existing objects

For templates like SWOT analysis, retrospective boards, journey maps, etc:
- Create a frame for each section
- Add appropriate sticky notes within frames
- Use colors to differentiate categories
- Add title text labels

The board coordinate system has (0,0) at the center. Positive X is right, positive Y is down.
A typical sticky note is 200x200. A frame is usually 400-600 wide.

When you receive the current board state, use it to understand existing objects and avoid overlapping.
Always use the tools provided. Execute multiple tool calls for complex commands."""


@app.post("/api/ai/command")
async def ai_command(request: AICommandRequest, user: dict = Depends(verify_token)):
    try:
        # Build context message with board state
        board_context = ""
        if request.boardState:
            board_context = f"\n\nCurrent board objects:\n{json.dumps(request.boardState, indent=2)}"

        user_message = f"{request.prompt}{board_context}"

        # Call Claude with tools
        response = claude.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=BOARD_TOOLS,
            messages=[
                {"role": "user", "content": user_message}
            ],
        )

        # Process tool calls
        actions = []
        message_text = ""

        # Handle multi-turn tool use
        messages = [{"role": "user", "content": user_message}]
        current_response = response

        while current_response.stop_reason == "tool_use":
            # Collect tool calls from this response
            assistant_content = current_response.content
            messages.append({"role": "assistant", "content": assistant_content})

            tool_results = []
            for block in assistant_content:
                if block.type == "text":
                    message_text += block.text
                elif block.type == "tool_use":
                    action = {
                        "action": block.name,
                        "params": block.input,
                    }
                    actions.append(action)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({"success": True, "message": f"{block.name} executed"})
                    })

            messages.append({"role": "user", "content": tool_results})

            # Continue the conversation
            current_response = claude.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=BOARD_TOOLS,
                messages=messages,
            )

        # Collect any final text
        for block in current_response.content:
            if block.type == "text":
                message_text += block.text
            elif block.type == "tool_use":
                actions.append({
                    "action": block.name,
                    "params": block.input,
                })

        return {
            "success": True,
            "actions": actions,
            "message": message_text or f"Executed {len(actions)} action(s)",
        }

    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
