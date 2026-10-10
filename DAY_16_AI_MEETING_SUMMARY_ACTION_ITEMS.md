# Day 16: AI Meeting Summary & Smart Action Item Extraction

## 📌 Feature Overview
Day 16 introduces automated AI-driven post-meeting intelligence to IntellMeet. Using the verified audio transcription from Day 15, the platform automatically generates concise executive recaps, key discussion points, agreed-upon decisions, and actionable task deliverables with assigned team members and priorities.

---

## 🏗️ Architecture & Component Flow

```
[Meeting Audio / Transcript (Day 15)]
              │
              ▼
[summaryService.js (AI Engine)]
  ├── Executive Overview (2-4 sentences)
  ├── Key Discussion Highlights (bullet points)
  ├── Agreed Decisions & Outcomes (checkmarked conclusions)
  └── Smart Action Items Extraction (tasks + assignees + priority)
              │
              ├──► MongoDB: Summary Collection
              └──► MongoDB: ActionItem Collection
                        │
                        ▼
[REST APIs (/api/v1/ai/meetings/:id/summary)]
                        │
                        ▼
[Frontend: SummaryAndActionItemsCard.tsx]
  ├── Interactive Checklist (toggle completed / pending)
  ├── Priority Badges (Urgent / High / Medium / Low)
  ├── Assignee Badges with attendee linking
  ├── Copy & File Export (.txt / .md)
  └── Manual Task Creation
```

---

## 🗄️ Database Schemas

### 1. `Summary` Model (`backend/src/models/Summary.js`)
- `meeting`: ObjectId (ref: "Meeting", required, indexed)
- `overview`: String (executive overview prose)
- `keyPoints`: Array of Strings (bullet points)
- `decisions`: Array of Strings (conclusions reached)
- `sentiment`: Enum (`productive`, `positive`, `neutral`, `constructive`, `urgent`)
- `status`: Enum (`pending`, `processing`, `completed`, `failed`)
- `provider`: String (`ai-intelligence`)
- `wordCount`: Number
- `sourceTextLength`: Number
- `generatedBy`: ObjectId (ref: "User")
- Timestamps

### 2. `ActionItem` Model (`backend/src/models/ActionItem.js`)
- `meeting`: ObjectId (ref: "Meeting", required, indexed)
- `summary`: ObjectId (ref: "Summary")
- `task`: String (action description)
- `assignee`: ObjectId (ref: "User", matched from attendees)
- `assigneeName`: String (e.g. "Member 1", "Team")
- `priority`: Enum (`low`, `medium`, `high`, `urgent`)
- `status`: Enum (`pending`, `in_progress`, `completed`, `cancelled`)
- `dueDate`: Date
- `dueDateText`: String (e.g. "By end of week", "Tomorrow", "TBD")
- `completedAt`: Date
- `completedBy`: ObjectId (ref: "User")
- `isAiGenerated`: Boolean
- Timestamps

---

## 🚀 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai/meetings/:id/summary/generate` | Generate or regenerate AI summary & action items |
| `GET` | `/api/v1/ai/meetings/:id/summary` | Fetch meeting summary & action items |
| `DELETE` | `/api/v1/ai/meetings/:id/summary` | Delete summary and action items |
| `GET` | `/api/v1/ai/meetings/:id/summary/export` | Download summary as `.txt` or `.md` |
| `PATCH` | `/api/v1/ai/action-items/:id/toggle` | Toggle action item status (pending <-> completed) |
| `POST` | `/api/v1/ai/meetings/:id/action-items` | Manually add a custom action item |
| `PUT` | `/api/v1/ai/action-items/:id` | Update action item details |
| `DELETE` | `/api/v1/ai/action-items/:id` | Delete an action item |

---

## 🎨 Frontend Features & Design
- Integrated into `MeetingDetails.tsx` with full `max-w-[1440px]` alignment matching Header, Dashboard, and Meetings list.
- Generic enterprise branding (`AI Intelligence`) without third-party tool/model name leaks.
- Interactive checklist with strikethrough styling and live completion metrics (e.g., `1/1 done • 100%`).
- Add Task inline modal with attendee selection dropdown.
- One-click Copy to clipboard and Download (`.txt` / `.md`).
