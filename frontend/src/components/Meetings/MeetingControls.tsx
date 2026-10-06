
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
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      setIsMuted(!isMuted);

      socket?.emit("meeting:media-state", {
        meetingId,
        isMuted: !isMuted,
        isVideoOn,
      });
    }
  };

  // Toggle camera by stopping/restarting the track
  const toggleVideo = async () => {
    if (!localStream || isScreenSharing) return;

    const newState = !isVideoOn;

    try {
      await onToggleVideo?.(newState);
    } catch (error) {
      console.error("Video toggle failed:", error);
      setIsVideoOn(!newState);
      return;
    }

    setIsVideoOn(newState);

    socket?.emit("meeting:media-state", {
      meetingId,
      isMuted,
      isVideoOn: newState,
    });
  };

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button
        variant={isMuted ? "destructive" : "secondary"}
        size="lg"
        onClick={toggleMute}
        className="rounded-full h-12 w-12 p-0"
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>

      <Button
        variant={!isVideoOn ? "destructive" : "secondary"}
        size="lg"
        onClick={toggleVideo}
        disabled={isScreenSharing}
        className="rounded-full h-12 w-12 p-0"
      >
        {isVideoOn ? (
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
      </Button>

      <Button
        variant={isScreenSharing ? "destructive" : "secondary"}
        size="lg"
        onClick={onToggleScreenShare}
        className="rounded-full h-12 w-12 p-0"
      >
        {isScreenSharing ? (
          <MonitorOff className="h-5 w-5" />
        ) : (
          <Monitor className="h-5 w-5" />
        )}
      </Button>

      {isHost && onToggleRecording && (
        <div className="flex items-center gap-1 bg-gray-800/80 p-1 rounded-full border border-gray-700/50">
          <Button
            variant={isRecording ? "destructive" : "secondary"}
            size="lg"
            onClick={onToggleRecording}
            title={isRecording ? "Stop recording" : "Record meeting"}
            className="rounded-full px-4 h-10 gap-2 font-medium"
          >
            {isRecording ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                <span className="text-xs font-mono">{formatTime(recordingTime)}</span>
              </>
            ) : (
              <>
                <Circle className="h-4 w-4 fill-current text-red-500" />
                <span className="text-xs">Record</span>
              </>
            )}
          </Button>

          {isRecording && onPauseRecording && onResumeRecording && (
            <Button
              variant="ghost"
              size="sm"
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              title={isPaused ? "Resume recording" : "Pause recording"}
              className="rounded-full h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
            >
              {isPaused ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      )}

      {isHost && onEnd && (
        <Button
          variant="destructive"
          size="lg"
          onClick={onEnd}
          className="rounded-full px-6 h-12 gap-2"
        >
          <XCircle className="h-5 w-5" />
          End
        </Button>
      )}

      <Button
        variant={isHost ? "secondary" : "destructive"}
        size="lg"
        onClick={onLeave}
        className={
          isHost ? "rounded-full px-6 h-12 gap-2" : "rounded-full h-12 w-12 p-0"
        }
      >
        <PhoneOff className="h-5 w-5" />
        {isHost && <span>Leave</span>}
      </Button>
    </div>
  );
}