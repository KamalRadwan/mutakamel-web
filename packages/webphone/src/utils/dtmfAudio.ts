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
let keepAlive: OscillatorNode | null = null;

/**
 * Holds one silent oscillator open for the life of the context.
 *
 * A context with no running source is one the browser is free to suspend, and
 * a suspended context's `currentTime` stops advancing — so a tone scheduled
 * against it is queued at a frozen instant and only becomes audible once
 * `resume()` lands. That is heard as the tone arriving well after the key,
 * which is the whole symptom this file exists to avoid. A muted oscillator
 * costs almost nothing and keeps the clock running.
 */
function startKeepAlive(ctx: AudioContext): void {
  if (keepAlive) return;
  try {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    keepAlive = osc;
  } catch {
    // Failing to hold the context open is not a reason to lose DTMF entirely.
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
    if (AudioContextClass) {
      // `interactive` asks for the smallest buffer the device will grant,
      // which is the difference between a keypad and a tape delay.
      audioCtx = new AudioContextClass({ latencyHint: "interactive" });
      startKeepAlive(audioCtx);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

/**
 * Builds and starts the audio clock before the first digit is pressed.
 *
 * A browser hands back a **suspended** context and `resume()` is asynchronous,
 * so creating it inside the keypress made the first tone wait for the audio
 * clock to start — long enough to hear the sound land after the button had
 * already animated. Priming it from an earlier user gesture (the autoplay
 * policy requires a gesture, which opening the dock provides) moves that cost
 * off the keypad.
 *
 * Safe to call repeatedly; once the context is running it does nothing.
 */
export function primeDtmfAudio(): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === "running") return;
  void ctx.resume().catch(() => undefined);
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

  // A suspended context has a frozen clock, so scheduling against it now would
  // park the tone at whatever instant the clock stopped and release it only
  // when the resume finally lands. Waiting for the resume and scheduling
  // against a live clock costs the same wall time but plays the tone once,
  // when it is asked for, instead of late.
  if (ctx.state === "suspended") {
    void ctx
      .resume()
      .then(() => scheduleTone(ctx, freqs, volume, duration))
      .catch(() => undefined);
    return;
  }

  scheduleTone(ctx, freqs, volume, duration);
}

function scheduleTone(
  ctx: AudioContext,
  freqs: [number, number],
  volume: number,
  duration: number,
) {
  try {
    const [lowFreq, highFreq] = freqs;
    // No lead-in. The previous 10ms head start bought nothing — Web Audio
    // schedules "now" reliably — and it sat on top of the cold-context delay,
    // so the two together were what made the tone trail the keypress.
    const start = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const toneVolume = Math.max(0.02, Math.min(0.12, volume / 850));

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(lowFreq, start);
    osc2.frequency.setValueAtTime(highFreq, start);
    gainNode.gain.setValueAtTime(0.0001, start);
    // 5ms attack rather than 15ms: still long enough to avoid the click of a
    // hard start, short enough that the tone reads as instant.
    gainNode.gain.exponentialRampToValueAtTime(
      toneVolume,
      start + 0.005,
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
