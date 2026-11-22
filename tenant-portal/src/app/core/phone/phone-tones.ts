import { DOCUMENT, DestroyRef, Service, inject } from '@angular/core';
import { PhoneRingVolumeLevel, PhoneVolumeLevel, volumeToGain } from './phone-preferences';

const DTMF_TABLE: Readonly<Record<string, readonly [number, number]>> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

const DTMF_DURATION_SEC = 0.12;
const RING_FREQ_A = 440;
const RING_FREQ_B = 554;
const RING_BURST_SEC = 0.7;
const RING_PERIOD_MS = 1600;

/** setSinkId is in the DOM lib now; kept as an alias for the call sites. */
type AudioElementWithSinkId = HTMLAudioElement;

/** Synthesizes DTMF tones, speaker tests, and leader ringtones using Web Audio. */
@Service()
export class PhoneTones {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private ctx: AudioContext | null = null;
  private keepAliveNode: ConstantSourceNode | OscillatorNode | null = null;
  private primed = false;

  private ringTimer: ReturnType<typeof setInterval> | null = null;
  private ringActiveNodes: { stop: () => void }[] = [];
  private ringSinkEl: AudioElementWithSinkId | null = null;
  private ringSinkDest: MediaStreamAudioDestinationNode | null = null;
  private isRinging = false;

  private readonly onGesture = () => {
    this.primeContext();
  };

