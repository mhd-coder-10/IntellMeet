// Manages WebRTC peer connections, media streams and screen sharing
// Handles offer/answer, ICE candidates, camera toggle and screen share across all peers

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useMeetingStore } from "@/store/meetingStore";
import { useAuthStore } from "@/store/authStore";
import type { VideoPeer } from "@/types/meeting";

// Multi-network ICE configuration with Google STUN and OpenRelay TURN for symmetric NAT/firewall traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelay",
      credential: "openrelay",
    },
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

// Creates a dummy fallback MediaStream when camera/microphone permissions are denied or unavailable
const createFallbackStream = (): MediaStream => {
  const stream = new MediaStream();
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      osc.connect(dst);
      const audioTrack = dst.stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        stream.addTrack(audioTrack);
      }
    }
  } catch (err) {
    console.warn("[WebRTC] Fallback audio track creation warning:", err);
  }
  return stream;
};

// Rebuilds and syncs active tracks from all receivers into a fresh MediaStream reference
const syncPeerStream = (
  pc: RTCPeerConnection,
  userId: string,
  updatePeer: (id: string, updates: Partial<VideoPeer>) => void
) => {
  const activeTracks: MediaStreamTrack[] = [];
  pc.getReceivers().forEach((r) => {
    if (r.track && r.track.readyState !== "ended") {
      activeTracks.push(r.track);
    }
  });

  const hasLiveVideo = activeTracks.some((t) => t.kind === "video" && t.readyState === "live");

  // Always create a fresh MediaStream instance with current active tracks
  // This guarantees React detects a reference change and re-renders VideoTile immediately!
  const freshStream = new MediaStream(activeTracks);

  updatePeer(userId, {
    stream: freshStream,
    ...(hasLiveVideo ? { isVideoOn: true } : {}),
  });
};

