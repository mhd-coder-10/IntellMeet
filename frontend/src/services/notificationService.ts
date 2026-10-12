// Notification API Service

import api from "./api";
import type { AppNotification, NotificationListResponse } from "@/types/notification";

// Get user notifications with unread count
export const getNotifications = async (limit = 40): Promise<NotificationListResponse> => {
  const res = await api.get<{ success: boolean; data: NotificationListResponse }>(
    `/notifications?limit=${limit}`
  );
  return res.data.data;
};

// Mark single notification as read
export const markNotificationAsRead = async (
  notificationId: string
): Promise<AppNotification> => {
  const res = await api.put<{ success: boolean; data: { notification: AppNotification } }>(
    `/notifications/${notificationId}/read`
  );
  return res.data.data.notification;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.put<{ success: boolean; message: string }>("/notifications/read-all");
};

// Delete single notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
  await api.delete<{ success: boolean; message: string }>(
    `/notifications/${notificationId}`
  );
};

// Clear all notifications
export const clearAllNotifications = async (): Promise<void> => {
  await api.delete<{ success: boolean; message: string }>("/notifications/clear-all");
};
