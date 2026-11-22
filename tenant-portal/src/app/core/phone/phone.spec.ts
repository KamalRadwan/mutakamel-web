import { Injectable, Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageState } from '../i18n/language';
import { Notify } from '../notify/notify';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import { HandoverGuard, StandDownHook, TabRole } from '../tabs/tab-leader.model';
import { PhoneState } from './phone';
import { listCallLogs } from './phone.api';
import { resetPhoneFake, setFakePhoneDelay, setFakePhoneMeMode, setFakeTurnTtl } from './phone.fake';
import { PhoneLostPayload, PhoneSyncedState } from './phone.model';
import { PHONE_PREFS_STORAGE_KEY, readPhonePrefs } from './phone-preferences';
import { SIP_ENGINE_FACTORY } from './sip-engine';
import { FakeSipEngine, FakeSipLeg, resetFakeSipEngineState, setFakeSipTimings } from './sip-engine.fake';

class FakeTabLeader {
  readonly tabId = 'tab-test-1';
  readonly role = signal<TabRole>('leader');
  readonly isLeader = signal(true);
  readonly leaderTabId = signal<string | null>('tab-test-1');
  readonly supported = true;

  private readonly guards = new Map<string, HandoverGuard>();
  private readonly standDowns = new Map<string, StandDownHook>();
  guardsChangedCalls = 0;
  requestLeadershipCalls = 0;

  start(): void {}

  async stop(): Promise<void> {
    if (this.isLeader()) {
      for (const hook of this.standDowns.values()) {
        await hook();
      }
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

  guardsChanged(): void {
    this.guardsChangedCalls += 1;
  }

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
  }

  setLeader(): void {
    this.isLeader.set(true);
    this.role.set('leader');
  }
}

class FakeTabBus {
  private readonly topicSignals = new Map<string, ReturnType<typeof signal<unknown>>>();
  private readonly listeners = new Map<string, Set<(payload: unknown, fromTabId: string) => void>>();

  published: { topic: string; payload: unknown }[] = [];
  sent: { topic: string; payload: unknown }[] = [];
  broadcasted: { topic: string; payload: unknown }[] = [];

  publish<T>(topic: string, payload: T): void {
    this.published.push({ topic, payload });
    this.ensureSignal(topic).set(payload);
  }

