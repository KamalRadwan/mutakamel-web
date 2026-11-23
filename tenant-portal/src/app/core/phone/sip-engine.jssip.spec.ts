import type { RTCSession } from 'jssip/lib/RTCSession';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHONE_DEV_ME_STORAGE_KEY, readPhoneDevMe } from './phone-dev-me';
import { fakeGetMe, resetPhoneFake, setFakePhoneDelay } from './phone.fake';
import { PhoneMe, PhoneServer } from './phone.model';
import { JsSipEngine } from './sip-engine.jssip';
import { PHONE_ENGINE_STORAGE_KEY, createSipEngine } from './sip-engine.provider';
import { ICE_GATE_TIMEOUT_MS, JsSipLeg, createIceGate } from './sip-leg.jssip';

type EventCallback = (arg?: unknown) => void;

// Hoisted so the classes exist when vi.mock factories and the hoisted mockState run.
const { SimpleEmitter, FakePeerConnection, FakeRTCSession } = vi.hoisted(() => {
class SimpleEmitter {
  private readonly handlers = new Map<string, Set<EventCallback>>();

  on(event: string, cb: EventCallback): this {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(cb);
    return this;
  }

  emit(event: string, arg?: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const cb of [...set]) {
      cb(arg);
    }
  }
}

class FakePeerConnection extends SimpleEmitter {
  private remoteStreams: MediaStream[] = [];

  setRemoteStreams(streams: MediaStream[]): void {
    this.remoteStreams = streams;
  }

  getRemoteStreams(): MediaStream[] {
    return this.remoteStreams;
  }

  addEventListener(event: string, cb: EventCallback): void {
    this.on(event, cb);
  }
}

class FakeRTCSession extends SimpleEmitter {
  connection: FakePeerConnection | null = null;
  remote_identity: { uri: { user: string }; display_name: string };
  ended = false;

  answerCalls: unknown[] = [];
  terminateCalls: unknown[] = [];
  holdResult = true;
  unholdResult = true;
  muteCalls: unknown[] = [];
  unmuteCalls: unknown[] = [];
  dtmfCalls: string[] = [];
  referCalls: { target: string; options: { replaces?: unknown; eventHandlers?: Record<string, EventCallback> } }[] = [];
  throwOnTerminate = false;

  constructor(number = '1002', displayName = 'Remote User') {
    super();
    this.remote_identity = {
      uri: { user: number },
      display_name: displayName,
    };
  }

  isEnded(): boolean {
    return this.ended;
  }

  answer(options: unknown): void {
    this.answerCalls.push(options);
    if (!this.connection) {
      this.connection = new FakePeerConnection();
      this.emit('peerconnection', { peerconnection: this.connection });
    }
  }

  terminate(options?: unknown): void {
    if (this.throwOnTerminate) {
      throw new Error('WebSocket is closed');
    }
    this.terminateCalls.push(options);
    this.ended = true;
  }

  hold(): boolean {
    return this.holdResult;
  }

  unhold(): boolean {
    return this.unholdResult;
  }

  mute(options: unknown): void {
    this.muteCalls.push(options);
  }

  unmute(options: unknown): void {
    this.unmuteCalls.push(options);
  }

  sendDTMF(tone: string): void {
    this.dtmfCalls.push(tone);
  }

  refer(
    target: string,
    options: { replaces?: unknown; eventHandlers?: Record<string, EventCallback> } = {},
  ): void {
    this.referCalls.push({ target, options });
  }
}

  return { SimpleEmitter, FakePeerConnection, FakeRTCSession };
});

type FakePeerConnection = InstanceType<typeof FakePeerConnection>;
type FakeRTCSession = InstanceType<typeof FakeRTCSession>;

