import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.anyio
async def test_ai_command_returns_actions_from_tool_calls(client, auth_headers):
    """Test that tool_use responses are converted to actions."""
    # Create a mock response with tool calls
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.id = "tool-1"
    tool_block.name = "createStickyNote"
    tool_block.input = {"text": "Hello", "x": 100, "y": 200}

    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "Created a sticky note!"

    # First response has tool_use, second is final
    first_response = MagicMock()
    first_response.stop_reason = "tool_use"
    first_response.content = [tool_block]

    final_response = MagicMock()
    final_response.stop_reason = "end_turn"
    final_response.content = [text_block]

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.side_effect = [first_response, final_response]
        response = await client.post(
            "/api/ai/command",
            json={"boardId": "board-123", "prompt": "add a sticky note saying Hello"},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["actions"]) == 1
    assert data["actions"][0]["action"] == "createStickyNote"
    assert data["actions"][0]["params"]["text"] == "Hello"
    assert data["actions"][0]["params"]["x"] == 100
    assert "Created a sticky note!" in data["message"]


@pytest.mark.anyio
async def test_ai_command_handles_multiple_tool_calls(client, auth_headers):
    """Test that multiple tool calls in one response are all captured."""
    tool1 = MagicMock(type="tool_use", id="t1", name="createStickyNote", input={"text": "Note 1", "x": 0, "y": 0})
    tool2 = MagicMock(type="tool_use", id="t2", name="createStickyNote", input={"text": "Note 2", "x": 200, "y": 0})

    first_response = MagicMock(stop_reason="tool_use", content=[tool1, tool2])

    text_block = MagicMock(type="text", text="Created 2 notes")
    final_response = MagicMock(stop_reason="end_turn", content=[text_block])

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.side_effect = [first_response, final_response]
        response = await client.post(
            "/api/ai/command",
            json={"boardId": "board-123", "prompt": "create 2 sticky notes"},
            headers=auth_headers,
        )

    data = response.json()
    assert len(data["actions"]) == 2
    assert data["actions"][0]["params"]["text"] == "Note 1"
    assert data["actions"][1]["params"]["text"] == "Note 2"


@pytest.mark.anyio
async def test_ai_command_with_no_tool_calls(client, auth_headers):
    """Test response when Claude returns only text (no actions)."""
    text_block = MagicMock(type="text", text="I'm not sure what to create. Can you be more specific?")

    response_mock = MagicMock(stop_reason="end_turn", content=[text_block])

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.return_value = response_mock
        response = await client.post(
            "/api/ai/command",
            json={"boardId": "board-123", "prompt": "do something"},
            headers=auth_headers,
        )

    data = response.json()
    assert data["success"] is True
    assert len(data["actions"]) == 0
    assert "not sure" in data["message"]


@pytest.mark.anyio
async def test_ai_command_includes_board_state(client, auth_headers):
    """Test that board state is passed to Claude in the prompt."""
    text_block = MagicMock(type="text", text="Noted.")
    response_mock = MagicMock(stop_reason="end_turn", content=[text_block])

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.return_value = response_mock
        response = await client.post(
            "/api/ai/command",
            json={
                "boardId": "board-123",
                "prompt": "what's on the board?",
                "boardState": [{"id": "obj-1", "type": "sticky-note", "text": "Hello"}],
            },
            headers=auth_headers,
        )

    # Verify Claude was called with board state in the message
    call_args = mock_claude.messages.create.call_args
    user_message = call_args.kwargs["messages"][0]["content"]
    assert "obj-1" in user_message
    assert "sticky-note" in user_message


@pytest.mark.anyio
async def test_ai_command_handles_claude_api_error(client, auth_headers):
    """Test that Anthropic API errors return 500."""
    import anthropic

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.side_effect = anthropic.APIError(
            message="Rate limited",
            request=MagicMock(),
            body=None,
        )
        response = await client.post(
            "/api/ai/command",
            json={"boardId": "board-123", "prompt": "create something"},
            headers=auth_headers,
        )

    assert response.status_code == 500
    assert "Claude API error" in response.json()["detail"]


@pytest.mark.anyio
async def test_ai_command_request_validation(client, auth_headers):
    """Test that missing required fields are rejected."""
    # Missing prompt
    response = await client.post(
        "/api/ai/command",
        json={"boardId": "board-123"},
        headers=auth_headers,
    )
    assert response.status_code == 422

    # Missing boardId
    response = await client.post(
        "/api/ai/command",
        json={"prompt": "test"},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_ai_command_default_board_state(client, auth_headers):
    """Test that boardState defaults to empty list."""
    text_block = MagicMock(type="text", text="Ok")
    response_mock = MagicMock(stop_reason="end_turn", content=[text_block])

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.return_value = response_mock
        response = await client.post(
            "/api/ai/command",
            json={"boardId": "board-123", "prompt": "test"},
            headers=auth_headers,
        )

    assert response.status_code == 200
    # No board context should be in the message when boardState is empty
    call_args = mock_claude.messages.create.call_args
    user_message = call_args.kwargs["messages"][0]["content"]
    assert "Current board objects" not in user_message
