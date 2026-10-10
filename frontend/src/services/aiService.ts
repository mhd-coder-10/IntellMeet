// Handles AI Transcription and Intelligence API calls
// Uses centralized axios client with JWT authentication

import api from "./api";
import type { MeetingTranscript, GenerateTranscriptPayload } from "@/types/transcript";

/**
 * Fetch transcript for a meeting
 */
export const getMeetingTranscript = async (
  meetingId: string,
  recordingIndex: number = 0
): Promise<MeetingTranscript | null> => {
  try {
    const response = await api.get(`/meetings/${meetingId}/transcript`, {
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
  const response = await api.post(`/meetings/${meetingId}/transcript/generate`, payload);
  return response.data.data.transcript;
};

/**
 * Update transcript segments or text (manual correction)
 */
export const updateMeetingTranscript = async (
  meetingId: string,
  updates: { segments?: any[]; fullText?: string }
): Promise<MeetingTranscript> => {
  const response = await api.put(`/meetings/${meetingId}/transcript`, updates);
  return response.data.data.transcript;
};

/**
 * Delete transcript
 */
export const deleteMeetingTranscript = async (meetingId: string): Promise<void> => {
  await api.delete(`/meetings/${meetingId}/transcript`);
};

/**
 * Download transcript as file (.txt, .vtt, .json)
 */
export const downloadMeetingTranscript = async (
  meetingId: string,
  format: "txt" | "vtt" | "json" = "txt",
  defaultFileName: string = "meeting-transcript"
): Promise<void> => {
  const response = await api.get(`/meetings/${meetingId}/transcript/export`, {
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
