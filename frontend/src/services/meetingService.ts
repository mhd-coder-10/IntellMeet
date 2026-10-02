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