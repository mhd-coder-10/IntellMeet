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

## Author
Zidio Development Internship - March 2026


## Project Status

- Week 1 (Days 1-7): Backend + Auth — Complete
- Week 2 (Days 8-14): Frontend + Real-Time Meeting — Complete
- Week 3 (Days 15-21): AI + Collaboration — In Progress
- Week 4 (Days 22-28): Deployment — Pending

## Features Working

### Meetings
- Create, join, leave meetings
- Multi-user video and audio calls
- Screen sharing and recording
- Live chat with typing indicators
- Participant list with presence indicators
- Host controls (mute, kick, end)

### Auth & Profile
- JWT authentication with refresh tokens
- Profile management with avatar upload
- Session persistence across refreshes