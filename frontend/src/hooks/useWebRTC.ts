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
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
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

// Rebuilds and syncs active tracks from all receivers into a stable MediaStream
const syncPeerStream = (
  pc: RTCPeerConnection,
  userId: string,
  updatePeer: (id: string, updates: Partial<VideoPeer>) => void
) => {
  const currentPeer = useMeetingStore
    .getState()
    .peers.find((p) => String(p.userId) === String(userId));

  const stream = currentPeer?.stream || new MediaStream();
  let changed = false;

  pc.getReceivers().forEach((r) => {
    if (r.track && r.track.readyState !== "ended") {
      const exists = stream.getTracks().some((t) => t.id === r.track.id);
      if (!exists) {
        stream.addTrack(r.track);
        changed = true;
      }
    }
  });

  // Remove tracks that have ended
  stream.getTracks().forEach((track) => {
    const isReceiverTrack = pc
      .getReceivers()
      .some((r) => r.track && r.track.id === track.id && r.track.readyState !== "ended");
    if (!isReceiverTrack) {
      stream.removeTrack(track);
      changed = true;
    }
  });

  if (!currentPeer?.stream || changed) {
    updatePeer(userId, { stream });
  }
};

export function useWebRTC(socket: Socket | null, meetingId: string | null) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Remember camera state before screen share to restore afterwards
  const wasVideoOnRef = useRef<boolean>(true);
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Helper to drain buffered early ICE candidates once remote description is set
  const drainPendingCandidates = useCallback(
    async (peerId: string, pc: RTCPeerConnection) => {
      const pending = pendingCandidatesRef.current.get(peerId);
      if (pending && pending.length > 0) {
        for (const cand of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn(`Error applying queued ICE candidate for peer ${peerId}:`, err);
          }
        }
        pendingCandidatesRef.current.delete(peerId);
      }
    },
    []
  );

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
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch {
          // If video camera permission is blocked or unavailable, gracefully fallback to audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          useMeetingStore.getState().setIsVideoOn(false);
        }
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
      const peerId = String(peerInfo.userId);

      // Cleanly close any previous connection for this peer before creating a new one
      const existingPc = peerConnections.current.get(peerId);
      if (existingPc) {
        try {
          existingPc.close();
        } catch { }
        peerConnections.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);

      const pc = new RTCPeerConnection(ICE_SERVERS);

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

    const handleJoined = async ({
      users,
      screenSharingUserId,
      isRecording,
      recordingUserId,
      recordingStartedAt,
    }: {
      users: MeetingUser[];
      screenSharingUserId: string | null;
      isRecording?: boolean;
      recordingUserId?: string | null;
      recordingStartedAt?: number | null;
    }) => {
        // Restore ongoing screen share state
        if (screenSharingUserId) {
          useMeetingStore
            .getState()
            .setScreenSharingUserId(screenSharingUserId);
        }

        // Restore ongoing live recording state immediately upon join/rejoin
        if (isRecording) {
          useMeetingStore
            .getState()
            .setRecordingState(
              true,
              recordingUserId,
              "Meeting",
              recordingStartedAt || Date.now()
            );
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
      };

    const handleUserJoined = (data: any) => {
      console.log("User joined:", data.name);
    };

    const handleUserLeft = ({ userId }: { userId: any }) => {
      const peerId = String(userId);
      const pc = peerConnections.current.get(peerId);
      if (pc) {
        try {
          pc.close();
        } catch { }
        peerConnections.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);
      removePeer(userId);
    };

    // Handle incoming offer (answerer side): attach tracks to negotiated transceivers
    const handleOffer = async ({
      fromUserId,
      fromUsername,
      fromName,
      fromProfilePicture,
      sdp,
      isMuted: remoteMuted,
      isVideoOn: remoteVideoOn,
    }: any) => {
      if (fromUserId === currentUserId) return;
      const stream = localStream || (await startLocalStream());
      const peerId = String(fromUserId);

      // Cleanly close any previous connection for this peer before answering
      const existingPc = peerConnections.current.get(peerId);
      if (existingPc) {
        try {
          existingPc.close();
        } catch { }
        peerConnections.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);

      const pc = new RTCPeerConnection(ICE_SERVERS);

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

      // 2. Drain any early ICE candidates that arrived before remoteDescription was set
      await drainPendingCandidates(peerId, pc);

      // 3. Attach local tracks to the negotiated transceivers
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

      // 4. Create answer and send back
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc:answer", {
        meetingId,
        toUserId: fromUserId,
        sdp: answer,
      });
    };

    const handleAnswer = async ({ fromUserId, sdp }: any) => {
      const peerId = String(fromUserId);
      const pc = peerConnections.current.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainPendingCandidates(peerId, pc);
        syncPeerStream(pc, fromUserId, updatePeer);
      }
    };

    const handleIceCandidate = async ({ fromUserId, candidate }: any) => {
      if (!fromUserId || !candidate) return;
      const peerId = String(fromUserId);
      const pc = peerConnections.current.get(peerId);

      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("ICE candidate error:", err);
        }
      } else {
        // Buffer candidate until remote description is set
        const list = pendingCandidatesRef.current.get(peerId) || [];
        list.push(candidate);
        pendingCandidatesRef.current.set(peerId, list);
      }
    };

    // On media state change, update mute/video states without destroying the active audio/video stream
    const handleMediaStateChanged = ({
      userId,
      isMuted: remoteMuted,
      isVideoOn: remoteVideoOn,
    }: any) => {
      updatePeer(userId, {
        isMuted: remoteMuted,
        isVideoOn: remoteVideoOn,
      });
    };

    // Screen share started: update store and re-sync presenter stream instantly
    const handleScreenShareStarted = ({ userId }: { userId: string }) => {
      useMeetingStore.getState().setScreenSharingUserId(userId);
      const uIdStr = String(userId);
      const pc = peerConnections.current.get(uIdStr);
      if (pc) {
        syncPeerStream(pc, userId, updatePeer);
        updatePeer(userId, { isVideoOn: true });
      }
    };

    // Screen share stopped: update store and re-sync all peer streams
    const handleScreenShareStopped = () => {
      useMeetingStore.getState().setScreenSharingUserId(null);
      peerConnections.current.forEach((pc, peerId) => {
        syncPeerStream(pc, peerId, updatePeer);
      });
    };

    socket.on("meeting:joined", handleJoined);
    socket.on("meeting:user-joined", handleUserJoined);
    socket.on("meeting:user-left", handleUserLeft);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("meeting:media-state-changed", handleMediaStateChanged);
    socket.on("meeting:screen-share-started", handleScreenShareStarted);
    socket.on("meeting:screen-share-stopped", handleScreenShareStopped);

    return () => {
      socket.off("meeting:joined", handleJoined);
      socket.off("meeting:user-joined", handleUserJoined);
      socket.off("meeting:user-left", handleUserLeft);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("meeting:media-state-changed", handleMediaStateChanged);
      socket.off("meeting:screen-share-started", handleScreenShareStarted);
      socket.off("meeting:screen-share-stopped", handleScreenShareStopped);
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