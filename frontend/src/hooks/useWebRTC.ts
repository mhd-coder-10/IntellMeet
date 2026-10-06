// Manages WebRTC peer connections, media streams and screen sharing
// Handles offer/answer, ICE candidates, camera toggle and screen share

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useMeetingStore } from "@/store/meetingStore";
import { useAuthStore } from "@/store/authStore";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Remember camera state before screen share to restore afterwards
  const wasVideoOnRef = useRef<boolean>(true);
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

  // Start local camera and microphone
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Failed to get user media:", error);
      throw error;
    }
  }, [setLocalStream]);

  // Create a new RTCPeerConnection for a peer
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
          socket.emit("webrtc:ice-candidate", {
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

  // Send an offer to a peer to start negotiation
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

      socket?.emit("webrtc:offer", {
        meetingId,
        toUserId: peerInfo.userId,
        sdp: offer,
        isMuted,
        isVideoOn,
      });
    },
    [socket, meetingId, createPeerConnection, addPeer, isMuted, isVideoOn]
  );

  // Toggle camera by building a fresh MediaStream
  // Fresh reference forces VideoTile useEffect to re-run
  const toggleVideo = useCallback(
    async (enabled: boolean) => {
      const currentStream = useMeetingStore.getState().localStream;
      if (!currentStream) return;

      // Save existing audio tracks
      const audioTracks = currentStream.getAudioTracks();

      // Stop old video tracks
      currentStream.getVideoTracks().forEach((track) => track.stop());

      // Build a fresh MediaStream (new reference forces React re-render)
      const freshStream = new MediaStream();
      audioTracks.forEach((t) => freshStream.addTrack(t));

      if (enabled) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          const newTrack = videoStream.getVideoTracks()[0];
          freshStream.addTrack(newTrack);

          // Swap track on all peers
          videoSendersRef.current.forEach((sender) => {
            sender.replaceTrack(newTrack);
          });
        } catch (error) {
          console.error("Failed to start camera:", error);
          throw error;
        }
      } else {
        // Remove video on all peers
        videoSendersRef.current.forEach((sender) => {
          sender.replaceTrack(null);
        });
      }

      // Set the new stream — this triggers VideoTile useEffect
      setLocalStream(freshStream);
    },
    [setLocalStream]
  );

  // Socket event listeners
  useEffect(() => {
    if (!socket || !meetingId) return;

    socket.on(
      "meeting:joined",
      async ({
        users,
        screenSharingUserId,
      }: {
        users: MeetingUser[];
        screenSharingUserId: string | null;
      }) => {
        // Restore ongoing screen share state
        if (screenSharingUserId) {
          useMeetingStore
            .getState()
            .setScreenSharingUserId(screenSharingUserId);
        }

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
      }
    );

    socket.on("meeting:user-joined", (data) => {
      console.log("User joined:", data.name);
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
      "webrtc:offer",
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

        socket.emit("webrtc:answer", {
          meetingId,
          toUserId: fromUserId,
          sdp: answer,
        });
      }
    );

    socket.on("webrtc:answer", async ({ fromUserId, sdp }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    socket.on("webrtc:ice-candidate", async ({ fromUserId, candidate }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      }
    });

    // On media state change, rebuild peer stream with fresh reference
    // so video element re-attaches and shows updated track
    socket.on(
      "meeting:media-state-changed",
      ({ userId, isMuted: remoteMuted, isVideoOn: remoteVideoOn }) => {
        const existingPeer = useMeetingStore
          .getState()
          .peers.find((p) => p.userId === userId);

        let freshStream: MediaStream | undefined;

        if (existingPeer?.stream) {
          freshStream = new MediaStream();
          existingPeer.stream.getTracks().forEach((track) => {
            freshStream!.addTrack(track);
          });
        }

        updatePeer(userId, {
          isMuted: remoteMuted,
          isVideoOn: remoteVideoOn,
          ...(freshStream ? { stream: freshStream } : {}),
        });
      }
    );

    return () => {
      socket.off("meeting:joined");
      socket.off("meeting:user-joined");
      socket.off("meeting:user-left");
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("meeting:media-state-changed");
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

  // Stop local camera and microphone tracks
  const stopLocalStream = useCallback(() => {
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
  }, [localStream, setLocalStream]);

  // Stop screen share and restore camera track
  const stopScreenShare = useCallback(async () => {
    try {
      // Stop screen tracks
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;

      const currentStream = useMeetingStore.getState().localStream;

      // Remove all video tracks from local stream
      if (currentStream) {
        currentStream.getVideoTracks().forEach((track) => {
          track.stop();
          currentStream.removeTrack(track);
        });
      }

      // Restore camera only if it was on before screen share
      if (wasVideoOnRef.current) {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const cameraTrack = cameraStream.getVideoTracks()[0];

        if (currentStream) {
          currentStream.addTrack(cameraTrack);
        }

        videoSendersRef.current.forEach((sender) => {
          sender.replaceTrack(cameraTrack);
        });
      } else {
        videoSendersRef.current.forEach((sender) => {
          sender.replaceTrack(null);
        });
      }
    } catch (error) {
      console.error("Failed to stop screen share:", error);
    }
  }, []);

  // Start screen sharing and replace video track on all peers
  const startScreenShare = useCallback(async () => {
    const state = useMeetingStore.getState();
    // Remember current camera state so we can restore later
    wasVideoOnRef.current = state.isVideoOn;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      screenStreamRef.current = screenStream;

      // Replace video track on all peer connections
      videoSendersRef.current.forEach((sender) => {
        sender.replaceTrack(screenTrack);
      });

      // Replace video track on local stream so local preview shows screen
      const currentStream = state.localStream;
      if (currentStream) {
        currentStream.getVideoTracks().forEach((track) => {
          track.stop();
          currentStream.removeTrack(track);
        });
        currentStream.addTrack(screenTrack);
      }

      // Handle native browser "Stop sharing" button
      screenTrack.onended = async () => {
        await stopScreenShare();
        useMeetingStore.getState().setIsScreenSharing(false);
        useMeetingStore.getState().setScreenSharingUserId(null);
        socket?.emit("meeting:screen-share-stopped", { meetingId });
      };

      return screenStream;
    } catch (error) {
      console.error("Failed to start screen share:", error);
      throw error;
    }
  }, [stopScreenShare, socket, meetingId]);

  // Close all peer connections and stop streams
  const closeAllPeers = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    videoSendersRef.current.clear();
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
  }, []);

  return {
    startLocalStream,
    stopLocalStream,
    toggleVideo,
    closeAllPeers,
    startScreenShare,
    stopScreenShare,
    peerCount: peers.length,
  };
}