# Day 18: Team Workspace and Project Board (Kanban Style)
## Complete Technical Architecture, Data Flow, Integration Guide & Step-by-Step Testing

---

## 📌 1. Feature Overview & Objectives

Day 18 introduces **Enterprise Team Workspaces and Real-Time Collaborative Kanban Boards** to IntellMeet (Roadmap Feature **F-06**).

This module empowers engineering and product teams to organize sprints, deliverables, and action items in one place:
- **Workspaces Directory**: Create multi-tenant team workspaces, generate secure invite codes (`TM-XXXXXX`), and invite colleagues.
- **Role-Based Membership**: `owner`, `admin`, and `member` permissions.
- **Automated Kanban Columns**: Every project board automatically initializes with 4 status columns:
  1. 🔵 **To Do** (`col-todo`)
  2. 🟡 **In Progress** (`col-in-progress`)
  3. 🟣 **In Review** (`col-review`)
  4. 🟢 **Done** (`col-done`)
- **Zero-Bug Cross-Device Experience**:
  - **Desktop**: Native HTML5 Drag-and-Drop between columns with reactive dropzones.
  - **Mobile / Touch Devices**: Dedicated **Mobile Column Selector Pills** and **One-Tap Quick Move Dropdowns** on every card (eliminates awkward touchscreen drag bugs).
  - **Dual Views**: Instant toggle between visual **Kanban Board** and tabular **List View**.
- **Real-Time WebSockets**: Live synchronisation via Socket.io rooms (`project:join`, `task:moved`, `task:created`, `task:updated`, `task:deleted`).
- **Discussion Threads**: In-card commenting and activity logs.

---

## 🏗️ 2. High-Level Architecture & End-to-End Flow

```mermaid
flowchart TD
    subgraph Frontend["Frontend (React 19 + TypeScript + Vite)"]
        UI_List["TeamsList.tsx\n(/teams)"]
        UI_Detail["TeamDetail.tsx\n(/teams/:id)"]
        UI_Board["ProjectBoard.tsx\n(/teams/:teamId/projects/:projectId)"]
        
        S_Team["teamService.ts (Axios)"]
        S_Task["taskService.ts (Axios)"]
        Hook_Socket["useSocket.ts (Socket.io Client)"]
        
        UI_List --> S_Team
        UI_Detail --> S_Team
        UI_Board --> S_Task
        UI_Board <--> Hook_Socket
    end

    subgraph Backend_HTTP["Backend Express Server (:5100)"]
        R_Team["teamRoutes.js\n(/api/teams)"]
        R_Task["taskRoutes.js\n(/api/projects, /api/tasks)"]
        
        Auth_Mid["auth.middleware.js\n(JWT Verification)"]
        
        C_Team["teamController.js"]
        C_Proj["projectController.js"]
        C_Task["taskController.js"]
        
        Srv_Team["teamService.js"]
        Srv_Proj["projectService.js"]
        Srv_Task["taskService.js"]
        Srv_Notif["notificationService.js"]
        
        R_Team --> Auth_Mid --> C_Team --> Srv_Team
        R_Task --> Auth_Mid --> C_Proj --> Srv_Proj
        R_Task --> Auth_Mid --> C_Task --> Srv_Task
        Srv_Task -.-> Srv_Notif
    end

    subgraph Backend_Socket["Real-Time Socket.io (:5100)"]
        Sock_Index["socket/index.js\n(JWT socketAuth)"]
        Sock_Team["teamSocket.js\n(project:join, task:move)"]
        Sock_Index --> Sock_Team
    end

    subgraph Database["MongoDB Database"]
        M_Team[("Team Collection\n(members, code, owner)")]
        M_Proj[("Project Collection\n(columns, status, totalTasks)")]
        M_Task[("Task Collection\n(columnId, priority, comments)")]
        M_Notif[("Notification Collection")]
        
        Srv_Team --> M_Team
        Srv_Proj --> M_Proj
        Srv_Task --> M_Task
        Srv_Notif --> M_Notif
    end

    Hook_Socket <===> Sock_Team
    C_Task -.->|io.to('project:id').emit| Sock_Index
```

---

## 🔄 3. Step-by-Step Code Execution Flow (Request to Response)

