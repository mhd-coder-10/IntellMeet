
// Displays a single video stream tile
// Video element is always mounted so track updates work seamlessly

import { useEffect, useRef } from "react";
import { MicOff, VideoOff, Monitor } from "lucide-react";

interface Props {
  stream: MediaStream | null;
  name: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  name,
  isMuted = false,
  isVideoOn = true,
  isLocal = false,
  isScreenSharing = false,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach stream only when the reference actually changes
  // This prevents re-attach flicker on every media state change
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;

      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => console.warn("Video play failed:", err));
      }
    }
  }, [stream]);

  // Video element stays mounted as long as we have a stream
  const hasStream = !!stream;

  // Show avatar overlay when there is no live video
  const showAvatar =
    !hasStream || (!isVideoOn && !isScreenSharing);

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className || "aspect-video"}`}>
      {hasStream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${
            isScreenSharing ? "object-contain bg-black" : "object-cover"
          }`}
        />
      )}

      {showAvatar && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
        {isScreenSharing && <Monitor className="h-3 w-3 text-blue-400" />}
        <span>{isLocal ? `${name} (You)` : name}</span>
        {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
        {!isVideoOn && !isScreenSharing && (
          <VideoOff className="h-3 w-3 text-red-400" />
        )}
      </div>
    </div>
  );
}