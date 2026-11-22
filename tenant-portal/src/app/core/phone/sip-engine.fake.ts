import { isDevMode } from '@angular/core';
import { FakeCallLogsMode, FakePhoneMeMode, setFakeCallLogsMode, setFakePhoneMeMode } from './phone.fake';
import { PhoneMe, PhoneServer } from './phone.model';
import { SipCallOptions, SipCauseEvent, SipEngine, SipEngineEvent, SipLeg, SipLegEvent } from './sip-engine';

export interface FakeSipTimings {
  connectMs: number;
  registerMs: number;
  progressMs: number;
  acceptMs: number;
  noAnswerMs: number;
  referMs: number;
}

export const DEFAULT_FAKE_SIP_TIMINGS: FakeSipTimings = {
  connectMs: 400,
  registerMs: 600,
  progressMs: 700,
  acceptMs: 2000,
  noAnswerMs: 20000,
  referMs: 800,
};

export interface PhoneFakeDevApi {
  ring: (number?: string) => void;
  hangupRemote: (legId?: string) => void;
  failPrimary: (on: boolean) => void;
  dropMedia: () => void;
  setMeMode: (mode: FakePhoneMeMode) => void;
  setCallLogsMode: (mode: FakeCallLogsMode) => void;
}

interface PhoneFakeWindow extends Window {
  __phoneFake?: PhoneFakeDevApi;
}

interface FakeSender {
  track: MediaStreamTrack | null;
  replaceTrack: (track: MediaStreamTrack | null) => Promise<void>;
}

interface FakePeer {
  connectionState: RTCPeerConnectionState;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  getSenders: () => FakeSender[];
  getStats: () => Promise<Map<string, Record<string, unknown>>>;
  failMedia: () => void;
  setConnected: () => void;
}

let globalFailPrimary = false;
let globalTimings: FakeSipTimings = { ...DEFAULT_FAKE_SIP_TIMINGS };
const activeEngines = new Set<FakeSipEngine>();
let onDevModeChangeCb: (() => void) | null = null;

/** Sets timing overrides for the fake SIP engine (primarily for fast unit tests). */
export function setFakeSipTimings(overrides: Partial<FakeSipTimings>): void {
  globalTimings = { ...DEFAULT_FAKE_SIP_TIMINGS, ...overrides };
}

/** Resets global fake SIP engine state (primarily for unit tests). */
export function resetFakeSipEngineState(): void {
  globalFailPrimary = false;
  globalTimings = { ...DEFAULT_FAKE_SIP_TIMINGS };
  activeEngines.clear();
  onDevModeChangeCb = null;
}

/** Registers a callback triggered when dev mode helpers alter `/me` mode on `window.__phoneFake`. */
export function onFakeMeModeChange(cb: (() => void) | null): void {
  onDevModeChangeCb = cb;
}

/** Installs `window.__phoneFake` helpers in Angular dev mode. */
export function installPhoneFakeGlobals(): void {
  if (typeof window === 'undefined' || !isDevMode()) return;
  const win = window as PhoneFakeWindow;
  if (win.__phoneFake) return;

  win.__phoneFake = {
    ring: (number = '+201005550142') => {
      for (const engine of activeEngines) {
        if (engine.isRegistered) {
          engine.simulateIncoming(number);
          return;
        }
      }
    },
    hangupRemote: (legId?: string) => {
      for (const engine of activeEngines) {
        if (engine.simulateRemoteHangup(legId)) return;
      }
    },
    failPrimary: (on: boolean) => {
      globalFailPrimary = on;
      if (on) {
        for (const engine of activeEngines) {
          if (engine.isPrimaryServer && engine.isConnected) {
            engine.simulateRegistrationFailure();
          }
        }
      }
    },
    dropMedia: () => {
      for (const engine of activeEngines) {
        engine.simulateMediaDrop();
      }
    },
    setMeMode: (mode: FakePhoneMeMode) => {
      setFakePhoneMeMode(mode);
      onDevModeChangeCb?.();
    },
    setCallLogsMode: (mode: FakeCallLogsMode) => {
      setFakeCallLogsMode(mode);
    },
  };
}

