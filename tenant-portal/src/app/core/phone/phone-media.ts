import { DestroyRef, Service, inject, signal } from '@angular/core';
import { MediaNotice, PhoneDevicesInfo, PhoneMicPermission } from './phone.model';
import { PhonePrefs, volumeToGain } from './phone-preferences';

export interface ConferenceMixLeg {
  id: string;
  peer: RTCPeerConnection | null;
  remoteStream: MediaStream | null;
}

/** setSinkId is in the DOM lib now; kept as an alias for the call sites. */
type AudioElementWithSinkId = HTMLAudioElement;

const METER_INTERVAL_MS = 60;

/** Manages microphone streams, audio output routing, level metering, and conference Web Audio mixing. */
@Service()
export class PhoneMedia {
  private readonly destroyRef = inject(DestroyRef);

  readonly micPermission = signal<PhoneMicPermission>('unknown');
  readonly devices = signal<PhoneDevicesInfo>({
    inputs: [],
    outputs: [],
    canChooseOutput: this.detectCanChooseOutput(),
  });
  readonly micLevel = signal(0);
  readonly speakerLevel = signal(0);
  readonly mediaNotice = signal<MediaNotice | null>(null);

  private audioEl: AudioElementWithSinkId | null = null;
  private rawMicStream: MediaStream | null = null;
  private processedMicStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private micGainNode: GainNode | null = null;
  private currentRemoteStream: MediaStream | null = null;

  private meterActive = false;
  private meterStream: MediaStream | null = null;
  private meterCtx: AudioContext | null = null;
  private meterAnalyser: AnalyserNode | null = null;
  private meterTimer: ReturnType<typeof setInterval> | null = null;
  private meterBuffer: Float32Array<ArrayBuffer> | null = null;

  private speakerMeterCtx: AudioContext | null = null;
  private speakerAnalyser: AnalyserNode | null = null;
  private speakerTimer: ReturnType<typeof setInterval> | null = null;
  private speakerBuffer: Float32Array<ArrayBuffer> | null = null;

  private confCtx: AudioContext | null = null;
  private confCleanupNodes: (() => void)[] = [];

  private onDeviceGoneCb: ((missing: { mic?: boolean; speaker?: boolean; ring?: boolean }) => void) | null = null;
  private getPrefsCb: (() => PhonePrefs) | null = null;
  private permissionStatus: PermissionStatus | null = null;
  private initialized = false;
  private useSyntheticMicFallback = false;
  /** Streams created by the dev-only synthetic mic fallback, so callers can report `simulated` instead of `granted`. */
  private readonly syntheticStreams = new WeakSet<MediaStream>();

  private readonly onDeviceChange = () => {
    void this.refreshDevices(true);
  };

  private readonly onPermissionChange = () => {
    if (!this.permissionStatus) return;
    const perm = mapPermissionState(this.permissionStatus.state);
    this.micPermission.set(perm);
    if (perm === 'denied') {
      this.mediaNotice.set('permissionDenied');
    } else if (perm === 'granted' && this.mediaNotice() === 'permissionDenied') {
      this.mediaNotice.set(null);
    }
    void this.refreshDevices(false);
  };

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  isSecureContext(): boolean {
    return typeof window === 'undefined' ? true : window.isSecureContext !== false;
  }

  isBrowserSupported(): boolean {
    return (
      typeof RTCPeerConnection !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
    );
  }

  setSyntheticMicFallback(enabled: boolean): void {
    this.useSyntheticMicFallback = enabled;
  }

