
// Zustand store for current active meeting state
// Holds local stream, peers, connection status and media flags

import { create } from "zustand";
import type { VideoPeer } from "@/types/meeting";

interface MeetingState {
    currentMeetingId: string | null;
    localStream: MediaStream | null;
    peers: VideoPeer[];
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isRecording: boolean;
    recordingUserId: string | null;
    recordingUserName: string | null;
    recordingStartTime: number | null;
    screenSharingUserId: string | null;
    setCurrentMeetingId: (id: string | null) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setPeers: (peers: VideoPeer[]) => void;
    addPeer: (peer: VideoPeer) => void;
    updatePeer: (userId: string, updates: Partial<VideoPeer>) => void;
    removePeer: (userId: string) => void;
    setIsMuted: (val: boolean) => void;
    setIsVideoOn: (val: boolean) => void;
    setIsScreenSharing: (val: boolean) => void;
    setIsRecording: (val: boolean) => void;
    setRecordingState: (
        isRecording: boolean,
        recordingUserId?: string | null,
        recordingUserName?: string | null,
        recordingStartTime?: number | null
    ) => void;
    setScreenSharingUserId: (userId: string | null) => void;
    resetMeeting: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
    currentMeetingId: null,
    localStream: null,
    peers: [],
    isMuted: false,
    isVideoOn: true,
    isScreenSharing: false,
    isRecording: false,
    recordingUserId: null,
    recordingUserName: null,
    recordingStartTime: null,
    screenSharingUserId: null,

    setCurrentMeetingId: (id) => set({ currentMeetingId: id }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setPeers: (peers) => set({ peers }),

    addPeer: (peer) => set((state) => ({ peers: [...state.peers, peer] })),

    updatePeer: (userId, updates) =>
        set((state) => ({
            peers: state.peers.map((p) =>
                p.userId === userId ? { ...p, ...updates } : p
            ),
        })),

    removePeer: (userId) =>
        set((state) => ({
            peers: state.peers.filter((p) => p.userId !== userId),
        })),

    setIsMuted: (val) => set({ isMuted: val }),
    setIsVideoOn: (val) => set({ isVideoOn: val }),
    setIsScreenSharing: (val) => set({ isScreenSharing: val }),
    setIsRecording: (val) =>
        set({
            isRecording: val,
            ...(!val
                ? {
                      recordingUserId: null,
                      recordingUserName: null,
                      recordingStartTime: null,
                  }
                : {}),
        }),
    setRecordingState: (
        isRecording,
        recordingUserId = null,
        recordingUserName = null,
        recordingStartTime = null
    ) =>
        set({
            isRecording,
            recordingUserId,
            recordingUserName,
            recordingStartTime: isRecording
                ? recordingStartTime || Date.now()
                : null,
        }),
    setScreenSharingUserId: (userId) => set({ screenSharingUserId: userId }),

    resetMeeting: () =>
        set({
            currentMeetingId: null,
            localStream: null,
            peers: [],
            isMuted: false,
            isVideoOn: true,
            isScreenSharing: false,
            isRecording: false,
            recordingUserId: null,
            recordingUserName: null,
            recordingStartTime: null,
            screenSharingUserId: null,
        }),
}));