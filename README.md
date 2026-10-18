# IntellMeet 
**AI-Powered Enterprise Video Conferencing & Workspace Collaboration Platform**

IntellMeet is a modern virtual meeting and collaboration application. It combines real-time video conferencing, in-meeting recording, Google Gemini AI intelligence (transcripts, summaries, action items), and an integrated Kanban board with automatic task synchronization.

---

## Key Features

- **HD Video & Audio Meetings**: Peer-to-peer video calling built with WebRTC for ultra-low latency, with active speaker detection and mute controls.
- **Screen Sharing & Meeting Recording**: Share screens with system audio and record entire meetings directly to Cloudinary cloud storage.
- **Google Gemini AI Intelligence**:
  - Full speech-to-text audio transcription with keyword search.
  - Executive meeting summaries, key discussion points, and sentiment analysis.
  - Smart action item extraction with task titles, priorities, and assignments mapped to real participant names.
- **Automated Kanban Integration**: Extracted action items are automatically pushed to the project Kanban board under the **To-Do** column (`col-todo`), with 2-way real-time status synchronization.
- **Team Workspaces**: Create teams, invite members, manage project boards, and organize tasks across columns (`To Do`, `In Progress`, `In Review`, `Done`).
- **Live Chat & Notifications**: Real-time in-meeting messaging with typing indicators and global desktop/push notification alerts.

---

## Technology Stack & Purpose

| Technology | Used For / Purpose |
|---|---|
| **React 19 + TypeScript** | Modern, responsive, type-safe Single Page Application (SPA) frontend |
| **Tailwind CSS + shadcn/ui** | Clean, accessible design system with glassmorphism and mobile support |
| **Node.js + Express** | RESTful backend API handling authentication, meetings, and business logic |
| **WebRTC** | Direct browser-to-browser audio and video streaming with STUN/TURN failover |
| **Socket.io** | Real-time signaling, live chat, presence tracking, and instant notifications |
| **Google Gemini AI** | Generating accurate meeting transcripts, executive summaries, and action items |
| **MongoDB Atlas + Mongoose** | Primary database storing users, meetings, summaries, workspaces, and tasks |
| **Redis** | High-performance in-memory caching, socket clustering, and session storage |
| **Cloudinary** | Cloud storage for meeting video recordings, avatars, and file uploads |
| **Docker & Docker Compose** | Containerized deployment for consistent local development and production |

---

## Architecture Overview

```
[ Clients: Web / Mobile ]
         │
         ├─── WebRTC (Peer-to-Peer Audio / Video / Screen Share)
         │
[ Express API + Socket.io Server ]
   ├── Redis (Pub/Sub & Room State Cache)
   ├── MongoDB Atlas (Users, Meetings, Tasks, Workspaces)
   ├── Google Gemini AI (Audio Transcription & Summary Extraction)
   └── Cloudinary CDN (Meeting Recordings & Media Storage)
```

1. **Signaling & Media**: WebRTC handles peer-to-peer media streams, while Socket.io exchanges SDP offers/answers and ICE candidates.
2. **AI Processing**: Once a meeting recording ends, Gemini AI processes the audio to generate transcripts, summaries, and action items.
3. **Task Automation**: Action items automatically create Kanban tasks assigned to members under the workspace board.

---

## Quick Setup & Installation

### Prerequisites
- Node.js (v20+ or v24+)
- MongoDB (Atlas or local)
- Redis (Local or Upstash)
- Cloudinary & Gemini API credentials

### 1. Backend Setup
```bash
cd backend
npm install

# Create .env file with your credentials (PORT, MONGO_URI, REDIS_HOST, JWT_SECRET, GEMINI_API_KEY, CLOUDINARY_*)
npm run dev
```
> Backend runs at `http://localhost:5100`  
> Interactive API Docs (Swagger): `http://localhost:5100/api-docs`

### 2. Frontend Setup
```bash
cd frontend
npm install

# Create .env with:
# VITE_API_URL=http://localhost:5100/api
# VITE_SOCKET_URL=http://localhost:5100
npm run dev
```
> Frontend runs at `http://localhost:5173`

### 3. Docker (Optional)
```bash
docker compose up --build -d
```

---

## Project Directory Structure

```text
IntellMeet/
├── backend/            # Express REST API, Mongoose models, Socket.io handlers & AI services
│   ├── src/controllers # Auth, Meeting, Chat, AI, Team, and Task controllers
│   ├── src/models      # MongoDB schemas (User, Meeting, Task, Summary, ActionItem)
│   ├── src/services    # Gemini AI integration, transcription, and task automation
│   └── src/socket      # WebRTC signaling, chat, and presence handlers
├── frontend/           # React 19 + TypeScript + Vite application
│   ├── src/components  # Video grid, controls, meeting cards, transcript & summary UI
│   ├── src/pages       # Dashboard, Video Room, Team Workspaces, and Kanban Board
│   └── src/services    # Axios API client services
├── docker-compose.yml  # Multi-container local orchestration (App, Mongo, Redis)
└── README.md           # Project documentation
```

---

## License
This project is licensed under the ISC License.