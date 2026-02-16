# CollabBoard

Real-time collaborative whiteboard with AI-powered board manipulation.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Konva.js
- **Backend**: Python FastAPI, Anthropic Claude API
- **Database**: Firebase Firestore (real-time sync)
- **Auth**: Firebase Authentication (Google sign-in)

## Project Structure

```
CollabBoard/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # FastAPI backend
└── packages/
    └── shared-types/ # TypeScript type definitions
```

## Prerequisites

- Node.js 18+
- Python 3.12+
- A Firebase project with Firestore and Google Auth enabled
- An Anthropic API key

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in method → **Google**
3. Enable **Cloud Firestore** in production mode
4. Go to Project Settings → General → Your apps → Add a **Web app**
5. Copy the Firebase config values

### Firestore Rules

In the Firebase Console under Firestore → Rules, set:

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

Fill in:

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

### Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs at `http://localhost:8000`.

## Deployment

### Backend (Docker / Cloud Run)

```bash
cd apps/api
docker build -t collabboard-api .
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e FIREBASE_PROJECT_ID=your-project-id \
  collabboard-api
```

### Frontend (Vite Static Build)

```bash
cd apps/web
npm run build
```

Output in `apps/web/dist/` — deploy to any static host (Firebase Hosting, Vercel, Netlify). Set `VITE_API_URL` to your deployed backend URL before building.

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
| `Cmd+D` / `Ctrl+D` | Duplicate selected |
| `Escape` | Deselect / reset tool |

## AI Commands

Press `/` or click the **AI** button to open the command bar. Example prompts:

- "Create a SWOT analysis template"
- "Add 5 sticky notes for sprint retro"
- "Organize the board into columns"
- "Change all sticky notes to blue"