/** Fake SIP leg simulating ringing, acceptance, busy/no-answer, hold, DTMF, refer, and remote audio. */
export class FakeSipLeg implements SipLeg {
  readonly id: string;
  readonly remoteNumber: string;
  readonly remoteName: string | null;
  readonly peer: RTCPeerConnection | null;

  private readonly listeners = new Map<SipLegEvent, Set<(arg?: unknown) => void>>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly fakePeer: FakePeer;

  private held = false;
  private muted = false;
  private accepted = false;
  private finished = false;
  private traceSip = false;

  private osc: OscillatorNode | null = null;
  private audioCtx: AudioContext | null = null;
  private remoteStream: MediaStream | null = null;

  constructor(
    id: string,
    remoteNumber: string,
    remoteName: string | null,
    private readonly direction: 'incoming' | 'outgoing',
    private readonly timings: FakeSipTimings,
    private readonly onClosed: (id: string) => void,
    traceSip = false,
  ) {
    this.id = id;
    this.remoteNumber = remoteNumber;
    this.remoteName = remoteName;
    this.traceSip = traceSip;
    this.fakePeer = createFakePeer();
    this.peer = this.fakePeer as unknown as RTCPeerConnection;
  }

  startOutgoing(stream: MediaStream): void {
    const sender = this.fakePeer.getSenders()[0];
    if (sender && typeof stream.getAudioTracks === 'function') {
      sender.track = stream.getAudioTracks()[0] ?? null;
    }

    this.schedule(() => {
      if (this.finished) return;
      this.emit('progress');
    }, this.timings.progressMs);

    if (this.remoteNumber.endsWith('0')) {
      this.schedule(() => {
        if (this.finished) return;
        this.finish('failed', { cause: 'Busy', statusCode: 486 });
      }, this.timings.acceptMs);
      return;
    }

    if (this.remoteNumber.endsWith('9')) {
      this.schedule(() => {
        if (this.finished) return;
        this.finish('failed', { cause: 'No Answer', statusCode: 408 });
      }, this.timings.noAnswerMs);
      return;
    }

    this.schedule(() => {
      if (this.finished) return;
      this.acceptCall();
    }, this.timings.acceptMs);
  }

  answer(stream: MediaStream): void {
    if (this.finished || this.direction !== 'incoming' || this.accepted) return;
    const sender = this.fakePeer.getSenders()[0];
    if (sender && typeof stream.getAudioTracks === 'function') {
      sender.track = stream.getAudioTracks()[0] ?? null;
    }
    this.acceptCall();
  }

  terminate(status?: 480 | 486 | 603): void {
    if (this.finished) return;
    if (this.accepted) {
      this.finish('ended', { cause: 'Terminated', statusCode: status ?? 200 });
    } else {
      const cause = status === 486 ? 'Busy' : status === 603 ? 'Declined' : status === 480 ? 'Unavailable' : 'Terminated';
      this.finish('failed', { cause, statusCode: status ?? 487 });
    }
  }

  simulateRemoteHangup(): void {
    if (this.finished) return;
    if (this.accepted) {
      this.finish('ended', { cause: 'BYE', statusCode: 200 });
    } else {
      this.finish('failed', { cause: 'Cancelled', statusCode: 487 });
    }
  }

  simulateMediaDrop(): void {
    if (this.finished) return;
    this.fakePeer.failMedia();
  }

  hold(): boolean {
    if (this.finished || !this.accepted) return false;
    this.held = true;
    return true;
  }

  unhold(): boolean {
    if (this.finished || !this.accepted) return false;
    this.held = false;
    return true;
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }

  dtmf(tone: string): void {
    if (this.traceSip && isDevMode()) {
      console.info('[phone] fake DTMF', { legId: this.id, tone });
    }
  }