const mockState = vi.hoisted(() => {
  const uaInstances: FakeUAClassInstance[] = [];
  const wsUrls: string[] = [];
  let nextOutgoingSession: FakeRTCSession | null = null;

  interface FakeUAClassInstance {
    config: Record<string, unknown>;
    started: boolean;
    stopped: boolean;
    registerCalls: number;
    unregisterCalls: unknown[];
    callArgs: { target: string; options: Record<string, unknown> }[];
    emit(event: string, arg?: unknown): void;
  }

  class FakeWebSocketInterface {
    constructor(readonly url: string) {
      wsUrls.push(url);
    }
  }

  class FakeUA extends SimpleEmitter {
    started = false;
    stopped = false;
    registerCalls = 0;
    unregisterCalls: unknown[] = [];
    callArgs: { target: string; options: Record<string, unknown> }[] = [];

    constructor(readonly config: Record<string, unknown>) {
      super();
      uaInstances.push(this);
    }

    start(): void {
      this.started = true;
    }

    stop(): void {
      this.stopped = true;
      this.emit('disconnected', { socket: null, error: false });
    }

    register(): void {
      this.registerCalls += 1;
    }

    unregister(options?: unknown): void {
      this.unregisterCalls.push(options);
    }

    call(target: string, options: Record<string, unknown>): FakeRTCSession {
      this.callArgs.push({ target, options });
      const session = nextOutgoingSession ?? new FakeRTCSession(target.replace(/^sip:/, '').split('@')[0] ?? target, '');
      nextOutgoingSession = null;
      session.connection = session.connection ?? new FakePeerConnection();
      return session;
    }
  }

  return {
    uaInstances,
    wsUrls,
    setNextOutgoingSession(session: FakeRTCSession | null): void {
      nextOutgoingSession = session;
    },
    reset(): void {
      uaInstances.length = 0;
      wsUrls.length = 0;
      nextOutgoingSession = null;
    },
    FakeUA,
    FakeWebSocketInterface,
  };
});

vi.mock('jssip', () => ({
  UA: mockState.FakeUA,
  WebSocketInterface: mockState.FakeWebSocketInterface,
}));

function makeServer(overrides: Partial<PhoneServer> = {}): PhoneServer {
  return {
    id: 'srv-1',
    name: 'Primary PBX',
    priority: 1,
    sipDomain: 'pbx.example.com',
    websocketUrl: 'wss://pbx.example.com:8089/ws',
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 300,
    defaultCallerId: null,
    iceTransportPolicy: 'all',
    traceSip: false,
    sessionTimers: true,
    allowInvalidTlsCertificate: false,
    timeoutSeconds: 10,
    maxRetries: 2,
    iceServers: [],
    ...overrides,
  };
}

function makeMe(overrides: Partial<PhoneMe> = {}): PhoneMe {
  return {
    enabled: true,
    reason: null,
    extension: '1001',
    sipUsername: '1001',
    sipPassword: 'secret-sip-password',
    displayName: 'Sara Hassan',
    outboundCallerId: '+20225550100',
    passwordConfigured: true,
    servers: [makeServer()],
    turnCredentials: { enabled: false, iceServers: [], expiresAt: null },
    ...overrides,
  };
}

