// Main video call room with WebRTC, chat sidebar, screen share, and Google Meet recording
// Shows local and remote videos, dynamic composite recording, recording preview, and meeting controls

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, Loader2, MessageSquare, Monitor } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useChat } from "@/hooks/useChat";
import { useCompositeRecording } from "@/hooks/useCompositeRecording";
import { useMeetingStore } from "@/store/meetingStore";
import { useAuthStore } from "@/store/authStore";
import {
  getMeetingById,
  joinMeeting,
  leaveMeeting,
  endMeeting,
} from "@/services/meetingService";
import { VideoTile } from "@/components/Meetings/VideoTile";
import { MeetingControls } from "@/components/Meetings/MeetingControls";
import { ChatPanel } from "@/components/Chat/ChatPanel";
import { RecordConsentModal } from "@/components/Meetings/RecordConsentModal";
import { RecordingPreviewModal } from "@/components/Meetings/RecordingPreviewModal";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [remoteRecordingTime, setRemoteRecordingTime] = useState(0);

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
    recordingStartTime,
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
  });

  const isHost = meeting?.host._id === user?.id;

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
    downloadRecording,
    clearRecordedResult,
  } = useCompositeRecording();

  // Set current meeting id and call join API
  useEffect(() => {
    if (!id) return;
    setCurrentMeetingId(id);
    joinMeeting(id).catch(() => {});
  }, [id, setCurrentMeetingId]);

  // Emit socket join and initial media state
  useEffect(() => {
    if (!socket || !isConnected || !id) return;

    socket.emit("meeting:join", { meetingId: id });

    const timer = setTimeout(() => {
      const { isMuted, isVideoOn } = useMeetingStore.getState();
      socket.emit("meeting:media-state", {
        meetingId: id,
        isMuted,
        isVideoOn,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [socket, isConnected, id]);

  // Start local camera and microphone
  useEffect(() => {
    if (socket && isConnected && id) {
      startLocalStream().catch(() => {
        toast.error("Failed to access camera and microphone");
      });
    }
  }, [socket, isConnected, id, startLocalStream]);

  // Remote recording timer calculation for non-host participants
  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      setRemoteRecordingTime(0);
      return;
    }
    const updateTime = () => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      setRemoteRecordingTime(Math.max(0, elapsed));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  // Open preview modal automatically when recording finishes
  useEffect(() => {
    if (recordedResult) {
      setIsPreviewModalOpen(true);
    }
  }, [recordedResult]);

  // Listen for host ending the meeting
  useEffect(() => {
    if (!socket) return;

    const handleMeetingEnded = async (data: {
      meetingId: string;
      message: string;
    }) => {
      if (data.meetingId === id) {
        toast.error(data.message || "Meeting has been ended by the host");
        stopLocalStream();
        closeAllPeers();
        resetMeeting();
        await queryClient.invalidateQueries({ queryKey: ["meetings"] });
        navigate(`/meetings/${id}/details`);
      }
    };

    socket.on("meeting:ended", handleMeetingEnded);

    return () => {
      socket.off("meeting:ended", handleMeetingEnded);
    };
  }, [
    socket,
    id,
    stopLocalStream,
    closeAllPeers,
    resetMeeting,
    navigate,
    queryClient,
  ]);

  // Listen for screen share and recording events across the room
  useEffect(() => {
    if (!socket) return;

    const handleJoined = (data: {
      screenSharingUserId?: string | null;
      isRecording?: boolean;
      recordingUserId?: string | null;
    }) => {
      if (data.screenSharingUserId) {
        setScreenSharingUserId(data.screenSharingUserId);
      }
      if (data.isRecording) {
        setRecordingState(true, data.recordingUserId, "Host", Date.now());
      }
    };

    const handleScreenStart = ({ userId }: { userId: string }) => {
      setScreenSharingUserId(userId);
      toast.info("Someone started screen sharing");
    };

    const handleScreenStop = () => {
      setScreenSharingUserId(null);
    };

    const handleRecordStart = (data: {
      userId?: string;
      name?: string;
      startedAt?: number;
    }) => {
      const recorderName = data.name || "Host";
      setRecordingState(true, data.userId, recorderName, data.startedAt || Date.now());
      toast.info(`🔴 ${recorderName} started recording this meeting`);
      playRecordingStartChime();
    };

    const handleRecordStop = () => {
      setRecordingState(false);
      toast.info("Recording stopped");
      playRecordingStopChime();
    };

    socket.on("meeting:joined", handleJoined);
    socket.on("meeting:screen-share-started", handleScreenStart);
    socket.on("meeting:screen-share-stopped", handleScreenStop);
    socket.on("meeting:recording-started", handleRecordStart);
    socket.on("meeting:recording-stopped", handleRecordStop);

    return () => {
      socket.off("meeting:joined", handleJoined);
      socket.off("meeting:screen-share-started", handleScreenStart);
      socket.off("meeting:screen-share-stopped", handleScreenStop);
      socket.off("meeting:recording-started", handleRecordStart);
      socket.off("meeting:recording-stopped", handleRecordStop);
    };
  }, [socket, setScreenSharingUserId, setRecordingState]);

  const handleLeave = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    }

    if (isRecording) {
      const result = await stopRecording();
      setRecordingState(false);
      socket?.emit("meeting:recording-stopped", { meetingId: id });
      if (result) {
        downloadRecording(result);
      }
    }

    if (id) {
      try {
        socket?.emit("meeting:leave", { meetingId: id });
        await leaveMeeting(id);
      } catch (err) {
        console.error("Leave error:", err);
      }
    }

    stopLocalStream();
    closeAllPeers();
    resetMeeting();

    await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    navigate("/meetings");
  };

  const handleEndMeeting = async () => {
    if (!id) return;

    if (isScreenSharing) {
      await stopScreenShare();
    }

    if (isRecording) {
      const result = await stopRecording();
      setRecordingState(false);
      socket?.emit("meeting:recording-stopped", { meetingId: id });
      if (result) {
        downloadRecording(result);
      }
    }

    try {
      socket?.emit("meeting:leave", { meetingId: id });
      await endMeeting(id);
      toast.success("Meeting ended");
    } catch (err) {
      console.error("End meeting error:", err);
      toast.error("Failed to end meeting");
    }

    stopLocalStream();
    closeAllPeers();
    resetMeeting();

    await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    navigate("/meetings");
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
      } catch (error) {
        console.error("Screen share failed:", error);
        toast.error("Failed to start screen sharing");
      }
    }
  };

  // Toggle composite recording on/off (host only)
  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording().then((result) => {
        setRecordingState(false);
        socket?.emit("meeting:recording-stopped", { meetingId: id });
        toast.success("Recording saved");
        if (result) {
          setIsPreviewModalOpen(true);
        }
      });
    } else {
      // Open Google Meet consent confirmation modal
      setIsConsentModalOpen(true);
    }
  };

  // Confirmed start from Google Meet consent modal
  const handleConfirmStartRecording = async () => {
    try {
      await startRecording();
      setRecordingState(true, user?.id, user?.name, Date.now());
      socket?.emit("meeting:recording-started", { meetingId: id });
      toast.success("Recording started");
    } catch (error) {
      console.error("Recording failed:", error);
      toast.error("Failed to start recording");
    }
  };

  // Redirect to Details if meeting has concluded
  useEffect(() => {
    if (meeting?.status === "completed" || meeting?.status === "cancelled") {
      toast.info("This meeting has concluded. Viewing details.");
      navigate(`/meetings/${id}/details`, { replace: true });
    }
  }, [meeting?.status, id, navigate]);

  const isAnyScreenSharing =
    isScreenSharing ||
    (!!screenSharingUserId && peers.some((p) => p.userId === screenSharingUserId));

  const screenPresenter = isScreenSharing
    ? { name: user?.name || "You", stream: localStream, isLocal: true }
    : screenSharingUserId
    ? {
        name:
          peers.find((p) => p.userId === screenSharingUserId)?.name ||
          "Participant",
        stream:
          peers.find((p) => p.userId === screenSharingUserId)?.stream || null,
        isLocal: false,
      }
    : null;

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
      <div className="border-b border-gray-800/80 px-6 py-3 flex items-center justify-between text-white bg-gray-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          <h1 className="text-base font-medium text-gray-100">{meeting?.title}</h1>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="flex items-center gap-1.5 bg-gray-800/60 px-2.5 py-1 rounded-full text-xs">
            <Users className="h-3.5 w-3.5 text-gray-400" />
            <span>{peers.length + 1}</span>
          </div>

          <span className="text-xs font-mono bg-gray-800/80 text-gray-300 px-2.5 py-1 rounded border border-gray-700/50">
            {meeting?.meetingCode}
          </span>

          {/* Google Meet Recording Badge with Live Pulse & Time */}
          {isRecording && (
            <div
              className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1 rounded-full text-xs font-medium shadow-sm animate-in fade-in"
              title={`Meeting is being recorded${recordingUserName ? ` by ${recordingUserName}` : ""}`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="font-semibold tracking-wider">REC</span>
              <span className="font-mono text-white/90 text-[11px] pl-1.5 border-l border-red-500/30">
                {formatTime(isHost ? recordingTime : remoteRecordingTime)}
              </span>
            </div>
          )}

          <Button
            variant={isChatOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setIsChatOpen((v) => !v);
              if (!isChatOpen) setUnreadCount(0);
            }}
            className="text-gray-300 hover:text-white rounded-lg relative"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Chat
            {unreadCount > 0 && !isChatOpen && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-[10px] font-bold rounded-full text-white shadow-sm shadow-blue-500/50 animate-pulse">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Video Room Layout */}
      {/* Main Video Room Layout */}
      <div className="flex-1 flex overflow-hidden">
        {isAnyScreenSharing && screenPresenter ? (
          /* Screen Sharing View: Large Primary Screen Stage + Right Column Filmstrip */
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
            {/* Primary Large Screen Share Stage */}
            <div className="flex-1 h-full min-h-[300px] bg-black/95 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative flex items-center justify-center">
              <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-black/75 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full border border-gray-700/60 shadow-lg select-none">
                <Monitor className="w-4 h-4 text-blue-400 animate-pulse" />
                <span>
                  <strong className="text-blue-300">{screenPresenter.name}</strong> is presenting screen
                </span>
              </div>

              <VideoTile
                stream={screenPresenter.stream}
                name={screenPresenter.name}
                isLocal={screenPresenter.isLocal}
                isScreenSharing
                className="w-full h-full object-contain"
              />
            </div>

            {/* Right Column Filmstrip for Participants */}
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto p-2 bg-gray-900/60 border border-gray-800/80 rounded-2xl scrollbar-thin">
              <div className="hidden lg:flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 uppercase tracking-wider select-none">
                <span>In Call ({peers.length + 1})</span>
              </div>

              {/* Local user tile (when remote peer is presenting) */}
              {!isScreenSharing && (
                <div className="w-48 lg:w-full shrink-0 aspect-video rounded-xl overflow-hidden shadow-md border border-gray-800/80">
                  <VideoTile
                    stream={localStream}
                    name={user?.name || "You"}
                    isMuted={isMuted}
                    isVideoOn={isVideoOn}
                    isLocal
                  />
                </div>
              )}

              {/* Other remote peers */}
              {peers
                .filter((p) => p.userId !== screenSharingUserId)
                .map((peer) => (
                  <div
                    key={peer.userId}
                    className="w-48 lg:w-full shrink-0 aspect-video rounded-xl overflow-hidden shadow-md border border-gray-800/80"
                  >
                    <VideoTile
                      stream={peer.stream || null}
                      name={peer.name}
                      isMuted={peer.isMuted}
                      isVideoOn={peer.isVideoOn}
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
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                isLocal
                isScreenSharing={isScreenSharing}
              />

              {peers.map((peer) => (
                <VideoTile
                  key={peer.userId}
                  stream={peer.stream || null}
                  name={peer.name}
                  isMuted={peer.isMuted}
                  isVideoOn={peer.isVideoOn}
                  isScreenSharing={screenSharingUserId === peer.userId}
                />
              ))}
            </div>

            {peers.length === 0 && (
              <div className="text-center text-gray-400 mt-12">
                <p className="text-base text-gray-300">Waiting for others to join...</p>
                <p className="text-sm mt-2 text-gray-400">
                  Share meeting code:{" "}
                  <span className="font-mono font-bold text-blue-400 select-all">
                    {meeting?.meetingCode}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {isChatOpen && (
          <ChatPanel
            messages={messages}
            typingUsers={typingUsers}
            isHost={isHost}
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
        onEnd={handleEndMeeting}
        isHost={isHost}
        socket={socket}
        meetingId={id}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        isPaused={isPaused}
        recordingTime={recordingTime}
      />

      {/* Google Meet Start Recording Confirmation Modal */}
      <RecordConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onConfirm={handleConfirmStartRecording}
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
        onDownload={() => downloadRecording()}
        meetingTitle={meeting?.title}
        meetingId={id}
      />
    </div>
  );
}