  refer(target: string, replaces?: SipLeg): void {
    if (this.finished || !this.accepted) return;
    const targetNumber = extractUserPart(target);
    this.schedule(() => {
      if (this.finished) return;
      if (targetNumber.endsWith('7')) {
        this.emit('referFailed', { cause: 'Transfer Rejected', statusCode: 603 } satisfies SipCauseEvent);
        return;
      }
      this.emit('referAccepted');
      this.finish('ended', { cause: 'Transferred', statusCode: 200 });
      if (replaces && replaces instanceof FakeSipLeg) {
        replaces.finish('ended', { cause: 'Transferred', statusCode: 200 });
      }
    }, this.timings.referMs);
  }

  on(event: SipLegEvent, handler: (arg?: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  isHeld(): boolean {
    return this.held;
  }

  isMuted(): boolean {
    return this.muted;
  }

  dispose(): void {
    this.clearTimers();
    this.stopRemoteTone();
    this.listeners.clear();
  }

  private acceptCall(): void {
    this.accepted = true;
    this.fakePeer.setConnected();
    this.emit('accepted');
    const stream = this.createRemoteStream();
    if (stream) {
      this.emit('remoteStream', stream);
    }
  }

  private finish(event: 'ended' | 'failed', detail: SipCauseEvent): void {
    if (this.finished) return;
    this.finished = true;
    this.clearTimers();
    this.stopRemoteTone();
    this.onClosed(this.id);
    this.emit(event, detail);
  }

  private emit(event: SipLegEvent, arg?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(arg);
    }
  }

  private schedule(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private createRemoteStream(): MediaStream | null {
    if (typeof AudioContext !== 'undefined') {
      try {
        const ctx = new AudioContext();
        if (typeof ctx.createMediaStreamDestination === 'function') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const dest = ctx.createMediaStreamDestination();
          osc.type = 'sine';
          osc.frequency.value = 330;
          gain.gain.value = 0.015;
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          this.audioCtx = ctx;
          this.osc = osc;
          this.remoteStream = dest.stream;
          return dest.stream;
        }
        void ctx.close().catch(() => {});
      } catch {
        // Fallback when AudioContext is unavailable in tests.
      }
    }
    if (typeof MediaStream !== 'undefined') {
      this.remoteStream = new MediaStream();
      return this.remoteStream;
    }
    return null;
  }

  private stopRemoteTone(): void {
    try {
      this.osc?.stop();
    } catch {
      // Ignore already stopped
    }
    this.osc = null;
    if (this.remoteStream && typeof this.remoteStream.getTracks === 'function') {
      for (const track of this.remoteStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      }
    }
    this.remoteStream = null;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}

/** Fake SIP engine simulating registration, failover, outgoing/incoming calls, and dev hooks. */
export class FakeSipEngine implements SipEngine {
  private readonly listeners = new Map<SipEngineEvent, Set<(arg?: unknown) => void>>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly activeLegs = new Map<string, FakeSipLeg>();

  private currentServer: PhoneServer | null = null;
  private stopped = false;
  private connected = false;
  private registered = false;
  private legCounter = 0;

  readonly events = {
    on: (event: SipEngineEvent, handler: (arg?: unknown) => void): (() => void) => {
      let set = this.listeners.get(event);
      if (!set) {
        set = new Set();
        this.listeners.set(event, set);
      }
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
  };

  constructor(private readonly timings: FakeSipTimings = globalTimings) {}

  get isConnected(): boolean {
    return this.connected;
  }

  get isRegistered(): boolean {
    return this.registered;
  }

  get isPrimaryServer(): boolean {
    return this.currentServer?.priority === 1;
  }

  async connect(server: PhoneServer, _me: PhoneMe, _ice: RTCIceServer[]): Promise<void> {
    this.stopped = false;
    this.currentServer = server;
    activeEngines.add(this);

    if (server.traceSip && isDevMode()) {
      console.info('[phone] fake connect', { server: server.name, url: server.websocketUrl });
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        resolve();
      }, this.timings.connectMs);
      this.timers.add(timer);
    });

    if (this.stopped) return;
    this.connected = true;
    this.emit('connected');
  }