  init(
    onDeviceGone: (missing: { mic?: boolean; speaker?: boolean; ring?: boolean }) => void,
    getPrefs: () => PhonePrefs,
  ): void {
    this.onDeviceGoneCb = onDeviceGone;
    this.getPrefsCb = getPrefs;
    if (this.initialized) return;
    this.initialized = true;

    void this.queryMicPermission();
    void this.refreshDevices(false);

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', this.onDeviceChange);
    }
  }

  dispose(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', this.onDeviceChange);
    }
    this.permissionStatus?.removeEventListener('change', this.onPermissionChange);
    this.permissionStatus = null;
    this.stopMicMeter();
    this.stopConferenceMix();
    this.releaseCallMic();
    this.clearRemoteStream();
    this.initialized = false;
  }

  async refreshDevices(notifyIfMissing = false): Promise<PhoneDevicesInfo> {
    const canChooseOutput = this.detectCanChooseOutput();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      const empty: PhoneDevicesInfo = { inputs: [], outputs: [], canChooseOutput };
      this.devices.set(empty);
      return empty;
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((d) => d.kind === 'audioinput');
      const outputs = all.filter((d) => d.kind === 'audiooutput');
      const next: PhoneDevicesInfo = { inputs, outputs, canChooseOutput };
      this.devices.set(next);

      if (notifyIfMissing && this.getPrefsCb && this.onDeviceGoneCb) {
        const prefs = this.getPrefsCb();
        const hasRealInputIds = inputs.some((d) => d.deviceId !== '');
        const hasRealOutputIds = outputs.some((d) => d.deviceId !== '');
        const missing: { mic?: boolean; speaker?: boolean; ring?: boolean } = {};
        if (prefs.micId && hasRealInputIds && !inputs.some((d) => d.deviceId === prefs.micId)) {
          missing.mic = true;
        }
        if (prefs.speakerId && hasRealOutputIds && !outputs.some((d) => d.deviceId === prefs.speakerId)) {
          missing.speaker = true;
        }
        if (prefs.ringId && hasRealOutputIds && !outputs.some((d) => d.deviceId === prefs.ringId)) {
          missing.ring = true;
        }
        if (missing.mic || missing.speaker || missing.ring) {
          this.onDeviceGoneCb(missing);
        }
      }
      return next;
    } catch {
      const fallback: PhoneDevicesInfo = { inputs: [], outputs: [], canChooseOutput };
      this.devices.set(fallback);
      return fallback;
    }
  }

  async requestMicPermission(): Promise<PhoneMicPermission> {
    if (!this.isSecureContext()) {
      this.mediaNotice.set('requiresHttps');
      return 'denied';
    }
    if (!this.isBrowserSupported()) {
      this.mediaNotice.set('unavailable');
      return 'denied';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stopMediaTracks(stream);
      this.micPermission.set('granted');
      if (
        this.mediaNotice() === 'permissionDenied' ||
        this.mediaNotice() === 'noMicrophone' ||
        this.mediaNotice() === 'unavailable'
      ) {
        this.mediaNotice.set(null);
      }
      await this.refreshDevices(false);
      return 'granted';
    } catch (error) {
      const classified = classifyMediaError(error);
      if (this.useSyntheticMicFallback && classified !== 'permissionDenied') {
        const synthetic = this.createSyntheticMicStream();
        if (synthetic) {
          stopMediaTracks(synthetic);
        }
        this.micPermission.set('simulated');
        if (
          this.mediaNotice() === 'permissionDenied' ||
          this.mediaNotice() === 'noMicrophone' ||
          this.mediaNotice() === 'unavailable'
        ) {
          this.mediaNotice.set(null);
        }
        await this.refreshDevices(false);
        return 'simulated';
      }
      if (classified === 'noMicrophone') {
        this.mediaNotice.set('noMicrophone');
        this.micPermission.set('prompt');
      } else {
        this.micPermission.set('denied');
        this.mediaNotice.set('permissionDenied');
      }
      await this.refreshDevices(false);
      return this.micPermission();
    }
  }

  async acquireCallMic(prefs: PhonePrefs, muted: boolean): Promise<MediaStream> {
    if (!this.isSecureContext()) {
      this.mediaNotice.set('requiresHttps');
      throw new Error('requiresHttps');
    }
    if (!this.isBrowserSupported()) {
      this.mediaNotice.set('unavailable');
      throw new Error('unavailable');
    }

    if (this.rawMicStream && this.hasLiveAudioTrack(this.rawMicStream)) {
      this.applyMicPrefs(prefs, muted);
      return this.processedMicStream ?? this.rawMicStream;
    }

    this.releaseCallMic();

    let raw: MediaStream;
    try {
      raw = await this.openMicStream(prefs.micId);
    } catch (error) {
      const classified = classifyMediaError(error);
      if (classified === 'noMicrophone') {
        this.mediaNotice.set('noMicrophone');
      } else if (classified === 'permissionDenied') {
        this.micPermission.set('denied');
        this.mediaNotice.set('permissionDenied');
      } else {
        this.mediaNotice.set('unavailable');
      }
      throw error;
    }

    this.micPermission.set(this.syntheticStreams.has(raw) ? 'simulated' : 'granted');
    if (
      this.mediaNotice() === 'permissionDenied' ||
      this.mediaNotice() === 'noMicrophone' ||
      this.mediaNotice() === 'unavailable'
    ) {
      this.mediaNotice.set(null);
    }

    this.rawMicStream = raw;
    this.processedMicStream = this.buildProcessedMicStream(raw, prefs, muted);
    void this.refreshDevices(false);
    return this.processedMicStream;
  }

  getCallMicStream(): MediaStream | null {
    return this.processedMicStream ?? this.rawMicStream;
  }

  getRawMicStream(): MediaStream | null {
    return this.rawMicStream;
  }

  applyMicPrefs(prefs: PhonePrefs, muted: boolean): void {
    const targetGain = muted ? 0 : volumeToGain(prefs.micVolume);
    if (this.micGainNode && this.micCtx) {
      try {
        this.micGainNode.gain.setValueAtTime(targetGain, this.micCtx.currentTime);
      } catch {
        this.micGainNode.gain.value = targetGain;
      }
    }
    this.setStreamTracksEnabled(this.rawMicStream, !muted);
    this.setStreamTracksEnabled(this.processedMicStream, !muted);
  }

  releaseCallMic(): void {
    if (this.processedMicStream && this.processedMicStream !== this.rawMicStream) {
      stopMediaTracks(this.processedMicStream);
    }
    this.processedMicStream = null;
    if (this.rawMicStream) {
      stopMediaTracks(this.rawMicStream);
      this.rawMicStream = null;
    }
    this.micGainNode = null;
    if (this.micCtx) {
      void this.micCtx.close().catch(() => {});
      this.micCtx = null;
    }
    if (this.meterActive) {
      void this.ensureMeterAttached();
    }
  }

  attachAudio(el: HTMLAudioElement): void {
    this.audioEl = el as AudioElementWithSinkId;
    if (this.getPrefsCb) {
      this.applySpeakerPrefs(this.getPrefsCb(), false);
    }
    if (this.currentRemoteStream) {
      void this.playStreamOnElement(this.currentRemoteStream);
    }
  }

  applySpeakerPrefs(prefs: PhonePrefs, speakerMuted: boolean): void {
    const el = this.audioEl;
    if (!el) return;
    el.volume = volumeToGain(prefs.speakerVolume);
    el.muted = speakerMuted;
    if (typeof el.setSinkId === 'function') {
      void el.setSinkId(prefs.speakerId ?? '').catch(() => {
        // Fallback silently to default output when sink ID is unavailable.
      });
    }
  }

  async playRemoteStream(stream: MediaStream | null, prefs: PhonePrefs, speakerMuted: boolean): Promise<void> {
    this.currentRemoteStream = stream;
    this.applySpeakerPrefs(prefs, speakerMuted);
    if (!stream) {
      this.clearRemoteStream();
      return;
    }
    this.startSpeakerMeter(stream);
    await this.playStreamOnElement(stream);
  }

  async retryRemotePlayback(): Promise<void> {
    if (!this.audioEl || !this.currentRemoteStream) {
      if (this.mediaNotice() === 'clickToAllow') this.mediaNotice.set(null);
      return;
    }
    await this.playStreamOnElement(this.currentRemoteStream);
  }

  clearRemoteStream(): void {
    this.currentRemoteStream = null;
    this.stopSpeakerMeter();
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
      } catch {
        // Ignore DOM cleanup errors
      }
    }
    if (this.mediaNotice() === 'clickToAllow') {
      this.mediaNotice.set(null);
    }
  }

  setMeterActive(active: boolean, prefs?: PhonePrefs): void {
    if (active === this.meterActive) return;
    this.meterActive = active;
    if (active) {
      void this.startMicMeter(prefs ?? this.getPrefsCb?.());
    } else {
      this.stopMicMeter();
    }
  }

  async startMicMeter(prefs?: PhonePrefs): Promise<void> {
    this.meterActive = true;
    await this.ensureMeterAttached(prefs?.micId ?? null);
  }

  stopMicMeter(): void {
    this.meterActive = false;
    if (this.meterTimer !== null) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
    this.meterAnalyser = null;
    this.meterBuffer = null;
    if (this.meterCtx) {
      void this.meterCtx.close().catch(() => {});
      this.meterCtx = null;
    }
    if (this.meterStream) {
      stopMediaTracks(this.meterStream);
      this.meterStream = null;
    }
    this.micLevel.set(0);
  }

  /** Builds per-leg Web Audio mixes (mic + every other leg) and swaps via RTCRtpSender.replaceTrack(). */
  async startConferenceMix(legs: ConferenceMixLeg[], prefs: PhonePrefs, speakerMuted: boolean): Promise<void> {
    const micStream = this.processedMicStream ?? this.rawMicStream;
    if (!micStream) {
      throw new Error('Missing microphone stream for conference mix');
    }
    if (typeof AudioContext === 'undefined') {
      throw new Error('Web Audio is unavailable for conference mix');
    }

    const rollbackTracks: { sender: RTCRtpSender; prevTrack: MediaStreamTrack | null }[] = [];
    this.stopConferenceMix();

    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ latencyHint: 'interactive' });
      this.confCtx = ctx;
      const cleanupNodes: (() => void)[] = [];

      const micSource = ctx.createMediaStreamSource(micStream);
      const localSpeakerDest = ctx.createMediaStreamDestination();
      const legRemoteSources = new Map<string, MediaStreamAudioSourceNode>();

      for (const leg of legs) {
        if (leg.remoteStream && this.hasLiveAudioTrack(leg.remoteStream)) {
          const src = ctx.createMediaStreamSource(leg.remoteStream);
          legRemoteSources.set(leg.id, src);
          src.connect(localSpeakerDest);
        }
      }

      for (const leg of legs) {
        if (!leg.peer) {
          throw new Error(`Missing peer connection for leg ${leg.id}`);
        }
        const sender = leg.peer.getSenders().find((s) => !s.track || s.track.kind === 'audio');
        if (!sender || typeof sender.replaceTrack !== 'function') {
          throw new Error(`Missing audio sender for leg ${leg.id}`);
        }

        const outDest = ctx.createMediaStreamDestination();
        micSource.connect(outDest);
        for (const [otherId, otherSrc] of legRemoteSources.entries()) {
          if (otherId !== leg.id) {
            otherSrc.connect(outDest);
          }
        }

        const mixedTrack = outDest.stream.getAudioTracks()[0] ?? null;
        if (!mixedTrack) {
          throw new Error(`No audio track created for leg ${leg.id}`);
        }
        const prevTrack = sender.track;
        await sender.replaceTrack(mixedTrack);
        rollbackTracks.push({ sender, prevTrack });
        cleanupNodes.push(() => {
          stopMediaTracks(outDest.stream);
          try {
            outDest.disconnect();
          } catch {
            // Ignore cleanup errors
          }
        });
      }

      this.confCleanupNodes = cleanupNodes;
      await this.playRemoteStream(localSpeakerDest.stream, prefs, speakerMuted);
    } catch (error) {
      for (const entry of rollbackTracks) {
        try {
          await entry.sender.replaceTrack(entry.prevTrack);
        } catch {
          // Ignore rollback failure
        }
      }
      this.stopConferenceMix();
      throw error;
    }
  }

  /** Restores direct microphone track and remote playback when returning from conference to single call. */
  async restoreSingleCallMix(leg: ConferenceMixLeg, prefs: PhonePrefs, speakerMuted: boolean): Promise<void> {
    this.stopConferenceMix();
    const micTrack = (this.processedMicStream ?? this.rawMicStream)?.getAudioTracks()[0] ?? null;
    if (leg.peer && micTrack) {
      const sender = leg.peer.getSenders().find((s) => !s.track || s.track.kind === 'audio');
      if (sender && typeof sender.replaceTrack === 'function') {
        try {
          await sender.replaceTrack(micTrack);
        } catch {
          // Ignore restore errors
        }
      }
    }
    await this.playRemoteStream(leg.remoteStream, prefs, speakerMuted);
  }

  stopConferenceMix(): void {
    for (const fn of this.confCleanupNodes) {
      fn();
    }
    this.confCleanupNodes = [];
    if (this.confCtx) {
      void this.confCtx.close().catch(() => {});
      this.confCtx = null;
    }
  }

  private async ensureMeterAttached(micId: string | null = null): Promise<void> {
    if (!this.meterActive || typeof AudioContext === 'undefined') return;
    if (this.meterTimer !== null) return;

    let stream = this.rawMicStream;
    if (!stream) {
      const perm = this.micPermission();
      if (perm !== 'granted' && perm !== 'simulated') return;
      try {
        stream = await this.openMicStream(micId);
        if (!this.meterActive) {
          stopMediaTracks(stream);
          return;
        }
        this.meterStream = stream;
      } catch {
        return;
      }
    }

    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
      this.meterCtx = ctx;
      this.meterAnalyser = analyser;
      this.meterBuffer = buffer;
      this.meterTimer = setInterval(() => {
        if (!this.meterAnalyser || !this.meterBuffer) return;
        this.micLevel.set(computeAnalyserLevel(this.meterAnalyser, this.meterBuffer));
      }, METER_INTERVAL_MS);
    } catch {
      this.micLevel.set(0);
    }
  }

  private startSpeakerMeter(stream: MediaStream): void {
    this.stopSpeakerMeter();
    if (!this.hasLiveAudioTrack(stream) || typeof AudioContext === 'undefined') return;
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
      this.speakerMeterCtx = ctx;
      this.speakerAnalyser = analyser;
      this.speakerBuffer = buffer;
      this.speakerTimer = setInterval(() => {
        if (!this.speakerAnalyser || !this.speakerBuffer) return;
        this.speakerLevel.set(computeAnalyserLevel(this.speakerAnalyser, this.speakerBuffer));
      }, METER_INTERVAL_MS);
    } catch {
      this.stopSpeakerMeter();
    }
  }

  private stopSpeakerMeter(): void {
    if (this.speakerTimer !== null) {
      clearInterval(this.speakerTimer);
      this.speakerTimer = null;
    }
    this.speakerAnalyser = null;
    this.speakerBuffer = null;
    if (this.speakerMeterCtx) {
      void this.speakerMeterCtx.close().catch(() => {});
      this.speakerMeterCtx = null;
    }
    this.speakerLevel.set(0);
  }

  private buildProcessedMicStream(raw: MediaStream, prefs: PhonePrefs, muted: boolean): MediaStream {
    this.setStreamTracksEnabled(raw, !muted);
    if (typeof AudioContext === 'undefined') return raw;
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      if (typeof ctx.createMediaStreamDestination !== 'function') {
        void ctx.close().catch(() => {});
        return raw;
      }
      const source = ctx.createMediaStreamSource(raw);
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : volumeToGain(prefs.micVolume);
      const dest = ctx.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(dest);
      this.micCtx = ctx;
      this.micGainNode = gain;
      this.setStreamTracksEnabled(dest.stream, !muted);
      return dest.stream;
    } catch {
      return raw;
    }
  }

  private async openMicStream(micId: string | null): Promise<MediaStream> {
    try {
      if (micId) {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId } }, video: false });
        } catch (err) {
          if (err instanceof Error && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
          throw err;
        }
      }
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      if (this.useSyntheticMicFallback && classifyMediaError(error) !== 'permissionDenied') {
        const synthetic = this.createSyntheticMicStream();
        if (synthetic) {
          this.syntheticStreams.add(synthetic);
          return synthetic;
        }
      }
      throw error;
    }
  }

  private createSyntheticMicStream(): MediaStream | null {
    if (typeof AudioContext !== 'undefined') {
      try {
        const ctx = new AudioContext({ latencyHint: 'interactive' });
        if (typeof ctx.createMediaStreamDestination === 'function') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const dest = ctx.createMediaStreamDestination();
          osc.type = 'sine';
          osc.frequency.value = 220;
          gain.gain.value = 0.005;
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          for (const track of dest.stream.getAudioTracks()) {
            const origStop = track.stop.bind(track);
            track.stop = () => {
              try {
                osc.stop();
              } catch {
                // Ignore already stopped
              }
              void ctx.close().catch(() => {});
              origStop();
            };
          }
          return dest.stream;
        }
        void ctx.close().catch(() => {});
      } catch {
        // Fallback when AudioContext destination is unavailable.
      }
    }
    if (typeof MediaStream !== 'undefined') {
      return new MediaStream();
    }
    return null;
  }

  private async playStreamOnElement(stream: MediaStream): Promise<void> {
    const el = this.audioEl;
    if (!el) return;
    el.srcObject = stream;
    try {
      await el.play();
      if (this.mediaNotice() === 'clickToAllow') {
        this.mediaNotice.set(null);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        this.mediaNotice.set('clickToAllow');
      }
    }
  }

  private async queryMicPermission(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.permissionStatus = status;
      const perm = mapPermissionState(status.state);
      this.micPermission.set(perm);
      if (perm === 'denied') {
        this.mediaNotice.set('permissionDenied');
      } else if (perm === 'granted' && this.mediaNotice() === 'permissionDenied') {
        this.mediaNotice.set(null);
      }
      status.addEventListener('change', this.onPermissionChange);
    } catch {
      // Safari/jsdom may reject microphone permission query.
    }
  }

  private detectCanChooseOutput(): boolean {
    return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  }

  private hasLiveAudioTrack(stream: MediaStream): boolean {
    const tracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
    return tracks.some((t) => t.readyState !== 'ended');
  }

  private setStreamTracksEnabled(stream: MediaStream | null, enabled: boolean): void {
    if (!stream || typeof stream.getAudioTracks !== 'function') return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }
}

function stopMediaTracks(stream: MediaStream): void {
  if (typeof stream.getTracks !== 'function') return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Ignore cleanup errors
    }
  }
}

function mapPermissionState(state: PermissionState): PhoneMicPermission {
  if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
  return 'unknown';
}

function classifyMediaError(error: unknown): 'noMicrophone' | 'permissionDenied' | 'unavailable' {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'noMicrophone';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permissionDenied';
  return 'unavailable';
}

function computeAnalyserLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i] ?? 0;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / buffer.length);
  return Math.min(100, Math.round(rms * 260));
}
