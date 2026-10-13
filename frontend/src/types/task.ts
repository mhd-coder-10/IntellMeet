// Kanban Task Card TypeScript Definitions

import type { TeamMemberUser } from "./team";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export interface TaskComment {
  _id: string;
  user: TeamMemberUser;
  text: string;
  createdAt: string;
}

export interface KanbanTask {
  _id: string;
  title: string;
  description?: string;
  project: string;
  team: string;
  columnId: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: TeamMemberUser | null;
  creator: TeamMemberUser;
  dueDate?: string | null;
  order: number;
  tags?: string[];
  meeting?: string | null;
  actionItemId?: string | null;
  comments?: TaskComment[];
  updateCount?: number;
  createdAt: string;
  updatedAt: string;
}
