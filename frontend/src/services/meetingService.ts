// Handles all meeting API calls
// Uses centralized axios instance with JWT interceptor

import api from './api'
import type { Meeting, CreateMeetingPayload } from '@/types/meeting'

export const createMeeting = async (payload: CreateMeetingPayload): Promise<Meeting> => {
    const response = await api.post('/meetings', payload)
    return response.data.data.meeting
}

export const getMyMeetings = async (): Promise<Meeting[]> => {
    const response = await api.get('/meetings')
    return response.data.data.meetings
}

export const hideMeeting = async (id: string): Promise<void> => {
    await api.delete(`/meetings/${id}/hide`)
}

export const getMeetingById = async (id: string): Promise<Meeting> => {
    const response = await api.get(`/meetings/${id}`)
    return response.data.data.meeting
}

export const getMeetingByCode = async (code: string): Promise<Meeting> => {
    const response = await api.get(`/meetings/code/${code}`)
    return response.data.data.meeting
}

export const joinMeeting = async (id: string): Promise<Meeting> => {
    const response = await api.post(`/meetings/${id}/join`)
    return response.data.data.meeting
}

export const leaveMeeting = async (id: string): Promise<void> => {
    await api.post(`/meetings/${id}/leave`)
}

export const startMeeting = async (id: string): Promise<Meeting> => {
    const response = await api.post(`/meetings/${id}/start`)
    return response.data.data.meeting
}

export const endMeeting = async (id: string): Promise<Meeting> => {
    const response = await api.post(`/meetings/${id}/end`)
    return response.data.data.meeting
}

export const deleteMeeting = async (id: string): Promise<void> => {
    await api.delete(`/meetings/${id}`)
}

export const uploadMeetingRecording = async (
    id: string,
    blobOrFormData: Blob | FormData | { recordingUrl: string },
    metadata?: { title?: string; duration?: number; size?: number }
): Promise<{ meeting: Meeting; recordingUrl: string }> => {
    let payload: FormData | { recordingUrl: string };

    if (blobOrFormData instanceof Blob) {
        const fd = new FormData();
        fd.append("recording", blobOrFormData, `recording-${id}-${Date.now()}.webm`);
        if (metadata?.title) fd.append("title", metadata.title);
        if (metadata?.duration !== undefined) fd.append("duration", metadata.duration.toString());
        if (metadata?.size !== undefined) fd.append("size", metadata.size.toString());
        payload = fd;
    } else {
        payload = blobOrFormData;
    }

    const response = await api.post(`/meetings/${id}/recording`, payload, {
        headers: payload instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined,
    });
    return response.data.data;
};