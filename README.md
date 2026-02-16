# CollabBoard

Real-time collaborative whiteboard with AI-powered board manipulation.

**Live App**: [https://collabboard-8154b.web.app](https://collabboard-8154b.web.app)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Konva.js |
| Backend | Python FastAPI, Anthropic Claude API (tool-calling) |
| Database | Firebase Firestore (real-time sync) |
| Auth | Firebase Authentication (Google sign-in) |
| Hosting | Firebase Hosting (frontend), Render (backend API) |

## Architecture

```
Browser (React + Konva.js)
  ├── Firebase Auth (Google sign-in)
  ├── Firestore (real-time sync)
  │   ├── boards/{boardId}/objects   ← board objects
  │   ├── boards/{boardId}/cursors   ← multiplayer cursors
  │   └── boards/{boardId}/presence  ← online users
  └── FastAPI Backend
      └── Claude API (tool-calling with 10 board tools)
```

## Project Structure

```
CollabBoard/
├── apps/
│   ├── web/                # React frontend
│   │   └── src/
│   │       ├── components/ # WhiteboardCanvas, Toolbar, PresenceBar, PropertiesPanel, AICommandInput
│   │       ├── hooks/      # useAuth, useBoardObjects, useCursors, usePresence
│   │       ├── pages/      # LoginPage, DashboardPage, BoardPage
│   │       └── lib/        # Firebase config
│   └── api/                # FastAPI backend
│       ├── main.py         # AI agent with Claude tool-calling
│       ├── Dockerfile      # Container for deployment
│       └── requirements.txt
└── packages/
    └── shared-types/       # TypeScript type definitions
```

## Features

### Core Whiteboard
- Infinite board with smooth pan (middle-click, shift+drag, H key) and zoom (scroll wheel, 0.1x-5x)
- Sticky notes with editable text and color options
- Shapes: rectangles, circles, lines
- Frames for grouping content areas
- Connectors (arrows between objects)
- Standalone text elements
- Move, resize, rotate transforms via Konva Transformer
- Single-select, multi-select (shift+click), drag-to-select
- Delete, duplicate (Cmd+D), copy/paste (Cmd+C / Cmd+V)

### Real-Time Collaboration
- Multiplayer cursors with name labels and user colors
- Instant object sync via Firestore `onSnapshot` with `docChanges()`
- Presence awareness (who's online) with 10s heartbeat
- Last-write-wins conflict resolution (Firestore native)
- Auto disconnect/reconnect resilience (Firestore handles this)
- Board state persists after all users leave

### AI Board Agent
- 10 tools: createStickyNote, createShape, createFrame, createText, createConnector, moveObject, resizeObject, updateText, changeColor, deleteObject
- Multi-turn tool use for complex commands (SWOT templates, retrospectives)
- All users see AI-generated results in real-time (writes to Firestore)
- Supports creation, manipulation, layout, and complex template commands

### Authentication
- Google sign-in via Firebase Auth
- Protected routes (login required for dashboard and boards)
- Firebase ID token verification on backend API

## Prerequisites

- Node.js 18+
- Python 3.9+
- A Firebase project with Firestore and Google Auth enabled
- An Anthropic API key (for AI features)

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** -> Sign-in method -> **Google**
3. Enable **Cloud Firestore** (start in test mode for development)
4. Go to Project Settings -> General -> Your apps -> Add a **Web app**
5. Copy the Firebase config values

### Firestore Rules

In the Firebase Console under Firestore -> Rules, set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      allow read, write: if request.auth != null;
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## Environment Variables

### Frontend (`apps/web/.env`)

```bash
cp apps/web/.env.example apps/web/.env
```

Fill in with your Firebase config values:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_URL=http://localhost:8000
```

### Backend (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
FIREBASE_PROJECT_ID=your-project-id
PORT=8000
```

## Running Locally

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Backend (for AI commands)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs at `http://localhost:8000`.

## Deployment

### Frontend (Firebase Hosting)

```bash
cd apps/web
npm run build
firebase deploy --only hosting
```

Live at: [https://collabboard-8154b.web.app](https://collabboard-8154b.web.app)

### Backend (Render)

1. Go to [render.com](https://render.com) and connect your GitHub repo
2. Create a new Web Service with:
   - **Root directory**: `apps/api`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables: `ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID`

### Backend (Docker)

```bash
cd apps/api
docker build -t collabboard-api .
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e FIREBASE_PROJECT_ID=your-project-id \
  collabboard-api
```

After deploying the backend, update `VITE_API_URL` in `apps/web/.env` to the deployed backend URL, rebuild, and redeploy the frontend.

## Testing Multiplayer

1. Open `http://localhost:5173` in **Chrome** (sign in with Google Account A)
2. Open `http://localhost:5173` in **Chrome Incognito** (sign in with Google Account B)
3. Both users join the same board
4. You should see: real-time cursors, live object sync, presence indicators

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `H` | Pan tool |
| `N` | Sticky note |
| `R` | Rectangle |
| `C` | Circle |
| `L` | Line |
| `T` | Text |
| `F` | Frame |
| `/` | Open AI command bar |
| `Delete` / `Backspace` | Delete selected |
| `Cmd+C` / `Ctrl+C` | Copy selected |
| `Cmd+V` / `Ctrl+V` | Paste |
| `Cmd+D` / `Ctrl+D` | Duplicate selected |
| `Escape` | Deselect / reset tool |

## AI Commands

Press `/` or click the **AI** button to open the command bar. Example prompts:

- "Add a yellow sticky note that says 'User Research'"
- "Create a blue rectangle at position 100, 200"
- "Add a frame called 'Sprint Planning'"
- "Change the sticky note color to green"
- "Create a SWOT analysis template with four quadrants"
- "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns"
- "Build a user journey map with 5 stages"
- "Create a 2x3 grid of sticky notes for pros and cons"

## Conflict Resolution

Uses **last-write-wins** via Firestore's built-in behavior. When two users edit the same object simultaneously, the last write persists. This is acceptable for whiteboard use cases where objects are typically edited by one user at a time, and Firestore's real-time listeners ensure all clients converge to the same state within milliseconds.

## Performance

| Metric | Target | Implementation |
|--------|--------|---------------|
| Frame rate | 60 FPS | Konva.js hardware-accelerated canvas |
| Object sync | <100ms | Firestore `onSnapshot` with `docChanges()` |
| Cursor sync | <50ms | 50ms throttled writes, Firestore real-time |
| Object capacity | 500+ | Incremental updates via `docChanges()` |
| Concurrent users | 5+ | Firestore scales automatically |
