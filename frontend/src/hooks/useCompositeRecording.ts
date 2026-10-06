// High-quality Google Meet-grade composite meeting recorder
// Captures live participant webcams, avatars, screen share, and mixes all participant audio
// Produces seekable WebM recordings with dynamic grid layouts, active speaker spotlights, and watermarks

import { useCallback, useRef, useState, useEffect } from "react";
import { useMeetingStore } from "@/store/meetingStore";
import { useAuthStore } from "@/store/authStore";
import fixWebmDuration from "fix-webm-duration";
import { playRecordingStartChime, playRecordingStopChime } from "@/utils/meetingChime";

// Google Meet signature avatar colors
const AVATAR_COLORS = [
  "#1a73e8", // Google Blue
  "#ea4335", // Google Red
  "#fbbc04", // Google Yellow
  "#34a853", // Google Green
  "#9334e6", // Purple
  "#00897b", // Teal
  "#e8710a", // Orange
  "#d81b60", // Pink
];

const getAvatarColor = (name: string): string => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Profile image caching
const imageCache = new Map<string, HTMLImageElement>();
const getLoadedImage = (url?: string): HTMLImageElement | null => {
  if (!url) return null;
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    imageCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
};

// Participant representation for canvas rendering
interface RenderParticipant {
  id: string;
  name: string;
  stream?: MediaStream | null;
  isVideoOn: boolean;
  isMuted: boolean;
  isLocal: boolean;
  profilePicture?: string;
}

interface AudioSourceEntry {
  source: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  streamId: string;
}

export interface SupportedFormat {
  mimeType: string;
  extension: "mp4" | "webm";
  label: string;
}

export const CANDIDATE_FORMATS: SupportedFormat[] = [
  // 1. High compatibility MP4 (H.264 / AAC) - Flawless on Windows Media Player, QuickTime, iOS, Android, VLC
  {
    mimeType: "video/mp4;codecs=avc1,mp4a.40.2",
    extension: "mp4",
    label: "MP4 (H.264 / AAC)",
  },
  {
    mimeType: "video/mp4;codecs=avc1",
    extension: "mp4",
    label: "MP4 (H.264)",
  },
  {
    mimeType: "video/mp4",
    extension: "mp4",
    label: "MP4",
  },
  // 2. WebM with H.264 video
  {
    mimeType: "video/webm;codecs=h264,opus",
    extension: "webm",
    label: "WebM (H.264 / Opus)",
  },
  // 3. WebM VP9 / VP8
  {
    mimeType: "video/webm;codecs=vp9,opus",
    extension: "webm",
    label: "WebM (VP9 / Opus)",
  },
  {
    mimeType: "video/webm;codecs=vp8,opus",
    extension: "webm",
    label: "WebM (VP8 / Opus)",
  },
  {
    mimeType: "video/webm",
    extension: "webm",
    label: "WebM",
  },
];

export interface RecordedResult {
  blob: Blob;
  url: string;
  duration: number; // in seconds
  size: number; // in bytes
  filename: string;
  formatLabel: string;
}

