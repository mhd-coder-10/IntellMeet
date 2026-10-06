// Web Audio API synthesized chimes for Google Meet-like meeting experience
// No external audio assets required; runs reliably in all modern browsers.

let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

/**
 * Play a Google Meet style gentle two-tone chime when recording starts
 * Notes: G4 (392Hz) -> C5 (523.25Hz) with soft sine wave & exponential decay
 */
export const playRecordingStartChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Tone 1: 392Hz
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(392, now);
  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.35);

  // Tone 2: 523.25Hz (higher tone, feels affirming)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(523.25, now + 0.16);
  gain2.gain.setValueAtTime(0.001, now + 0.16);
  gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.22);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.16);
  osc2.stop(now + 0.7);
};

/**
 * Play a gentle descending tone when recording stops
 * Notes: C5 (523.25Hz) -> G4 (392Hz)
 */
export const playRecordingStopChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(523.25, now);
  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.3);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(392, now + 0.14);
  gain2.gain.setValueAtTime(0.001, now + 0.14);
  gain2.gain.exponentialRampToValueAtTime(0.16, now + 0.19);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.14);
  osc2.stop(now + 0.6);
};
