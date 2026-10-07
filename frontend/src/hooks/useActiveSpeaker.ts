// Detects the active speaker in real-time using Web Audio API AnalyserNode
// Analyzes audio volume across local stream and all remote peers

import { useEffect, useRef } from "react";
import { useMeetingStore } from "@/store/meetingStore";
import type { VideoPeer } from "@/types/meeting";

interface UseActiveSpeakerOptions {
  localStream: MediaStream | null;
  peers: VideoPeer[];
  currentUserId?: string;
  isMuted: boolean;
}

const SPEAKING_THRESHOLD = 14; // Volume threshold to consider speaking
const DECAY_MS = 600; // Hold active speaker highlight for 600ms to avoid flicker

export function useActiveSpeaker({
  localStream,
  peers,
  currentUserId,
  isMuted,
}: UseActiveSpeakerOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<
    Map<
      string,
      {
        source: MediaStreamAudioSourceNode;
        analyser: AnalyserNode;
        dataArray: Uint8Array;
      }
    >
  >(new Map());
  const lastSpokeTimeRef = useRef<{ id: string; time: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const { activeSpeakerId, setActiveSpeakerId } = useMeetingStore();

  useEffect(() => {
    // Initialize AudioContext if not already created
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!audioContextRef.current && AudioContextClass) {
      try {
        audioContextRef.current = new AudioContextClass();
      } catch (err) {
        console.warn("Failed to initialize AudioContext for active speaker detection:", err);
      }
    }

    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    // Resume AudioContext if suspended
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const activeIds = new Set<string>();

    // Setup analyzer helper
    const setupAnalyser = (id: string, stream: MediaStream | null, muted: boolean) => {
      if (!stream || muted) {
        // Cleanup if muted or no stream
        const existing = analysersRef.current.get(id);
        if (existing) {
          try {
            existing.source.disconnect();
          } catch {}
          analysersRef.current.delete(id);
        }
        return;
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== "live" || !audioTrack.enabled) {
        const existing = analysersRef.current.get(id);
        if (existing) {
          try {
            existing.source.disconnect();
          } catch {}
          analysersRef.current.delete(id);
        }
        return;
      }

      activeIds.add(id);

      // Already configured with an active source
      if (analysersRef.current.has(id)) {
        return;
      }

      try {
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analysersRef.current.set(id, { source, analyser, dataArray });
      } catch (err) {
        console.warn(`Could not attach analyser for user ${id}:`, err);
      }
    };

    // 1. Setup local user analyzer
    if (currentUserId) {
      setupAnalyser(currentUserId, localStream, isMuted);
    }

    // 2. Setup remote peers analyzers
    peers.forEach((peer) => {
      setupAnalyser(peer.userId, peer.stream || null, peer.isMuted ?? false);
    });

    // Remove any stale analysers
    Array.from(analysersRef.current.keys()).forEach((id) => {
      if (!activeIds.has(id)) {
        const item = analysersRef.current.get(id);
        if (item) {
          try {
            item.source.disconnect();
          } catch {}
          analysersRef.current.delete(id);
        }
      }
    });

    // Loop to continuously evaluate audio levels
    const checkAudioLevels = () => {
      let maxVolume = 0;
      let loudSpeakerId: string | null = null;
      const now = Date.now();

      analysersRef.current.forEach(({ analyser, dataArray }, id) => {
        analyser.getByteFrequencyData(dataArray as any);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        if (avg > SPEAKING_THRESHOLD && avg > maxVolume) {
          maxVolume = avg;
          loudSpeakerId = id;
        }
      });

      if (loudSpeakerId) {
        lastSpokeTimeRef.current = { id: loudSpeakerId, time: now };
        if (activeSpeakerId !== loudSpeakerId) {
          setActiveSpeakerId(loudSpeakerId);
        }
      } else if (lastSpokeTimeRef.current) {
        // Keep active speaker highlighted during decay window to prevent flickering
        if (now - lastSpokeTimeRef.current.time > DECAY_MS) {
          lastSpokeTimeRef.current = null;
          if (activeSpeakerId !== null) {
            setActiveSpeakerId(null);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(checkAudioLevels);
    };

    animFrameRef.current = requestAnimationFrame(checkAudioLevels);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [localStream, peers, currentUserId, isMuted, activeSpeakerId, setActiveSpeakerId]);

  // Cleanup on final hook unmount
  useEffect(() => {
    return () => {
      analysersRef.current.forEach(({ source }) => {
        try {
          source.disconnect();
        } catch {}
      });
      analysersRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    activeSpeakerId,
    isSpeaking: (userId: string) =>
      Boolean(activeSpeakerId && String(activeSpeakerId) === String(userId)),
  };
}
