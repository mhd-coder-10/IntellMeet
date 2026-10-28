
// Bottom control bar with mute, camera, screen share, record, leave and end
// End meeting button only visible to host

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  XCircle,
  Monitor,
  MonitorOff,
  Circle,
  Square,
  Pause,
  Play,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { useMeetingStore } from "@/store/meetingStore";
import { toast } from "sonner";

interface Props {
  onLeave: () => void;
  onEnd?: () => void;
  isHost?: boolean;
  socket?: Socket | null;
  meetingId?: string;
  onToggleVideo?: (enabled: boolean) => void | Promise<void>;
  onToggleScreenShare?: () => void | Promise<void>;
  onToggleRecording?: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
  isPaused?: boolean;
  recordingTime?: number;
}

// Format seconds into mm:ss
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export function MeetingControls({
  onLeave,
  onEnd,
  isHost = false,
  socket,
  meetingId,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onPauseRecording,
  onResumeRecording,
  isPaused = false,
  recordingTime = 0,
}: Props) {

  const {
    localStream,
    isMuted,
    isVideoOn,
    isScreenSharing,
    isRecording,
    setIsMuted,
    setIsVideoOn,
  } = useMeetingStore();

  // Toggle microphone by enabling/disabling the audio track
  const toggleMute = () => {
    if (!localStream) {
      toast.info("Microphone is connecting...");
      return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      setIsMuted(!isMuted);

      socket?.emit("meeting:media-state", {
        meetingId,
        isMuted: !isMuted,
        isVideoOn,
      });
    } else {
      toast.error("No active microphone track detected");
    }
  };

  // Toggle camera by stopping/restarting the track
  const toggleVideo = async () => {
    if (isScreenSharing) return;

    const newState = !isVideoOn;

    try {
      if (onToggleVideo) {
        await onToggleVideo(newState);
      }
      setIsVideoOn(newState);

      socket?.emit("meeting:media-state", {
        meetingId,
        isMuted,
        isVideoOn: newState,
      });
    } catch (error) {
      console.error("Video toggle failed:", error);
      toast.error("Failed to access camera");
      setIsVideoOn(isVideoOn);
    }
  };

  return (
    <div className="w-full bg-gray-950/90 border-t border-gray-800/80 px-1.5 sm:px-6 py-2 sm:py-3.5 flex items-center justify-center">
      <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-3 max-w-full overflow-x-auto no-scrollbar py-0.5 px-2">
        {/* Mute Button */}
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="default"
          onClick={toggleMute}
          className="rounded-full h-10 w-10 sm:h-12 sm:w-12 p-0 shrink-0"
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
        </Button>

        {/* Video Button */}
        <Button
          variant={!isVideoOn ? "destructive" : "secondary"}
          size="default"
          onClick={toggleVideo}
          disabled={isScreenSharing}
          className="rounded-full h-10 w-10 sm:h-12 sm:w-12 p-0 shrink-0"
          title={isVideoOn ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoOn ? (
            <Video className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        {/* Screen Share Button */}
        <Button
          variant={isScreenSharing ? "destructive" : "secondary"}
          size="default"
          onClick={onToggleScreenShare}
          className="rounded-full h-10 w-10 sm:h-12 sm:w-12 p-0 shrink-0"
          title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        >
          {isScreenSharing ? (
            <MonitorOff className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Monitor className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        {/* Host Recording Controls */}
        {isHost && onToggleRecording && (
          <div className={`flex items-center gap-1 p-0.5 sm:p-1 rounded-full border transition-all shrink-0 ${
            isRecording && isPaused
              ? "bg-amber-950/40 border-amber-500/40"
              : "bg-gray-800/80 border-gray-700/50"
          }`}>
            <Button
              variant={isRecording ? (isPaused ? "secondary" : "destructive") : "secondary"}
              size="default"
              onClick={onToggleRecording}
              title={isRecording ? (isPaused ? "Stop recording (Paused)" : "Stop recording") : "Record meeting"}
              className={`rounded-full px-2 sm:px-3.5 h-9 sm:h-10 gap-1.5 font-medium transition-all ${
                isRecording && isPaused
                  ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30"
                  : ""
              }`}
            >
              {isRecording ? (
                <>
                  <Square className={`h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current ${isPaused ? "text-amber-400" : ""}`} />
                  <span className="text-[11px] sm:text-xs font-mono font-medium">
                    {formatTime(recordingTime)}
                  </span>
                </>
              ) : (
                <>
                  <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current text-red-500" />
                  <span className="text-[11px] sm:text-xs hidden xs:inline">Record</span>
                </>
              )}
            </Button>

            {isRecording && onPauseRecording && onResumeRecording && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isPaused ? onResumeRecording : onPauseRecording}
                title={isPaused ? "Resume recording" : "Pause recording"}
                className={`rounded-full h-7 w-7 sm:h-8 sm:w-8 p-0 transition-all ${
                  isPaused
                    ? "text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 hover:text-emerald-300 ring-1 ring-emerald-400/40"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                {isPaused ? (
                  <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current ml-0.5" />
                ) : (
                  <Pause className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                )}
              </Button>
            )}
          </div>
        )}

        {/* Host End Meeting */}
        {isHost && onEnd && (
          <Button
            variant="destructive"
            size="default"
            onClick={onEnd}
            className="rounded-full px-2.5 sm:px-6 h-10 sm:h-12 gap-1 sm:gap-2 shrink-0"
            title="End meeting for all participants"
          >
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-semibold hidden xs:inline">End</span>
          </Button>
        )}

        {/* Leave Meeting */}
        <Button
          variant={isHost ? "secondary" : "destructive"}
          size="default"
          onClick={onLeave}
          className={
            isHost
              ? "rounded-full px-2.5 sm:px-6 h-10 sm:h-12 gap-1 sm:gap-2 shrink-0"
              : "rounded-full h-10 w-10 sm:h-12 sm:w-12 p-0 shrink-0"
          }
          title="Leave meeting"
        >
          <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
          {isHost && <span className="text-xs sm:text-sm font-semibold hidden xs:inline">Leave</span>}
        </Button>
      </div>
    </div>
  );
}