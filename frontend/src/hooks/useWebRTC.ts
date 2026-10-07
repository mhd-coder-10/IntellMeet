// Manages WebRTC peer connections, media streams and screen sharing
// Handles offer/answer, ICE candidates, camera toggle and screen share across all peers

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useMeetingStore } from "@/store/meetingStore";
import { useAuthStore } from "@/store/authStore";
import type { VideoPeer } from "@/types/meeting";

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

// Reliably finds the active video sender for a peer connection
const getVideoSender = (pc: RTCPeerConnection): RTCRtpSender | null => {
  // 1. Look for sender with an existing video track
  const withTrack = pc.getSenders().find((s) => s.track && s.track.kind === "video");
  if (withTrack) return withTrack;

  // 2. Look for transceiver whose receiver or sender track is video
  const videoTransceiver = pc.getTransceivers().find(
    (t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video"
  );
  if (videoTransceiver?.sender) return videoTransceiver.sender;

  // 3. Fallback to sender without audio track
  return pc.getSenders().find((s) => !s.track || s.track.kind !== "audio") || null;
};

// Rebuilds and syncs active tracks from all receivers into a fresh MediaStream
const syncPeerStream = (
  pc: RTCPeerConnection,
  userId: string,
  updatePeer: (id: string, updates: Partial<VideoPeer>) => void
) => {
  const freshStream = new MediaStream();
  pc.getReceivers().forEach((r) => {
    if (
      r.track &&
      r.track.readyState !== "ended" &&
      !freshStream.getTracks().some((t) => t.id === r.track.id)
    ) {
      freshStream.addTrack(r.track);
    }
  });

  if (freshStream.getTracks().length > 0) {
    updatePeer(userId, { stream: freshStream });
  }
};

export function useWebRTC(socket: Socket | null, meetingId: string | null) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
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
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Failed to get user media:", error);
      throw error;
    }
  }, [setLocalStream]);

  // Create a new RTCPeerConnection for a peer (offerer side)
  const createPeerConnection = useCallback(
    (peerInfo: PeerInfo, stream: MediaStream) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const peerId = String(peerInfo.userId);

      // Handle audio track or transceiver
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
      } else {
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }

      // Handle video track or transceiver
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        pc.addTrack(videoTrack, stream);
      } else {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }

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
        syncPeerStream(pc, peerInfo.userId, updatePeer);
        if (event.track) {
          event.track.onunmute = () => syncPeerStream(pc, peerInfo.userId, updatePeer);
          event.track.onended = () => syncPeerStream(pc, peerInfo.userId, updatePeer);
        }
      };

      peerConnections.current.set(peerId, pc);
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

  // Toggle camera: replaces video track with real camera or null
  const toggleVideo = useCallback(
    async (enabled: boolean) => {
      const currentStream = useMeetingStore.getState().localStream;
      if (!currentStream) return;

      const audioTracks = currentStream.getAudioTracks();
      currentStream.getVideoTracks().forEach((track) => track.stop());

      const freshStream = new MediaStream();
      audioTracks.forEach((t) => freshStream.addTrack(t));

      let newTrack: MediaStreamTrack | null = null;

      if (enabled) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          newTrack = videoStream.getVideoTracks()[0];
          freshStream.addTrack(newTrack);
        } catch (error) {
          console.error("Failed to start camera:", error);
          throw error;
        }
      }

      // Replace video track across all peers using precise video sender
      peerConnections.current.forEach((pc, peerId) => {
        const videoSender = getVideoSender(pc);
        if (videoSender) {
          videoSender.replaceTrack(newTrack).catch((err) => {
            console.warn(`replaceTrack error for peer ${peerId}:`, err);
          });
        }
      });

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
      const pc = peerConnections.current.get(String(userId));
      if (pc) {
        pc.close();
        peerConnections.current.delete(String(userId));
      }
      removePeer(userId);
    });

    // Handle incoming offer (answerer side): attach tracks to negotiated transceivers
    socket.on(
      "webrtc:offer",
      async ({
        fromUserId,
        fromUsername,
        fromName,
        fromProfilePicture,
        sdp,
        isMuted: remoteMuted,
        isVideoOn: remoteVideoOn,
      }) => {
        if (fromUserId === currentUserId) return;
        const stream = localStream || (await startLocalStream());

        const pc = new RTCPeerConnection(ICE_SERVERS);
        const peerId = String(fromUserId);

        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit("webrtc:ice-candidate", {
              meetingId,
              toUserId: fromUserId,
              candidate: event.candidate,
            });
          }
        };

        pc.ontrack = (event) => {
          syncPeerStream(pc, fromUserId, updatePeer);
          if (event.track) {
            event.track.onunmute = () => syncPeerStream(pc, fromUserId, updatePeer);
            event.track.onended = () => syncPeerStream(pc, fromUserId, updatePeer);
          }
        };

        peerConnections.current.set(peerId, pc);

        addPeer({
          userId: fromUserId,
          name: fromName || fromUsername,
          username: fromUsername,
          profilePicture: fromProfilePicture,
          isMuted: remoteMuted ?? false,
          isVideoOn: remoteVideoOn ?? true,
        });

        // 1. Set remote description from incoming offer first so transceivers match the offer
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // 2. Attach local tracks to the negotiated transceivers
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        pc.getTransceivers().forEach((transceiver) => {
          const kind = transceiver.receiver?.track?.kind;
          if (kind === "audio") {
            if (audioTrack) {
              transceiver.sender.replaceTrack(audioTrack).catch(console.warn);
            }
            transceiver.direction = "sendrecv";
          } else if (kind === "video") {
            if (videoTrack) {
              transceiver.sender.replaceTrack(videoTrack).catch(console.warn);
            }
            transceiver.direction = "sendrecv";
          }
        });

        // 3. Create answer and send back
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
      const pc = peerConnections.current.get(String(fromUserId));
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        syncPeerStream(pc, fromUserId, updatePeer);
      }
    });

    socket.on("webrtc:ice-candidate", async ({ fromUserId, candidate }) => {
      const pc = peerConnections.current.get(String(fromUserId));
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      }
    });

    // On media state change, rebuild peer stream with fresh reference
    socket.on(
      "meeting:media-state-changed",
      ({ userId, isMuted: remoteMuted, isVideoOn: remoteVideoOn }) => {
        const uIdStr = String(userId);
        const pc = peerConnections.current.get(uIdStr);

        const freshStream = new MediaStream();
        if (pc) {
          pc.getReceivers().forEach((r) => {
            if (
              r.track &&
              r.track.readyState !== "ended" &&
              !freshStream.getTracks().some((t) => t.id === r.track.id)
            ) {
              freshStream.addTrack(r.track);
            }
          });
        }

        updatePeer(userId, {
          isMuted: remoteMuted,
          isVideoOn: remoteVideoOn,
          ...(freshStream.getTracks().length > 0 ? { stream: freshStream } : {}),
        });
      }
    );

    // Screen share started: update store and re-sync presenter stream instantly
    socket.on("meeting:screen-share-started", ({ userId }: { userId: string }) => {
      useMeetingStore.getState().setScreenSharingUserId(userId);
      const uIdStr = String(userId);
      const pc = peerConnections.current.get(uIdStr);
      if (pc) {
        syncPeerStream(pc, userId, updatePeer);
        updatePeer(userId, { isVideoOn: true });
      }
    });

    // Screen share stopped: update store and re-sync all peer streams
    socket.on("meeting:screen-share-stopped", () => {
      useMeetingStore.getState().setScreenSharingUserId(null);
      peerConnections.current.forEach((pc, peerId) => {
        syncPeerStream(pc, peerId, updatePeer);
      });
    });

    return () => {
      socket.off("meeting:joined");
      socket.off("meeting:user-joined");
      socket.off("meeting:user-left");
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("meeting:media-state-changed");
      socket.off("meeting:screen-share-started");
      socket.off("meeting:screen-share-stopped");
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
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;

      const currentStream = useMeetingStore.getState().localStream;
      const freshStream = new MediaStream();
      if (currentStream) {
        currentStream.getAudioTracks().forEach((track) => {
          freshStream.addTrack(track);
        });
        currentStream.getVideoTracks().forEach((track) => {
          track.stop();
        });
      }

      let restoredTrack: MediaStreamTrack | null = null;

      if (wasVideoOnRef.current) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          restoredTrack = cameraStream.getVideoTracks()[0];
          freshStream.addTrack(restoredTrack);
          useMeetingStore.getState().setIsVideoOn(true);
        } catch (e) {
          console.warn("Failed to restore camera after screen share:", e);
          useMeetingStore.getState().setIsVideoOn(false);
        }
      } else {
        useMeetingStore.getState().setIsVideoOn(false);
      }

      // Update video track on all peer connections
      peerConnections.current.forEach((pc, peerId) => {
        const videoSender = getVideoSender(pc);
        if (videoSender) {
          videoSender.replaceTrack(restoredTrack).catch((err) => {
            console.warn(`replaceTrack error on restore for peer ${peerId}:`, err);
          });
        }
      });

      setLocalStream(freshStream);

      const isCurrentMuted = useMeetingStore.getState().isMuted;
      const isCurrentVideoOn = useMeetingStore.getState().isVideoOn;
      socket?.emit("meeting:media-state", {
        meetingId,
        isMuted: isCurrentMuted,
        isVideoOn: isCurrentVideoOn,
      });
    } catch (error) {
      console.error("Failed to stop screen share:", error);
    }
  }, [socket, meetingId, setLocalStream]);

  // Start screen sharing and replace video track on all peers
  const startScreenShare = useCallback(async () => {
    const state = useMeetingStore.getState();
    wasVideoOnRef.current = state.isVideoOn;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      screenStreamRef.current = screenStream;

      // Replace video track across ALL connected peers
      peerConnections.current.forEach((pc, peerId) => {
        const videoSender = getVideoSender(pc);
        if (videoSender) {
          videoSender.replaceTrack(screenTrack).catch((err) => {
            console.warn(`replaceTrack error for peer ${peerId}:`, err);
          });
        }
      });

      // Update local stream with screen track so local preview shows screen
      const currentStream = state.localStream;
      const freshStream = new MediaStream();
      if (currentStream) {
        currentStream.getAudioTracks().forEach((track) => {
          freshStream.addTrack(track);
        });
        currentStream.getVideoTracks().forEach((track) => {
          track.stop();
        });
      }
      freshStream.addTrack(screenTrack);
      setLocalStream(freshStream);

      // Handle native browser "Stop sharing" button
      screenTrack.onended = async () => {
        await stopScreenShare();
        useMeetingStore.getState().setIsScreenSharing(false);
        useMeetingStore.getState().setScreenSharingUserId(null);
        socket?.emit("meeting:screen-share-stopped", { meetingId });
      };

      // Notify room about media state
      socket?.emit("meeting:media-state", {
        meetingId,
        isMuted: state.isMuted,
        isVideoOn: true,
      });

      return screenStream;
    } catch (error) {
      console.error("Failed to start screen share:", error);
      throw error;
    }
  }, [stopScreenShare, socket, meetingId, setLocalStream]);

  // Close all peer connections and stop streams
  const closeAllPeers = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
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