  send<T>(topic: string, payload: T): void {
    this.sent.push({ topic, payload });
    this.dispatch(topic, payload, 'tab-follower');
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
    this.dispatch(topic, payload, 'tab-other');
  }

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

@Injectable()
class FakeTransloco {
  events$ = of();
  setActiveLang = vi.fn();
  selectTranslation() {
    return of({});
  }
  load() {
    return of({});
  }
  translate(key: string) {
    return key;
  }
}

function createFakeMediaStream(): MediaStream {
  const track = {
    kind: 'audio',
    enabled: true,
    readyState: 'live',
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

describe('PhoneState', () => {
  let fakeTabLeader: FakeTabLeader;
  let fakeTabBus: FakeTabBus;
  let engines: FakeSipEngine[];
  let origRtc: unknown;
  let origMediaDevices: unknown;
  let origAudioContext: unknown;
  let origSecureContext: PropertyDescriptor | undefined;

  async function flush(ms = 0): Promise<void> {
    if (ms > 0) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    TestBed.flushEffects();
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  }

  function createPhone(): PhoneState {
    const phone = TestBed.inject(PhoneState);
    TestBed.flushEffects();
    return phone;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    resetPhoneFake();
    resetFakeSipEngineState();
    setFakePhoneDelay(0);
    setFakeSipTimings({
      connectMs: 100,
      registerMs: 100,
      progressMs: 100,
      acceptMs: 250,
      noAnswerMs: 20_000,
      referMs: 100,
    });

    engines = [];
    fakeTabLeader = new FakeTabLeader();
    fakeTabBus = new FakeTabBus();

    origRtc = globalThis.RTCPeerConnection;
    origMediaDevices = navigator.mediaDevices;
    origAudioContext = globalThis.AudioContext;
    origSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    (globalThis as Record<string, unknown>)['RTCPeerConnection'] = class {};
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => createFakeMediaStream()),
        enumerateDevices: vi.fn(async () => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    (globalThis as Record<string, unknown>)['AudioContext'] = class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createGain() {
        return { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      }
      createOscillator() {
        return { type: 'sine', frequency: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
      }
      createConstantSource() {
        return { offset: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect: vi.fn() };
      }
      createMediaStreamDestination() {
        return { stream: createFakeMediaStream(), disconnect: vi.fn() };
      }
      createAnalyser() {
        return { fftSize: 256, getFloatTimeDomainData: vi.fn() };
      }
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
    };

    TestBed.configureTestingModule({
      providers: [
        PhoneState,
        Notify,
        LanguageState,
        { provide: TranslocoService, useClass: FakeTransloco },
        { provide: TabLeader, useValue: fakeTabLeader },
        { provide: TabBus, useValue: fakeTabBus },
        {
          provide: SIP_ENGINE_FACTORY,
          useValue: () => {
            const eng = new FakeSipEngine();
            engines.push(eng);
            return eng;
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    localStorage.removeItem(PHONE_PREFS_STORAGE_KEY);
    resetPhoneFake();
    resetFakeSipEngineState();

    (globalThis as Record<string, unknown>)['RTCPeerConnection'] = origRtc;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: origMediaDevices });
    (globalThis as Record<string, unknown>)['AudioContext'] = origAudioContext;
    if (origSecureContext) {
      Object.defineProperty(window, 'isSecureContext', origSecureContext);
    } else {
      delete (window as unknown as Record<string, unknown>)['isSecureContext'];
    }
  });

  it('handles /me gates: 403/409 hidden silently, OVER_CAPACITY visible+paused, notConfigured, requiresHttps, unsupported', async () => {
    setFakePhoneMeMode('403');
    const phone = createPhone();
    await flush();
    expect(phone.visible()).toBe(false);
    expect(TestBed.inject(Notify).toasts().length).toBe(0);

    setFakePhoneMeMode('409');
    await phone.reload();
    expect(phone.visible()).toBe(false);
    expect(TestBed.inject(Notify).toasts().length).toBe(0);

    setFakePhoneMeMode('DISABLED');
    await phone.reload();
    expect(phone.visible()).toBe(false);

    setFakePhoneMeMode('OVER_CAPACITY');
    await phone.reload();
    expect(phone.visible()).toBe(true);
    expect(phone.paused()).toBe(true);
    expect(phone.block()).toBe('paused');

    setFakePhoneMeMode('notConfigured');
    await phone.reload();
    expect(phone.visible()).toBe(true);
    expect(phone.configured()).toBe(false);
    expect(phone.block()).toBe('notConfigured');

    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    setFakePhoneMeMode('enabled');
    await phone.reload();
    expect(phone.block()).toBe('requiresHttps');

    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    (globalThis as Record<string, unknown>)['RTCPeerConnection'] = undefined;
    await phone.reload();
    expect(phone.block()).toBe('unsupported');
  });

  it('registers, retries up to maxRetries, fails over across servers, pauses 5s after last server, and ignores stale engines', async () => {
    const phone = createPhone();
    await flush();

    // Fail primary server: retries twice (attempt 1 -> 2), then fails over to Cairo backup
    const firstEngine = engines[0];
    expect(phone.server().name).toBe('Cairo primary');
    firstEngine.simulateRegistrationFailure('Service Unavailable', 503);
    await flush();
    expect(phone.status().detail).toBe('503: Service Unavailable');
    expect(phone.server().attempt).toBe(2);

    // Retry fires after 1000 ms on engine #2 (still Cairo primary)
    await flush(1_000);
    expect(engines.length).toBe(2);
    const secondEngine = engines[1];

    // Stale event from engine #1 must be ignored
    firstEngine.simulateRegistrationFailure('Stale error', 500);
    await flush();
    expect(phone.server().name).toBe('Cairo primary');

    // Attempt 2 fails -> fails over immediately to Cairo backup (server 2, attempt 1)
    secondEngine.simulateRegistrationFailure('Timeout', 408);
    await flush();
    expect(phone.server().index).toBe(2);
    expect(phone.server().name).toBe('Cairo backup');
    expect(phone.server().attempt).toBe(1);

    // Connect + register on Cairo backup -> registered
    await flush(250);
    expect(phone.connection()).toBe('registered');
    expect(phone.block()).toBeNull();

    // Now simulate Cairo backup failing too -> retries twice -> 5s lap pause resets to server 1
    engines[2].simulateRegistrationFailure('Forbidden', 403);
    await flush(1_000);
    engines[3].simulateRegistrationFailure('Forbidden', 403);
    await flush();
    expect(phone.connection()).toBe('error');
    expect(phone.block()).toBe('registrationFailed');

    await flush(5_000);
    expect(phone.server().index).toBe(1);
    expect(phone.server().name).toBe('Cairo primary');
    expect(phone.server().attempt).toBe(1);

    // Calling retry() while on server 2 resets back to server 1, attempt 1
    engines[4].simulateRegistrationFailure('Timeout', 408);
    await flush(1_000);
    engines[5].simulateRegistrationFailure('Timeout', 408);
    await flush();
    expect(phone.server().index).toBe(2);
    phone.retry();
    await flush();
    expect(phone.server().index).toBe(1);
    expect(phone.server().attempt).toBe(1);
  });

  it('never fails over while busy and pays owed failover after call ends', async () => {
    const phone = createPhone();
    await flush(250);
    expect(phone.connection()).toBe('registered');

    await phone.call('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');
    expect(fakeTabLeader.canHandOver()).toBe(false);

    // Registration drops during call -> must NOT fail over while busy
    engines[0].simulateRegistrationFailure('Connection lost', 503);
    await flush();
    expect(engines.length).toBe(1);
    expect(phone.callState()).toBe('active');

    phone.hangup();
    await flush();
    expect(phone.busy()).toBe(false);
    expect(fakeTabLeader.canHandOver()).toBe(true);
    // Owed failover starts retry on primary
    expect(phone.connection()).toBe('connecting');
  });

  it('a 403 /me during an active call keeps the call and engine, and hides the phone only after hang-up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const phone = createPhone();
    await flush(250);
    await phone.call('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');

    setFakePhoneMeMode('403');
    await phone.reload();
    await flush();
    expect(phone.callState()).toBe('active');
    expect(phone.visible()).toBe(true);
    expect(engines.length).toBe(1);
    expect(engines[0].isRegistered).toBe(true);
    expect(warn).toHaveBeenCalled();
    // A later transient failure must not downgrade the decided hide.
    setFakePhoneMeMode('SERVER_ERROR');
    await phone.reload();
    await flush();
    expect(phone.callState()).toBe('active');

    phone.hangup();
    await flush();
    expect(phone.busy()).toBe(false);
    expect(phone.visible()).toBe(false);
    expect(phone.block()).toBeNull();
    expect(engines[0].isConnected).toBe(false);
    warn.mockRestore();
  });

  it('a 409 /me while a call is ringing waits for the ring to end', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const phone = createPhone();
    await flush(250);
    engines[0].simulateIncoming('+201005550142');
    await flush();
    expect(phone.ringing()).not.toBeNull();

    setFakePhoneMeMode('409');
    await phone.reload();
    await flush();
    expect(phone.ringing()).not.toBeNull();
    expect(phone.visible()).toBe(true);

    phone.decline();
    await flush();
    expect(phone.busy()).toBe(false);
    expect(phone.visible()).toBe(false);
    warn.mockRestore();
  });

  it('a failed TURN refresh mid-call keeps the call and ICE, then re-fetches /me after hang-up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // TURN credentials live 70 s, so the refresh (60 s before expiry) fires 10 s after load.
    setFakeTurnTtl(70_000);
    const phone = createPhone();
    await flush(250);
    await phone.call('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');

    setFakePhoneMeMode('SERVER_ERROR');
    await flush(10_000);
    expect(phone.callState()).toBe('active');
    expect(phone.visible()).toBe(true);
    expect(phone.block()).toBeNull();
    expect(engines.length).toBe(1);
    expect(engines[0].isRegistered).toBe(true);
    expect(warn).toHaveBeenCalled();

    setFakePhoneMeMode('enabled');
    phone.hangup();
    await flush(250);
    expect(phone.visible()).toBe(true);
    expect(phone.block()).toBeNull();
    expect(phone.connection()).toBe('registered');
    warn.mockRestore();
  });

  it('a disabled /me mid-call (OVER_CAPACITY) is applied only after the call ends', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const phone = createPhone();
    await flush(250);
    await phone.call('+201005550142');
    await flush(300);

    setFakePhoneMeMode('OVER_CAPACITY');
    await phone.reload();
    await flush();
    expect(phone.callState()).toBe('active');
    expect(phone.paused()).toBe(false);
    expect(engines[0].isRegistered).toBe(true);

    phone.hangup();
    await flush();
    expect(phone.paused()).toBe(true);
    expect(phone.block()).toBe('paused');
    warn.mockRestore();
  });

  it.each([
    ['403', 'hidden'],
    ['409', 'hidden'],
    ['MODULE_INACTIVE', 'suspended'],
    ['SCOPE_MISMATCH', 'scopeMismatch'],
  ] as const)('maps /me mode %s to the %s state when idle', async (mode, expected) => {
    const phone = createPhone();
    await flush(250);
    expect(phone.connection()).toBe('registered');

    setFakePhoneMeMode(mode);
    await phone.reload();
    await flush();
    if (expected === 'hidden') {
      expect(phone.visible()).toBe(false);
      expect(phone.block()).toBeNull();
      expect(engines.at(-1)!.isConnected).toBe(false);
    } else {
      expect(phone.visible()).toBe(true);
      expect(phone.block()).toBe(expected);
      expect(phone.configured()).toBe(false);
      expect(engines.at(-1)!.isConnected).toBe(false);
      // Retry re-fetches /me and recovers once the refusal is gone.
      setFakePhoneMeMode('enabled');
      phone.retry();
      await flush(250);
      expect(phone.connection()).toBe('registered');
      expect(phone.block()).toBeNull();
    }
    expect(TestBed.inject(Notify).toasts().length).toBe(0);
  });

  it.each([
    ['MODULE_INACTIVE', 'suspended'],
    ['SCOPE_MISMATCH', 'scopeMismatch'],
  ] as const)('a /me %s mid-call keeps the call and shows %s only after it ends', async (mode, expected) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const phone = createPhone();
    await flush(250);
    await phone.call('+201005550142');
    await flush(300);

    setFakePhoneMeMode(mode);
    await phone.reload();
    await flush();
    expect(phone.callState()).toBe('active');
    expect(phone.block()).toBeNull();
    expect(engines[0].isRegistered).toBe(true);

    phone.hangup();
    await flush();
    expect(phone.visible()).toBe(true);
    expect(phone.block()).toBe(expected);
    expect(phone.configured()).toBe(false);
    expect(engines.at(-1)!.isConnected).toBe(false);
    warn.mockRestore();
  });

  it('an uncoded 403 is not read as "not purchased": a visible phone shows the retryable error', async () => {
    const phone = createPhone();
    await flush(250);
    setFakePhoneMeMode('FORBIDDEN');
    await phone.reload();
    await flush();
    expect(phone.visible()).toBe(true);
    expect(phone.block()).toBe('registrationFailed');
  });

  it('handles outgoing busy (ending in 0) and no-answer (ending in 9)', async () => {
    const phone = createPhone();
    await flush(250);

    await phone.call('+201005550140');
    await flush(300);
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('busy');

    await phone.call('+201005550149');
    await flush(20_100);
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('noAnswer');
  });

  it('rejects incoming calls with 486 when busy or DND, and looks up caller + updates missedCount', async () => {
    const phone = createPhone();
    await flush(250);
    const termSpy = vi.spyOn(FakeSipLeg.prototype, 'terminate');

    // DND rejects with 486
    phone.setPref('dnd', true);
    engines[0].simulateIncoming('+201005550142');
    expect(termSpy).toHaveBeenCalledWith(486);

    // Reset DND and test active call blocking incoming
    phone.setPref('dnd', false);
    const leg1 = engines[0].simulateIncoming('+201005550142');
    await flush();
    expect(phone.ringing()?.source?.label).toBe('أحمد علي');

    // Second incoming while ringing/busy gets 486
    termSpy.mockClear();
    const leg2 = engines[0].simulateIncoming('+201099998888');
    expect(leg2.remoteNumber).toBe('+201099998888');
    expect(termSpy).toHaveBeenCalledWith(486);

    // Remote hangup on leg1 while unanswered -> increments missedCount
    leg1.simulateRemoteHangup();
    await flush();
    expect(phone.missedCount()).toBe(1);
    phone.clearMissed();
    expect(phone.missedCount()).toBe(0);

    // Auto-answer answers incoming call after 250 ms
    phone.setPref('autoAnswer', true);
    engines[0].simulateIncoming('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');
    phone.hangup();
    await flush();
    termSpy.mockRestore();
  });

  it('supports blind transfer success and failure (ending in 7)', async () => {
    const phone = createPhone();
    await flush(250);

    await phone.call('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');

    phone.blindTransfer('1007');
    await flush(150);
    expect(phone.callState()).toBe('active');
    expect(TestBed.inject(Notify).toasts().some((t) => t.type === 'error')).toBe(true);

    phone.blindTransfer('1002');
    await flush(150);
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('transferred');
    expect(phone.ended()?.transferredTo).toBe('1002');
  });

  it('supports consult swap, cancel, complete transfer, and held-primary remote hangup', async () => {
    const phone = createPhone();
    await flush(250);

    // Start primary call
    await phone.call('+201005550142');
    await flush(300);
    const primaryId = phone.focusedLegId()!;

    // Start consult -> holds primary, dials consult
    await phone.startConsult('1002');
    await flush(300);
    expect(phone.mode()).toBe('consult');
    expect(phone.legs().find((l) => l.id === primaryId)?.held).toBe(true);
    const consultId = phone.focusedLegId()!;
    expect(consultId).not.toBe(primaryId);

    // Swap legs
    phone.swapLegs();
    await flush();
    expect(phone.focusedLegId()).toBe(primaryId);
    expect(phone.legs().find((l) => l.id === primaryId)?.held).toBe(false);
    expect(phone.legs().find((l) => l.id === consultId)?.held).toBe(true);

    // Cancel consult -> returns to single active primary
    phone.cancelConsult();
    await flush();
    expect(phone.mode()).toBe('single');
    expect(phone.legs().length).toBe(1);
    expect(phone.legs()[0].held).toBe(false);

    // Consult + completeTransfer -> both legs end transferred
    await phone.startConsult('1003');
    await flush(300);
    phone.completeTransfer();
    await flush(150);
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('transferred');
    expect(phone.ended()?.transferredTo).toBe('1003');

    // Held primary hangs up -> consult becomes primary
    await phone.call('+201005550142');
    await flush(300);
    const p2Id = phone.focusedLegId()!;
    await phone.startConsult('1004');
    await flush(300);
    engines[0].simulateRemoteHangup(p2Id);
    await flush();
    expect(phone.mode()).toBe('single');
    expect(phone.legs().length).toBe(1);
    expect(phone.legs()[0].role).toBe('primary');
    expect(phone.legs()[0].held).toBe(false);
  });

  it('supports conference merge, addParty, removeParty drop to single, and endConference', async () => {
    const phone = createPhone();
    await flush(250);

    await phone.call('+201005550142');
    await flush(300);
    await phone.startConsult('1002');
    await flush(300);

    phone.mergeConference();
    await flush();
    expect(phone.mode()).toBe('conference');
    expect(phone.legs().every((l) => !l.held)).toBe(true);

    await phone.addParty('1003');
    await flush(300);
    expect(phone.legs().length).toBe(3);

    // Remove one party -> 2 remain in conference
    const party3 = phone.legs().find((l) => l.number === '1003')!;
    phone.removeParty(party3.id);
    await flush();
    expect(phone.mode()).toBe('conference');
    expect(phone.legs().length).toBe(2);

    // Remove second -> 1 remains, drops back to single mode
    const party2 = phone.legs().find((l) => l.number === '1002')!;
    phone.removeParty(party2.id);
    await flush();
    expect(phone.mode()).toBe('single');
    expect(phone.legs().length).toBe(1);

    // Add party again and endConference -> all end with conferenceEnded
    await phone.addParty('1005');
    await flush(300);
    phone.endConference();
    await flush();
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('conferenceEnded');
  });

  it('routes follower commands over phone.command and requests leadership on call()', async () => {
    const phone = createPhone();
    await flush(250);

    fakeTabLeader.setFollower();
    await flush();

    // Follower receives leader state
    const snapshot: PhoneSyncedState = {
      visible: true,
      paused: false,
      configured: true,
      connection: 'registered',
      status: { code: 'inCall' },
      server: { index: 1, count: 2, name: 'Cairo primary', attempt: 1 },
      block: null,
      identity: { displayName: 'Sara Hassan', extension: '1001' },
      legs: [
        {
          id: 'remote-leg-1',
          role: 'primary',
          direction: 'outgoing',
          number: '+201005550142',
          displayName: 'أحمد علي',
          source: null,
          state: 'active',
          held: false,
          startedAt: new Date().toISOString(),
          answeredAt: new Date().toISOString(),
        },
      ],
      mode: 'single',
      focusedLegId: 'remote-leg-1',
      call: 'active',
      timer: 12,
      muted: false,
      speakerMuted: false,
      quality: null,
      ringing: null,
      ringSilenced: false,
      ended: null,
      sentTones: '',
      busy: true,
      canAnswerHere: true,
      missedCount: 0,
      mediaNotice: null,
      micPermission: 'granted',
      notifyPermission: 'default',
    };
    fakeTabBus.publish('phone.state', snapshot);
    await flush();

    expect(phone.busy()).toBe(true);
    phone.toggleMute();
    expect(fakeTabBus.sent.some((m) => m.topic === 'phone.command')).toBe(true);

    // Follower calling when idle requests leadership and fails gracefully after 8s if not granted
    fakeTabBus.publish('phone.state', { ...snapshot, busy: false, legs: [], call: 'idle', status: { code: 'idle' } });
    await flush();
    const callPromise = phone.call('+201005550142');
    expect(fakeTabLeader.requestLeadershipCalls).toBe(1);
    await flush(8_100);
    await callPromise;
    // A follower's status() mirrors the leader's synced snapshot; the local failure surfaces as the error toast.
    expect(phone.status().code).toBe('idle');
    expect(TestBed.inject(Notify).toasts().some((t) => t.type === 'error')).toBe(true);
  });

  it('shows persistent lost-call toast on pagehide broadcast and on crash takeover without phone.lost', async () => {
    const phone = createPhone();
    await flush(250);
    const notify = TestBed.inject(Notify);

    // Broadcast phone.lost (simulating another tab closing mid-call)
    const lostPayload: PhoneLostPayload = {
      lossId: 'lost-1',
      name: 'أحمد علي',
      number: '+201005550142',
      durationSeconds: 75,
    };
    fakeTabBus.dispatch('phone.lost', lostPayload);
    await flush();
    expect(notify.toasts().filter((t) => t.type === 'error').length).toBe(1);

    // Simulate follower becoming leader after a crashed busy leader (no phone.lost sent)
    fakeTabLeader.setFollower();
    await flush();
    fakeTabBus.publish('phone.state', {
      visible: true,
      paused: false,
      configured: true,
      connection: 'registered',
      status: { code: 'inCall' },
      server: { index: 1, count: 2, name: 'Cairo primary', attempt: 1 },
      block: null,
      identity: { displayName: 'Sara Hassan', extension: '1001' },
      legs: [
        {
          id: 'crashed-leg-1',
          role: 'primary',
          direction: 'outgoing',
          number: '+201005550142',
          displayName: 'Sara',
          source: null,
          state: 'active',
          held: false,
          startedAt: new Date().toISOString(),
          answeredAt: new Date().toISOString(),
        },
      ],
      mode: 'single',
      focusedLegId: 'crashed-leg-1',
      call: 'active',
      timer: 10,
      muted: false,
      speakerMuted: false,
      quality: null,
      ringing: null,
      ringSilenced: false,
      ended: null,
      sentTones: '',
      busy: true,
      canAnswerHere: true,
      missedCount: 0,
      mediaNotice: null,
      micPermission: 'granted',
      notifyPermission: 'default',
    });
    await flush();

    fakeTabLeader.setLeader();
    await flush();
    expect(notify.toasts().filter((t) => t.type === 'error').length).toBe(2);

    // Busy leader closing on pagehide broadcasts phone.lost
    await flush(250);
    await phone.call('+201005550142');
    await flush(300);
    expect(phone.busy()).toBe(true);
    window.dispatchEvent(new Event('pagehide'));
    await flush();
    expect(fakeTabBus.broadcasted.some((b) => b.topic === 'phone.lost')).toBe(true);
  });

  it('migrates legacy volume strings to numeric 0..100, applies numeric gains, and meters speakerLevel', async () => {
    localStorage.setItem(
      PHONE_PREFS_STORAGE_KEY,
      JSON.stringify({
        micVolume: 'low',
        speakerVolume: 'high',
        ringVolume: 'low',
      }),
    );

    const origCreateAnalyser = (globalThis as Record<string, unknown>)['AudioContext'] as new () => {
      createAnalyser(): { fftSize: number; getFloatTimeDomainData: (arr: Float32Array) => void };
    };
    const BaseAudioCtx = origCreateAnalyser;
    (globalThis as Record<string, unknown>)['AudioContext'] = class extends BaseAudioCtx {
      override createAnalyser() {
        return {
          fftSize: 256,
          getFloatTimeDomainData: (arr: Float32Array) => {
            arr.fill(0.25);
          },
        };
      }
    };

    const phone = createPhone();
    await flush(250);

    // Migrated legacy values: low -> 40, high -> 100; ringVolume stays 'low'
    expect(phone.prefs().micVolume).toBe(40);
    expect(phone.prefs().speakerVolume).toBe(100);
    expect(phone.prefs().ringVolume).toBe('low');

    // Check defaults (micVolume: 70, speakerVolume: 60)
    localStorage.removeItem(PHONE_PREFS_STORAGE_KEY);
    const defaults = readPhonePrefs();
    expect(defaults.micVolume).toBe(70);
    expect(defaults.speakerVolume).toBe(60);
    phone.setPref('micVolume', defaults.micVolume);
    phone.setPref('speakerVolume', defaults.speakerVolume);

    const fakeAudioEl = {
      volume: 1,
      muted: false,
      srcObject: null as MediaStream | null,
      play: vi.fn(async () => {}),
      pause: vi.fn(),
    } as unknown as HTMLAudioElement;
    phone.attachAudio(fakeAudioEl);
    expect(fakeAudioEl.volume).toBeCloseTo(0.6);

    await phone.call('+201005550142');
    await flush(350);
    expect(phone.callState()).toBe('active');
    expect(phone.speakerLevel()).toBe(Math.min(100, Math.round(0.25 * 260)));

    phone.setPref('speakerVolume', 85);
    expect(fakeAudioEl.volume).toBeCloseTo(0.85);

    phone.hangup();
    await flush();
    expect(phone.speakerLevel()).toBe(0);
  });

  it('opens the phone panel and answers using synthetic mic fallback when getUserMedia reports NotFoundError on FakeSipEngine', async () => {
    const getUserMediaMock = vi.fn(async () => {
      throw Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: vi.fn(async () => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const phone = createPhone();
    await flush(250);
    expect(phone.panelOpen()).toBe(false);
    expect(phone.connection()).toBe('registered');

    engines[0].simulateIncoming('+201005550142');
    await flush();
    expect(phone.ringing()).not.toBeNull();

    phone.setTab('calls');
    phone.answer();
    await flush();

    expect(phone.panelOpen()).toBe(true);
    expect(phone.tab()).toBe('phone');
    expect(phone.callState()).toBe('active');
    expect(TestBed.inject(Notify).toasts().some((t) => t.type === 'error')).toBe(false);

    phone.hangup();
    await flush();
  });

  it('keeps the dialer visible with permissionDenied notice and suppresses Call failed toast when microphone is blocked', async () => {
    const getUserMediaMock = vi.fn(async () => {
      throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: vi.fn(async () => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const phone = createPhone();
    await flush(250);
    expect(phone.connection()).toBe('registered');

    await phone.call('+201005550142');
    await flush();

    expect(phone.micPermission()).toBe('denied');
    expect(phone.block()).toBeNull();
    expect(phone.mediaNotice()).toBe('permissionDenied');
    expect(TestBed.inject(Notify).toasts().some((t) => t.type === 'error')).toBe(false);

    engines[0].simulateIncoming('+201005550142');
    await flush();
    phone.answer();
    await flush();

    expect(phone.panelOpen()).toBe(true);
    expect(phone.block()).toBeNull();
    expect(phone.ringing()).not.toBeNull();
    expect(TestBed.inject(Notify).toasts().some((t) => t.type === 'error')).toBe(false);
  });

  it('looks up typed outgoing call number at call end and enriches both ended info and call log', async () => {
    const phone = createPhone();
    await flush(250);

    await phone.call('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');
    expect(phone.focusedLeg()?.source).toBeNull();

    phone.hangup();
    await flush();

    expect(phone.ended()?.name).toBe('أحمد علي');
    expect(phone.ended()?.source).toEqual({
      type: 'LEAD',
      id: 'lead-001',
      label: 'أحمد علي',
    });
    expect(phone.ended()?.logged).toBe(true);

    const logs = await listCallLogs({ page: 1, limit: 5 });
    const latest = logs.data[0];
    expect(latest.phoneNumber).toBe('+201005550142');
    expect(latest.displayName).toBe('أحمد علي');
    expect(latest.sourceType).toBe('LEAD');
    expect(latest.sourceId).toBe('lead-001');
    expect(latest.sourceLabel).toBe('أحمد علي');
  });
});