### Flow A: Creating a New Task Card
1. **Frontend Trigger**:
   - User clicks **"+ Add Task"** in [ProjectBoard.tsx](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/frontend/src/pages/Teams/ProjectBoard.tsx) or clicks the `+` icon on a column header.
   - Form state collects: `title`, `description`, `columnId` (e.g. `col-todo`), `priority`, `assignee`, `dueDate`, `tags`.
2. **Frontend API Call**:
   - `createTask(projectId, payload)` in [taskService.ts](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/frontend/src/services/taskService.ts) sends `POST /api/projects/:projectId/tasks` with JWT in `Authorization: Bearer <token>`.
3. **Backend Route & Middleware**:
   - Handled by [taskRoutes.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/routes/taskRoutes.js) -> `auth.middleware.js` verifies the JWT and attaches `req.user`.
4. **Backend Controller**:
   - [taskController.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/controllers/taskController.js) invokes `taskService.createTask(projectId, req.user.id, req.body)`.
5. **Backend Service Logic**:
   - [taskService.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/services/taskService.js) verifies project existence and calculates the next `order` position in the target column.
   - Saves new document in [Task.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/models/Task.js).
   - If an `assignee` is specified (and is not the creator), calls `notificationService.createNotification()` to alert the assignee.
   - Returns fully populated task with `assignee` and `creator` fields.
6. **Real-Time Broadcast & Response**:
   - Controller gets Socket.io instance: `io.to('project:' + projectId).emit('task:created', task)`.
   - Sends HTTP `201 Created` with JSON `{ success: true, data: task }`.
   - All other connected users in that project room have their board UI updated immediately without reloading!

---

### Flow B: Moving a Task Card (Drag-and-Drop or Mobile Tap)
1. **User Action**:
   - **Desktop**: User drags card to another column -> `handleDrop(e, targetColId)`.
   - **Mobile**: User taps the quick-action column selector dropdown on the card -> `handleQuickMove(task, targetColId)`.
2. **Optimistic UI Update**:
   - React Query cache is instantly updated in [ProjectBoard.tsx](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/frontend/src/pages/Teams/ProjectBoard.tsx) using `queryClient.setQueryData`, providing 0ms latency visual feedback.
3. **HTTP Persistence**:
   - Calls `moveTask(taskId, { columnId: targetColId })` via [taskService.ts](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/frontend/src/services/taskService.ts) (`PATCH /api/tasks/:id/move`).
4. **Service & DB Update**:
   - [taskService.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/services/taskService.js) maps column ID (`col-done`) to status (`done`) and updates MongoDB.
5. **Socket Sync**:
   - Socket server broadcasts `task:moved` to `project:${projectId}`.
   - Teammates' browsers catch `task:moved` and shift the card to the matching column automatically.

---

## 🗄️ 4. Database Schema Specifications

### 1. `Team` Schema ([Team.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/models/Team.js))
| Field | Type | Description |
|---|---|---|
| `name` | String (Trim, Required) | Workspace name (e.g. "Core Engineering") |
| `description` | String | Purpose or goals of workspace |
| `owner` | ObjectId (`ref: "User"`) | User who created the workspace |
| `code` | String (Unique, Indexed) | Unique invite code (format: `TM-XXXXXX`) |
| `color` | Enum String | Theme color (`indigo`, `blue`, `emerald`, `purple`, `amber`, `rose`) |
| `members` | Array of Objects | `[{ user: ObjectId, role: 'owner'\|'admin'\|'member', joinedAt }]` |
| `createdAt` / `updatedAt` | Date (Timestamps) | Automatic MongoDB timestamps |

### 2. `Project` Schema ([Project.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/models/Project.js))
| Field | Type | Description |
|---|---|---|
| `name` | String (Trim, Required) | Board title (e.g. "Sprint 1", "Bug Tracker") |
| `description` | String | Board scope or sprint deliverables |
| `team` | ObjectId (`ref: "Team"`) | Parent workspace reference |
| `owner` | ObjectId (`ref: "User"`) | Board creator |
| `status` | Enum | `active`, `completed`, `archived` |
| `color` | String | Accent theme color |
| `columns` | Array of Objects | Columns definitions with ID, title, order, and color |

