import { EnvironmentProviders, Injectable, Provider, Signal, Type, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom, map, timer } from 'rxjs';
import { TabBus } from '../../../core/tabs/tab-bus';
import { TabLeader } from '../../../core/tabs/tab-leader';
import { HandoverGuard, StandDownHook, TabRole } from '../../../core/tabs/tab-leader.model';
import { PhoneState } from '../../../core/phone/phone';
import { resetPhoneFake, setFakeCallLogsMode, setFakePhoneDelay } from '../../../core/phone/phone.fake';
import { CallLeg, PhoneSyncedState } from '../../../core/phone/phone.model';
import { SIP_ENGINE_FACTORY } from '../../../core/phone/sip-engine';
import { FakeSipEngine, resetFakeSipEngineState, setFakeSipTimings } from '../../../core/phone/sip-engine.fake';

/*
 * Test-only harness for the web-phone layout specs (imported by *.spec.ts only, never by the app).
 * The phone runs on the real fakes: PhoneState + FakeSipEngine + the phone.fake API. Only the browser
 * pieces jsdom lacks (WebRTC, media devices, AudioContext, <dialog>.showModal) and the app-level tab
 * leader/bus are replaced, so a spec can switch the tab between leader and follower.
 * It imports nothing from vitest because tsconfig.app.json also type-checks it.
 */

/** Async like the HTTP loader, so Transloco never emits during a render (a sync loader triggers NG0600). */
@Injectable()
class AsyncEmptyLoader implements TranslocoLoader {
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

/** Stand-in for the app-level TabLeader: starts as the leader; `setFollower()` makes this tab a follower. */
export class FakeTabLeader {
  readonly tabId = 'tab-test-1';
  readonly role = signal<TabRole>('leader');
  readonly isLeader = signal(true);
  readonly leaderTabId = signal<string | null>('tab-test-1');
  readonly supported = true;

  private readonly guards = new Map<string, HandoverGuard>();
  private readonly standDowns = new Map<string, StandDownHook>();
  requestLeadershipCalls = 0;

  start(): void {}

  async stop(): Promise<void> {
    if (this.isLeader()) {
      for (const hook of this.standDowns.values()) await hook();
    }
    this.isLeader.set(false);
    this.role.set('electing');
  }

  registerGuard(owner: string, guard: HandoverGuard): () => void {
    this.guards.set(owner, guard);
    return () => this.guards.delete(owner);
  }

  registerStandDown(owner: string, hook: StandDownHook): () => void {
    this.standDowns.set(owner, hook);
    return () => this.standDowns.delete(owner);
  }

  guardsChanged(): void {}

  requestLeadership(): void {
    this.requestLeadershipCalls += 1;
  }

  canHandOver(): boolean {
    for (const guard of this.guards.values()) {
      if (!guard()) return false;
    }
    return true;
  }

  setFollower(): void {
    this.isLeader.set(false);
    this.role.set('follower');
    this.leaderTabId.set('tab-leader-other');
  }
}

/** In-memory TabBus: records what this tab publishes/sends so a spec can see leader/follower traffic. */
export class FakeTabBus {
  private readonly topicSignals = new Map<string, ReturnType<typeof signal<unknown>>>();
  private readonly listeners = new Map<string, Set<(payload: unknown, fromTabId: string) => void>>();

  published: { topic: string; payload: unknown }[] = [];
  sent: { topic: string; payload: unknown }[] = [];
  broadcasted: { topic: string; payload: unknown }[] = [];

  publish<T>(topic: string, payload: T): void {
    this.published.push({ topic, payload });
    this.ensureSignal(topic).set(payload);
  }

  /** Follower -> leader. Not delivered back to this tab's own listeners: the leader is another tab. */
  send<T>(topic: string, payload: T): void {
    this.sent.push({ topic, payload });
  }

