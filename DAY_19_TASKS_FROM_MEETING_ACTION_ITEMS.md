# Day 19: Task Creation from Meeting Action Items with Assignee Selection

## 📌 Feature Overview
Day 19 seamlessly bridges post-meeting AI intelligence (Day 16) with collaborative Kanban Project Boards (Day 18). Users can now directly convert meeting action items into trackable Kanban task cards on any of their active workspace boards with custom assignee selection, column targeting, priority overrides, and real-time socket updates.

---

## 🏗️ Architecture & Component Flow

```
[Meeting Action Item (Day 16)]
            │
            ▼ Click "Convert to Task"
[Convert to Task Modal (SummaryAndActionItemsCard.tsx)]
  ├── Select Workspace (User's active teams from /api/teams)
  ├── Select Project Board (Projects from /api/teams/:id/projects)
  ├── Select Kanban Column (To Do, In Progress, Review, Done)
  ├── Select Assignee (Team members with auto-matching from meeting attendees)
  ├── Priority & Due Date (Pre-filled from action item)
  └── Tags Input (Default: ["Meeting", "ActionItem"])
            │
            ▼ POST /api/ai/action-items/:id/convert-to-task
[actionItemService.js (Backend Engine)]
  ├── 1. Validates user active membership in selected workspace
  ├── 2. Calculates highest order for target Kanban column
  ├── 3. Creates Task document linked to meeting & action item
  ├── 4. Updates ActionItem (isConverted: true, convertedTask, convertedProject, convertedTeam)
  ├── 5. Sends real-time notification to assignee
  └── 6. Emits socket events:
           ├── io.to('project:id').emit('task:created', task)
           └── io.to('team:id').emit('team:updated', { _id: teamId })
            │
            ▼
[Frontend Live State]
  ├── Action Item shows "Board: [Board Name] ↗" deep-link badge
  ├── Direct navigation to /teams/:teamId/projects/:projectId
  └── Kanban Board instantly renders the new task card
```

---

## 🗄️ Database Schemas & Updates

### 1. `ActionItem` Model (`backend/src/models/ActionItem.js`)
Added conversion tracking fields:
- `isConverted`: Boolean (default: `false`, indexed)
- `convertedTask`: ObjectId (ref: `"Task"`, default: `null`)
- `convertedProject`: ObjectId (ref: `"Project"`, default: `null`)
- `convertedTeam`: ObjectId (ref: `"Team"`, default: `null`)
- `convertedAt`: Date (default: `null`)

### 2. `Task` Model (`backend/src/models/Task.js`)
Pre-linked schema references:
- `meeting`: ObjectId (ref: `"Meeting"`, indexed)
- `actionItemId`: ObjectId (ref: `"ActionItem"`, indexed)

---

## 🚀 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/action-items/:id/convert-to-task` | Converts an action item into a Kanban task card on target project board |
| `GET` | `/api/teams` | Fetches active workspaces available for task assignment |
| `GET` | `/api/teams/:teamId/projects` | Fetches project boards for selected workspace |

### Request Payload (`POST /api/ai/action-items/:id/convert-to-task`):
```json
{
  "teamId": "6acc77e2eeb961afd5e62e33",
  "projectId": "6acc88f3eeb961afd5e62e44",
  "columnId": "col-todo",
  "title": "Fix login authentication timeout",
  "description": "Generated from meeting action item",
  "priority": "high",
  "assignee": "6acc11a1eeb961afd5e62e11",
  "dueDate": "2026-10-20T00:00:00.000Z",
  "tags": ["Meeting", "ActionItem", "Bug"]
}
```

---

## 🎨 Frontend Features & Design
1. **Interactive Badge & Conversion Button**:
   - Unconverted action items display a **`Convert to Task`** button with purple styling.
   - Converted action items display a clickable **`Board: [Project Name] ↗`** badge that deep-links directly to the Kanban board.
2. **Convert Action Item Modal**:
   - Workspace dropdown filtering only user's active workspaces.
   - Dynamic Project Board dropdown that re-loads based on selected workspace.
   - Dynamic Assignee dropdown with member names and emails, pre-selecting matching meeting attendees.
   - Column selector defaulting to `To Do` (`col-todo`).
   - Priority and Due Date pre-populated from AI extraction.
3. **Resilience & Cleanup**:
   - If a Kanban task is deleted from the board, its associated action item automatically resets its `isConverted` state so it can be re-converted if needed.

---

## 🚀 Advanced Enhancements (Day 19+)

### 1. Task Creator Edit Permission & Project-Scoped Notifications
- **Creator Permission**: Task creators can edit their own card details, even if not the current assignee or workspace owner, by normalizing `currentUser.id` and `currentUser._id`.
- **Project-Scoped Notifications**: When task details are updated or column status is changed, notifications are sent **only** to users directly involved in the project board (project owner, task creator, task assignee, and active task assignees in that board), completely avoiding notification spam across the entire workspace.

### 2. 2-Way Synchronization & Update Counter Badge
- **Bi-Directional Sync**:
  - Updating an action item in **Meeting Summary** (title, priority, due date, status, assignee) automatically updates the linked **Kanban Task** on the project board and emits real-time Socket.io events.
  - Updating a Kanban task (moving column, editing title, priority, due date, assignee) automatically synchronizes back to the linked **Meeting Action Item**.
- **Revision Counter Badge**:
  - Whenever a card is edited, an `updateCount` counter increments.
  - A green badge displaying `Updated` (for 1 edit) or `Updated {N}x` (e.g., `Updated 2x`) is displayed on both the Meeting Action Item and the Kanban Task (card view, list view, and detail modal).

### 3. Due Date Reminder Notifications
- **Automated Scanning**: Periodic background scanner (`checkDueTasksAndNotify`) runs on startup and every 30 minutes.
- **Daily Reminders**: Dispatches a `task_due` notification to the assigned user for tasks that are due today or overdue (and not marked `done`).
- **Spam Prevention**: Uses `lastDueReminderSentAt` to ensure assignees receive at most one reminder per task per day.