  register(): void {
    if (this.stopped || !this.currentServer) return;
    const server = this.currentServer;

    this.schedule(() => {
      if (this.stopped) return;
      if (globalFailPrimary && server.priority === 1) {
        this.registered = false;
        this.emit('registrationFailed', { cause: 'Service Unavailable', statusCode: 503 } satisfies SipCauseEvent);
        return;
      }
      this.registered = true;
      this.emit('registered');
    }, this.timings.registerMs);
  }

  unregister(): void {
    this.registered = false;
  }

  stop(): void {
    this.stopped = true;
    this.connected = false;
    this.registered = false;
    this.clearTimers();
    for (const leg of this.activeLegs.values()) {
      leg.dispose();
    }
    this.activeLegs.clear();
    activeEngines.delete(this);
    this.listeners.clear();
  }

  call(target: string, opts: SipCallOptions): SipLeg {
    const number = extractUserPart(target);
    const id = `fake-leg-${++this.legCounter}`;
    const leg = new FakeSipLeg(
      id,
      number,
      null,
      'outgoing',
      this.timings,
      (closedId) => this.activeLegs.delete(closedId),
      this.currentServer?.traceSip ?? false,
    );
    this.activeLegs.set(id, leg);
    leg.startOutgoing(opts.stream);
    return leg;
  }

  simulateIncoming(number: string, name: string | null = null): FakeSipLeg {
    const id = `fake-leg-${++this.legCounter}`;
    const leg = new FakeSipLeg(
      id,
      number,
      name,
      'incoming',
      this.timings,
      (closedId) => this.activeLegs.delete(closedId),
      this.currentServer?.traceSip ?? false,
    );
    this.activeLegs.set(id, leg);
    this.emit('incoming', leg);
    return leg;
  }

  simulateRemoteHangup(legId?: string): boolean {
    const target = legId ? this.activeLegs.get(legId) : Array.from(this.activeLegs.values()).at(-1);
    if (!target) return false;
    target.simulateRemoteHangup();
    return true;
  }

  simulateRegistrationFailure(cause = 'Service Unavailable', statusCode = 503): void {
    this.registered = false;
    this.emit('registrationFailed', { cause, statusCode } satisfies SipCauseEvent);
  }

  simulateMediaDrop(): void {
    for (const leg of this.activeLegs.values()) {
      leg.simulateMediaDrop();
    }
  }

  private emit(event: SipEngineEvent, arg?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(arg);
    }
  }

  private schedule(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

function extractUserPart(target: string): string {
  const withoutScheme = target.replace(/^sips?:/i, '');
  const atIndex = withoutScheme.indexOf('@');
  return (atIndex >= 0 ? withoutScheme.slice(0, atIndex) : withoutScheme).trim();
}

function createFakePeer(): FakePeer {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  let state: RTCPeerConnectionState = 'new';
  let packetsReceived = 0;

  const sender: FakeSender = {
    track: null,
    replaceTrack: async (track: MediaStreamTrack | null) => {
      sender.track = track;
    },
  };

  const emitStateChange = () => {
    const set = listeners.get('connectionstatechange');
    if (!set) return;
    const evt = typeof Event !== 'undefined' ? new Event('connectionstatechange') : ({ type: 'connectionstatechange' } as Event);
    for (const listener of [...set]) {
      if (typeof listener === 'function') {
        listener(evt);
      } else {
        listener.handleEvent(evt);
      }
    }
  };

  return {
    get connectionState() {
      return state;
    },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener);
    },
    getSenders: () => [sender],
    getStats: async () => {
      packetsReceived += 150;
      const stats = new Map<string, Record<string, unknown>>();
      stats.set('inbound-audio', {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsReceived,
        packetsLost: 0,
        jitterBufferDelay: packetsReceived * 0.012,
        jitterBufferEmittedCount: packetsReceived,
      });
      stats.set('pair-1', {
        type: 'candidate-pair',
        nominated: true,
        currentRoundTripTime: 0.032,
      });
      return stats;
    },
    failMedia: () => {
      state = 'failed';
      emitStateChange();
    },
    setConnected: () => {
      state = 'connected';
      emitStateChange();
    },
  };
}
