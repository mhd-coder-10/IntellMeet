// Main video call room with WebRTC, chat sidebar, screen share, and Google Meet recording
// Shows local and remote videos, dynamic composite recording, recording preview, and meeting controls

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, Loader2, MessageSquare, Monitor } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useChat } from "@/hooks/useChat";
import { useCompositeRecording, type RecordedResult } from "@/hooks/useCompositeRecording";
import { useMeetingStore } from "@/store/meetingStore";
import { useAuthStore } from "@/store/authStore";
import { useActiveSpeaker } from "@/hooks/useActiveSpeaker";
import {
  getMeetingById,
  joinMeeting,
  leaveMeeting,
  endMeeting,
  uploadMeetingRecording,
} from "@/services/meetingService";
import { VideoTile } from "@/components/Meetings/VideoTile";
import { MeetingControls } from "@/components/Meetings/MeetingControls";
import { ChatPanel } from "@/components/Chat/ChatPanel";
import { ParticipantList } from "@/components/Meetings/ParticipantList";
import { RecordConsentModal } from "@/components/Meetings/RecordConsentModal";
import { RecordingPreviewModal } from "@/components/Meetings/RecordingPreviewModal";
import { RecordStopConfirmModal } from "@/components/Meetings/RecordStopConfirmModal";
import { HostLeaveWarningModal } from "@/components/Meetings/HostLeaveWarningModal";
import { EndMeetingConfirmModal } from "@/components/Meetings/EndMeetingConfirmModal";
import { Button } from "@/components/ui/button";
import { playRecordingStartChime, playRecordingStopChime } from "@/utils/meetingChime";