  on<T>(topic: string, handler: (payload: T, fromTabId: string) => void): () => void {
    let set = this.listeners.get(topic);
    if (!set) {
      set = new Set();
      this.listeners.set(topic, set);
    }
    const wrapped = handler as (payload: unknown, fromTabId: string) => void;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  state<T>(topic: string): Signal<T | null> {
    return this.ensureSignal(topic).asReadonly() as Signal<T | null>;
  }

  broadcast<T>(topic: string, payload: T): void {
    this.broadcasted.push({ topic, payload });
  }

  /** Delivers a message as if another tab had sent it. */
  dispatch(topic: string, payload: unknown, fromTabId = 'tab-other'): void {
    const set = this.listeners.get(topic);
    if (!set) return;
    for (const fn of [...set]) fn(payload, fromTabId);
  }

  private ensureSignal(topic: string) {
    let sig = this.topicSignals.get(topic);
    if (!sig) {
      sig = signal<unknown>(null);
      this.topicSignals.set(topic, sig);
    }
    return sig;
  }
}

export interface PhoneHarness {
  readonly leader: FakeTabLeader;
  readonly bus: FakeTabBus;
  /** Every FakeSipEngine PhoneState created, in order (the live one is the last). */
  readonly engines: FakeSipEngine[];
  readonly providers: (Provider | EnvironmentProviders)[];
  restore(): void;
}

function noop(): void {}

function fakeMediaStream(): MediaStream {
  const track = { kind: 'audio', enabled: true, readyState: 'live', stop: noop } as unknown as MediaStreamTrack;
  return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  createGain() {
    return { gain: { value: 1, setValueAtTime: noop, linearRampToValueAtTime: noop }, connect: noop, disconnect: noop };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0, setValueAtTime: noop },
      connect: noop,
      start: noop,
      stop: noop,
      disconnect: noop,
      onended: null,
    };
  }
  createConstantSource() {
    return { offset: { value: 0 }, connect: noop, start: noop, stop: noop };
  }
  createMediaStreamSource() {
    return { connect: noop, disconnect: noop };
  }
  createMediaStreamDestination() {
    return { stream: fakeMediaStream(), disconnect: noop };
  }
  createAnalyser() {
    return { fftSize: 256, getFloatTimeDomainData: noop };
  }
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

/** Resets every phone fake, installs the browser stubs and returns the providers for TestBed. */
export function setUpPhoneTest(): PhoneHarness {
  localStorage.clear();
  resetPhoneFake();
  resetFakeSipEngineState();
  setFakePhoneDelay(0);
  setFakeCallLogsMode('normal');
  setFakeSipTimings({
    connectMs: 100,
    registerMs: 100,
    progressMs: 100,
    acceptMs: 250,
    noAnswerMs: 20_000,
    referMs: 100,
  });

  const g = globalThis as Record<string, unknown>;
  const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  const saved = {
    rtc: g['RTCPeerConnection'],
    audio: g['AudioContext'],
    media: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
    secure: Object.getOwnPropertyDescriptor(window, 'isSecureContext'),
    showModal: dialogProto['showModal'],
    close: dialogProto['close'],
  };

  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  g['RTCPeerConnection'] = class {};
  g['AudioContext'] = FakeAudioContext;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => fakeMediaStream(),
      enumerateDevices: async () => [],
      addEventListener: noop,
      removeEventListener: noop,
    },
  });
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    // Browsers fire `close` as a queued task, after the caller's own code has run.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };

  const leader = new FakeTabLeader();
  const bus = new FakeTabBus();
  const engines: FakeSipEngine[] = [];

  return {
    leader,
    bus,
    engines,
    providers: [
      provideRouter([]),
      provideTransloco({
        config: {
          availableLangs: ['ar', 'en'],
          defaultLang: 'en',
          missingHandler: { logMissingKey: false },
        },
        loader: AsyncEmptyLoader,
      }),
      { provide: TabLeader, useValue: leader },
      { provide: TabBus, useValue: bus },
      {
        provide: SIP_ENGINE_FACTORY,
        useValue: () => {
          const engine = new FakeSipEngine();
          engines.push(engine);
          return engine;
        },
      },
    ],
    restore() {
      localStorage.clear();
      resetPhoneFake();
      resetFakeSipEngineState();
      g['RTCPeerConnection'] = saved.rtc;
      g['AudioContext'] = saved.audio;
      if (saved.media) Object.defineProperty(navigator, 'mediaDevices', saved.media);
      else delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
      if (saved.secure) Object.defineProperty(window, 'isSecureContext', saved.secure);
      else delete (window as unknown as Record<string, unknown>)['isSecureContext'];
      dialogProto['showModal'] = saved.showModal;
      dialogProto['close'] = saved.close;
    },
  };
}

