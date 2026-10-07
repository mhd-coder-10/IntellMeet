// Displays a single video stream tile with avatar / profile picture overlay when camera is off
// Supports screen sharing, role badges, and responsive video layout

import { useEffect, useRef, useState } from "react";
import { MicOff, VideoOff, Monitor, Crown } from "lucide-react";

interface Props {
  stream: MediaStream | null;
  name: string;
  profilePicture?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  isHost?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  name,
  profilePicture,
  isMuted = false,
  isVideoOn = true,
  isLocal = false,
  isScreenSharing = false,
  isHost = false,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setTrackStateTick] = useState(0);

  // Listen to track lifecycle changes (unmute, mute, ended) so UI syncs immediately
  useEffect(() => {
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    const handleTrackLifecycle = () => {
      setTrackStateTick((k) => k + 1);
    };

    tracks.forEach((track) => {
      track.addEventListener("unmute", handleTrackLifecycle);
      track.addEventListener("mute", handleTrackLifecycle);
      track.addEventListener("ended", handleTrackLifecycle);
    });

    return () => {
      tracks.forEach((track) => {
        track.removeEventListener("unmute", handleTrackLifecycle);
        track.removeEventListener("mute", handleTrackLifecycle);
        track.removeEventListener("ended", handleTrackLifecycle);
      });
    };
  }, [stream]);

  // Attach stream when stream changes or media state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    if (isScreenSharing || isLocal) {
      video.muted = true;
    }

    if (isVideoOn || isScreenSharing) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          if (err.name === "NotAllowedError") {
            video.muted = true;
            video.play().catch(() => {});
          }
        });
      }
    }
  }, [stream, isVideoOn, isScreenSharing, isLocal]);

  const hasStream = !!stream;

  // Check if stream has an actual live video track
  const hasLiveVideoTrack = Boolean(
    stream &&
      stream
        .getVideoTracks()
        .some((t) => t.readyState === "live" && t.enabled)
  );

  // Show avatar overlay when camera is off, or when no stream, or when camera is supposed to be on but no live video track exists yet
  const showAvatar =
    !hasStream ||
    (!isScreenSharing && (!isVideoOn || (!isLocal && !hasLiveVideoTrack)));

  return (
    <div
      className={`relative bg-gray-900 rounded-lg overflow-hidden select-none ${
        className || "aspect-video"
      }`}
    >
      {/* Video Element */}
      {hasStream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isScreenSharing}
          onLoadedMetadata={() => {
            videoRef.current?.play().catch(() => {});
          }}
          className={`w-full h-full ${
            isScreenSharing ? "object-contain bg-black" : "object-cover"
          } ${showAvatar ? "hidden" : "block"}`}
        />
      )}

      {/* Avatar or Profile Picture Overlay when Camera is Off or No Video Track */}
      {showAvatar && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
          {profilePicture ? (
            <img
              src={profilePicture}
              alt={name}
              className="w-20 h-20 rounded-full object-cover shadow-lg ring-4 ring-blue-500/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-blue-500/20">
              {(name || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Bottom Status Info Tag */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-md border border-white/10">
        {isScreenSharing && <Monitor className="h-3 w-3 text-blue-400" />}
        <span className="font-medium">
          {isLocal ? `${name || (isHost ? "Host" : "Member")} (You)` : name || (isHost ? "Host" : "Member")}
        </span>

        {/* Role Badge: Host vs Member */}
        {isHost ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/25 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded shadow-xs">
            <Crown className="w-2.5 h-2.5 text-amber-400" />
            Host
          </span>
        ) : (
          <span className="inline-flex items-center text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded">
            Member
          </span>
        )}

        {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
        {!isVideoOn && !isScreenSharing && (
          <VideoOff className="h-3 w-3 text-red-400" />
        )}
      </div>
    </div>
  );
}