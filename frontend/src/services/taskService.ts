// Kanban Task API Service

import api from "./api";
import type { KanbanTask, TaskPriority } from "@/types/task";

// Get all tasks for a project board
export const getTasksByProject = async (projectId: string): Promise<KanbanTask[]> => {
  const res = await api.get<{ success: boolean; data: KanbanTask[] }>(
    `/projects/${projectId}/tasks`
  );
  return res.data.data;
};

// Create a new task card
export const createTask = async (
  projectId: string,
  data: {
    title: string;
    description?: string;
    columnId?: string;
    priority?: TaskPriority;
    assignee?: string | null;
    dueDate?: string | null;
    tags?: string[];
    meeting?: string | null;
  }
): Promise<KanbanTask> => {
  const res = await api.post<{ success: boolean; data: KanbanTask }>(
    `/projects/${projectId}/tasks`,
    data
  );
  return res.data.data;
};

// Move a task card between Kanban columns
export const moveTask = async (
  taskId: string,
  data: { columnId: string; newOrder?: number }
): Promise<KanbanTask> => {
  const res = await api.patch<{ success: boolean; data: KanbanTask }>(
    `/tasks/${taskId}/move`,
    data
  );
  return res.data.data;
};

// Update task details
export const updateTask = async (
  taskId: string,
  data: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    columnId?: string;
    status?: string;
    assignee?: string | null;
    dueDate?: string | null;
    tags?: string[];
  }
): Promise<KanbanTask> => {
  const res = await api.put<{ success: boolean; data: KanbanTask }>(
    `/tasks/${taskId}`,
    data
  );
  return res.data.data;
};

// Delete a task card
export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};

// Add comment to task
export const addTaskComment = async (
  taskId: string,
  text: string
): Promise<KanbanTask> => {
  const res = await api.post<{ success: boolean; data: KanbanTask }>(
    `/tasks/${taskId}/comments`,
    { text }
  );
  return res.data.data;
};
