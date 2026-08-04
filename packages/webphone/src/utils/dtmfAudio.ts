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

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

export function playDtmfTone(
  char: string,
  volume = 100,
  duration = 0.12,
) {
  const freqs = DTMF_FREQUENCIES[char];
  if (!freqs || volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const [lowFreq, highFreq] = freqs;
    const start = ctx.currentTime + 0.01;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const toneVolume = Math.max(0.02, Math.min(0.12, volume / 850));

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(lowFreq, start);
    osc2.frequency.setValueAtTime(highFreq, start);
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(
      toneVolume,
      start + 0.015,
    );
    gainNode.gain.setValueAtTime(toneVolume, start + duration * 0.65);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration,
    );

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + duration + 0.01);
    osc2.stop(start + duration + 0.01);

    window.setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      gainNode.disconnect();
    }, Math.ceil((duration + 0.08) * 1000));
  } catch {
    // DTMF feedback must never block keypad input or an active SIP call.
  }
}