export function useWebRTC(socket: Socket | null, meetingId: string | null) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const wasVideoOnRef = useRef<boolean>(true);

  // Zustand Store hooks
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

  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id || (user as { _id?: string })?._id;

  // Stable refs to avoid tearing down socket listeners during state changes
  const localStreamRef = useRef<MediaStream | null>(localStream);
  localStreamRef.current = localStream;

  const currentUserIdRef = useRef<string | null>(currentUserId ? String(currentUserId) : null);
  currentUserIdRef.current = currentUserId ? String(currentUserId) : null;

  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;

  const isVideoOnRef = useRef<boolean>(isVideoOn);
  isVideoOnRef.current = isVideoOn;

  const meetingIdRef = useRef<string | null>(meetingId);
  meetingIdRef.current = meetingId;

  // Helper to drain buffered early ICE candidates once remote description is set
  const drainPendingCandidates = useCallback(
    async (peerId: string, pc: RTCPeerConnection) => {
      const pending = pendingCandidatesRef.current.get(peerId);
      if (pending && pending.length > 0) {
        for (const cand of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn(`[WebRTC] Error applying queued ICE candidate for peer ${peerId}:`, err);
          }
        }
        pendingCandidatesRef.current.delete(peerId);
      }
    },
    []
  );

  // Start local camera and microphone with acoustic echo cancellation & robust fallback
  const startLocalStream = useCallback(async () => {
    const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: AUDIO_CONSTRAINTS,
        });
      } catch {
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
          // Gracefully fallback to audio-only if camera is unavailable or in use
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: AUDIO_CONSTRAINTS,
            });
            useMeetingStore.getState().setIsVideoOn(false);
          } catch {
            // If microphone is also unavailable, create dummy fallback stream
            stream = createFallbackStream();
            useMeetingStore.getState().setIsVideoOn(false);
            useMeetingStore.getState().setIsMuted(true);
          }
        }
      }
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.warn("[WebRTC] getUserMedia notice, using fallback stream:", error);
      const fallback = createFallbackStream();
      setLocalStream(fallback);
      useMeetingStore.getState().setIsVideoOn(false);
      useMeetingStore.getState().setIsMuted(true);
      return fallback;
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
        } catch {}
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
            meetingId: meetingIdRef.current,
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
    [socket, updatePeer]
  );

  // Send an offer to a peer to start negotiation
  const callPeer = useCallback(
    async (peerInfo: PeerInfo, stream: MediaStream) => {
      const peerId = String(peerInfo.userId);
      const currentUId = currentUserIdRef.current;
      if (peerId === currentUId) return;

      console.log("[WebRTC] Calling peer:", peerInfo.name, peerId);

      const pc = createPeerConnection(peerInfo, stream);

      addPeer({
        userId: peerId,
        name: peerInfo.name,
        username: peerInfo.username,
        profilePicture: peerInfo.profilePicture,
        isMuted: peerInfo.isMuted ?? false,
        isVideoOn: peerInfo.isVideoOn ?? true,
      });

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.emit("webrtc:offer", {
          meetingId: meetingIdRef.current,
          toUserId: peerInfo.userId,
          sdp: offer,
          isMuted: isMutedRef.current,
          isVideoOn: isVideoOnRef.current,
        });
      } catch (err) {
        console.error("[WebRTC] Error creating offer for peer:", peerId, err);
      }
    },
    [socket, createPeerConnection, addPeer]
  );

  // Toggle camera: replaces video track with real camera or null
  const toggleVideo = useCallback(
    async (enabled: boolean) => {
      let currentStream = useMeetingStore.getState().localStream;
      if (!currentStream) {
        try {
          currentStream = await startLocalStream();
        } catch {
          currentStream = createFallbackStream();
        }
      }

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
          console.error("[WebRTC] Failed to start camera:", error);
          throw error;
        }
      }

      // Replace video track across all peers using precise video sender
      peerConnections.current.forEach((pc, peerId) => {
        const videoSender = getVideoSender(pc);
        if (videoSender) {
          videoSender.replaceTrack(newTrack).catch((err) => {
            console.warn(`[WebRTC] replaceTrack error for peer ${peerId}:`, err);
          });
        } else if (newTrack) {
          try {
            pc.addTrack(newTrack, freshStream);
          } catch (e) {
            console.warn(`[WebRTC] addTrack fallback error for peer ${peerId}:`, e);
          }
        }
      });

      setLocalStream(freshStream);
      useMeetingStore.getState().setIsVideoOn(enabled);

      if (socket && meetingIdRef.current) {
        socket.emit("meeting:media-state", {
          meetingId: meetingIdRef.current,
          isMuted: isMutedRef.current,
          isVideoOn: enabled,
        });
      }
    },
    [setLocalStream, socket, startLocalStream]
  );

  // Socket event listeners: stable lifecycle attached once per (socket, meetingId)
  useEffect(() => {
    if (!socket || !meetingId) return;

    // Handle initial join response from server
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
      console.log("[WebRTC] meeting:joined received. Total room users:", users?.length);

      if (screenSharingUserId) {
        useMeetingStore.getState().setScreenSharingUserId(screenSharingUserId);
      }

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

      const myId = currentUserIdRef.current;

      // 1. Immediately register all existing participants in Zustand peers store so they appear instantly
      for (const u of users || []) {
        const uId = String(u.userId);
        if (uId === myId) continue;

        addPeer({
          userId: uId,
          name: u.name || u.username || "Participant",
          username: u.username || "user",
          profilePicture: u.profilePicture,
          isMuted: u.isMuted ?? false,
          isVideoOn: u.isVideoOn ?? true,
        });
      }

      // 2. Ensure local media stream is available
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await startLocalStream();
        } catch {
          stream = createFallbackStream();
        }
      }

      // 3. Initiate WebRTC peer connections to all existing room members
      for (const u of users || []) {
        const uId = String(u.userId);
        if (uId === myId) continue;

        await callPeer(
          {
            userId: uId,
            name: u.name,
            username: u.username,
            profilePicture: u.profilePicture,
            isMuted: u.isMuted ?? false,
            isVideoOn: u.isVideoOn ?? true,
          },
          stream
        );
      }
    };

    // Handle another user joining the meeting room
    const handleUserJoined = async (data: {
      userId: string;
      name?: string;
      username?: string;
      profilePicture?: string;
      isMuted?: boolean;
      isVideoOn?: boolean;
    }) => {
      const uId = String(data.userId);
      const myId = currentUserIdRef.current;
      if (uId === myId) return;

      console.log("[WebRTC] meeting:user-joined received for:", data.name, uId);

      // 1. Immediately add the newly joined user to peers in Zustand store so their card appears right away
      addPeer({
        userId: uId,
        name: data.name || data.username || "Participant",
        username: data.username || "user",
        profilePicture: data.profilePicture,
        isMuted: data.isMuted ?? false,
        isVideoOn: data.isVideoOn ?? true,
      });

      // 2. Proactively establish connection if local stream is already active
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await startLocalStream();
        } catch {
          stream = createFallbackStream();
        }
      }

      if (stream) {
        await callPeer(
          {
            userId: uId,
            name: data.name || data.username || "Participant",
            username: data.username || "user",
            profilePicture: data.profilePicture,
            isMuted: data.isMuted ?? false,
            isVideoOn: data.isVideoOn ?? true,
          },
          stream
        );
      }
    };

    // Handle a participant leaving the room
    const handleUserLeft = ({ userId }: { userId: any }) => {
      const peerId = String(userId);
      console.log("[WebRTC] meeting:user-left received for:", peerId);

      const pc = peerConnections.current.get(peerId);
      if (pc) {
        try {
          pc.close();
        } catch {}
        peerConnections.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);
      removePeer(peerId);
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
      const peerId = String(fromUserId);
      const myId = currentUserIdRef.current;
      if (peerId === myId) return;

      console.log("[WebRTC] Received offer from:", fromName || fromUsername, peerId);

      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await startLocalStream();
        } catch {
          stream = createFallbackStream();
        }
      }

      // Cleanly close any previous connection for this peer before answering
      const existingPc = peerConnections.current.get(peerId);
      if (existingPc) {
        try {
          existingPc.close();
        } catch {}
        peerConnections.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);

      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc:ice-candidate", {
            meetingId: meetingIdRef.current,
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
        userId: peerId,
        name: fromName || fromUsername || "Participant",
        username: fromUsername || "user",
        profilePicture: fromProfilePicture,
        isMuted: remoteMuted ?? false,
        isVideoOn: remoteVideoOn ?? true,
      });

      try {
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
          meetingId: meetingIdRef.current,
          toUserId: fromUserId,
          sdp: answer,
        });
      } catch (err) {
        console.error("[WebRTC] Error handling offer from peer:", peerId, err);
      }
    };

    // Handle incoming answer
    const handleAnswer = async ({ fromUserId, sdp }: any) => {
      const peerId = String(fromUserId);
      console.log("[WebRTC] Received answer from:", peerId);

      const pc = peerConnections.current.get(peerId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainPendingCandidates(peerId, pc);
          syncPeerStream(pc, fromUserId, updatePeer);
        } catch (err) {
          console.error("[WebRTC] Error setting remote answer for peer:", peerId, err);
        }
      }
    };

    // Handle incoming ICE candidate
    const handleIceCandidate = async ({ fromUserId, candidate }: any) => {
      if (!fromUserId || !candidate) return;
      const peerId = String(fromUserId);
      const pc = peerConnections.current.get(peerId);

      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("[WebRTC] ICE candidate error:", err);
        }
      } else {
        const list = pendingCandidatesRef.current.get(peerId) || [];
        list.push(candidate);
        pendingCandidatesRef.current.set(peerId, list);
      }
    };

    // On media state change, update mute/video states and re-sync peer stream
    const handleMediaStateChanged = ({
      userId,
      isMuted: remoteMuted,
      isVideoOn: remoteVideoOn,
    }: any) => {
      const uId = String(userId);
      updatePeer(uId, {
        isMuted: remoteMuted,
        isVideoOn: remoteVideoOn,
      });

      const pc = peerConnections.current.get(uId);
      if (pc) {
        syncPeerStream(pc, uId, updatePeer);
      }
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
  }, [socket, meetingId, addPeer, removePeer, updatePeer, startLocalStream, callPeer, drainPendingCandidates]);

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
          console.warn("[WebRTC] Failed to restore camera after screen share:", e);
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
            console.warn(`[WebRTC] replaceTrack error on restore for peer ${peerId}:`, err);
          });
        }
      });

      setLocalStream(freshStream);

      const isCurrentMuted = useMeetingStore.getState().isMuted;
      const isCurrentVideoOn = useMeetingStore.getState().isVideoOn;
      socket?.emit("meeting:media-state", {
        meetingId: meetingIdRef.current,
        isMuted: isCurrentMuted,
        isVideoOn: isCurrentVideoOn,
      });
    } catch (error) {
      console.error("[WebRTC] Failed to stop screen share:", error);
    }
  }, [socket, setLocalStream]);

  // Start screen sharing and replace video track on all peers
  const startScreenShare = useCallback(async () => {
    const state = useMeetingStore.getState();
    wasVideoOnRef.current = state.isVideoOn;

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
      throw new Error("Screen sharing is not supported on this browser.");
    }

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
            console.warn(`[WebRTC] replaceTrack error for peer ${peerId}:`, err);
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
        socket?.emit("meeting:screen-share-stopped", { meetingId: meetingIdRef.current });
      };

      // Notify room about media state
      socket?.emit("meeting:media-state", {
        meetingId: meetingIdRef.current,
        isMuted: state.isMuted,
        isVideoOn: true,
      });

      return screenStream;
    } catch (error) {
      console.error("[WebRTC] Failed to start screen share:", error);
      throw error;
    }
  }, [stopScreenShare, socket, setLocalStream]);

  // Close all peer connections and stop streams
  const closeAllPeers = useCallback(() => {
    peerConnections.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnections.current.clear();
    pendingCandidatesRef.current.clear();
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
