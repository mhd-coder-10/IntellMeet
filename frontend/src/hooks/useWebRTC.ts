
// Manages WebRTC peer connections and media streams
// Handles offer/answer exchange and ICE candidates via socket

import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useMeetingStore } from '@/store/meetingStore';
import { useAuthStore } from '@/store/authStore';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface PeerInfo {
  userId: string;
  name: string;
  username: string;
  profilePicture?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
}

interface MeetingUser {
  userId: string;
  name: string;
  username: string;
  profilePicture?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
}

export function useWebRTC(socket: Socket | null, meetingId: string | null) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const currentUserId = useAuthStore((state) => state.user?.id);

  const {
    localStream,
    setLocalStream,
    addPeer,
    updatePeer,
    removePeer,
    peers,
    isMuted,
    isVideoOn,
  } = useMeetingStore();

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw error;
    }
  }, [setLocalStream]);

  const createPeerConnection = useCallback(
    (peerInfo: PeerInfo, stream: MediaStream) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        if (track.kind === "video") {
          videoSendersRef.current.set(peerInfo.userId, sender);
        }
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc:ice-candidate', {
            meetingId,
            toUserId: peerInfo.userId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        updatePeer(peerInfo.userId, { stream: remoteStream });
      };

      peerConnections.current.set(peerInfo.userId, pc);
      return pc;
    },
    [socket, meetingId, updatePeer]
  );

  const callPeer = useCallback(
    async (peerInfo: PeerInfo, stream: MediaStream) => {
      const pc = createPeerConnection(peerInfo, stream);

      addPeer({
        userId: peerInfo.userId,
        name: peerInfo.name,
        username: peerInfo.username,
        profilePicture: peerInfo.profilePicture,
        isMuted: peerInfo.isMuted ?? false,
        isVideoOn: peerInfo.isVideoOn ?? true,
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit('webrtc:offer', {
        meetingId,
        toUserId: peerInfo.userId,
        sdp: offer,
        isMuted,
        isVideoOn,
      });
    },
    [socket, meetingId, createPeerConnection, addPeer, isMuted, isVideoOn]
  );

  useEffect(() => {
    if (!socket || !meetingId) return;

    socket.on('meeting:joined', async ({ users }: { users: MeetingUser[] }) => {
      const stream = localStream || (await startLocalStream());

      for (const user of users) {
        if (user.userId === currentUserId) continue;
        await callPeer(
          {
            userId: user.userId,
            name: user.name,
            username: user.username,
            profilePicture: user.profilePicture,
            isMuted: user.isMuted ?? false,
            isVideoOn: user.isVideoOn ?? true,
          },
          stream
        );
      }
    });

    socket.on('meeting:user-joined', (data) => {
      console.log('User joined:', data.name);
    });

    socket.on("meeting:user-left", ({ userId }) => {
      const pc = peerConnections.current.get(userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(userId);
      }
      videoSendersRef.current.delete(userId);
      removePeer(userId);
    });

    socket.on(
      'webrtc:offer',
      async ({
        fromUserId,
        fromUsername,
        fromName,
        sdp,
        isMuted: remoteMuted,
        isVideoOn: remoteVideoOn,
      }) => {
        if (fromUserId === currentUserId) return;
        const stream = localStream || (await startLocalStream());

        const peerInfo: PeerInfo = {
          userId: fromUserId,
          name: fromName || fromUsername,
          username: fromUsername,
          isMuted: remoteMuted ?? false,
          isVideoOn: remoteVideoOn ?? true,
        };

        const pc = createPeerConnection(peerInfo, stream);

        addPeer({
          userId: fromUserId,
          name: fromName || fromUsername,
          username: fromUsername,
          isMuted: remoteMuted ?? false,
          isVideoOn: remoteVideoOn ?? true,
        });

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          meetingId,
          toUserId: fromUserId,
          sdp: answer,
        });
      }
    );

    socket.on('webrtc:answer', async ({ fromUserId, sdp }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    socket.on('webrtc:ice-candidate', async ({ fromUserId, candidate }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('ICE candidate error:', err);
        }
      }
    });

    socket.on(
      'meeting:media-state-changed',
      ({ userId, isMuted: remoteMuted, isVideoOn: remoteVideoOn }) => {
        updatePeer(userId, { isMuted: remoteMuted, isVideoOn: remoteVideoOn });
      }
    );

    return () => {
      socket.off('meeting:joined');
      socket.off('meeting:user-joined');
      socket.off('meeting:user-left');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('meeting:media-state-changed');
    };
  }, [
    socket,
    meetingId,
    localStream,
    currentUserId,
    isMuted,
    isVideoOn,
    startLocalStream,
    callPeer,
    createPeerConnection,
    addPeer,
    removePeer,
    updatePeer,
  ]);

  const stopLocalStream = useCallback(() => {
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
  }, [localStream, setLocalStream]);

  // Turn camera on/off by stopping or restarting the video track
  const toggleVideo = useCallback(
    async (enabled: boolean) => {
      if (!localStream) return;

      // Stop existing video tracks
      localStream.getVideoTracks().forEach((track) => {
        track.stop();
        localStream.removeTrack(track);
      });

      if (enabled) {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          const newTrack = newStream.getVideoTracks()[0];
          localStream.addTrack(newTrack);

          videoSendersRef.current.forEach((sender) => {
            sender.replaceTrack(newTrack);
          });
        } catch (error) {
          console.error("Failed to start camera:", error);
          throw error;
        }
      } else {
        videoSendersRef.current.forEach((sender) => {
          sender.replaceTrack(null);
        });
      }
    },
    [localStream]
  );

  const closeAllPeers = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
  }, []);

  return {
    startLocalStream,
    stopLocalStream,
    toggleVideo,
    closeAllPeers,
    peerCount: peers.length,
  };
}