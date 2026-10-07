# IntelliMeet
AI-Powered Enterprise Meeting & Collaboration Platform

## About
Real-time video meetings, AI summaries, smart action items, and team collaboration for modern teams.

## Tech Stack
- Frontend: React 19 + TypeScript + Vite (Week 2)
- Backend: Node.js + Express
- Database: MongoDB
- Real-Time: Socket.io + WebRTC
- Cache: Redis
- Auth: JWT + bcrypt
- Storage: Cloudinary

## Setup

### Backend
cd backend
npm install
# Add .env variables (see .env)
npm start

Server runs at http://localhost:5100
API docs at http://localhost:5100/api-docs

## Week 1 Progress
- Day 1: Project Setup
- Day 2: Authentication (JWT + bcrypt)
- Day 3: Profile + Avatar Upload
- Day 4: Meeting CRUD + WebRTC
- Day 5: Redis + Socket.io
- Day 6: Chat + Notifications
- Day 7: Week 1 Checkpoint


## Week 2 Progress
- Day 8: Frontend Setup (React 19, Tailwind, shadcn/ui)
- Day 9: Authentication Pages & Protected Routes
- Day 10: Meeting Lobby & Video Room with WebRTC
- day 11: Real-Time Chat with Typing Indicators
- Day 12: Screen Sharing & Meeting Recording
- Day 13: Live Participant List & Mute Controls
- Day 14: Week 2 Checkpoint

### Frontend Features (Week 2)
- User authentication pages with validation
- Protected routes with session persistence
- Meeting lobby (create, join, list)
- Multi-user video calls via WebRTC
- Camera on/off and mute controls
- Screen sharing across participants
- Composite meeting recording (host only)
- Real-time chat with typing indicators
- Live participant list with presence
- Host controls (force mute, kick, end meeting)
- Toast notifications for all actions