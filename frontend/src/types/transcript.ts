// Types for AI Meeting Transcription
// Used across services, components and meeting details

export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerId?: string | null;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  confidence?: number;
}

export interface MeetingTranscript {
  _id: string;
  meeting: string;
  recordingIndex: number;
  recordingUrl: string;
  status: "pending" | "processing" | "completed" | "failed";
  provider: string;
  language: string;
  duration: number; // seconds
  wordCount: number;
  fullText: string;
  segments: TranscriptSegment[];
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateTranscriptPayload {
  recordingIndex?: number;
  provider?: string;
  forceRegenerate?: boolean;
}
