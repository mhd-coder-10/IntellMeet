// Defines meeting related TypeScript types
// Used across services, stores and components

export interface MeetingParticipant {
    _id: string
    name: string
    username: string
    profilePicture?: string
}

export interface Meeting {
    _id: string
    title: string
    description?: string
    host: MeetingParticipant
    participants: MeetingParticipant[]
    meetingCode: string
    scheduledAt: string
    startedAt?: string | null
    endedAt?: string | null
    recordingUrl?: string
    isRecording?: boolean
    recordingDeletedByHost?: boolean
    isHostDeleted?: boolean
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
    settings: {
        allowChat: boolean
        allowScreenShare: boolean
        muteOnJoin: boolean
        waitingRoom: boolean
    }
    createdAt: string
    updatedAt: string
}

export interface CreateMeetingPayload {
    title: string
    description?: string
    scheduledAt?: string
}

export interface VideoPeer {
    userId: string
    name: string
    username: string
    profilePicture?: string
    stream?: MediaStream
    isMuted: boolean
    isVideoOn: boolean
}