function makeStream(): MediaStream {
  return {
    getTracks: () => [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

/** JsSipEngine loads jssip with a dynamic import, so the UA appears a few ticks after connect(). */
async function waitForUas(count: number): Promise<void> {
  await vi.waitFor(() => expect(mockState.uaInstances.length).toBeGreaterThanOrEqual(count));
}

describe('JsSipEngine & JsSipLeg', () => {
  beforeEach(() => {
    mockState.reset();
    localStorage.clear();
    sessionStorage.clear();
    resetPhoneFake();
    setFakePhoneDelay(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    resetPhoneFake();
  });

  it('builds UA configuration with fromDomain, registrar, relay policy, Route header, and display name fallback', async () => {
    const engine1 = new JsSipEngine();
    const connect1 = engine1.connect(
      makeServer({
        fromDomain: null,
        registrarServer: null,
        outboundProxy: 'sip:proxy.example.com:5060;lr',
        iceTransportPolicy: 'all',
        realm: 'pbx-realm',
        contactUri: 'sip:1001@edge.example.com;transport=wss',
      }),
      makeMe({ displayName: null, extension: '1001' }),
      [{ urls: ['stun:stun.l.google.com:19302'] }],
    );

    await waitForUas(1);
    const ua1 = mockState.uaInstances[0];
    expect(mockState.wsUrls[0]).toBe('wss://pbx.example.com:8089/ws');
    expect(ua1.config['uri']).toBe('sip:1001@pbx.example.com');
    expect(ua1.config['registrar_server']).toBeUndefined();
    expect(ua1.config['authorization_user']).toBe('1001');
    expect(ua1.config['password']).toBe('secret-sip-password');
    expect(ua1.config['realm']).toBe('pbx-realm');
    expect(ua1.config['display_name']).toBe('1001');
    expect(ua1.config['register']).toBe(false);
    expect(ua1.config['register_expires']).toBe(300);
    expect(ua1.config['contact_uri']).toBe('sip:1001@edge.example.com;transport=wss');
    expect(ua1.config['session_timers']).toBe(true);
    expect(ua1.config['extra_headers']).toEqual(['Route: <sip:proxy.example.com:5060;lr>']);
    expect(ua1.config['user_agent']).toBe('Mutakamel WebPhone');
    ua1.emit('connected');
    await connect1;

    const outgoing1 = engine1.call('sip:1002@pbx.example.com', {
      fromUserName: null,
      fromDisplayName: null,
      stream: makeStream(),
    });
    expect(outgoing1).toBeInstanceOf(JsSipLeg);
    expect(ua1.callArgs[0].options['pcConfig']).toEqual({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    });

    const engine2 = new JsSipEngine();
    const connect2 = engine2.connect(
      makeServer({
        fromDomain: 'from.example.com',
        registrarServer: null,
        iceTransportPolicy: 'relay',
      }),
      makeMe(),
      [{ urls: ['turn:turn.example.com:3478'] }],
    );

    await waitForUas(2);
    const ua2 = mockState.uaInstances[1];
    expect(ua2.config['uri']).toBe('sip:1001@from.example.com');
    expect(ua2.config['registrar_server']).toBe('sip:pbx.example.com');
    ua2.emit('connected');
    await connect2;

    engine2.call('sip:1003@pbx.example.com', {
      fromUserName: '1001',
      fromDisplayName: 'Sara Hassan',
      stream: makeStream(),
    });
    expect(ua2.callArgs[0].options['pcConfig']).toEqual({
      iceServers: [{ urls: ['turn:turn.example.com:3478'] }],
      iceTransportPolicy: 'relay',
    });

    const engine3 = new JsSipEngine();
    const connect3 = engine3.connect(
      makeServer({
        fromDomain: 'from.example.com',
        registrarServer: 'sip:override-reg.example.com',
      }),
      makeMe(),
      [],
    );
    await waitForUas(3);
    const ua3 = mockState.uaInstances[2];
    expect(ua3.config['uri']).toBe('sip:1001@from.example.com');
    expect(ua3.config['registrar_server']).toBe('sip:override-reg.example.com');
    ua3.emit('connected');
    await connect3;
  });

  it('resolves connect on connected, rejects on early disconnected, and ignores events after stop()', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const engine1 = new JsSipEngine();
    const events1: string[] = [];
    engine1.events.on('connected', () => events1.push('connected'));
    engine1.events.on('registered', () => events1.push('registered'));
    engine1.events.on('registrationFailed', () => events1.push('registrationFailed'));

    const p1 = engine1.connect(makeServer({ traceSip: true }), makeMe(), []);
    await waitForUas(1);
    const ua1 = mockState.uaInstances[0];
    ua1.emit('connected');
    await expect(p1).resolves.toBeUndefined();

    engine1.register();
    expect(ua1.registerCalls).toBe(1);
    ua1.emit('registered');
    expect(events1).toEqual(['connected', 'registered']);

    engine1.unregister();
    expect(ua1.unregisterCalls).toEqual([{ all: false }]);
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('secret-sip-password');
    infoSpy.mockRestore();

    engine1.stop();
    expect(ua1.stopped).toBe(true);
    ua1.emit('registered');
    ua1.emit('registrationFailed', { cause: 'Forbidden' });
    expect(events1).toEqual(['connected', 'registered']);

    const engine2 = new JsSipEngine();
    const disconnectedEvents: unknown[] = [];
    engine2.events.on('disconnected', (e) => disconnectedEvents.push(e));
    const p2 = engine2.connect(makeServer(), makeMe(), []);
    await waitForUas(2);
    const ua2 = mockState.uaInstances[1];
    ua2.emit('disconnected', { error: true, reason: 'Connection Refused' });
    await expect(p2).rejects.toThrow('Connection Refused');
    expect(ua2.stopped).toBe(true);
    expect(disconnectedEvents).toEqual([{ cause: 'Connection Refused' }]);
  });

  it('stops UA on disconnected only when there is no live session', async () => {
    const engine = new JsSipEngine();
    const disconnected: unknown[] = [];
    engine.events.on('disconnected', (e) => disconnected.push(e));

    const connectP = engine.connect(makeServer(), makeMe(), []);
    await waitForUas(1);
    const ua = mockState.uaInstances[0];
    ua.emit('connected');
    await connectP;

    const session = new FakeRTCSession('1005', 'Omar');
    mockState.setNextOutgoingSession(session);
    const leg = engine.call('sip:1005@pbx.example.com', {
      fromUserName: '1001',
      fromDisplayName: 'Sara',
      stream: makeStream(),
    });

    // Disconnect during live session must NOT stop UA (stopping UA kills calls).
    ua.emit('disconnected', { error: true, reason: 'Socket drop' });
    expect(ua.stopped).toBe(false);
    expect(disconnected).toHaveLength(1);

    // Once session ends, a subsequent disconnect stops UA so failover takes over cleanly.
    session.ended = true;
    session.emit('ended', { cause: 'Terminated' });
    expect(leg).toBeDefined();

    ua.emit('disconnected', { error: true, reason: 'Socket drop 2' });
    expect(ua.stopped).toBe(true);
    expect(disconnected).toHaveLength(2);
  });

  it('maps outgoing and incoming legs, deduplicates accepted/confirmed, and passes causes through', async () => {
    const engine = new JsSipEngine();
    const incomingLegs: JsSipLeg[] = [];
    engine.events.on('incoming', (leg) => incomingLegs.push(leg as JsSipLeg));

    const connectP = engine.connect(makeServer(), makeMe(), []);
    await waitForUas(1);
    const ua = mockState.uaInstances[0];
    ua.emit('connected');
    await connectP;

    const outSession = new FakeRTCSession('1002', 'Client A');
    mockState.setNextOutgoingSession(outSession);
    const outLeg = engine.call('sip:1002@pbx.example.com', {
      fromUserName: '1001',
      fromDisplayName: 'Sara',
      stream: makeStream(),
    });

    const outEvents: { type: string; arg?: unknown }[] = [];
    outLeg.on('progress', () => outEvents.push({ type: 'progress' }));
    outLeg.on('accepted', () => outEvents.push({ type: 'accepted' }));
    outLeg.on('ended', (arg) => outEvents.push({ type: 'ended', arg }));

    outSession.emit('progress');
    outSession.emit('accepted');
    outSession.emit('confirmed');
    outSession.emit('ended', { cause: 'BYE' });

    expect(outEvents).toEqual([
      { type: 'progress' },
      { type: 'accepted' },
      { type: 'ended', arg: { cause: 'BYE' } },
    ]);

    // Local newRTCSession must be ignored; remote newRTCSession emits incoming leg.
    ua.emit('newRTCSession', { originator: 'local', session: outSession });
    expect(incomingLegs).toHaveLength(0);

    const inSession = new FakeRTCSession('+201005550142', 'Ahmed Ali');
    ua.emit('newRTCSession', { originator: 'remote', session: inSession });
    expect(incomingLegs).toHaveLength(1);

    const inLeg = incomingLegs[0];
    expect(inLeg.remoteNumber).toBe('+201005550142');
    expect(inLeg.remoteName).toBe('Ahmed Ali');
    expect(inLeg.peer).toBeNull();

    const failedEvents: unknown[] = [];
    inLeg.on('failed', (arg) => failedEvents.push(arg));
    inLeg.answer(makeStream());
    expect(inSession.answerCalls).toHaveLength(1);
    expect(inLeg.peer).toBe(inSession.connection);

    inSession.emit('failed', { cause: 'Busy' });
    expect(failedEvents).toEqual([{ cause: 'Busy' }]);
  });

  it('implements terminate codes, swallows errors, hold/unhold, mute/unmute, DTMF, and blind/attended refer', () => {
    const s1 = new FakeRTCSession('1002', 'Primary');
    const s2 = new FakeRTCSession('1003', 'Consult');
    const leg1 = new JsSipLeg(s1 as unknown as RTCSession, { iceServers: [] });
    const leg2 = new JsSipLeg(s2 as unknown as RTCSession, { iceServers: [] });

    leg1.terminate(603);
    expect(s1.terminateCalls[0]).toEqual({ status_code: 603, reason_phrase: 'Decline' });
    // Calling terminate after session ended is a no-op.
    leg1.terminate(486);
    expect(s1.terminateCalls).toHaveLength(1);

    const sBusy = new FakeRTCSession();
    new JsSipLeg(sBusy as unknown as RTCSession, { iceServers: [] }).terminate(486);
    expect(sBusy.terminateCalls[0]).toEqual({ status_code: 486, reason_phrase: 'Busy Here' });

    const sUnavail = new FakeRTCSession();
    new JsSipLeg(sUnavail as unknown as RTCSession, { iceServers: [] }).terminate(480);
    expect(sUnavail.terminateCalls[0]).toEqual({ status_code: 480, reason_phrase: 'Temporarily Unavailable' });

    const sPlain = new FakeRTCSession();
    sPlain.throwOnTerminate = true;
    expect(() => new JsSipLeg(sPlain as unknown as RTCSession, { iceServers: [] }).terminate()).not.toThrow();

    s2.holdResult = true;
    s2.unholdResult = false;
    expect(leg2.hold()).toBe(true);
    expect(leg2.unhold()).toBe(false);

    leg2.mute();
    leg2.unmute();
    expect(s2.muteCalls).toEqual([{ audio: true }]);
    expect(s2.unmuteCalls).toEqual([{ audio: true }]);

    leg2.dtmf('5');
    expect(s2.dtmfCalls).toEqual(['5']);

    const referEvents: { type: string; arg?: unknown }[] = [];
    leg2.on('referAccepted', () => referEvents.push({ type: 'referAccepted' }));
    leg2.on('referFailed', (arg) => referEvents.push({ type: 'referFailed', arg }));

    // Blind refer
    leg2.refer('sip:1009@pbx.example.com');
    expect(s2.referCalls[0].target).toBe('sip:1009@pbx.example.com');
    expect(s2.referCalls[0].options.replaces).toBeUndefined();
    s2.referCalls[0].options.eventHandlers?.['accepted']?.();
    s2.referCalls[0].options.eventHandlers?.['failed']?.({
      status_line: { status_code: 486, reason_phrase: 'Busy Here' },
    });

    // Attended refer with replaces passes the wrapped RTCSession
    const sTarget = new FakeRTCSession('1004', 'Target');
    const targetLeg = new JsSipLeg(sTarget as unknown as RTCSession, { iceServers: [] });
    leg2.refer('sip:1004@pbx.example.com', targetLeg);
    expect(s2.referCalls[1].options.replaces).toBe(sTarget);
    s2.referCalls[1].options.eventHandlers?.['requestFailed']?.({ cause: 'Rejected' });

    expect(referEvents).toEqual([
      { type: 'referAccepted' },
      { type: 'referFailed', arg: { cause: '486 Busy Here' } },
      { type: 'referFailed', arg: { cause: 'Rejected' } },
    ]);
  });

  it('fires ICE gate ready on srflx/relay, on null candidate, and after 1 200 ms', () => {
    vi.useFakeTimers();

    const readySrflx = vi.fn();
    const gateSrflx = createIceGate();
    gateSrflx({
      candidate: { type: 'srflx', candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 50000 typ srflx' } as RTCIceCandidate,
      ready: readySrflx,
    });
    expect(readySrflx).toHaveBeenCalledTimes(1);

    const readyRelay = vi.fn();
    const gateRelay = createIceGate();
    gateRelay({
      candidate: { candidate: 'candidate:2 1 udp 16777215 5.6.7.8 3478 typ relay' } as RTCIceCandidate,
      ready: readyRelay,
    });
    expect(readyRelay).toHaveBeenCalledTimes(1);

    const readyEnd = vi.fn();
    const gateEnd = createIceGate();
    gateEnd({ candidate: null, ready: readyEnd });
    expect(readyEnd).toHaveBeenCalledTimes(1);

    const readyTimeout = vi.fn();
    const gateTimeout = createIceGate();
    gateTimeout({
      candidate: { type: 'host', candidate: 'candidate:0 1 udp 2122260223 192.168.1.10 50000 typ host' } as RTCIceCandidate,
      ready: readyTimeout,
    });
    expect(readyTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ICE_GATE_TIMEOUT_MS - 1);
    expect(readyTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(readyTimeout).toHaveBeenCalledTimes(1);
  });

  it('emits remoteStream from track events and legacy addstream / getRemoteStreams fallbacks', () => {
    const stream1 = makeStream();
    const s1 = new FakeRTCSession();
    s1.connection = new FakePeerConnection();
    const leg1 = new JsSipLeg(s1 as unknown as RTCSession, { iceServers: [] });
    const received1: MediaStream[] = [];
    leg1.on('remoteStream', (s) => received1.push(s as MediaStream));

    s1.connection.emit('track', { streams: [stream1] });
    expect(received1).toEqual([stream1]);

    const sTrackOnly = new FakeRTCSession();
    sTrackOnly.connection = new FakePeerConnection();
    const legTrackOnly = new JsSipLeg(sTrackOnly as unknown as RTCSession, { iceServers: [] });
    const receivedTrackOnly: MediaStream[] = [];
    legTrackOnly.on('remoteStream', (s) => receivedTrackOnly.push(s as MediaStream));
    const track = { kind: 'audio' } as MediaStreamTrack;
    sTrackOnly.connection.emit('track', { track, streams: [] });
    expect(receivedTrackOnly).toHaveLength(1);
    expect(receivedTrackOnly[0].getAudioTracks()).toEqual([track]);

    const stream2 = makeStream();
    const s2 = new FakeRTCSession();
    s2.connection = new FakePeerConnection();
    const leg2 = new JsSipLeg(s2 as unknown as RTCSession, { iceServers: [] });
    const received2: MediaStream[] = [];
    leg2.on('remoteStream', (s) => received2.push(s as MediaStream));

    s2.connection.emit('addstream', { stream: stream2 });
    expect(received2).toEqual([stream2]);

    const stream3 = makeStream();
    const s3 = new FakeRTCSession();
    s3.connection = new FakePeerConnection();
    const leg3 = new JsSipLeg(s3 as unknown as RTCSession, { iceServers: [] });
    const received3: MediaStream[] = [];
    leg3.on('remoteStream', (s) => received3.push(s as MediaStream));

    s3.connection.setRemoteStreams([stream3]);
    s3.emit('accepted');
    expect(received3).toEqual([stream3]);
  });

  it('always selects JsSipEngine and honors the fixture dev-me override only in dev mode', async () => {
    expect(createSipEngine()).toBeInstanceOf(JsSipEngine);

    localStorage.setItem(PHONE_ENGINE_STORAGE_KEY, 'fake');
    expect(createSipEngine()).toBeInstanceOf(JsSipEngine);

    localStorage.setItem(PHONE_ENGINE_STORAGE_KEY, 'jssip');
    expect(createSipEngine()).toBeInstanceOf(JsSipEngine);

    localStorage.removeItem(PHONE_ENGINE_STORAGE_KEY);
    expect(createSipEngine()).toBeInstanceOf(JsSipEngine);

    const devMe = makeMe({ extension: '2009', sipUsername: '2009' });
    sessionStorage.setItem(PHONE_DEV_ME_STORAGE_KEY, JSON.stringify(devMe));
    expect(readPhoneDevMe(false)).toBeNull();
    expect(readPhoneDevMe(true)?.extension).toBe('2009');

    const loaded = await fakeGetMe();
    expect(loaded.extension).toBe('2009');
  });
});