### 3. `Task` Schema ([Task.js](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/models/Task.js))
| Field | Type | Description |
|---|---|---|
| `title` | String (Required) | Task deliverable name |
| `description` | String | Context, acceptance criteria, or details |
| `project` | ObjectId (`ref: "Project"`) | Parent board |
| `team` | ObjectId (`ref: "Team"`) | Parent workspace |
| `columnId` | String (Default: `col-todo`) | Current column (`col-todo`, `col-in-progress`, `col-review`, `col-done`) |
| `status` | Enum | `todo`, `in_progress`, `review`, `done` |
| `priority` | Enum | `low`, `medium`, `high`, `urgent` |
| `assignee` | ObjectId (`ref: "User"`) | Assigned teammate (nullable) |
| `creator` | ObjectId (`ref: "User"`) | Task author |
| `dueDate` | Date | Target completion date |
| `order` | Number | Vertical sorting index within column |
| `tags` | Array of Strings | Tag chips (e.g. `['frontend', 'api']`) |
| `meeting` | ObjectId (`ref: "Meeting"`) | Optional reference to a source meeting |
| `actionItemId` | ObjectId (`ref: "ActionItem"`) | Optional reference to an AI action item |
| `comments` | Array of Objects | `[{ user: ObjectId, text: String, createdAt: Date }]` |

---

## 📡 5. REST API Reference

### Workspace Endpoints (`/api/teams`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/teams` | Authenticated | List all workspaces for logged-in user |
| `POST` | `/api/teams` | Authenticated | Create a new team workspace |
| `GET` | `/api/teams/:id` | Member/Owner | Get team details, members, and boards |
| `PUT` | `/api/teams/:id` | Admin/Owner | Update team metadata |
| `DELETE` | `/api/teams/:id` | Owner | Delete workspace and all associated boards |
| `POST` | `/api/teams/join` | Authenticated | Join workspace via `TM-XXXXXX` code |
| `POST` | `/api/teams/:id/members` | Admin/Owner | Add teammate by email or username |
| `DELETE` | `/api/teams/:id/members/:userId` | Admin/Owner | Remove teammate from workspace |

### Project & Kanban Endpoints (`/api/projects` & `/api/tasks`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/teams/:teamId/projects` | Member | List all boards for a team |
| `POST` | `/api/teams/:teamId/projects` | Member | Create a new project board |
| `GET` | `/api/projects/:id` | Member | Get project board by ID |
| `PUT` | `/api/projects/:id` | Admin/Owner | Update board title/theme/status |
| `DELETE` | `/api/projects/:id` | Admin/Owner | Delete project board and cards |
| `GET` | `/api/projects/:projectId/tasks` | Member | Get all task cards for a board |
| `POST` | `/api/projects/:projectId/tasks` | Member | Create new task card on board |
| `PATCH` | `/api/tasks/:id/move` | Member | Move task between columns |
| `PUT` | `/api/tasks/:id` | Member | Update task title, desc, assignee, priority |
| `DELETE` | `/api/tasks/:id` | Member | Delete task card |
| `POST` | `/api/tasks/:id/comments` | Member | Add comment to discussion thread |

---

## 🔗 6. Meetings vs Workspace Dependency Analysis (Clarification)

> [!NOTE]
> **Question Answered**: *Are Meeting Details (Recording, Transcript, Summary) and Team Workspaces dependent on each other? Can users use Workspaces without meetings?*

### 1. Completely Autonomous & Independently Usable
- **Yes, Team Workspaces & Kanban Boards work 100% without ever hosting a meeting.**
- A user can log in, create a workspace, invite their team, create project boards, assign tasks, write comments, and track sprints just like **Trello** or **Jira**.
- No meeting ID is required to create a workspace, project, or task card.

### 2. Built With Seamless Interoperability (Future-Ready)
- While independent, the data models are **interconnected**:
  - The `Task` schema contains optional `meeting` and `actionItemId` fields.
  - This allows future workflows where an action item generated from an AI Meeting Summary (Day 16) can be promoted into a full Kanban board card in 1 click!

---

## 📱 7. Responsive & Mobile-First Design Strategies

To guarantee zero visual or interaction bugs on mobile:
1. **Mobile Column Selector Pills**:
   - Rather than forcing mobile users to swipe horizontally across 4 squeezed columns, the top of the mobile screen presents compact column filter pills: `All Columns`, `To Do (3)`, `In Progress (2)`, `Review (1)`, `Done (4)`.
   - Tapping any pill expands that specific column to full width.
2. **One-Tap Quick Move Dropdowns**:
   - HTML5 drag-and-drop can fail on mobile touchscreens without specialized touch polyfills.
   - Every card has a quick move dropdown selector right on its header, allowing mobile users to move cards between columns in a single tap without fighting touch drag limitations.
