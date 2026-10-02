// Zustand store for current active meeting state
// Holds local stream, peers and connection status

import { create } from 'zustand'
import type { VideoPeer } from '@/types/meeting'

interface MeetingState {
    currentMeetingId: string | null
    localStream: MediaStream | null
    peers: VideoPeer[]
    isMuted: boolean
    isVideoOn: boolean
    setCurrentMeetingId: (id: string | null) => void
    setLocalStream: (stream: MediaStream | null) => void
    setPeers: (peers: VideoPeer[]) => void
    addPeer: (peer: VideoPeer) => void
    updatePeer: (userId: string, updates: Partial<VideoPeer>) => void
    removePeer: (userId: string) => void
    setIsMuted: (val: boolean) => void
    setIsVideoOn: (val: boolean) => void
    resetMeeting: () => void
}

export const useMeetingStore = create<MeetingState>((set) => ({
    currentMeetingId: null,
    localStream: null,
    peers: [],
    isMuted: false,
    isVideoOn: true,

    setCurrentMeetingId: (id) => set({ currentMeetingId: id }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setPeers: (peers) => set({ peers }),

    addPeer: (peer) =>
        set((state) => ({ peers: [...state.peers, peer] })),

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

    resetMeeting: () =>
        set({
            currentMeetingId: null,
            localStream: null,
            peers: [],
            isMuted: false,
            isVideoOn: true,
        }),
}))