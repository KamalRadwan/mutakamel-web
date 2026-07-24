// Web Audio API Synthesizer for Authentic Telephone DTMF Tones

const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playDtmfTone(char: string, duration = 0.12) {
  const freqs = DTMF_FREQUENCIES[char];
  if (!freqs) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const [lowFreq, highFreq] = freqs;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc1.type = "sine";
  osc2.type = "sine";

  osc1.frequency.setValueAtTime(lowFreq, ctx.currentTime);
  osc2.frequency.setValueAtTime(highFreq, ctx.currentTime);

  // Set gain level (volume) to avoid clipping
  gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime);

  osc1.stop(ctx.currentTime + duration);
  osc2.stop(ctx.currentTime + duration);
}
