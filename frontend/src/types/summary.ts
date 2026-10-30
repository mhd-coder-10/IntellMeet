// Types for AI Meeting Summary & Smart Action Items (Day 16)
// Used across services, components and meeting details

export type ActionItemPriority = "low" | "medium" | "high" | "urgent";
export type ActionItemStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type SummarySentiment = "productive" | "positive" | "neutral" | "constructive" | "urgent";

export interface MeetingSummary {
  _id: string;
  meeting: string;
  overview: string;
  keyPoints: string[];
  decisions: string[];
  sentiment: SummarySentiment;
  hasSpokenContent?: boolean;
  contentNotice?: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  provider: string;
  wordCount: number;
  sourceTextLength?: number;
  generatedBy?: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  } | null;
  error?: string | null;
  isTrusted?: boolean;
  trustedBy?: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  } | null;
  trustedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingActionItem {
  _id: string;
  meeting: string;
  summary?: string;
  title?: string;
  task: string;
  assignee?: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  } | null;
  assigneeName: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  dueDate?: string | null;
  dueDateText?: string;
  completedAt?: string | null;
  isAiGenerated: boolean;
  isConverted?: boolean;
  convertedTask?: {
    _id: string;
    title: string;
    status?: string;
    columnId?: string;
  } | string | null;
  convertedProject?: {
    _id: string;
    name: string;
    color?: string;
  } | string | null;
  convertedTeam?: {
    _id: string;
    name: string;
    color?: string;
  } | string | null;
  convertedAt?: string | null;
  isWorkspaceTaskDeleted?: boolean;
  updateCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSummaryResponse {
  summary: MeetingSummary | null;
  actionItems: MeetingActionItem[];
}

export interface GenerateSummaryPayload {
  forceRegenerate?: boolean;
}

export interface CreateActionItemPayload {
  title?: string;
  task: string;
  assignee?: string | null;
  assigneeName?: string;
  priority?: ActionItemPriority;
  dueDate?: string | null;
}