  constructor() {
    this.document.addEventListener('pointerdown', this.onGesture, { capture: true, passive: true });
    this.document.addEventListener('keydown', this.onGesture, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('pointerdown', this.onGesture, { capture: true });
      this.document.removeEventListener('keydown', this.onGesture, { capture: true });
      this.stopRing();
      this.closeContext();
    });
  }

  /** Plays a 120 ms standard dual-frequency DTMF tone for `0-9`, `*`, or `#`. */
  playDtmf(key: string, volume: PhoneVolumeLevel = 'medium'): void {
    const pair = DTMF_TABLE[key];
    if (!pair) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const gainValue = Math.min(0.2, volumeToGain(volume) * 0.16);
    this.playDualTone(ctx, pair[0], pair[1], DTMF_DURATION_SEC, gainValue, ctx.destination);
  }

  /** Plays a short test chime on the selected speaker output device. */
  playSpeakerTest(volume: PhoneVolumeLevel = 'medium', sinkId: string | null = null): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const gainValue = Math.max(0.05, volumeToGain(volume) * 0.25);

    const playOnTarget = (target: AudioNode) => {
      this.playDualTone(ctx, 523.25, 659.25, 0.22, gainValue, target);
      setTimeout(() => {
        if (this.ctx === ctx) {
          this.playDualTone(ctx, 659.25, 783.99, 0.28, gainValue, target);
        }
      }, 240);
    };

    if (sinkId && typeof ctx.createMediaStreamDestination === 'function') {
      const el = this.createSinkAudioElement(sinkId);
      if (el) {
        const dest = ctx.createMediaStreamDestination();
        el.srcObject = dest.stream;
        void el.play().catch(() => {});
        playOnTarget(dest);
        setTimeout(() => {
          el.pause();
          el.srcObject = null;
        }, 900);
        return;
      }
    }

    playOnTarget(ctx.destination);
  }

  /** Starts the 440 + 554 Hz ringtone loop (0.7 s burst every 1.6 s) unless muted (`off`). */
  startRing(volume: PhoneRingVolumeLevel, sinkId: string | null = null): void {
    this.stopRing();
    if (volume === 'off') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isRinging = true;
    const gainValue = Math.max(0.04, volumeToGain(volume) * 0.25);
    let target: AudioNode = ctx.destination;

    if (sinkId && typeof ctx.createMediaStreamDestination === 'function') {
      const el = this.createSinkAudioElement(sinkId);
      if (el) {
        const dest = ctx.createMediaStreamDestination();
        el.srcObject = dest.stream;
        void el.play().catch(() => {});
        this.ringSinkEl = el;
        this.ringSinkDest = dest;
        target = dest;
      }
    }

    const triggerBurst = () => {
      if (!this.isRinging || this.ctx !== ctx) return;
      this.playDualTone(ctx, RING_FREQ_A, RING_FREQ_B, RING_BURST_SEC, gainValue, target, this.ringActiveNodes);
    };

    triggerBurst();
    this.ringTimer = setInterval(triggerBurst, RING_PERIOD_MS);
  }

  /** Updates the active ringtone volume or output device when preferences change mid-ring. */
  updateRing(volume: PhoneRingVolumeLevel, sinkId: string | null = null): void {
    if (!this.isRinging) return;
    this.startRing(volume, sinkId);
  }

  /** Stops any running ringtone loop and detaches temporary sink elements. */
  stopRing(): void {
    this.isRinging = false;
    if (this.ringTimer !== null) {
      clearInterval(this.ringTimer);
      this.ringTimer = null;
    }
    for (const active of this.ringActiveNodes) {
      active.stop();
    }
    this.ringActiveNodes = [];
    if (this.ringSinkEl) {
      try {
        this.ringSinkEl.pause();
        this.ringSinkEl.srcObject = null;
      } catch {
        // Ignore cleanup errors
      }
      this.ringSinkEl = null;
    }
    if (this.ringSinkDest) {
      try {
        this.ringSinkDest.disconnect();
      } catch {
        // Ignore cleanup errors
      }
      this.ringSinkDest = null;
    }
  }

  private primeContext(): void {
    if (this.primed) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.primed = true;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      if (typeof ctx.createConstantSource === 'function') {
        const src = ctx.createConstantSource();
        src.offset.value = 0;
        src.connect(gain);
        src.start();
        this.keepAliveNode = src;
      } else {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.start();
        this.keepAliveNode = osc;
      }
    } catch {
      // Ignore Web Audio mock limitations in tests.
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private closeContext(): void {
    try {
      this.keepAliveNode?.stop();
    } catch {
      // Ignore cleanup errors
    }
    this.keepAliveNode = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private createSinkAudioElement(sinkId: string): AudioElementWithSinkId | null {
    try {
      const el = this.document.createElement('audio') as AudioElementWithSinkId;
      if (typeof el.setSinkId !== 'function') return null;
      void el.setSinkId(sinkId).catch(() => {});
      return el;
    } catch {
      return null;
    }
  }

  private playDualTone(
    ctx: AudioContext,
    freqA: number,
    freqB: number,
    durationSec: number,
    gainLevel: number,
    target: AudioNode,
    trackList?: { stop: () => void }[],
  ): void {
    try {
      const now = ctx.currentTime;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const gain = ctx.createGain();

      oscA.type = 'sine';
      oscB.type = 'sine';
      oscA.frequency.setValueAtTime(freqA, now);
      oscB.frequency.setValueAtTime(freqB, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainLevel, now + 0.01);
      gain.gain.setValueAtTime(gainLevel, Math.max(now + 0.01, now + durationSec - 0.02));
      gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(target);

      const handle = {
        stop: () => {
          try {
            oscA.stop();
            oscB.stop();
          } catch {
            // Already stopped
          }
          try {
            oscA.disconnect();
            oscB.disconnect();
            gain.disconnect();
          } catch {
            // Ignore cleanup errors
          }
        },
      };

      trackList?.push(handle);
      oscA.start(now);
      oscB.start(now);
      oscA.stop(now + durationSec + 0.01);
      oscB.stop(now + durationSec + 0.01);
      oscA.onended = () => {
        if (trackList) {
          const idx = trackList.indexOf(handle);
          if (idx >= 0) trackList.splice(idx, 1);
        }
        handle.stop();
      };
    } catch {
      // Non-fatal in restricted or mocked environments.
    }
  }
}