/** Drains promises and Angular effects; `advance` moves the (fake) clock first. */
export async function drainPhone(advance: (ms: number) => Promise<unknown>, ms = 0, flushEffects?: () => void): Promise<void> {
  await advance(ms);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  flushEffects?.();
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

/** A leader snapshot for follower specs (an idle, registered phone); override the fields a case needs. */
export function syncedState(overrides: Partial<PhoneSyncedState> = {}): PhoneSyncedState {
  return {
    visible: true,
    paused: false,
    configured: true,
    connection: 'registered',
    status: { code: 'registered' },
    server: { index: 1, count: 2, name: 'Cairo primary', attempt: 1 },
    block: null,
    identity: { displayName: 'Sara Hassan', extension: '1001' },
    legs: [],
    mode: 'single',
    focusedLegId: null,
    call: 'idle',
    timer: 0,
    muted: false,
    speakerMuted: false,
    quality: null,
    ringing: null,
    ringSilenced: false,
    ended: null,
    sentTones: '',
    busy: false,
    canAnswerHere: true,
    missedCount: 0,
    mediaNotice: null,
    micPermission: 'granted',
    notifyPermission: 'default',
    ...overrides,
  };
}

/** A call leg for follower snapshots and input-driven components. */
export function leg(overrides: Partial<CallLeg> = {}): CallLeg {
  return {
    id: 'leg-1',
    role: 'primary',
    direction: 'incoming',
    number: '+201005550142',
    displayName: 'أحمد علي',
    source: null,
    state: 'incoming',
    held: false,
    startedAt: new Date().toISOString(),
    answeredAt: null,
    ...overrides,
  };
}

export interface PhoneSpecContext {
  /** Advances the clock by `ms`, drains promises and effects, and re-renders every mounted fixture. */
  flush(ms?: number): Promise<void>;
  /** Injects PhoneState and lets the fake engine connect and register (100 ms + 100 ms). */
  start(): Promise<PhoneState>;
  mount<T>(type: Type<T>, inputs?: Record<string, unknown>): ComponentFixture<T>;
  destroy(): void;
}

export function phoneSpecContext(advance: (ms: number) => Promise<unknown>): PhoneSpecContext {
  const fixtures: ComponentFixture<unknown>[] = [];
  const render = () => {
    for (const fixture of fixtures) fixture.detectChanges();
  };
  const ctx: PhoneSpecContext = {
    async flush(ms = 0) {
      await drainPhone(advance, ms, () => TestBed.flushEffects());
      render();
      await drainPhone(advance, 0, () => TestBed.flushEffects());
      render();
    },
    async start() {
      // Load the (empty) global language first, so views created later render their keys at once.
      const loaded = firstValueFrom(TestBed.inject(TranslocoService).load('en'));
      await advance(0);
      await loaded;
      const phone = TestBed.inject(PhoneState);
      TestBed.flushEffects();
      await ctx.flush(250);
      return phone;
    },
    mount<T>(type: Type<T>, inputs: Record<string, unknown> = {}) {
      const fixture = TestBed.createComponent(type);
      for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
      fixture.detectChanges();
      fixtures.push(fixture as ComponentFixture<unknown>);
      return fixture;
    },
    destroy() {
      for (const fixture of fixtures.splice(0)) fixture.destroy();
    },
  };
  return ctx;
}

/** The button whose trimmed text or aria-label is this i18n key (the test loader is empty, so keys render). */
export function buttonByKey(root: ParentNode, key: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === key || b.getAttribute('aria-label') === key,
  );
}

export function textOf(fixture: ComponentFixture<unknown>): string {
  return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();
}
