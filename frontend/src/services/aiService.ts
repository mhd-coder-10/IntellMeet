// Handles AI Transcription, Summary & Intelligence API calls (Day 15 & Day 16)
// Uses centralized axios client with JWT authentication
// All AI endpoints are cleanly mounted under /api/ai

import api from "./api";
import type { MeetingTranscript, GenerateTranscriptPayload } from "@/types/transcript";
import type {
  MeetingSummaryResponse,
  GenerateSummaryPayload,
  CreateActionItemPayload,
  MeetingActionItem,
} from "@/types/summary";

/**
 * Fetch transcript for a meeting
 */
export const getMeetingTranscript = async (
  meetingId: string,
  recordingIndex: number = 0
): Promise<MeetingTranscript | null> => {
  try {
    const response = await api.get(`/ai/meetings/${meetingId}/transcript`, {
      params: { recordingIndex },
    });
    return response.data.data?.transcript || null;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

/**
 * Trigger AI transcript generation for a meeting
 */
export const generateMeetingTranscript = async (
  meetingId: string,
  payload: GenerateTranscriptPayload = {}
): Promise<MeetingTranscript> => {
  const response = await api.post(`/ai/meetings/${meetingId}/transcript/generate`, payload);
  return response.data.data.transcript;
};

/**
 * Update transcript segments or text (manual correction)
 */
export const updateMeetingTranscript = async (
  meetingId: string,
  updates: { segments?: any[]; fullText?: string }
): Promise<MeetingTranscript> => {
  const response = await api.put(`/ai/meetings/${meetingId}/transcript`, updates);
  return response.data.data.transcript;
};

/**
 * Delete transcript
 */
export const deleteMeetingTranscript = async (meetingId: string): Promise<void> => {
  await api.delete(`/ai/meetings/${meetingId}/transcript`);
};

/**
 * Download transcript as file (.txt, .vtt, .json)
 */
export const downloadMeetingTranscript = async (
  meetingId: string,
  format: "txt" | "vtt" | "json" = "txt",
  defaultFileName: string = "meeting-transcript"
): Promise<void> => {
  const response = await api.get(`/ai/meetings/${meetingId}/transcript/export`, {
    params: { format },
    responseType: "blob",
  });

  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${defaultFileName}.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Fetch AI summary and action items for a meeting
 */
export const getMeetingSummary = async (
  meetingId: string
): Promise<MeetingSummaryResponse> => {
  try {
    const response = await api.get(`/ai/meetings/${meetingId}/summary`);
    return response.data.data || { summary: null, actionItems: [] };
  } catch (err: any) {
    if (err.response?.status === 404) {
      return { summary: null, actionItems: [] };
    }
    throw err;
  }
};

/**
 * Trigger AI summary and action item generation for a meeting
 */
export const generateMeetingSummary = async (
  meetingId: string,
  payload: GenerateSummaryPayload = {}
): Promise<MeetingSummaryResponse> => {
  const response = await api.post(`/ai/meetings/${meetingId}/summary/generate`, payload);
  return response.data.data;
};

/**
 * Delete meeting summary and action items
 */
export const deleteMeetingSummary = async (meetingId: string): Promise<void> => {
  await api.delete(`/ai/meetings/${meetingId}/summary`);
};

/**
 * Download meeting summary (.txt or .md)
 */
export const downloadMeetingSummary = async (
  meetingId: string,
  format: "txt" | "md" = "txt",
  defaultFileName: string = "meeting-summary"
): Promise<void> => {
  const response = await api.get(`/ai/meetings/${meetingId}/summary/export`, {
    params: { format },
    responseType: "blob",
  });

  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${defaultFileName}.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Toggle action item status (pending <-> completed)
 */
export const toggleActionItemStatus = async (
  actionItemId: string
): Promise<MeetingActionItem> => {
  const response = await api.patch(`/ai/action-items/${actionItemId}/toggle`);
  return response.data.data.actionItem;
};

/**
 * Create a manual action item for a meeting
 */
export const createMeetingActionItem = async (
  meetingId: string,
  payload: CreateActionItemPayload
): Promise<MeetingActionItem> => {
  const response = await api.post(`/ai/meetings/${meetingId}/action-items`, payload);
  return response.data.data.actionItem;
};

/**
 * Update an action item (task, assignee, priority, dueDate)
 */
export const updateMeetingActionItem = async (
  actionItemId: string,
  payload: Partial<CreateActionItemPayload>
): Promise<MeetingActionItem> => {
  const response = await api.put(`/ai/action-items/${actionItemId}`, payload);
  return response.data.data.actionItem;
};

/**
 * Delete an action item
 */
export const deleteMeetingActionItem = async (
  actionItemId: string
): Promise<void> => {
  await api.delete(`/ai/action-items/${actionItemId}`);
};
