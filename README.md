# IntellMeet
**AI-Powered Enterprise Video Conferencing & Workspace Collaboration Platform**

[![Live App](https://img.shields.io/badge/Live_App-Vercel-black?style=flat&logo=vercel)](https://intell-meet-murex.vercel.app)
[![API Status](https://img.shields.io/badge/API-Render-46E3B7?style=flat&logo=render)](https://intellmeet-backend-hlpy.onrender.com)
[![Swagger Docs](https://img.shields.io/badge/Swagger-API_Docs-85EA2D?style=flat&logo=swagger)](https://intellmeet-backend-hlpy.onrender.com/api-docs)
[![Security](https://img.shields.io/badge/OWASP-Grade_A+_100%25-brightgreen?style=flat&logo=owasp)](security/OWASP_ZAP_SECURITY_REPORT.md)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

IntellMeet is an enterprise-grade virtual collaboration platform designed for high-performance team communication. It bridges real-time WebRTC audio/video meetings with Google Gemini AI intelligence, turning live discussions into structured meeting transcripts, executive summaries, and automatically synchronized Kanban tasks.

---

### Live Environments & Documentation
- **Production Web App:** [https://intell-meet-murex.vercel.app](https://intell-meet-murex.vercel.app)
- **Production API Server:** [https://intellmeet-backend-hlpy.onrender.com](https://intellmeet-backend-hlpy.onrender.com)
- **Interactive Swagger Docs:** [https://intellmeet-backend-hlpy.onrender.com/api-docs](https://intellmeet-backend-hlpy.onrender.com/api-docs)
- **Prometheus Telemetry:** [https://intellmeet-backend-hlpy.onrender.com/metrics](https://intellmeet-backend-hlpy.onrender.com/metrics)
- **Security Audit Report:** [OWASP Top 10 Audit (Grade A+)](security/OWASP_ZAP_SECURITY_REPORT.md)
- **Load Test Dashboard:** [Apache JMeter Performance Report](load-testing/reports/index.html)

---

## Core Capabilities

- **Low-Latency Video Conferencing:** Direct peer-to-peer browser communication built with WebRTC mesh architecture, featuring dynamic audio level metering, active speaker detection, and grid-adaptive video streams.
- **Resilient Meeting Recording:** Screen sharing with synchronized system audio and in-meeting cloud recording saved directly to Cloudinary CDN storage.
- **Google Gemini 8.5 Flash AI Engine:**
  - Fast, context-aware speech-to-text audio transcription.
  - Automatic executive meeting summaries highlighting key discussion topics and overall sentiment.
  - Intelligent action item extraction that maps action verbs, deadlines, and priorities directly to real meeting participants.
- **Automated Kanban Task Synchronization:** Action items extracted by Gemini AI are automatically dispatched to the team Kanban board under the **To-Do** column (`col-todo`), keeping meeting outcomes instantly actionable.
- **Team Workspaces & Real-Time Chat:** Multi-workspace organization, role-based member management, in-meeting chat channels, and instant WebSocket notifications.

---

## Technical Stack

- **Frontend Client:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend Application:** Node.js 24, Express 5, RESTful architecture
- **Signaling & Real-Time:** WebRTC (P2P Mesh, STUN/TURN failover), Socket.io
- **State & In-Memory Store:** Redis (Room sessions, pub/sub signaling, multi-node clustering)
- **Persistent Database:** MongoDB Atlas, Mongoose ODM
- **AI Processing:** Google Gemini 8.5 Flash API
- **Cloud Media Storage:** Cloudinary Media Management
- **Monitoring & Telemetry:** Prometheus (`prom-client`), Grafana Dashboards, Sentry Error Tracking
- **Containerization & Orchestration:** Docker, Docker Compose, Kubernetes, Helm Charts

---

## Architecture Flow

```
[ Web & Mobile Clients ]
         |
         +==== WebRTC (Low-Latency Peer-to-Peer Audio, Video, Screen Share) ====+
         |                                                                      |
[ Express 5 & Socket.io Signaling ]                                             |
   |-- Redis (In-Memory Room State & Cluster Pub/Sub)                           |
   |-- MongoDB Atlas (User Profiles, Meetings, Workspaces, Kanban Tasks)        |
   |-- Google Gemini 8.5 Flash (Speech-to-Text, Summaries, Action Items)        |
   |-- Cloudinary Storage (Meeting Recordings & File Attachments)               |
   |-- Sentry SDK (Real-Time Backend Exception & Crash Capture)                 |
   +-- Prometheus Scraper (/metrics Telemetry Pipeline -> Grafana Dashboard)    |
```

---

## Performance Benchmarking (Apache JMeter)

The platform was subjected to high-concurrency automated load testing using Apache JMeter and an automated benchmark runner (`load-testing/run_load_test.js` & `load-testing/intellmeet_load_test.jmx`).

- **Test Load:** 500 Virtual User API invocations across 5 mission-critical endpoints (Liveness, Prometheus Metrics, Swagger UI, Auth Rate-Limit, and Meeting Security Barriers).
- **Peak Throughput:** **48.48 requests/second** under sustained load.
- **Error Rate:** **0.00%** failure across all test samples.
- **Apdex User Satisfaction Score:** **0.99** (T=500ms, F=1500ms — Excellent enterprise performance rating).
- **Generated Report:** Detailed HTML charts and latency distributions are stored in `load-testing/reports/index.html`.

---

## Security Hardening (OWASP Top 10 — Grade A+)

IntellMeet underwent a full automated security audit and penetration check across all API surfaces (`security/owasp-security-audit.js`). The platform achieved a **100% Security Posture Score (Grade A+)**.

- **A01: Broken Access Control:** Enforced JWT authentication (`protect` middleware) across all private meeting, workspace, and task mutations. Unauthorized access returns HTTP 401.
- **A02: Cryptographic Failures:** Enforced HTTPS/TLS in transit, HSTS headers, and salted bcrypt hashing (salt rounds: 10) for credential storage.
- **A03: Injection Defense:** Strict Mongoose Schema typing and sanitized query selectors completely disallow NoSQL operator injections (e.g. `{"$ne": null}`).
- **A04: Insecure Design & Brute Force Prevention:** Strict rate-limiting via `express-rate-limit` throttles repeated authentication attempts, neutralizing credential stuffing attacks.
- **A05: Security Misconfiguration:** Helmet.js middleware protects against clickjacking and MIME-type sniffing (`X-Content-Type-Options: nosniff`), while hiding Express technology fingerprinting (`X-Powered-By`).
- **A07: Identification & Authentication Failures:** Tampered JWT signatures and `alg: none` header bypass attempts are blocked and rejected via HMAC SHA-256 validation.
- **A09: Security Logging & Monitoring:** Complete telemetry via Prometheus and Sentry ensures immediate detection and notification of anomalous traffic spikes or unhandled exceptions.

---

## DevOps, Kubernetes & Helm Orchestration

IntellMeet is fully containerized and cloud-ready for high-availability enterprise deployment.

### 1. Docker Multi-Stage Builds
- Multi-container orchestration ready via `docker-compose.yml` for local development and `docker-compose.prod.yml` for production builds.

### 2. Kubernetes Manifests (`k8s/`)
- **Backend & Frontend Deployments:** Managed replicas with health checks (`livenessProbe`, `readinessProbe`).
- **Horizontal Pod Autoscaler (`hpa.yaml`):** Automatically scales backend pod replicas from 2 to 10 based on CPU (70%) and Memory (80%) thresholds.
- **Ingress Controller (`ingress.yaml`):** Production NGINX ingress routing with automatic TLS termination and WebSocket upgrade support.
- **ConfigMaps & Secrets (`configmap.yaml`, `secrets.yaml`):** Centralized, secure environment configuration.

### 3. Helm Chart (`helm/intellmeet`)
The entire stack can be deployed to any Kubernetes cluster (EKS, GKE, AKS, Minikube) using the custom Helm chart:

```bash
# Lint the chart
helm lint ./helm/intellmeet

# Deploy IntellMeet to your Kubernetes cluster
helm install intellmeet ./helm/intellmeet -n intellmeet --create-namespace

# Upgrade release with custom values
helm upgrade intellmeet ./helm/intellmeet -f ./helm/intellmeet/values.yaml
```

---

## Observability: Prometheus, Grafana & Sentry

### 1. Real-Time Telemetry with Prometheus
The backend exposes a dedicated, production-grade `/metrics` endpoint using `prom-client`:
- Tracks HTTP request duration histograms, response code distributions, and active socket connections.
- Monitored via Prometheus configuration in `monitoring/prometheus/prometheus.yml`.

### 2. Grafana Visualization
- Pre-provisioned dashboards in `monitoring/grafana/dashboards/intellmeet-overview.json`.
- Visualize real-time RPS, p95/p99 latency, active WebRTC room count, and system memory consumption.
- Launch the complete monitoring stack locally:
  ```bash
  docker compose -f docker-compose.monitoring.yml up -d
  ```
  Access Prometheus at `http://localhost:9090` and Grafana at `http://localhost:3000`.

### 3. Sentry Error Tracking & Crash Analytics
- Configured via `@sentry/node` in `backend/src/config/sentry.js`.
- Intercepts uncaught exceptions, unhandled Promise rejections, and application errors before they impact the user experience.

---

## Project Structure

```text
IntellMeet/
|-- backend/
|   |-- src/controllers/       # Auth, Meeting, AI, Team, and Task controllers
|   |-- src/models/            # Mongoose schemas (User, Meeting, Task, Summary)
|   |-- src/services/          # Gemini 8.5 Flash AI, Cloudinary & transcription logic
|   |-- src/socket/            # WebRTC signaling, live chat & room presence
|   |-- src/config/            # Redis, MongoDB, and Sentry configurations
|   +-- src/app.js             # Express application & Prometheus /metrics route
|-- frontend/
|   |-- src/components/        # Video grid, controls, meeting cards & chat UI
|   |-- src/pages/             # Dashboard, Video Room, Team Workspaces, Kanban Board
|   +-- src/services/          # Axios API clients & Socket.io listeners
|-- k8s/                       # Kubernetes manifests (Deployments, HPA, Ingress, Services)
|-- helm/intellmeet/           # Production Helm chart (Chart.yaml, values.yaml, templates)
|-- monitoring/                # Prometheus & Grafana configuration and dashboards
|-- load-testing/              # JMeter test plan (.jmx), test runner, and HTML reports
|-- security/                  # OWASP Top 10 automated audit scripts and report
|-- docker-compose.yml         # Local container orchestration (App, Mongo, Redis)
|-- docker-compose.prod.yml    # Production multi-container deployment
+-- README.md                  # Project documentation
```

---

## Getting Started Locally

### Prerequisites
- Node.js (v20+ or v24+)
- MongoDB Atlas or local MongoDB instance
- Redis (Local server or cloud instance)
- Google Gemini API Key & Cloudinary account

### 1. Backend Setup
```bash
cd backend
npm install

# Configure environment variables in backend/.env:
# PORT=5100
# MONGO_URI=<your-mongodb-uri>
# REDIS_HOST=localhost
# REDIS_PORT=6379
# JWT_SECRET=<your-jwt-secret>
# GEMINI_API_KEY=<your-gemini-key>
# CLOUDINARY_CLOUD_NAME=<your-cloud-name>
# CLOUDINARY_API_KEY=<your-api-key>
# CLOUDINARY_API_SECRET=<your-api-secret>
# SENTRY_DSN=<optional-sentry-dsn>

npm run dev
```
Backend runs at: `http://localhost:5100`  
Swagger UI at: `http://localhost:5100/api-docs`

### 2. Frontend Setup
```bash
cd frontend
npm install

# Configure frontend/.env:
# VITE_API_URL=http://localhost:5100/api
# VITE_SOCKET_URL=http://localhost:5100

npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## Author & Project Credit

- **Project:** IntellMeet — AI-Powered Video Conferencing & Workspace Platform
- **Developer:** **Momin Mahmmadbha A** ([@mhd-coder-10](https://github.com/mhd-coder-10))
- **Team:** Team 16 (Solo Contributor)
- **Program:** Web Development Domain — Zidio Development

---

## License
This project is licensed under the ISC License.