// Format seconds into mm:ss
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isStopConfirmModalOpen, setIsStopConfirmModalOpen] = useState(false);
  const [isHostLeaveWarningOpen, setIsHostLeaveWarningOpen] = useState(false);
  const [isEndConfirmModalOpen, setIsEndConfirmModalOpen] = useState(false);
  const [remoteRecordingTime, setRemoteRecordingTime] = useState(0);
  const [remoteIsPaused, setRemoteIsPaused] = useState(false);
  const pendingRecordingsRef = useRef<RecordedResult[]>([]);
  const isAutoPausedDueToEmptyRoomRef = useRef(false);

  const { socket, isConnected } = useSocket();
  const user = useAuthStore((state) => state.user);

  const {
    localStream,
    peers,
    isMuted,
    isVideoOn,
    isScreenSharing,
    isRecording,
    recordingUserName,
    screenSharingUserId,
    setCurrentMeetingId,
    setIsScreenSharing,
    setRecordingState,
    setScreenSharingUserId,
    resetMeeting,
  } = useMeetingStore();

  const { messages, typingUsers, sendMessage, deleteMessage, sendTyping } =
    useChat(socket, id || null);

  // Track unread messages when chat sidebar is closed
  const prevMessagesCountRef = useRef(messages.length);
  // Deduplicate rapid join/leave notifications for the same user
  const lastJoinToastRef = useRef<Map<string, number>>(new Map());
  const lastLeftToastRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    } else if (messages.length > prevMessagesCountRef.current) {
      const diff = messages.length - prevMessagesCountRef.current;
      setUnreadCount((c) => c + diff);
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, isChatOpen]);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => getMeetingById(id!),
    enabled: !!id,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Instantly sync live recording state from meeting query without waiting for sockets
  useEffect(() => {
    if (meeting?.isRecording) {
      const startedAt = meeting.recordingStartedAt
        ? new Date(meeting.recordingStartedAt).getTime()
        : Date.now();
      setRecordingState(
        true,
        meeting.recordingUserId || null,
        "Meeting",
        startedAt
      );
    }
  }, [
    meeting?.isRecording,
    meeting?.recordingStartedAt,
    meeting?.recordingUserId,
    setRecordingState,
  ]);

  const isHost = meeting?.host._id === user?.id;

  // Collect all participants available for @mentions in meeting chat
  const mentionCandidates = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; username: string; profilePicture?: string }
    >();

    if (meeting?.host) {
      map.set(meeting.host._id, {
        id: meeting.host._id,
        name: meeting.host.name,
        username: meeting.host.username,
        profilePicture: meeting.host.profilePicture,
      });
    }

    if (Array.isArray(meeting?.participants)) {
      meeting.participants.forEach((p) => {
        if (p?._id) {
          map.set(p._id, {
            id: p._id,
            name: p.name,
            username: p.username,
            profilePicture: p.profilePicture,
          });
        }
      });
    }

    peers.forEach((peer) => {
      if (peer?.userId && !map.has(peer.userId)) {
        map.set(peer.userId, {
          id: peer.userId,
          name: peer.name || peer.username || "Participant",
          username: peer.username || peer.name || "user",
          profilePicture: peer.profilePicture,
        });
      }
    });

    return Array.from(map.values());
  }, [meeting, peers]);

  const {
    startLocalStream,
    stopLocalStream,
    closeAllPeers,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useWebRTC(socket, id || null);

  const {
    recordingTime,
    isPaused,
    recordedResult,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecordedResult,
    isRecorderActive,
  } = useCompositeRecording();

  const { isSpeaking } = useActiveSpeaker({
    localStream,
    peers,
    currentUserId: user?.id,
    isMuted,
  });

  const isEndingMeetingRef = useRef(false);
  const isLeavingMeetingRef = useRef(false);

  // Set current meeting id and call join API
  useEffect(() => {
    if (!id) return;
    setCurrentMeetingId(id);
    joinMeeting(id).catch(() => {});
  }, [id, setCurrentMeetingId]);

  // Emit socket join and initial media state, immediately attaching joined listener
  useEffect(() => {
    if (!socket || !isConnected || !id) return;

    const handleJoined = (data: {
      screenSharingUserId?: string | null;
      isRecording?: boolean;
      recordingUserId?: string | null;
      recordingStartedAt?: number | null;
      recordingElapsedSeconds?: number;
      isRecordingPaused?: boolean;
      recordingPausedSeconds?: number;
    }) => {
      if (data.screenSharingUserId) {
        setScreenSharingUserId(data.screenSharingUserId);
      }
      if (data.isRecording) {
        setRecordingState(
          true,
          data.recordingUserId,
          "Meeting",
          data.recordingStartedAt || Date.now()
        );
        if (data.isRecordingPaused) {
          setRemoteIsPaused(true);
          setRemoteRecordingTime(data.recordingPausedSeconds || 0);
        } else if (typeof data.recordingElapsedSeconds === "number") {
          setRemoteRecordingTime(data.recordingElapsedSeconds);
        } else if (data.recordingStartedAt) {
          const elapsed = Math.max(0, Math.floor((Date.now() - data.recordingStartedAt) / 1000));
          setRemoteRecordingTime(elapsed);
        }
      }
    };

    socket.on("meeting:joined", handleJoined);
    socket.emit("meeting:join", { meetingId: id });

    const timer = setTimeout(() => {
      const { isMuted, isVideoOn } = useMeetingStore.getState();
      socket.emit("meeting:media-state", {
        meetingId: id,
        isMuted,
        isVideoOn,
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      socket.off("meeting:joined", handleJoined);
    };
  }, [socket, isConnected, id, setScreenSharingUserId, setRecordingState]);

  // Start local camera and microphone immediately upon entering meeting room
  useEffect(() => {
    if (id) {
      startLocalStream().catch((err) => {
        console.warn("Failed to auto-start camera and microphone:", err);
      });
    }
  }, [id, startLocalStream]);

  // Remote recording timer calculation for non-host participants
  useEffect(() => {
    if (!isRecording) {
      setRemoteRecordingTime(0);
      setRemoteIsPaused(false);
      return;
    }
    if (remoteIsPaused) {
      return;
    }
    const interval = setInterval(() => {
      setRemoteRecordingTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, remoteIsPaused]);

  // Periodic sync of recorder's exact elapsed timer to all participants in the room
  useEffect(() => {
    if (!isRecorderActive() || !isRecording || !id) return;
    const interval = setInterval(() => {
      socket?.emit("meeting:recording-sync", {
        meetingId: id,
        currentSeconds: recordingTime,
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isRecording, recordingTime, id, socket, isRecorderActive]);

  // Open preview modal automatically when recording finishes
  useEffect(() => {
    if (recordedResult) {
      setIsPreviewModalOpen(true);
    }
  }, [recordedResult]);

  // Auto-pause recording if recorder is alone in the room, and auto-resume when participants join
  useEffect(() => {
    if (!isRecorderActive()) {
      isAutoPausedDueToEmptyRoomRef.current = false;
      return;
    }

    if (peers.length === 0) {
      if (!isPaused && !isAutoPausedDueToEmptyRoomRef.current) {
        pauseRecording();
        socket?.emit("meeting:recording-paused", {
          meetingId: id,
          currentSeconds: recordingTime,
        });
        isAutoPausedDueToEmptyRoomRef.current = true;
        toast.info("⏸️ Recording auto-paused (waiting for participants to join)");
      }
    } else {
      if (isPaused && isAutoPausedDueToEmptyRoomRef.current) {
        resumeRecording();
        socket?.emit("meeting:recording-resumed", { meetingId: id });
        isAutoPausedDueToEmptyRoomRef.current = false;
        toast.info("▶️ Recording auto-resumed (participant joined)");
      }
    }
  }, [
    peers.length,
    isPaused,
    isRecorderActive,
    pauseRecording,
    resumeRecording,
    socket,
    id,
  ]);

  // Listen for host ending or auto-concluded meeting
  useEffect(() => {
    if (!socket) return;

    const handleMeetingEnded = async (data: {
      meetingId: string;
      message: string;
    }) => {
      if (data.meetingId === id) {
        if (isEndingMeetingRef.current) return;
        toast.info(data.message || "Meeting has been ended");

        const activeRecording = isRecorderActive();
        const hasPendingRecordings = pendingRecordingsRef.current.length > 0;

        if (activeRecording || hasPendingRecordings) {
          try {
            if (activeRecording) {
              const fresh = await stopRecording(true);
              if (fresh) {
                pendingRecordingsRef.current.push(fresh);
              }
            }
            const recordingsToSave = [...pendingRecordingsRef.current];
            pendingRecordingsRef.current = [];
            clearRecordedResult();
            if (recordingsToSave.length > 0 && id) {
              for (let i = 0; i < recordingsToSave.length; i++) {
                const rec = recordingsToSave[i];
                const currentCount = meeting?.recordings?.length || 0;
                const partNumber = currentCount + i + 1;
                const finalDuration = rec.duration > 0 ? rec.duration : 1;
                await uploadMeetingRecording(id, rec.blob, {
                  title: `${meeting?.title || "Meeting"} - Recording ${partNumber}`,
                  duration: finalDuration,
                  size: rec.size,
                });
              }
            }
          } catch (recErr) {
            console.error("Save recording on meeting ended error:", recErr);
          }
        }

        stopLocalStream();
        closeAllPeers();
        resetMeeting();
        await queryClient.invalidateQueries({ queryKey: ["meeting", id] });
        await queryClient.invalidateQueries({ queryKey: ["meetings"] });
        navigate(`/meetings/${id}/details`, { replace: true });
      }
    };

    socket.on("meeting:ended", handleMeetingEnded);

    return () => {
      socket.off("meeting:ended", handleMeetingEnded);
    };
  }, [
    socket,
    id,
    isRecording,
    isRecorderActive,
    stopRecording,
    clearRecordedResult,
    meeting?.title,
    stopLocalStream,
    closeAllPeers,
    resetMeeting,
    navigate,
    queryClient,
  ]);

  // Listen for screen share and recording events across the room
  useEffect(() => {
    if (!socket) return;

    const handleScreenStart = ({ userId, name }: { userId: string; name?: string }) => {
      setScreenSharingUserId(userId);
      if (!user?.id || String(userId) !== String(user.id)) {
        toast.info(`${name || "Someone"} started screen sharing`);
      }
    };

    const handleScreenStop = () => {
      setScreenSharingUserId(null);
      toast.info("Screen sharing ended");
    };

    const handleRecordStart = (data: {
      userId?: string;
      name?: string;
      startedAt?: number;
      elapsedSeconds?: number;
      isSilent?: boolean;
    }) => {
      const recorderName = data.name || "Host";
      const startTimestamp = data.startedAt || Date.now();
      setRecordingState(true, data.userId, recorderName, startTimestamp);
      const elapsed =
        typeof data.elapsedSeconds === "number"
          ? data.elapsedSeconds
          : Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
      setRemoteRecordingTime(elapsed);
      setRemoteIsPaused(false);
      if (!data.isSilent) {
        toast.info("🔴 Recording Started by Host");
        playRecordingStartChime();
      }
    };

    const handleRecordSync = ({ currentSeconds }: { currentSeconds?: number }) => {
      if (typeof currentSeconds === "number" && !isRecorderActive()) {
        setRemoteRecordingTime(currentSeconds);
      }
    };

    const handleRecordStop = async () => {
      setRecordingState(false);
      setRemoteIsPaused(false);
      setRemoteRecordingTime(0);
      toast.info("Recording stopped");
      playRecordingStopChime();
      if (isRecorderActive()) {
        try {
          const result = await stopRecording(true);
          if (result) {
            pendingRecordingsRef.current.push(result);
          }
          clearRecordedResult();
        } catch (err) {
          console.error("Delegated recorder stop error:", err);
        }
      }
    };

    const handleRecordPaused = (data?: { currentSeconds?: number }) => {
      setRemoteIsPaused(true);
      if (typeof data?.currentSeconds === "number") {
        setRemoteRecordingTime(data.currentSeconds);
      }
      toast.info("⏸️ Recording Paused by Host");
    };

    const handleRecordResumed = () => {
      setRemoteIsPaused(false);
      toast.info("▶️ Recording Resumed by Host");
    };

    // Handle force mute by meeting host
    const handleForceMute = (data?: { mutedBy?: string; isMuteAll?: boolean }) => {
      if (isHost) return;

      const { localStream, setIsMuted, isVideoOn } = useMeetingStore.getState();

      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      setIsMuted(true);

      socket.emit("meeting:media-state", {
        meetingId: id,
        isMuted: true,
        isVideoOn,
      });

      const mutedBy = data?.mutedBy || "Host";
      if (data?.isMuteAll) {
        toast.info(`🔇 ${mutedBy} muted all participants`);
      } else {
        toast.info(`🔇 ${mutedBy} muted your microphone`);
      }
    };

    const handleUserJoined = (data: {
      userId: string;
      name?: string;
      username?: string;
    }) => {
      const currentUserId = user?.id || (user as any)?._id;
      if (currentUserId && String(data.userId) === String(currentUserId)) return;

      const userIdStr = String(data.userId);
      const now = Date.now();
      const lastNotified = lastJoinToastRef.current.get(userIdStr) || 0;
      if (now - lastNotified < 3000) return; // Ignore duplicate join events within 3 seconds
      lastJoinToastRef.current.set(userIdStr, now);
      lastLeftToastRef.current.delete(userIdStr);

      const hostId = (meeting?.host?._id || meeting?.host)?.toString();
      const isHostJoining = hostId && userIdStr === String(hostId);
      const peer = useMeetingStore
        .getState()
        .peers.find((p) => String(p.userId) === userIdStr);
      const displayName =
        data.name ||
        data.username ||
        peer?.name ||
        peer?.username ||
        (isHostJoining ? "Host" : "Participant");

      toast.info(`${displayName} joined`, {
        id: `user-joined-${userIdStr}`,
      });
    };

    const handleUserLeft = (data: {
      userId: string;
      name?: string;
      username?: string;
    }) => {
      const currentUserId = user?.id || (user as any)?._id;
      if (currentUserId && String(data.userId) === String(currentUserId)) return;

      const userIdStr = String(data.userId);
      const now = Date.now();
      const lastNotified = lastLeftToastRef.current.get(userIdStr) || 0;
      if (now - lastNotified < 3000) return; // Ignore duplicate left events within 3 seconds
      lastLeftToastRef.current.set(userIdStr, now);
      lastJoinToastRef.current.delete(userIdStr);

      const hostId = (meeting?.host?._id || meeting?.host)?.toString();
      const isHostLeaving = hostId && userIdStr === String(hostId);
      const peer = useMeetingStore
        .getState()
        .peers.find((p) => String(p.userId) === userIdStr);
      const displayName =
        data.name ||
        data.username ||
        peer?.name ||
        peer?.username ||
        (isHostLeaving ? "Host" : "Participant");

      toast.info(`${displayName} left`, {
        id: `user-left-${userIdStr}`,
      });
    };

    socket.on("meeting:screen-share-started", handleScreenStart);
    socket.on("meeting:screen-share-stopped", handleScreenStop);
    socket.on("meeting:recording-started", handleRecordStart);
    socket.on("meeting:recording-stopped", handleRecordStop);
    socket.on("meeting:recording-paused", handleRecordPaused);
    socket.on("meeting:recording-resumed", handleRecordResumed);
    socket.on("meeting:recording-sync", handleRecordSync);
    socket.on("meeting:user-joined", handleUserJoined);
    socket.on("meeting:user-left", handleUserLeft);
    socket.on("meeting:force-mute", handleForceMute);
    socket.on("meeting:force-mute-all", handleForceMute);

    return () => {
      socket.off("meeting:screen-share-started", handleScreenStart);
      socket.off("meeting:screen-share-stopped", handleScreenStop);
      socket.off("meeting:recording-started", handleRecordStart);
      socket.off("meeting:recording-stopped", handleRecordStop);
      socket.off("meeting:recording-paused", handleRecordPaused);
      socket.off("meeting:recording-resumed", handleRecordResumed);
      socket.off("meeting:recording-sync", handleRecordSync);
      socket.off("meeting:user-joined", handleUserJoined);
      socket.off("meeting:user-left", handleUserLeft);
      socket.off("meeting:force-mute", handleForceMute);
      socket.off("meeting:force-mute-all", handleForceMute);
    };
  }, [
    socket,
    setScreenSharingUserId,
    setRecordingState,
    isHost,
    id,
    user?.id,
    meeting?.host,
  ]);

  const executeLeaveMeeting = async () => {
    if (isLeavingMeetingRef.current || isEndingMeetingRef.current) return;
    isLeavingMeetingRef.current = true;

    if (isScreenSharing) {
      stopScreenShare().catch(() => {});
    }

    const activeRecording = isRecorderActive();

    if (activeRecording) {
      try {
        const fresh = await stopRecording(true);
        if (fresh) {
          pendingRecordingsRef.current.push(fresh);
        }
      } catch (e) {
        console.warn("Stop recording on leave error:", e);
      }
    }

    // 1. Immediately cut off local mic & camera so voice stops transmitting instantly
    stopLocalStream();
    closeAllPeers();

    // 2. Emit leave socket event immediately
    if (id) {
      socket?.emit("meeting:leave", { meetingId: id });
      leaveMeeting(id).catch((err) => console.error("Leave error:", err));
    }

    // 3. Process and upload recordings if host was recording
    const recordingsToSave = [...pendingRecordingsRef.current];
    pendingRecordingsRef.current = [];
    clearRecordedResult();
    setRecordingState(false);
    socket?.emit("meeting:recording-stopped", { meetingId: id });

    if (recordingsToSave.length > 0 && id) {
      const toastId = toast.loading("Saving meeting recording to Cloudinary... Please wait.");
      try {
        for (let i = 0; i < recordingsToSave.length; i++) {
          const rec = recordingsToSave[i];
          const currentCount = meeting?.recordings?.length || 0;
          const partNumber = currentCount + i + 1;
          const finalDuration = rec.duration > 0 ? rec.duration : 1;
          await uploadMeetingRecording(id, rec.blob, {
            title: `${meeting?.title || "Meeting"} - Recording ${partNumber}`,
            duration: finalDuration,
            size: rec.size,
          });
        }
        toast.success("Recording saved!", { id: toastId });
      } catch (err) {
        console.error("Save recording on leave error:", err);
        toast.error("Failed to upload recording to cloud. Please check network.", { id: toastId });
      }
    }

    resetMeeting();
    if (id) {
      await queryClient.invalidateQueries({ queryKey: ["meeting", id] });
    }
    await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    navigate(isHost ? `/meetings/${id}/details` : "/meetings", { replace: true });
  };

  const handleLeave = () => {
    const activeRecording = isRecorderActive();
    const hasPendingRecordings = pendingRecordingsRef.current.length > 0;

    // If host has an active or pending recording and there are other participants in the room,
    // prompt host with options to avoid accidental disconnects
    if (isHost && (activeRecording || hasPendingRecordings) && peers.length > 0) {
      setIsHostLeaveWarningOpen(true);
      return;
    }

    executeLeaveMeeting();
  };

  const handleEndMeeting = async () => {
    if (!id || isEndingMeetingRef.current) return;
    isEndingMeetingRef.current = true;

    if (isScreenSharing) {
      stopScreenShare().catch(() => {});
    }

    const activeRecording = isRecorderActive();
    if (activeRecording) {
      try {
        const fresh = await stopRecording(true);
        if (fresh) {
          pendingRecordingsRef.current.push(fresh);
        }
      } catch (e) {
        console.warn("Stop recording on end error:", e);
      }
    }

    // 1. Immediately cut off local mic & camera so NO voice continues playing to other participants
    stopLocalStream();
    closeAllPeers();

    // 2. Broadcast meeting:end immediately so all participants exit to details instantly
    try {
      socket?.emit("meeting:end", { meetingId: id });
      socket?.emit("meeting:leave", { meetingId: id });
      endMeeting(id).catch((err) => console.error("End meeting API error:", err));
      toast.success("Meeting ended");
    } catch (err) {
      console.error("End meeting error:", err);
    }

    // 3. Process pending recordings and upload directly to Cloudinary
    const recordingsToSave = [...pendingRecordingsRef.current];
    pendingRecordingsRef.current = [];
    clearRecordedResult();
    setRecordingState(false);
    socket?.emit("meeting:recording-stopped", { meetingId: id });

    if (recordingsToSave.length > 0 && id) {
      const toastId = toast.loading("Saving meeting recording to Cloudinary... Please wait.");
      try {
        for (let i = 0; i < recordingsToSave.length; i++) {
          const rec = recordingsToSave[i];
          const currentCount = meeting?.recordings?.length || 0;
          const partNumber = currentCount + i + 1;
          const finalDuration = rec.duration > 0 ? rec.duration : 1;
          await uploadMeetingRecording(id, rec.blob, {
            title: `${meeting?.title || "Meeting"} - Recording ${partNumber}`,
            duration: finalDuration,
            size: rec.size,
          });
        }
        toast.success("Recording saved to Meeting Details!", { id: toastId });
      } catch (err) {
        console.error("Auto upload recording on end:", err);
        toast.error("Failed to upload recording to cloud. Please check network.", { id: toastId });
      }
    }

    resetMeeting();
    await queryClient.invalidateQueries({ queryKey: ["meeting", id] });
    await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    navigate(`/meetings/${id}/details`, { replace: true });
  };

  // Toggle screen sharing on/off
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      setIsScreenSharing(false);
      setScreenSharingUserId(null);
      socket?.emit("meeting:screen-share-stopped", { meetingId: id });
    } else {
      try {
        await startScreenShare();
        setIsScreenSharing(true);
        setScreenSharingUserId(user?.id || "local");
        socket?.emit("meeting:screen-share-started", { meetingId: id });
      } catch (error: any) {
        console.error("Screen share failed:", error);
        if (error.name === "NotAllowedError") {
          toast.info("Screen sharing cancelled");
        } else {
          toast.error(error.message || "Failed to start screen sharing");
        }
      }
    }
  };

  // Toggle composite recording on/off (host only)
  const handleToggleRecording = () => {
    if (isRecording) {
      // Show confirmation popup: Keep Recording vs Stop Recording
      setIsStopConfirmModalOpen(true);
    } else {
      // Open Google Meet consent confirmation modal
      setIsConsentModalOpen(true);
    }
  };

  // Continue recording uninterrupted
  const handleContinueRecording = () => {
    setIsStopConfirmModalOpen(false);
    toast.info("Continuing meeting recording...");
  };

  // Stop recording mid-meeting (does NOT upload mid-meeting; will be saved automatically when meeting ends)
  const handleDoneRecording = async () => {
    try {
      const result = await stopRecording(true);
      if (result) {
        pendingRecordingsRef.current.push(result);
      }
      setRecordingState(false);
      socket?.emit("meeting:recording-stopped", { meetingId: id });
      toast.info("Recording part stopped. It will be saved automatically when the meeting ends.");
    } catch (err) {
      console.error("Stop recording error:", err);
      toast.error("Failed to stop recording");
    } finally {
      setIsStopConfirmModalOpen(false);
      clearRecordedResult();
    }
  };

  // Confirmed start from Google Meet consent modal
  const handleConfirmStartRecording = async () => {
    try {
      const now = Date.now();
      await startRecording();
      setRecordingState(true, user?.id, user?.name, now);
      socket?.emit("meeting:recording-started", { meetingId: id, startedAt: now });
      toast.success("Recording Started by Host");
    } catch (error) {
      console.error("Recording failed:", error);
      toast.error("Failed to start recording");
    }
  };

  // Pause composite recording (host only)
  const handlePauseRecording = () => {
    isAutoPausedDueToEmptyRoomRef.current = false;
    pauseRecording();
    socket?.emit("meeting:recording-paused", {
      meetingId: id,
      currentSeconds: recordingTime,
    });
    toast.info("Recording paused");
  };

  // Resume composite recording (host only)
  const handleResumeRecording = () => {
    isAutoPausedDueToEmptyRoomRef.current = false;
    resumeRecording();
    socket?.emit("meeting:recording-resumed", { meetingId: id });
    toast.info("Recording resumed");
  };

  // Host moderation: Mute specific participant
  const handleMuteParticipant = (targetUserId: string, targetName: string) => {
    if (!socket || !id || !isHost) return;
    socket.emit("meeting:mute-participant", {
      meetingId: id,
      targetUserId,
    });
    toast.info(`Muted ${targetName}`);
  };

  // Host moderation: Mute all non-host participants
  const handleMuteAll = () => {
    if (!socket || !id || !isHost) return;
    socket.emit("meeting:mute-all", {
      meetingId: id,
    });
    toast.info("Muted all participants");
  };

  // Redirect to Details if meeting has concluded
  useEffect(() => {
    if (meeting?.status === "completed" || meeting?.status === "cancelled" || meeting?.status === "expired") {
      toast.info(
        meeting?.status === "expired"
          ? "This meeting has expired."
          : meeting?.status === "cancelled"
          ? "This meeting was cancelled."
          : "This meeting has concluded."
      );
      navigate(`/meetings/${id}/details`, { replace: true });
    }
  }, [meeting?.status, id, navigate]);

  const isLocalSharing = Boolean(
    isScreenSharing ||
      (screenSharingUserId && user?.id && String(screenSharingUserId) === String(user.id)) ||
      screenSharingUserId === "local"
  );

  const isAnyScreenSharing = Boolean(isLocalSharing || screenSharingUserId);

  const presenterPeer =
    !isLocalSharing && screenSharingUserId
      ? peers.find(
          (p) =>
            String(p.userId) === String(screenSharingUserId) ||
            p.userId === screenSharingUserId
        )
      : null;

  const hostUserId = (meeting?.host?._id || meeting?.host)?.toString();
  const isPresenterHost = isLocalSharing
    ? isHost
    : presenterPeer
    ? hostUserId === presenterPeer.userId?.toString()
    : hostUserId === screenSharingUserId?.toString();

  const presenterName = isLocalSharing
    ? user?.name || (isHost ? "Host" : "Member")
    : presenterPeer?.name || (isPresenterHost ? "Host" : "Member");

  const presenterStream = isLocalSharing
    ? localStream
    : presenterPeer?.stream || null;

  const screenPresenter = isAnyScreenSharing
    ? {
        name: presenterName,
        stream: presenterStream,
        isLocal: isLocalSharing,
        isHost: isPresenterHost,
      }
    : null;

  const effectiveIsPaused = isHost ? isPaused : remoteIsPaused;

  const activeRecordingSeconds = isHost
    ? recordingTime
    : remoteRecordingTime;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none">
      {/* Top Header Bar */}
      <div className="border-b border-gray-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between text-white bg-gray-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] shrink-0" />
          <h1
            className="text-sm sm:text-base font-semibold text-gray-100 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs md:max-w-md"
            title={meeting?.title}
          >
            {meeting?.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 text-sm text-gray-400 shrink-0">
          {/* People / Participants Drawer Toggle Button */}
          <Button
            variant={isParticipantsOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setIsParticipantsOpen((v) => {
                const next = !v;
                if (next) setIsChatOpen(false);
                return next;
              });
            }}
            className="text-gray-300 hover:text-white rounded-lg relative px-2 sm:px-3 h-8 sm:h-9"
            title="Toggle participants list"
          >
            <Users className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">People</span>
            <span className="ml-1 sm:ml-1.5 px-1.5 py-0.2 bg-gray-800 text-[10px] sm:text-[11px] font-medium rounded-full text-gray-300 border border-gray-700/60">
              {peers.length + 1}
            </span>
          </Button>

          {meeting?.workspace && (
            <span className="hidden md:inline-flex text-xs font-medium bg-gray-800/80 text-gray-300 px-2.5 py-1 rounded border border-gray-700/50 truncate max-w-[120px]">
              {meeting.workspace.name}
            </span>
          )}

          {/* Google Meet Recording Badge with Live Pulse & Time */}
          {isRecording && (
            <div
              className={`flex items-center gap-1.5 sm:gap-2 border px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium shadow-sm animate-in fade-in ${
                effectiveIsPaused
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-red-500/15 border-red-500/30 text-red-400"
              }`}
              title={
                effectiveIsPaused
                  ? "Recording is paused"
                  : `Meeting is being recorded${recordingUserName ? ` by ${recordingUserName}` : ""}`
              }
            >
              <span
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  effectiveIsPaused
                    ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                    : "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                }`}
              />
              <span className="font-semibold tracking-wider text-[10px] sm:text-xs">
                {effectiveIsPaused ? "PAUSED" : "REC"}
              </span>
              <span
                className={`font-mono text-white/90 text-[10px] sm:text-[11px] pl-1 sm:pl-1.5 border-l ${
                  effectiveIsPaused ? "border-amber-500/30" : "border-red-500/30"
                }`}
              >
                {formatTime(activeRecordingSeconds)}
              </span>
            </div>
          )}

          <Button
            variant={isChatOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setIsChatOpen((v) => {
                const next = !v;
                if (next) {
                  setIsParticipantsOpen(false);
                  setUnreadCount(0);
                }
                return next;
              });
            }}
            className="text-gray-300 hover:text-white rounded-lg relative px-2 sm:px-3 h-8 sm:h-9"
            title="Toggle in-meeting chat"
          >
            <MessageSquare className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="ml-1 sm:ml-1.5 px-1.5 py-0.5 bg-blue-600 text-[10px] font-bold rounded-full text-white shadow-sm shadow-blue-500/50 animate-pulse">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Video Room Layout */}
      <div className="flex-1 flex overflow-hidden">
        {isAnyScreenSharing && screenPresenter ? (
          /* Screen Sharing View: Large Primary Screen Stage + Bottom Horizontal Row */
          <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
            {/* Primary Large Screen Share Stage */}
            <div className="flex-1 min-h-0 bg-black/95 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative flex items-center justify-center">
              <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-black/75 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full border border-gray-700/60 shadow-lg select-none">
                <Monitor className="w-4 h-4 text-blue-400 animate-pulse" />
                <span>
                  <strong className="text-blue-300">{screenPresenter.name}</strong>{" "}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                    screenPresenter.isHost
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  }`}>
                    {screenPresenter.isHost ? "Host" : "Member"}
                  </span>{" "}
                  is presenting screen
                </span>
              </div>

              <VideoTile
                stream={screenPresenter.stream}
                name={screenPresenter.name}
                profilePicture={isLocalSharing ? user?.profilePicture : presenterPeer?.profilePicture}
                isLocal={screenPresenter.isLocal}
                isScreenSharing
                isHost={screenPresenter.isHost}
                isSpeaking={isSpeaking(screenPresenter.isLocal ? (user?.id || "") : (presenterPeer?.userId || ""))}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Bottom Single Horizontal Row for Members */}
            <div className="h-32 sm:h-36 md:h-40 shrink-0 flex items-center gap-3 overflow-x-auto p-2 bg-gray-900/60 border border-gray-800/80 rounded-2xl scrollbar-thin">
              {/* Local user tile (when remote peer is presenting) */}
              {!isLocalSharing && (
                <div className="h-full aspect-video shrink-0 rounded-xl overflow-hidden shadow-md border border-gray-800/80">
                  <VideoTile
                    stream={localStream}
                    name={user?.name || "You"}
                    profilePicture={user?.profilePicture}
                    isMuted={isMuted}
                    isVideoOn={isVideoOn}
                    isLocal
                    isHost={isHost}
                    isSpeaking={isSpeaking(user?.id || "")}
                  />
                </div>
              )}

              {/* Local user tile as presenter (shows camera/avatar in bottom row while presenting) */}
              {isLocalSharing && (
                <div className="h-full aspect-video shrink-0 rounded-xl overflow-hidden shadow-md border border-blue-500/40 ring-1 ring-blue-500/30">
                  <VideoTile
                    stream={localStream}
                    name={user?.name || "You"}
                    profilePicture={user?.profilePicture}
                    isMuted={isMuted}
                    isVideoOn={isVideoOn}
                    isLocal
                    isHost={isHost}
                    isSpeaking={isSpeaking(user?.id || "")}
                  />
                </div>
              )}

              {/* Other remote peers */}
              {peers
                .filter(
                  (p) =>
                    !screenSharingUserId ||
                    String(p.userId) !== String(screenSharingUserId)
                )
                .map((peer) => (
                  <div
                    key={peer.userId}
                    className="h-full aspect-video shrink-0 rounded-xl overflow-hidden shadow-md border border-gray-800/80"
                  >
                    <VideoTile
                      stream={peer.stream || null}
                      name={peer.name}
                      profilePicture={peer.profilePicture}
                      isMuted={peer.isMuted}
                      isVideoOn={peer.isVideoOn}
                      isHost={(meeting?.host?._id || meeting?.host)?.toString() === peer.userId?.toString()}
                      isSpeaking={isSpeaking(peer.userId)}
                    />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* Normal Grid View when no one is sharing screen */
          <div className="flex-1 p-4 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <VideoTile
                stream={localStream}
                name={user?.name || "You"}
                profilePicture={user?.profilePicture}
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                isLocal
                isHost={isHost}
                isScreenSharing={isLocalSharing}
                isSpeaking={isSpeaking(user?.id || "")}
              />

              {peers.map((peer) => (
                <VideoTile
                  key={peer.userId}
                  stream={peer.stream || null}
                  name={peer.name}
                  profilePicture={peer.profilePicture}
                  isMuted={peer.isMuted}
                  isVideoOn={peer.isVideoOn}
                  isHost={meeting?.host?._id === peer.userId}
                  isSpeaking={isSpeaking(peer.userId)}
                  isScreenSharing={Boolean(
                    screenSharingUserId &&
                      String(screenSharingUserId) === String(peer.userId)
                  )}
                />
              ))}
            </div>

            {peers.length === 0 && (
              <div className="text-center text-gray-400 mt-12">
                <p className="text-base text-gray-300">Waiting for other members to join...</p>
                <p className="text-xs mt-1.5 text-gray-500">
                  Invited participants will join automatically from their dashboard.
                </p>
              </div>
            )}
          </div>
        )}

        {isParticipantsOpen && (
          <ParticipantList
            currentUser={{
              id: user?.id || "",
              name: user?.name || "You",
              profilePicture: user?.profilePicture,
              isMuted,
              isVideoOn,
              isScreenSharing: isLocalSharing,
              isHost,
            }}
            peers={peers}
            meetingHostId={(meeting?.host?._id || meeting?.host)?.toString()}
            screenSharingUserId={screenSharingUserId}
            isSpeaking={isSpeaking}
            onMuteParticipant={handleMuteParticipant}
            onMuteAll={handleMuteAll}
            onClose={() => setIsParticipantsOpen(false)}
          />
        )}

        {isChatOpen && (
          <ChatPanel
            messages={messages}
            typingUsers={typingUsers}
            isHost={isHost}
            mentionSuggestions={mentionCandidates}
            onSend={sendMessage}
            onTyping={sendTyping}
            onDelete={deleteMessage}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* Google Meet Bottom Controls Bar */}
      <MeetingControls
        onLeave={handleLeave}
        onEnd={() => setIsEndConfirmModalOpen(true)}
        isHost={isHost}
        socket={socket}
        meetingId={id}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onPauseRecording={handlePauseRecording}
        onResumeRecording={handleResumeRecording}
        isPaused={effectiveIsPaused}
        recordingTime={activeRecordingSeconds}
      />

      {/* Google Meet Start Recording Confirmation Modal */}
      <RecordConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onConfirm={handleConfirmStartRecording}
        meetingTitle={meeting?.title}
      />

      {/* Mid-Meeting Stop Confirmation Modal (Keep Recording vs Stop Recording) */}
      <RecordStopConfirmModal
        isOpen={isStopConfirmModalOpen}
        onContinue={handleContinueRecording}
        onDone={handleDoneRecording}
        recordingTime={activeRecordingSeconds}
        meetingTitle={meeting?.title}
      />

      {/* Google Meet Recording Saved & Video Preview Modal */}
      <RecordingPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          clearRecordedResult();
        }}
        result={recordedResult}
        meetingTitle={meeting?.title}
        meetingId={id}
      />

      {/* Host Leave Warning Modal (prompt to End & Save or Stop & Leave) */}
      <HostLeaveWarningModal
        isOpen={isHostLeaveWarningOpen}
        onCancel={() => setIsHostLeaveWarningOpen(false)}
        onEndMeeting={() => {
          setIsHostLeaveWarningOpen(false);
          handleEndMeeting();
        }}
        onLeaveOnly={() => {
          setIsHostLeaveWarningOpen(false);
          executeLeaveMeeting();
        }}
        meetingTitle={meeting?.title}
        isRecordingActive={isRecorderActive()}
      />

      {/* Host End Meeting Confirmation Modal */}
      <EndMeetingConfirmModal
        isOpen={isEndConfirmModalOpen}
        onClose={() => setIsEndConfirmModalOpen(false)}
        onConfirm={() => {
          setIsEndConfirmModalOpen(false);
          handleEndMeeting();
        }}
        meetingTitle={meeting?.title}
        isRecordingActive={isRecorderActive()}
      />
    </div>
  );
}