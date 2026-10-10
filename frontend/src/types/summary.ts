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
  createdAt: string;
  updatedAt: string;
}

export interface MeetingActionItem {
  _id: string;
  meeting: string;
  summary?: string;
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
  task: string;
  assignee?: string | null;
  assigneeName?: string;
  priority?: ActionItemPriority;
  dueDate?: string | null;
}