3. **List View Fallback**:
   - Users can toggle between **Board View** and **List View** with one click.
4. **Header Navigation Integration**:
   - Visible on desktop navbar and mobile drawer menu via the `Users` icon.
   - Dashboard features grid includes a dedicated **Workspaces & Boards** card.

---

## 🧪 8. Step-by-Step Testing & Verification Guide

Follow these steps in your browser ([http://localhost:5173](http://localhost:5173)) to test the entire Day 18 implementation:

### Step 1: Navigate to Workspaces
1. Open [http://localhost:5173/dashboard](http://localhost:5173/dashboard).
2. Verify that the **"Teams & Boards"** link is present in the top Header navigation.
3. In the feature cards grid, verify the new **"Workspaces & Boards"** card.
4. Click either link to navigate to `/teams`.

### Step 2: Create a Workspace
1. On the `/teams` page, click **"+ Create Workspace"**.
2. Enter:
   - **Name**: `Product Engineering`
   - **Description**: `Main sprint workspace for IntellMeet development`
   - **Theme Accent**: Select `Indigo` or `Emerald`.
3. Click **"Create Workspace"**.
4. Verify success toast notification and instant redirection to `/teams/:id`.

### Step 3: Test Invite Code & Teammates
1. On the workspace page (`/teams/:id`), verify the **Team Invite Code** card (e.g. `TM-123456`).
2. Click **"Copy Code"** and ensure the checkmark appears and code is copied to clipboard.
3. Click **"Teammates"** tab:
   - Click **"+ Add Teammate"**.
   - Enter another user's email or username (e.g. `testuser@example.com`).
   - Select role (`Member` or `Admin`) and click **"Add to Team"**.
   - Verify the member appears in the directory with role badge.

### Step 4: Create a Kanban Project Board
1. In the workspace, click the **"Project Boards"** tab.
2. Click **"+ New Project Board"**.
3. Enter:
   - **Board Name**: `Sprint 1 - MVP Release`
   - **Description**: `Deliverables for v1.0`
   - **Theme Accent**: `Blue`
4. Click **"Create Board"**.
5. Verify redirection to `/teams/:teamId/projects/:projectId`.

### Step 5: Create Task Cards
1. Click **"+ Add Task"** in the top bar, or click `+` on the **To Do** column header.
2. Fill out:
   - **Title**: `Implement Responsive Kanban Layout`
   - **Description**: `Ensure columns adapt gracefully to mobile and desktop screens.`
   - **Priority**: `High`
   - **Assignee**: Select a team member from the dropdown.
   - **Due Date**: Select tomorrow's date.
   - **Tags**: `frontend, ui, responsive`
3. Click **"Create Task"**.
4. Verify the card appears in the **To Do** column with the orange High priority badge, due date, tags chips, and assignee avatar.

### Step 6: Test Drag-and-Drop & Mobile Move
1. **Desktop Test**: Click and drag the card from **To Do** into **In Progress**.
   - Verify column border glows during drag-over.
   - Verify card drops smoothly into **In Progress** and column counters update.
2. **Mobile Quick-Move Test**:
   - On the card header, click the column dropdown selector.
   - Change column to **Done**.
   - Verify the card moves to **Done** instantly.

### Step 7: Test Task Details & Comments Thread
1. Click on the card body to open the **Task Detail Modal**.
2. Verify you can edit the title, description, priority, or column directly.
3. In the **Discussion & Updates** section at the bottom:
   - Type a comment: `Ready for QA review.`
   - Click **"Send"**.
   - Verify the comment appears with your user initial avatar and timestamp.
4. Close the modal and verify the card shows `💬 1` comment icon.

### Step 8: Test List View & Filters
1. In the top bar, click the **"List"** view button.
   - Verify cards display in a clean, scrollable table format.
   - Switch back to **"Board"** view.
2. In the filter bar:
   - Filter by Priority: Select `High` -> verify only high priority cards display.
   - Filter by Assignee: Select `Assigned to Me` -> verify filtering works.
   - Clear filters -> verify all cards return.

### Step 9: Test Multi-User Real-Time Sync (Optional)
1. Open an incognito browser window or second browser tab.
2. Log in with a second user account and join the workspace using the `TM-XXXXXX` code.
3. Open the same project board in both windows side-by-side.
4. Move a card in Window 1 -> verify Window 2 updates in real time without refreshing!