export function useCompositeRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const chosenFormatRef = useRef<SupportedFormat>({
    mimeType: "video/webm",
    extension: "webm",
    label: "WebM",
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedResult, setRecordedResult] = useState<RecordedResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const renderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio Context and sources
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourcesRef = useRef<Map<string, AudioSourceEntry>>(new Map());

  // Hidden offscreen video elements for participants & screen share
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active speaker tracking
  const activeSpeakerIdRef = useRef<string>("local");
  const lastSpeechTimeRef = useRef<number>(0);
  const speakingVolumesRef = useRef<Map<string, number>>(new Map());

  // Cleanup all video elements helper
  const cleanupVideoElements = useCallback(() => {
    videoElementsRef.current.forEach((video) => {
      video.srcObject = null;
    });
    videoElementsRef.current.clear();

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
  }, []);

  // Get or create an offscreen video element for a given stream
  const getOrCreateVideo = useCallback(
    (id: string, stream?: MediaStream | null): HTMLVideoElement | null => {
      if (!stream) {
        const existing = videoElementsRef.current.get(id);
        if (existing) {
          existing.srcObject = null;
          videoElementsRef.current.delete(id);
        }
        return null;
      }

      let video = videoElementsRef.current.get(id);
      if (!video) {
        video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        videoElementsRef.current.set(id, video);
      }

      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }

      return video;
    },
    []
  );

  // Screen share stream resolution
  const getScreenShareInfo = useCallback(() => {
    const { isScreenSharing, screenSharingUserId, localStream, peers } =
      useMeetingStore.getState();
    const currentUser = useAuthStore.getState().user;

    const isLocalSharing =
      isScreenSharing ||
      (screenSharingUserId &&
        (screenSharingUserId === currentUser?.id ||
          screenSharingUserId === "local"));

    if (isLocalSharing && localStream) {
      const screenTrack = localStream
        .getVideoTracks()
        .find((t) => t.readyState === "live");
      if (screenTrack) {
        return {
          stream: localStream,
          presenterName: currentUser?.name || "You",
        };
      }
    }

    if (screenSharingUserId) {
      const peer = peers.find((p) => p.userId === screenSharingUserId);
      if (peer?.stream) {
        const screenTrack = peer.stream
          .getVideoTracks()
          .find((t) => t.readyState === "live");
        if (screenTrack) {
          return {
            stream: peer.stream,
            presenterName: peer.name || "Participant",
          };
        }
      }
    }

    return null;
  }, []);

  // Connect participant audio tracks to audio mixer with volume nodes
  const syncAudioSources = useCallback(() => {
    const audioContext = audioContextRef.current;
    const destination = destinationRef.current;
    if (!audioContext || !destination || audioContext.state === "closed") {
      return;
    }

    const { localStream, peers, isMuted } = useMeetingStore.getState();
    const activeKeys = new Set<string>();

    // Connect Local Mic
    if (localStream && localStream.getAudioTracks().length > 0) {
      const track = localStream.getAudioTracks().find((t) => t.readyState === "live");
      if (track) {
        activeKeys.add("local");
        let entry = audioSourcesRef.current.get("local");

        if (!entry || entry.streamId !== localStream.id) {
          try {
            entry?.source.disconnect();
            const source = audioContext.createMediaStreamSource(localStream);
            const gainNode = audioContext.createGain();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            source.connect(gainNode);
            gainNode.connect(analyser);
            analyser.connect(destination);

            entry = {
              source,
              gainNode,
              analyser,
              data: new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>,
              streamId: localStream.id,
            };
            audioSourcesRef.current.set("local", entry);
          } catch (err) {
            console.warn("Failed to connect local audio source:", err);
          }
        }

        // Adjust gain based on mute status
        if (entry) {
          const targetGain = isMuted ? 0 : 1;
          entry.gainNode.gain.setValueAtTime(targetGain, audioContext.currentTime);
        }
      }
    }

    // Connect Remote Peers
    peers.forEach((peer) => {
      if (peer.stream && peer.stream.getAudioTracks().length > 0) {
        const track = peer.stream.getAudioTracks().find((t) => t.readyState === "live");
        if (track) {
          activeKeys.add(peer.userId);
          let entry = audioSourcesRef.current.get(peer.userId);

          if (!entry || entry.streamId !== peer.stream.id) {
            try {
              entry?.source.disconnect();
              const source = audioContext.createMediaStreamSource(peer.stream);
              const gainNode = audioContext.createGain();
              const analyser = audioContext.createAnalyser();
              analyser.fftSize = 256;

              source.connect(gainNode);
              gainNode.connect(analyser);
              analyser.connect(destination);

              entry = {
                source,
                gainNode,
                analyser,
                data: new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>,
                streamId: peer.stream.id,
              };
              audioSourcesRef.current.set(peer.userId, entry);
            } catch (err) {
              console.warn(`Failed to connect audio for peer ${peer.name}:`, err);
            }
          }

          if (entry) {
            const targetGain = peer.isMuted ? 0 : 1;
            entry.gainNode.gain.setValueAtTime(targetGain, audioContext.currentTime);
          }
        }
      }
    });

    // Remove left participants
    audioSourcesRef.current.forEach((entry, key) => {
      if (!activeKeys.has(key)) {
        try {
          entry.source.disconnect();
        } catch {}
        audioSourcesRef.current.delete(key);
      }
    });
  }, []);

  // Detect which participant is actively speaking
  const detectActiveSpeaker = useCallback(() => {
    let maxVolume = 0;
    let loudestUserId: string | null = null;
    const volumes = new Map<string, number>();

    audioSourcesRef.current.forEach((item, userId) => {
      item.analyser.getByteFrequencyData(item.data);
      let sum = 0;
      for (let i = 0; i < item.data.length; i++) {
        sum += item.data[i];
      }
      const avg = sum / item.data.length;
      volumes.set(userId, avg);

      if (avg > 14 && avg > maxVolume) {
        maxVolume = avg;
        loudestUserId = userId;
      }
    });

    speakingVolumesRef.current = volumes;

    if (loudestUserId) {
      activeSpeakerIdRef.current = loudestUserId;
      lastSpeechTimeRef.current = Date.now();
    }
  }, []);

  // Format recording timestamp (mm:ss or hh:mm:ss)
  const formatTimeCode = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Draw Google Meet participant tile (Video or Avatar card)
  const drawParticipantTile = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      participant: RenderParticipant,
      videoEl: HTMLVideoElement | null,
      isSpeaking: boolean,
      borderRadius = 12
    ) => {
      ctx.save();

      // Rounded container path
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, borderRadius);
      } else {
        ctx.rect(x, y, width, height);
      }
      ctx.clip();

      const hasLiveVideo =
        participant.isVideoOn &&
        participant.stream &&
        videoEl &&
        videoEl.readyState >= 2 &&
        videoEl.videoWidth > 0;

      if (hasLiveVideo && videoEl) {
        // Render video feed with cover fit
        const vidW = videoEl.videoWidth;
        const vidH = videoEl.videoHeight;
        const vidRatio = vidW / vidH;
        const tileRatio = width / height;

        let sW = vidW;
        let sH = vidH;
        let sx = 0;
        let sy = 0;

        if (vidRatio > tileRatio) {
          sW = vidH * tileRatio;
          sx = (vidW - sW) / 2;
        } else {
          sH = vidW / tileRatio;
          sy = (vidH - sH) / 2;
        }

        ctx.drawImage(videoEl, sx, sy, sW, sH, x, y, width, height);
      } else {
        // Google Meet dark avatar card
        const grad = ctx.createLinearGradient(x, y, x, y + height);
        grad.addColorStop(0, "#282a2d");
        grad.addColorStop(1, "#1e2022");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, width, height);

        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const avatarRadius = Math.min(Math.max(width * 0.14, 38), 68);

        // Animated speaking wave rings around avatar
        if (isSpeaking) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius + 10, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(66, 133, 244, 0.4)";
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(66, 133, 244, 0.7)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const avatarImg = getLoadedImage(participant.profilePicture);
        if (avatarImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            avatarImg,
            centerX - avatarRadius,
            centerY - avatarRadius,
            avatarRadius * 2,
            avatarRadius * 2
          );
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
          ctx.fillStyle = getAvatarColor(participant.name);
          ctx.fill();

          const initial = (participant.name || "U").trim().charAt(0).toUpperCase();
          ctx.fillStyle = "#ffffff";
          ctx.font = `600 ${Math.floor(avatarRadius * 0.9)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initial, centerX, centerY + 2);
        }
      }

      ctx.restore();

      // Active Speaker Border (Google Meet Blue / Green glow)
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, borderRadius);
      } else {
        ctx.rect(x, y, width, height);
      }

      if (isSpeaking) {
        ctx.strokeStyle = "#4285F4";
        ctx.lineWidth = 3.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // Bottom-left Participant Name Pill
      ctx.save();
      const displayName = participant.isLocal
        ? `${participant.name || "You"} (You)`
        : participant.name || "Participant";

      ctx.font = "500 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const nameMetrics = ctx.measureText(displayName);
      const pillHeight = 28;
      const pillWidth = nameMetrics.width + (participant.isMuted || isSpeaking ? 38 : 22);
      const pillX = x + 12;
      const pillY = y + height - pillHeight - 12;

      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14);
      } else {
        ctx.rect(pillX, pillY, pillWidth, pillHeight);
      }
      ctx.fill();

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(displayName, pillX + 12, pillY + pillHeight / 2);

      // Icon: Mic Muted or Speaking equalizer
      if (participant.isMuted) {
        ctx.fillStyle = "#ea4335";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("✕", pillX + pillWidth - 18, pillY + pillHeight / 2);
      } else if (isSpeaking) {
        // Animated 3-bar voice visualizer
        const barX = pillX + pillWidth - 22;
        const barY = pillY + pillHeight / 2;
        const now = Date.now();
        const h1 = 4 + Math.sin(now / 120) * 3;
        const h2 = 6 + Math.cos(now / 150) * 4;
        const h3 = 5 + Math.sin(now / 100) * 3;

        ctx.fillStyle = "#34a853";
        ctx.fillRect(barX, barY - h1 / 2, 2.5, h1);
        ctx.fillRect(barX + 4.5, barY - h2 / 2, 2.5, h2);
        ctx.fillRect(barX + 9, barY - h3 / 2, 2.5, h3);
      }

      ctx.restore();
    },
    []
  );

  // Draw Google Meet Grid layout for all participants
  const drawGridLayout = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      participants: RenderParticipant[]
    ) => {
      // Dark workspace background
      ctx.fillStyle = "#111315";
      ctx.fillRect(0, 0, width, height);

      const n = Math.max(participants.length, 1);
      const topBarHeight = 54;
      const bottomPadding = 24;
      const sidePadding = 24;

      const availWidth = width - sidePadding * 2;
      const availHeight = height - topBarHeight - bottomPadding;

      // Active speaker volume check
      const speakingThreshold = 14;

      // Determine grid layout columns & rows
      let cols = 1;
      let rows = 1;

      if (n === 2) {
        cols = 2;
        rows = 1;
      } else if (n === 3 || n === 4) {
        cols = 2;
        rows = 2;
      } else if (n <= 6) {
        cols = 3;
        rows = 2;
      } else {
        cols = 4;
        rows = Math.ceil(n / 4);
      }

      const gap = 16;
      const tileWidth = (availWidth - gap * (cols - 1)) / cols;
      const tileHeight = (availHeight - gap * (rows - 1)) / rows;

      participants.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);

        // Center tiles in last row if fewer items
        const itemsInThisRow = Math.min(n - row * cols, cols);
        const rowOffset =
          itemsInThisRow < cols
            ? ((cols - itemsInThisRow) * (tileWidth + gap)) / 2
            : 0;

        const tileX = sidePadding + rowOffset + col * (tileWidth + gap);
        const tileY = topBarHeight + row * (tileHeight + gap);

        const videoEl = getOrCreateVideo(p.id, p.stream);
        const vol = speakingVolumesRef.current.get(p.id) || 0;
        const isSpeaking = vol > speakingThreshold;

        drawParticipantTile(
          ctx,
          tileX,
          tileY,
          tileWidth,
          tileHeight,
          p,
          videoEl,
          isSpeaking,
          12
        );
      });
    },
    [drawParticipantTile, getOrCreateVideo]
  );

  // Draw Google Meet Screen Share / Presentation layout
  const drawScreenShareLayout = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      screenVideo: HTMLVideoElement,
      presenterName: string,
      participants: RenderParticipant[]
    ) => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const topBarHeight = 48;
      const availW = width - 40;
      const availH = height - topBarHeight - 30;

      const vidW = screenVideo.videoWidth || 1280;
      const vidH = screenVideo.videoHeight || 720;

      const scale = Math.min(availW / vidW, availH / vidH);
      const drawW = vidW * scale;
      const drawH = vidH * scale;
      const drawX = (width - drawW) / 2;
      const drawY = topBarHeight + (availH - drawH) / 2;

      // Draw screen share video
      ctx.drawImage(screenVideo, drawX, drawY, drawW, drawH);

      // Presenter Badge at bottom-left
      ctx.save();
      const badgeText = `${presenterName} is presenting`;
      ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const metrics = ctx.measureText(badgeText);
      const badgeW = metrics.width + 36;
      const badgeH = 34;
      const badgeX = 32;
      const badgeY = height - badgeH - 24;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 17);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      // Screen icon dot
      ctx.fillStyle = "#4285F4";
      ctx.beginPath();
      ctx.arc(badgeX + 16, badgeY + badgeH / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, badgeX + 28, badgeY + badgeH / 2);
      ctx.restore();

      // Floating Google Meet PiP tile (Active Speaker or Presenter) in bottom-right
      const speakerId = activeSpeakerIdRef.current;
      const activeParticipant =
        participants.find((p) => p.id === speakerId) || participants[0];

      if (activeParticipant) {
        const pipW = 240;
        const pipH = 135; // 16:9
        const pipX = width - pipW - 28;
        const pipY = height - pipH - 24;

        // Shadow for PiP tile
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        const pipVideo = getOrCreateVideo(
          activeParticipant.id,
          activeParticipant.stream
        );
        const vol = speakingVolumesRef.current.get(activeParticipant.id) || 0;
        const isSpeaking = vol > 14;

        drawParticipantTile(
          ctx,
          pipX,
          pipY,
          pipW,
          pipH,
          activeParticipant,
          pipVideo,
          isSpeaking,
          10
        );
        ctx.restore();
      }
    },
    [drawParticipantTile, getOrCreateVideo]
  );

  // Draw Google Meet Top Bar Watermark & Status
  const drawTopBarOverlay = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      meetingTitle: string,
      elapsedSec: number
    ) => {
      ctx.save();

      // Subtle gradient header
      const grad = ctx.createLinearGradient(0, 0, 0, 48);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.7)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 48);

      // Left: IntelliMeet brand & Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      // Small logo circle
      ctx.fillStyle = "#4285f4";
      ctx.beginPath();
      ctx.arc(32, 24, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`IntelliMeet  •  ${meetingTitle || "Meeting"}`, 48, 24);

      // Right: REC badge + Timer
      const recText = `REC ${formatTimeCode(elapsedSec)}`;
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const recMetrics = ctx.measureText(recText);
      const pillW = recMetrics.width + 32;
      const pillH = 26;
      const pillX = width - pillW - 24;
      const pillY = 11;

      // Red recording pill
      ctx.fillStyle = "rgba(234, 67, 53, 0.9)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(pillX, pillY, pillW, pillH, 13);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();

      // Pulsing white recording dot
      const now = Date.now();
      const dotAlpha = 0.5 + 0.5 * Math.sin(now / 250);
      ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`;
      ctx.beginPath();
      ctx.arc(pillX + 13, pillY + pillH / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(recText, pillX + 23, pillY + pillH / 2 + 1);

      ctx.restore();
    },
    []
  );

  // Start composite recording
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const width = 1280;
      const height = 720;

      // Offscreen canvas for composition
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvasRef.current = canvas;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        throw new Error("Canvas 2D context creation failed");
      }

      // Hidden video element for screen share
      const screenVideo = document.createElement("video");
      screenVideo.autoplay = true;
      screenVideo.playsInline = true;
      screenVideo.muted = true;
      screenVideoRef.current = screenVideo;

      // Audio Context & Destination
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioCtx();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      audioContextRef.current = audioContext;

      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;
      audioSourcesRef.current.clear();

      // Connect initial audio
      syncAudioSources();

      let lastAudioSync = Date.now();
      pausedTimeRef.current = 0;
      pauseStartRef.current = 0;

      // Composite Render Loop (30 FPS)
      const renderLoop = () => {
        const now = Date.now();

        // Audio sync every 500ms
        if (now - lastAudioSync > 500) {
          syncAudioSources();
          lastAudioSync = now;
        }

        // Voice detection
        detectActiveSpeaker();

        const {
          localStream,
          peers,
          isMuted,
          isVideoOn,
          currentMeetingId,
        } = useMeetingStore.getState();
        const currentUser = useAuthStore.getState().user;

        // Build participant list
        const participants: RenderParticipant[] = [
          {
            id: "local",
            name: currentUser?.name || "You",
            stream: localStream,
            isVideoOn,
            isMuted,
            isLocal: true,
            profilePicture: currentUser?.profilePicture,
          },
          ...peers.map((p) => ({
            id: p.userId,
            name: p.name,
            stream: p.stream ?? null,
            isVideoOn: p.isVideoOn,
            isMuted: p.isMuted,
            isLocal: false,
            profilePicture: p.profilePicture,
          })),
        ];

        const screenInfo = getScreenShareInfo();

        if (screenInfo) {
          if (screenVideo.srcObject !== screenInfo.stream) {
            screenVideo.srcObject = screenInfo.stream;
            screenVideo.play().catch(() => {});
          }

          if (screenVideo.readyState >= 2) {
            drawScreenShareLayout(
              ctx,
              width,
              height,
              screenVideo,
              screenInfo.presenterName,
              participants
            );
          } else {
            drawGridLayout(ctx, width, height, participants);
          }
        } else {
          if (screenVideo.srcObject) {
            screenVideo.srcObject = null;
          }
          drawGridLayout(ctx, width, height, participants);
        }

        // Draw Google Meet Top Bar overlay
        const elapsed = Math.floor(
          (Date.now() - recordingStartRef.current - pausedTimeRef.current) / 1000
        );
        drawTopBarOverlay(
          ctx,
          width,
          currentMeetingId ? `Meeting` : "IntelliMeet",
          Math.max(0, elapsed)
        );

        animationFrameRef.current = requestAnimationFrame(renderLoop);
      };

      // Start render loop
      renderLoop();

      // Capture 30fps canvas stream
      const canvasStream = canvas.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      const audioTrack = destination.stream.getAudioTracks()[0];

      if (!videoTrack) {
        throw new Error("Failed to capture video track from canvas");
      }

      const streamTracks: MediaStreamTrack[] = [videoTrack];
      if (audioTrack) {
        streamTracks.push(audioTrack);
      }
      const recordStream = new MediaStream(streamTracks);

      // Detect best supported container & codecs (MP4 prioritized for native Windows / QuickTime / VLC playback)
      let selectedFormat: SupportedFormat =
        CANDIDATE_FORMATS[CANDIDATE_FORMATS.length - 1];
      for (const candidate of CANDIDATE_FORMATS) {
        if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
          selectedFormat = candidate;
          break;
        }
      }
      chosenFormatRef.current = selectedFormat;

      chunksRef.current = [];
      const recorder = new MediaRecorder(recordStream, {
        mimeType: selectedFormat.mimeType,
        videoBitsPerSecond: 3000000, // 3 Mbps high quality
        audioBitsPerSecond: 128000, // 128 kbps audio
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recordingStartRef.current = Date.now();
      pausedTimeRef.current = 0;
      pauseStartRef.current = 0;

      // Start render loop
      renderLoop();

      // Background tab render keeper
      const fallbackInterval = setInterval(() => {
        if (document.hidden) {
          renderLoop();
        }
      }, 100);
      renderIntervalRef.current = fallbackInterval;

      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setRecordedResult(null);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Play Google Meet start chime
      playRecordingStartChime();
    } catch (err) {
      console.error("Failed to start recording:", err);
      cleanupVideoElements();
      throw err;
    }
  }, [
    isRecording,
    getScreenShareInfo,
    syncAudioSources,
    detectActiveSpeaker,
    drawGridLayout,
    drawScreenShareLayout,
    drawTopBarOverlay,
    cleanupVideoElements,
  ]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      pauseStartRef.current = Date.now();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      if (pauseStartRef.current > 0) {
        pausedTimeRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = 0;
      }
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  // Stop recording and process WebM/MP4 duration fix
  const stopRecording = useCallback(async (): Promise<RecordedResult | null> => {
    if (!isRecording) return null;

    return new Promise<RecordedResult | null>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        playRecordingStopChime();

        // 1. Clear intervals & animation frame ONLY AFTER recorder has completed stopping
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        if (renderIntervalRef.current) {
          clearInterval(renderIntervalRef.current);
          renderIntervalRef.current = null;
        }

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // 2. Disconnect and close audio AFTER recorder has stopped
        audioSourcesRef.current.forEach((entry) => {
          try {
            entry.source.disconnect();
          } catch {}
        });
        audioSourcesRef.current.clear();

        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        // 3. Clean up video elements
        cleanupVideoElements();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setIsPaused(false);

        if (chunksRef.current.length === 0) {
          console.error("No recording data captured");
          resolve(null);
          return;
        }

        const format = chosenFormatRef.current;
        const actualMime = recorder.mimeType || format.mimeType;
        const rawBlob = new Blob(chunksRef.current, { type: actualMime });
        const durationMs = Math.max(
          Date.now() - recordingStartRef.current - pausedTimeRef.current,
          1000
        );

        let finalBlob: Blob = rawBlob;
        // ONLY apply fixWebmDuration if format is WebM
        if (format.extension === "webm") {
          try {
            finalBlob = await fixWebmDuration(rawBlob, durationMs, {
              logger: false,
            });
          } catch (err) {
            console.warn("fixWebmDuration fallback to raw:", err);
            finalBlob = rawBlob;
          }
        }

        const url = URL.createObjectURL(finalBlob);
        const filename = `IntelliMeet-Recording-${new Date().toISOString().slice(0, 10)}_${Date.now()}.${format.extension}`;

        const result: RecordedResult = {
          blob: finalBlob,
          url,
          duration: Math.round(durationMs / 1000),
          size: finalBlob.size,
          filename,
          formatLabel: format.label,
        };

        setRecordedResult(result);
        chunksRef.current = [];
        resolve(result);
      };

      // Request final data and stop recorder
      try {
        if (recorder.state === "recording") {
          recorder.requestData();
        }
        recorder.stop();
      } catch (e) {
        console.error("Error stopping recorder:", e);
      }
    });
  }, [isRecording, cleanupVideoElements]);

  // Direct download helper
  const downloadRecording = useCallback((result?: RecordedResult | null) => {
    const target = result || recordedResult;
    if (!target) return;

    const a = document.createElement("a");
    a.href = target.url;
    a.download = target.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [recordedResult]);

  // Clear recorded result
  const clearRecordedResult = useCallback(() => {
    if (recordedResult?.url) {
      URL.revokeObjectURL(recordedResult.url);
    }
    setRecordedResult(null);
  }, [recordedResult]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      cleanupVideoElements();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (recordedResult?.url) {
        URL.revokeObjectURL(recordedResult.url);
      }
    };
  }, [cleanupVideoElements, recordedResult]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    recordedResult,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    clearRecordedResult,
  };
}