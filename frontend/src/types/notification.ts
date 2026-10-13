// Notification Types

export type NotificationType =
  | "meeting_invite"
  | "meeting_started"
  | "meeting_ended"
  | "meeting_updated"
  | "chat_mention"
  | "action_item"
  | "system"
  | "task_assigned"
  | "task_status"
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "task_comment"
  | "task_due"
  | "team_updated"
  | "project_updated";

export interface NotificationSender {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

export interface AppNotification {
  _id: string;
  recipient: string;
  sender?: NotificationSender | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}
