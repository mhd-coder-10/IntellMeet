// Defines meeting related TypeScript types
// Used across services, stores and components

export interface MeetingParticipant {
    _id: string
    name: string
    username: string
    profilePicture?: string
}

export interface MeetingRecordingItem {
    _id?: string
    url: string
    title: string
    duration?: number
    size?: number
    createdAt?: string
}

export interface Meeting {
    _id: string
    title: string
    description?: string
    host: MeetingParticipant
    participants: MeetingParticipant[]
    workspace?: {
        _id: string;
        name: string;
        code?: string;
        color?: string;
        description?: string;
    } | null;
    project?: {
        _id: string;
        name: string;
        color?: string;
        description?: string;
    } | null;
    meetingCode?: string;
    scheduledAt: string;
    startTime?: string;
    endTime?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    recordingUrl?: string;
    recordings?: MeetingRecordingItem[];
    isRecording?: boolean;
    recordingStartedAt?: string | number | null;
    recordingUserId?: string | null;
    recordingDeletedByHost?: boolean;
    isHostDeleted?: boolean;
    wasAttended?: boolean;
    attendedUserIds?: string[];
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'expired';
    settings: {
        allowScreenShare: boolean;
        muteOnJoin: boolean;
        waitingRoom: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface CreateMeetingPayload {
    title: string;
    workspace: string;
    project?: string | null;
    participants: string[];
    description?: string;
    scheduledAt?: string;
    startTime?: string;
    endTime?: string | null;
    settings?: {
        allowChat?: boolean;
        allowScreenShare?: boolean;
        muteOnJoin?: boolean;
        waitingRoom?: boolean;
    };
}

export interface UpdateMeetingPayload {
    title?: string;
    workspace?: string;
    project?: string | null;
    participants?: string[];
    description?: string;
    scheduledAt?: string;
    startTime?: string;
    endTime?: string | null;
    settings?: {
        allowChat?: boolean;
        allowScreenShare?: boolean;
        muteOnJoin?: boolean;
        waitingRoom?: boolean;
    };
}

export interface MeetingAnalyticsItem {
    _id: string;
    title: string;
    description?: string;
    status: string;
    participationStatus: "present" | "absent" | "hosted" | "cancelled" | "expired" | "scheduled";
    userDurationSeconds: number;
    startTime: string;
    endTime?: string;
    startedAt?: string;
    endedAt?: string;
    isHost: boolean;
    isAccessible: boolean;
    monthName: string;
    monthKey: string;
    host?: any;
    participants?: any[];
    workspace?: any;
    project?: any;
}

export interface MeetingAnalytics {
    totalMeetingsHosted: number;
    totalMeetingsJoined: number;
    totalTimeSpentSeconds: number;
    totalTimeSpentMinutes: number;
    totalTimeSpentHours: number;
    attendancePercentage: number;
    sessionsAttended: number;
    totalSessions: number;
    upcomingCount: number;
    pastCount: number;
    monthlyBreakdown: { month: string; monthKey?: string; count: number; seconds?: number; hours: number }[];
    meetings?: MeetingAnalyticsItem[];
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