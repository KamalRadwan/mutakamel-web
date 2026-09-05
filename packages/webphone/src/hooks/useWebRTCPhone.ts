'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RTCSession } from 'jssip/lib/RTCSession';
import type { UA } from 'jssip';
import { createWebphoneApi } from '../api';
import { WEBPHONE_CHANGED_EVENT } from '../changed-signal';
import {
  WEBPHONE_FAILOVER_CYCLE_DELAY_MS,
  isWebphoneReady,
  normalizeCallTarget,
  pcConfigFromSettings,
  sipUri,
  usableWebphoneServers,
} from '../config';
import { useWebphoneContext } from '../context/WebphoneContext';
import {
  joinWebphoneTabs,
  type WebphoneCommand,
  type WebphoneSharedSnapshot,
  type WebphoneTabRole,
  type WebphoneTabsHandle,
} from '../tabs/leader';
import {
  CALL_QUALITY_GRACE_MS,
  CALL_QUALITY_INTERVAL_MS,
  diffCallQuality,
  readCallQualityCounters,
  smoothCallQuality,
  type CallQualityCounters,
  type CallQualitySample,
} from '../quality/callQuality';
import { playDtmfTone, primeDtmfAudio } from '../utils/dtmfAudio';
import type {
  ActiveCallContext,
  CreateWebphoneCallLogPayload,
  WebphoneCallLog,
  WebphoneCallLogType,
  WebphoneCallState,
  WebphoneConnectionState,
  WebphoneMe,
  WebphoneMediaNoticeCode,
  WebphoneServer,
  WebphoneStatus,
  WebphoneStatusCode,
  WebphoneTab,
} from '../types';

type PhoneLifecycle = {
  advanceToNextServer: () => void;
  connectPhone: () => Promise<void>;
  handleServerSetback: () => void;
  resetRemoteAudio: () => void;
  stopFailover: () => void;
  stopIncomingRingTone: () => void;
  stopLocalAudioStream: () => void;
};

type LegacyPeerConnection = RTCPeerConnection & {
  getRemoteStreams?: () => MediaStream[];
};

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const WEBPHONE_STORAGE_KEYS = {
  expanded: 'mutakamel.webphone.expanded',
  micVolume: 'mutakamel.webphone.micVolume',
  speakerVolume: 'mutakamel.webphone.speakerVolume',
} as const;

/** Re-fetch minted TURN credentials this far ahead of their expiry. */
const TURN_CREDENTIAL_REFRESH_MARGIN_MS = 60_000;

/**
 * The far end of the test ring, in one place.
 *
 * It is read twice — once into the call context and once into `remoteParty` —
 * and the two must agree, or the simulator shows one number and copies another.
 */
const SIMULATED_CALLER_NUMBER = '+20 100 123 4567';

/**
 * How long a call's media may be `disconnected` before the call is over.
 *
 * Long enough to ride out a Wi-Fi handover or a brief route change, which
 * recover in a few seconds; short enough that nobody sits watching a timer
 * count up on a call that has already stopped. ICE reporting `failed` skips
 * this entirely — that state is terminal and waiting on it would only delay
 * the truth.
 */
const MEDIA_RECOVERY_GRACE_MS = 12_000;

/**
 * How long a call waits for this tab to become the phone before giving up.
 *
 * Long enough for a lock hand-over and a fresh REGISTER, which together take a
 * second or two; short enough that a claim which never lands fails while the
 * person is still watching for it.
 */
const PENDING_CALL_DEADLINE_MS = 8_000;

const idlePhoneLifecycle: PhoneLifecycle = {
  advanceToNextServer: () => undefined,
  connectPhone: async () => undefined,
  handleServerSetback: () => undefined,
  resetRemoteAudio: () => undefined,
  stopFailover: () => undefined,
  stopIncomingRingTone: () => undefined,
  stopLocalAudioStream: () => undefined,
};

const keypad = [
  { value: '1', letters: '' },
  { value: '2', letters: 'ABC' },
  { value: '3', letters: 'DEF' },
  { value: '4', letters: 'GHI' },
  { value: '5', letters: 'JKL' },
  { value: '6', letters: 'MNO' },
  { value: '7', letters: 'PQRS' },
  { value: '8', letters: 'TUV' },
  { value: '9', letters: 'WXYZ' },
  { value: '*', letters: '' },
  { value: '0', letters: '+' },
  { value: '#', letters: '' },
] as const;

/**
 * The outcome to file the call under.
 *
 * Answered beats everything: a call that connected and was later dropped for
 * any reason still connected, and filing it as a failure would put a red arrow
 * on a conversation that happened. Busy is read off the SIP cause rather than
 * inferred from "not answered", because the two look identical in the timings
 * and are completely different facts to the person reading the log — one is a
 * call to retry, the other is a line to try later.
 */
export function callLogTypeFor(context: ActiveCallContext): WebphoneCallLogType {
  const outgoing = context.direction === 'outgoing';
  if (context.answeredAt) return outgoing ? 'OUT_ANS' : 'IN_ANS';
  // "Refused" rather than "busy": SIP says the same thing two ways and both
  // belong here. 486 Busy Here is a line in use; 603 Decline is a person
  // pressing decline -- including the local user declining an inbound call,
  // which JsSIP reports as `Rejected` and which would otherwise be filed as
  // nobody answering. Somebody did answer; they said no.
  //
  // Matched loosely because the cause string carries the JsSIP constant, whose
  // spelling has changed between versions.
  if (/busy|rejected|decline/i.test(context.cause ?? '')) {
    return outgoing ? 'OUT_BUSY' : 'IN_BUSY';
  }
  return outgoing ? 'OUT_NOANS' : 'IN_NOANS';
}

export function useWebRTCPhone() {
  const { basePath, http, active, copy } = useWebphoneContext();
  const api = useMemo(() => createWebphoneApi(basePath, http), [basePath, http]);

  const uaRef = useRef<UA | null>(null);
  /**
   * Bumped every time a UA is built or torn down, and captured by that UA's
   * event handlers. A stopped JsSIP UA keeps emitting — `disconnected` on the
   * way out, a late `registrationFailed` from a request already in flight —
   * and those arrive after the next server is already being dialled. Without a
   * generation stamp they would push the successor's state around.
   */
  const uaGenerationRef = useRef(0);
  const sessionRef = useRef<RTCSession | null>(null);
  const boundSessionsRef = useRef<WeakSet<RTCSession>>(new WeakSet());
  const boundPeerConnectionsRef = useRef<WeakSet<RTCPeerConnection>>(new WeakSet());
  const boundIceSessionsRef = useRef<WeakSet<RTCSession>>(new WeakSet());
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const micMeterStopRef = useRef<(() => void) | null>(null);
  const speakerMeterStopRef = useRef<(() => void) | null>(null);
  const ringToneStopRef = useRef<(() => void) | null>(null);
  const autoAnswerRef = useRef(false);
  const doNotDisturbRef = useRef(false);
  const stoppingLocalStreamRef = useRef(false);
  const callStartedAtRef = useRef<number | null>(null);
  const activeCallContextRef = useRef<ActiveCallContext | null>(null);
  const phoneLifecycleRef = useRef<PhoneLifecycle>(idlePhoneLifecycle);
  const reloadPhoneRef = useRef<(() => Promise<void>) | null>(null);

  /** The failover cursor. State mirrors it for rendering; this is what the loop reads. */
  const serverIndexRef = useRef(0);
  /** Registration attempts spent on the current server, reset when it changes or registers. */
  const attemptRef = useRef(0);
  const serverTimeoutRef = useRef<number | undefined>(undefined);
  const cycleDelayRef = useRef<number | undefined>(undefined);
  /** A failover the loop wanted while a call was up, owed to the moment it ends. */
  const failoverPendingRef = useRef(false);

  const [shouldRender, setShouldRender] = useState(false);
  const [expanded, setExpanded] = useState(() => readBooleanPreference(WEBPHONE_STORAGE_KEYS.expanded, false));
  const [incomingPopupDismissed, setIncomingPopupDismissed] = useState(false);
  const [simulatedIncoming, setSimulatedIncoming] = useState(false);
  const [activeTab, setActiveTab] = useState<WebphoneTab>('phone');
  const [me, setMe] = useState<WebphoneMe>();
  const [connectionState, setConnectionState] = useState<WebphoneConnectionState>('idle');
  const [callState, setCallState] = useState<WebphoneCallState>('idle');
  const [status, setStatus] = useState<WebphoneStatus>({ code: 'idle' });
  const [dialTarget, setDialTarget] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [remoteParty, setRemoteParty] = useState('');
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  // Which tab owns the registration. Until the election settles this is
  // `electing`, and no tab registers -- a brief silence beats two tabs
  // racing to REGISTER the same extension.
  const [tabRole, setTabRole] = useState<WebphoneTabRole>('electing');
  const [leaderSnapshot, setLeaderSnapshot] = useState<WebphoneSharedSnapshot | null>(null);
  const tabsRef = useRef<WebphoneTabsHandle | null>(null);
  /** Read by `connectPhone`, which is called from places a re-render never reaches. */
  /**
   * Runs a follower's command on the leader.
   *
   * Held in a ref because the election effect is mounted once and would
   * otherwise capture the first render's closures forever -- answering a
   * call with a `session` that was null when the tab opened.
   */
  /** The current key handler, so the keydown listener never goes stale. */
  /** Always the current `makeCall`, so the pending-call effect never goes stale. */
  const makeCallRef = useRef<((target?: string) => Promise<void>) | null>(null);
  /** A call asked for while this tab was still a follower, waiting on the lock. */
  const pendingCallRef = useRef<string | null>(null);
  const phoneKeyRef = useRef<((digit: string) => void) | null>(null);
  const commandHandlerRef = useRef<((command: WebphoneCommand) => void) | null>(null);
  const tabRoleRef = useRef<WebphoneTabRole>('electing');
  tabRoleRef.current = tabRole;
  /** Null until the grace window closes and two samples exist to compare. */
  const [callQuality, setCallQuality] = useState<CallQualitySample | null>(null);
  const qualityPeerRef = useRef<RTCPeerConnection | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [micVolume, setMicVolume] = useState(() => readVolumePreference(WEBPHONE_STORAGE_KEYS.micVolume, 70));
  const [speakerVolume, setSpeakerVolume] = useState(() => readVolumePreference(WEBPHONE_STORAGE_KEYS.speakerVolume, 60));
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [lastCallDuration, setLastCallDuration] = useState<string>();
  const [mediaNotice, setMediaNotice] = useState<WebphoneMediaNoticeCode>();
  const [activeCallContext, setActiveCallContext] = useState<ActiveCallContext | null>(null);
  const [callLogs, setCallLogs] = useState<WebphoneCallLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [registrationAttempt, setRegistrationAttempt] = useState(0);

  const servers = useMemo(() => usableWebphoneServers(me), [me]);
  // Clamped rather than indexed straight: a `/me` refresh (TURN credentials
  // expire on their own clock) can return a shorter list than the cursor.
  const currentServer = servers[activeServerIndex] ?? servers[0];

  useEffect(() => {
    phoneLifecycleRef.current = {
      advanceToNextServer,
      connectPhone,
      handleServerSetback,
      resetRemoteAudio,
      stopFailover,
      stopIncomingRingTone,
      stopLocalAudioStream,
    };
  });

  useEffect(() => {
    autoAnswerRef.current = autoAnswer;
  }, [autoAnswer]);

  useEffect(() => {
    doNotDisturbRef.current = doNotDisturb;
  }, [doNotDisturb]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function loadPhone() {
      setConnectionState('loading');
      setStatus({ code: 'loadingPhone' });

      try {
        const loadedMe = await api.loadMe();
        if (cancelled) return;

        setMe(loadedMe);
        setShouldRender(Boolean(loadedMe.enabled));

        if (!loadedMe.enabled) {
          setConnectionState('offline');
          setStatus({ code: 'disabled' });
          reportHidden('the caller has no enabled extension (/me returned enabled:false)');
          return;
        }

        const ready = isWebphoneReady(loadedMe);
        setConnectionState(ready ? 'ready' : 'offline');
        setStatus({ code: ready ? 'ready' : 'notConfigured' });
      } catch (error) {
        if (cancelled) return;
        setConnectionState('error');
        setStatus(readPhoneError(error, 'unavailable'));
        // Always reported, including in production: the dock renders nothing
        // on this path, so without a line here a failed load is
        // indistinguishable from an admin who simply has no phone.
        console.warn('[webphone] hidden — /me could not be read', error);
      }
    }

    void loadPhone();

    // Published so the change signal below can re-run exactly this load, with
    // its `cancelled` flag, rather than keeping a second copy that could
    // outlive the effect and write into an unmounted phone.
    reloadPhoneRef.current = loadPhone;

    return () => {
      cancelled = true;
      reloadPhoneRef.current = null;
      // Before the audio and the UA, because a pending failover timer would
      // otherwise wake up after the widget is gone and build a fresh socket.
      phoneLifecycleRef.current.stopFailover();
      phoneLifecycleRef.current.stopIncomingRingTone();
      phoneLifecycleRef.current.stopLocalAudioStream();
      phoneLifecycleRef.current.resetRemoteAudio();
      stopPhone(uaRef.current, sessionRef.current);
      uaRef.current = null;
      sessionRef.current = null;
    };
  }, [active, api]);

  /**
   * Re-reads `/me` when something in the portal changes this user's phone.
   *
   * Only while the phone is down. A live UA or session means the answer to
   * "should this render, and is it ready" is already settled and being acted
   * on: re-reading would drop the badge back to `loading`, and mid-call it
   * could unmount the dock under an active conversation. The signal exists for
   * the case that actually bites — a phone that was absent or unconfigured and
   * has just been given an extension.
   */
  useEffect(() => {
    if (!active) return;

    const onWebphoneChanged = () => {
      if (uaRef.current || sessionRef.current) return;
      void reloadPhoneRef.current?.();
    };

    window.addEventListener(WEBPHONE_CHANGED_EVENT, onWebphoneChanged);
    return () => {
      window.removeEventListener(WEBPHONE_CHANGED_EVENT, onWebphoneChanged);
    };
  }, [active]);

  // Join the election once, for the life of the component. The lock is held by
  // a promise that never resolves, so leadership ends only when this tab does --
  // or when `dispose` hands it back on unmount, which is what lets a
  // single-page navigation away from the phone pass the crown on rather than
  // stranding it until the tab closes.
  useEffect(() => {
    const handle = joinWebphoneTabs({
      onRole: setTabRole,
      onSnapshot: setLeaderSnapshot,
      onSnapshotRequested: () => publishSnapshotRef.current?.(),
      onFocusRequested: () => {
        // A follower asked for the phone. The audio is here, so the only useful
        // answer is to put this tab in front of the person.
        try {
          window.focus();
        } catch {
          // Blocked by the browser; the follower still shows where to go.
        }
      },
      onCommand: (command) => commandHandlerRef.current?.(command),
    });
    tabsRef.current = handle;
    return () => {
      handle.dispose();
      tabsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isWebphoneReady(me)) return;
    // Only the elected tab registers. A follower has the same `me` and the same
    // servers, and would happily build a second UA and a second contact on the
    // extension -- which is the whole problem the election exists to remove.
    if (tabRole !== 'leader') return;
    if (uaRef.current || connectionState === 'connecting' || connectionState === 'registered') {
      return;
    }
    // The pause after a full lap around the server list leaves no UA and an
    // errored state — exactly the shape this effect exists to repair. Reacting
    // to it would cancel the pause and reinstate the tight loop it prevents.
    if (cycleDelayRef.current) return;
    void phoneLifecycleRef.current.connectPhone();
  }, [connectionState, me, tabRole]);

  // Poll the peer connection while, and only while, a call is up.
  //
  // The first `CALL_QUALITY_GRACE_MS` are deliberately not measured: ICE is
  // still settling and the jitter buffer is filling from empty, so a reading
  // taken then reports a problem that does not exist. The indicator stays green
  // and says it is not measuring yet, which is true, rather than showing a
  // number it would immediately have to correct.
  useEffect(() => {
    // No synchronous reset here: leaving `active` re-runs this effect, and the
    // cleanup below already clears the reading. Doing both would add a
    // cascading render that says the same thing twice.
    if (callState !== 'active') return;

    let previous: CallQualityCounters | null = null;
    let smoothed: CallQualitySample | null = null;
    let cancelled = false;

    const sample = async () => {
      const peer = qualityPeerRef.current;
      if (!peer || cancelled) return;
      // A closed connection still answers `getStats`, with counters frozen at
      // the moment it closed -- which diffs to "no packets moved" and is
      // correctly reported as no reading rather than as silence.
      if (peer.connectionState === 'closed') return;
      try {
        const counters = readCallQualityCounters(await peer.getStats(), Date.now());
        if (!counters || cancelled) return;
        if (previous) {
          const next = diffCallQuality(previous, counters);
          if (next) {
            smoothed = smoothCallQuality(smoothed, next);
            setCallQuality(smoothed);
          }
        }
        previous = counters;
      } catch {
        // Stats are diagnostics. Losing them must never disturb the call.
      }
    };

    const grace = window.setTimeout(() => {
      void sample();
    }, CALL_QUALITY_GRACE_MS);
    const timer = window.setInterval(() => {
      void sample();
    }, CALL_QUALITY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(grace);
      window.clearInterval(timer);
      setCallQuality(null);
    };
  }, [callState]);

  useEffect(() => {
    if (callState !== 'active' || !callStartedAtRef.current) return;

    const timer = window.setInterval(() => {
      if (!callStartedAtRef.current) return;
      setCallDurationSeconds(elapsedSecondsSince(callStartedAtRef.current));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    writeBooleanPreference(WEBPHONE_STORAGE_KEYS.expanded, expanded);
  }, [expanded]);

  useEffect(() => {
    writeVolumePreference(WEBPHONE_STORAGE_KEYS.micVolume, micVolume);
  }, [micVolume]);

  useEffect(() => {
    writeVolumePreference(WEBPHONE_STORAGE_KEYS.speakerVolume, speakerVolume);
  }, [speakerVolume]);

  useEffect(() => {
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.muted = speakerMuted;
    remoteAudioRef.current.volume = speakerMuted ? 0 : speakerVolume / 100;
  }, [speakerMuted, speakerVolume]);

  useEffect(() => {
    if (activeTab !== 'log' || !shouldRender) return;

    let cancelled = false;

    async function loadLogs() {
      setLogsLoading(true);
      try {
        const logs = await api.loadCallLogs();
        if (!cancelled) setCallLogs(logs);
      } catch {
        if (!cancelled) setCallLogs([]);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [activeTab, api, shouldRender]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled || typeof window === 'undefined') return;
      if (!window.isSecureContext) {
        setMediaNotice('requiresHttps');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNotice('unavailable');
        return;
      }
      setMediaNotice(undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    const expiresAt = me?.turnCredentials?.expiresAt;
    if (!me?.turnCredentials?.enabled || !expiresAt) return;

    const msUntilRefresh = new Date(expiresAt).getTime() - Date.now() - TURN_CREDENTIAL_REFRESH_MARGIN_MS;
    if (msUntilRefresh <= 0) return;

    const timer = window.setTimeout(() => {
      void api
        .loadMe()
        .then(setMe)
        .catch(() => undefined);
    }, msUntilRefresh);

    return () => window.clearTimeout(timer);
  }, [api, me?.turnCredentials?.expiresAt, me?.turnCredentials?.enabled]);

  /**
   * Brings up ONE server — the one the failover cursor points at.
   *
   * A UA cannot stand in for two servers here: realm, registrar, outbound
   * proxy, contact URI and ICE set all move together with the server, and
   * JsSIP resolves those once per UA. Handing it every socket would only vary
   * the transport underneath a single fixed identity, which is not the
   * failover this list describes.
   */
  async function connectPhone() {
    if (!isWebphoneReady(me) || !me) return;
    // Guarded here as well as at the effect above because four call sites reach
    // this -- the retry button, the failover cursor, the reload path -- and a
    // guard on only the entry point is a guard on only one of them.
    if (tabRoleRef.current !== 'leader') return;

    const server = servers[serverIndexRef.current] ?? servers[0];
    if (!server) return;

    if (uaRef.current) {
      countRegistrationAttempt();
      uaRef.current.register();
      return;
    }

    setConnectionState('connecting');
    setStatus({ code: 'connecting' });

    try {
      const JsSIP = await import('jssip');
      const generation = ++uaGenerationRef.current;
      const isCurrentUa = () => uaGenerationRef.current === generation;
      const extraHeaders = server.outboundProxy ? [`Route: <${server.outboundProxy}>`] : undefined;
      const ua = new JsSIP.UA({
        sockets: [new JsSIP.WebSocketInterface(server.websocketUrl)],
        uri: sipUri(me.sipUsername!, server.sipDomain),
        authorization_user: me.sipUsername ?? undefined,
        password: me.sipPassword ?? undefined,
        display_name: me.displayName ?? me.extension ?? undefined,
        realm: server.realm ?? undefined,
        register: true,
        register_expires: server.registerExpires,
        registrar_server: server.registrarServer ?? undefined,
        contact_uri: server.contactUri ?? undefined,
        session_timers: server.sessionTimers,
        extra_headers: extraHeaders,
      });

      ua.on('connected', (event) => {
        if (!isCurrentUa()) return;
        setConnectionState('connecting');
        setStatus({ code: 'socketConnected' });
        tracePhone(server, 'ua.connected', { url: event.socket?.url });
      });
      ua.on('registered', () => {
        if (!isCurrentUa()) return;
        // Arrival ends the search: the budget that would have moved this phone
        // along is dropped outright, so a later re-REGISTER refresh starts from
        // a clean count rather than inheriting the trip that got here. The owed
        // failover goes with it — a server that has the phone registered is no
        // longer one to walk away from, however it looked mid-call.
        clearFailoverTimers();
        failoverPendingRef.current = false;
        attemptRef.current = 0;
        setRegistrationAttempt(0);
        setConnectionState('registered');
        setStatus({ code: 'registered' });
      });
      ua.on('registrationFailed', (event) => {
        if (!isCurrentUa()) return;
        setConnectionState('error');
        setStatus({ code: 'registrationFailed', detail: event.cause || undefined });
        phoneLifecycleRef.current.handleServerSetback();
      });
      ua.on('disconnected', () => {
        if (!isCurrentUa()) return;
        setConnectionState('offline');
        setStatus({ code: 'disconnected' });
        if (sessionRef.current) {
          // `stop()` ends every session it owns, so tearing the UA down here
          // would hang up on the caller because a socket blinked. JsSIP's own
          // recovery gets the call's remaining life to bring it back; if it
          // does, `registered` cancels this debt.
          failoverPendingRef.current = true;
          return;
        }
        // Left alone, JsSIP re-dials this socket on its own recovery timer —
        // the very retry this loop owns, aimed at a server the loop may have
        // already given up on. Stopping the UA hands the decision back to the
        // one component that knows the whole list.
        stopCurrentUa();
        phoneLifecycleRef.current.handleServerSetback();
      });
      ua.on('newRTCSession', (event: { session: RTCSession; originator: 'local' | 'remote' }) => {
        if (sessionRef.current && sessionRef.current !== event.session && !sessionRef.current.isEnded()) {
          event.session.terminate({
            status_code: 486,
            reason_phrase: 'Busy',
          });
          return;
        }
        if (event.originator === 'remote' && doNotDisturbRef.current) {
          event.session.terminate({
            status_code: 486,
            reason_phrase: 'Do Not Disturb',
          });
          return;
        }
        bindSession(event.session, event.originator === 'remote');
      });

      uaRef.current = ua;
      countRegistrationAttempt();
      startServerTimeout(server);
      ua.start();
    } catch (error) {
      setConnectionState('error');
      setStatus(readPhoneError(error, 'connectFailed'));
    }
  }

  function countRegistrationAttempt() {
    attemptRef.current += 1;
    setRegistrationAttempt(attemptRef.current);
  }

  /**
   * The deadline for the current server, not for the current attempt.
   *
   * A server that answers slowly and refuses, three times over, has still cost
   * the caller a phone that does not ring — so the clock runs across the whole
   * retry budget and whichever limit lands first ends this server's turn.
   */
  function startServerTimeout(server: WebphoneServer) {
    if (serverTimeoutRef.current) return;

    const timeoutMs = Math.round((server.timeoutSeconds ?? 0) * 1000);
    if (timeoutMs <= 0) return;

    serverTimeoutRef.current = window.setTimeout(() => {
      serverTimeoutRef.current = undefined;
      phoneLifecycleRef.current.advanceToNextServer();
    }, timeoutMs);
  }

  /**
   * One entry point for "this server is not carrying the phone".
   *
   * A refused REGISTER and a socket that went away are the same fact to the
   * loop, and giving them one handler is what keeps the retry budget honest:
   * a server that drops the connection instead of answering cannot buy itself
   * extra attempts by failing in the other way.
   */
  function handleServerSetback() {
    if (sessionRef.current) {
      // Hard rule: a live call outranks every registration problem. The move
      // is owed, not cancelled — `finishCall` pays it back.
      failoverPendingRef.current = true;
      return;
    }

    const server = servers[serverIndexRef.current] ?? servers[0];
    if (attemptRef.current < Math.max(1, server?.maxRetries ?? 1)) {
      retryCurrentServer();
      return;
    }
    advanceToNextServer();
  }

  /**
   * The status is deliberately left alone: the SIP cause of the last refusal
   * is the only thing here that explains an outage, and overwriting it with
   * "registering" every time the phone tries again would hide it behind the
   * retry. The attempt counter is what says a retry is in flight.
   */
  function retryCurrentServer() {
    // A UA that is still up owns a working socket to this server, so the retry
    // is one more REGISTER over it. Once the socket is gone the UA is too, and
    // the rebuild counts its own attempt.
    if (uaRef.current) {
      countRegistrationAttempt();
      uaRef.current.register();
      return;
    }
    void connectPhone();
  }

  function advanceToNextServer() {
    if (sessionRef.current) {
      failoverPendingRef.current = true;
      return;
    }

    clearFailoverTimers();
    stopCurrentUa();
    attemptRef.current = 0;
    setRegistrationAttempt(0);
    setStatus({ code: 'failingOver' });

    const nextIndex = serverIndexRef.current + 1;
    const wrapping = nextIndex >= servers.length;
    serverIndexRef.current = wrapping ? 0 : nextIndex;
    setActiveServerIndex(serverIndexRef.current);

    if (!wrapping) {
      setConnectionState('connecting');
      void connectPhone();
      return;
    }

    // Every server in the list has now refused this phone, which is a very
    // different situation from one server being down — and restarting the lap
    // at once would spend the outage opening sockets as fast as they fail.
    setConnectionState('error');
    cycleDelayRef.current = window.setTimeout(() => {
      cycleDelayRef.current = undefined;
      void phoneLifecycleRef.current.connectPhone();
    }, WEBPHONE_FAILOVER_CYCLE_DELAY_MS);
  }

  /** Pays back a failover the loop had to skip because a call was up. */
  function resumePendingFailover() {
    if (!failoverPendingRef.current) return;
    failoverPendingRef.current = false;
    handleServerSetback();
  }

  function stopCurrentUa() {
    // The bump first: `stop()` makes the UA emit its way out, and those events
    // must not reach a successor that is about to take this one's place.
    uaGenerationRef.current += 1;
    stopPhone(uaRef.current, null);
    uaRef.current = null;
  }

  function clearFailoverTimers() {
    if (serverTimeoutRef.current) window.clearTimeout(serverTimeoutRef.current);
    if (cycleDelayRef.current) window.clearTimeout(cycleDelayRef.current);
    serverTimeoutRef.current = undefined;
    cycleDelayRef.current = undefined;
  }

  function stopFailover() {
    clearFailoverTimers();
    failoverPendingRef.current = false;
    uaGenerationRef.current += 1;
  }

  function retryConnection() {
    stopFailover();
    stopPhone(uaRef.current, sessionRef.current);
    uaRef.current = null;
    sessionRef.current = null;
    // A manual retry is a fresh start, not a resumption: the operator asking
    // for it wants the preferred server tried again, not the fallback the
    // phone happened to drift onto.
    serverIndexRef.current = 0;
    setActiveServerIndex(0);
    attemptRef.current = 0;
    setRegistrationAttempt(0);
    void connectPhone();
  }

  function bindSession(session: RTCSession, incoming: boolean) {
    sessionRef.current = session;
    setMuted(false);
    setHeld(false);

    const partyNumber = session.remote_identity?.uri?.user ?? '';
    const partyName = session.remote_identity?.display_name ?? null;
    const party = partyNumber || partyName || 'Unknown';

    setRemoteParty(party);
    setDialTarget(partyNumber || party);
    setCallState(incoming ? 'incoming' : 'calling');
    setIncomingPopupDismissed(!incoming);
    setStatus({ code: incoming ? 'incomingCall' : 'calling' });

    if (!activeCallContextRef.current) {
      setCurrentActiveCallContext({
        direction: incoming ? 'incoming' : 'outgoing',
        number: partyNumber || party,
        displayName: partyName,
        startedAt: nowIso(),
      });
    }

    if (boundSessionsRef.current.has(session)) return;
    boundSessionsRef.current.add(session);

    if (incoming) bindIceCandidate(session);
    session.on('peerconnection', ({ peerconnection }) => bindPeerConnection(peerconnection));
    session.on('progress', () => {
      if (activeCallContextRef.current?.direction === 'incoming') {
        setStatus({ code: 'incomingCall' });
        return;
      }
      setCallState('ringing');
      setStatus({ code: 'ringing' });
    });
    session.on('accepted', markCallAnswered);
    session.on('confirmed', markCallAnswered);
    session.on('ended', () => finishCall('ended', { code: 'callEnded' }));
    session.on('failed', (event) => finishCall('failed', { code: 'callFailed', detail: event.cause || undefined }));
    session.on('hold', () => setHeld(true));
    session.on('unhold', () => setHeld(false));
    session.on('muted', () => setMuted(true));
    session.on('unmuted', () => setMuted(false));

    if (incoming && autoAnswerRef.current) {
      window.setTimeout(() => answerCall(session), 250);
    }
  }

  /**
   * @param override The number to dial, when it comes from somewhere other than
   * this tab's own input. A follower's command carries the target with it
   * because `setDialTarget` has not re-rendered by the time this runs, and
   * reading the state here would dial whatever was in the box before.
   */
  async function makeCall(override?: string) {
    const requested = (override ?? dialTarget).trim();
    if (!uaRef.current || !currentServer?.sipDomain || !requested) return;

    if (!uaRef.current.isRegistered()) {
      setConnectionState('connecting');
      setStatus({ code: 'registering' });
      uaRef.current.register();
      return;
    }

    const target = normalizeCallTarget(requested, currentServer.sipDomain);
    setCurrentActiveCallContext({
      direction: 'outgoing',
      number: dialTarget.trim(),
      displayName: null,
      startedAt: nowIso(),
    });
    setCallState('calling');
    setStatus({ code: 'startingCall' });

    try {
      tracePhone(currentServer, 'call.start', { target });
      const localStream = await getLocalAudioStream();
      const session = uaRef.current.call(target, {
        eventHandlers: {
          peerconnection: ({ peerconnection }) => bindPeerConnection(peerconnection),
          icecandidate: createIceCandidateHandler(),
        },
        mediaConstraints: { audio: true, video: false },
        mediaStream: localStream,
        pcConfig: pcConfigFromSettings(currentServer, me?.turnCredentials?.iceServers),
        rtcOfferConstraints: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        },
        fromDisplayName: me?.displayName ?? undefined,
        // The server's own default stands in when the extension carries no
        // caller ID: which trunk the call leaves by decides what the far end
        // is allowed to see, and that changes with the server.
        fromUserName: me?.outboundCallerId ?? currentServer.defaultCallerId ?? me?.extension ?? undefined,
      });
      bindSession(session, false);
    } catch (error) {
      tracePhone(currentServer, 'call.failed_before_invite', {
        target,
        error: safeErrorDetails(error),
      });
      const failure = classifyCallStartError(error);
      setMediaNotice(failure.mediaNoticeCode);
      finishCall('failed', failure.status);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function answerCall(targetSession?: any) {
    if (simulatedIncoming) {
      // A test ring has no media and no far end; it goes straight to the
      // in-call surface so the answered state can be inspected too.
      setIncomingPopupDismissed(true);
      stopIncomingRingTone();
      setCallState('active');
      setStatus({ code: 'inCall' });
      return;
    }
    const session = targetSession && typeof targetSession.isEnded === 'function' ? targetSession : sessionRef.current;
    if (!session || session.isEnded()) return;
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();
    void answerCallWithMedia(session);
  }

  async function answerCallWithMedia(session: RTCSession) {
    try {
      const localStream = await getLocalAudioStream();
      session.answer({
        mediaConstraints: { audio: true, video: false },
        mediaStream: localStream,
        pcConfig: pcConfigFromSettings(currentServer, me?.turnCredentials?.iceServers),
        rtcOfferConstraints: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        },
      });
      markCallAnswered();
    } catch (error) {
      const failure = classifyCallStartError(error);
      setMediaNotice(failure.mediaNoticeCode);
      finishCall('failed', failure.status);
    }
  }

  function declineCall() {
    if (simulatedIncoming) { endSimulatedCall(); return; }
    const session = sessionRef.current;
    if (!session || session.isEnded()) return;
    session.terminate({ status_code: 603, reason_phrase: 'Decline' });
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();
    finishCall('ended', { code: 'declined' });
  }

  function hangupCall() {
    if (simulatedIncoming) { endSimulatedCall(); return; }
    const session = sessionRef.current;
    // No session, or one already gone, still has to clear the UI: this is the
    // control someone reaches for precisely when the phone is stuck, and it
    // returning silently is how a call nobody can end happens.
    if (session && !session.isEnded()) {
      try {
        session.terminate();
      } catch {
        // A terminate over a dead transport throws. It used to throw *before*
        // `finishCall` below, so pressing hang up on a call whose socket had
        // gone left the call exactly where it was -- the one press guaranteed
        // to be a person trying to escape, and the one that could not.
      }
    }
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();
    finishCall('ended', { code: 'callEnded' });
  }

  function dismissIncomingPopup() {
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();
  }

  function toggleMute() {
    const session = sessionRef.current;
    const nextMuted = !muted;

    setMuted(nextMuted);
    setLocalAudioEnabled(!nextMuted);
    if (session && callState === 'active') {
      if (nextMuted) {
        session.mute({ audio: true });
      } else {
        session.unmute({ audio: true });
      }
    }
  }

  function toggleSpeakerMute() {
    const nextMuted = !speakerMuted;
    setSpeakerMuted(nextMuted);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = nextMuted;
    }
  }

  function toggleHold() {
    const session = sessionRef.current;
    if (!session || callState !== 'active') return;

    if (held) {
      if (session.unhold()) setHeld(false);
    } else if (session.hold()) {
      setHeld(true);
    }
  }

  function setMicVolumeLevel(value: number | string) {
    setMicVolume(clampVolume(Number(value)));
  }

  function setSpeakerVolumeLevel(value: number | string) {
    const nextVolume = clampVolume(Number(value));
    setSpeakerVolume(nextVolume);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = speakerMuted ? 0 : nextVolume / 100;
    }
  }

  function pressDigit(value: string) {
    if (!speakerMuted) playDtmfTone(value, speakerVolume);
    // While a transfer is being dialled the keypad addresses the transfer
    // target, not the far end — sending DTMF here would type the new number
    // into whatever IVR the caller is already connected to.
    if (transferring) {
      setTransferTarget((current) => `${current}${value}`);
      return;
    }
    if (callState === 'active' && sessionRef.current) {
      sessionRef.current.sendDTMF(value);
      return;
    }
    if (!callBusy) setDialTarget((current) => `${current}${value}`);
  }

  function deleteLastDigit() {
    if (transferring) {
      setTransferTarget((current) => current.slice(0, -1));
      return;
    }
    if (callBusy) return;
    setDialTarget((current) => current.slice(0, -1));
  }

  function beginTransfer() {
    if (callState !== 'active') return;
    setTransferTarget('');
    setTransferring(true);
  }

  function cancelTransfer() {
    setTransferring(false);
    setTransferTarget('');
  }

  /**
   * Blind transfer (SIP REFER).
   *
   * The call is handed to the new party and this phone drops out — it does not
   * wait to hear whether the target answered, which is what "blind" means. The
   * session is left to end on its own `ended` event rather than hung up here,
   * so a REFER the far end rejects leaves the original call still up instead
   * of silently dropping the caller.
   */
  /** @param override Same reasoning as `makeCall`: a command carries its own target. */
  function confirmTransfer(override?: string) {
    const target = (override ?? transferTarget).trim();
    if (!target || !sessionRef.current || !currentServer?.sipDomain) return;
    try {
      tracePhone(currentServer, 'call.transfer', { target });
      sessionRef.current.refer(normalizeCallTarget(target, currentServer.sipDomain));
      setStatus({ code: 'transferring' });
      setTransferring(false);
      setTransferTarget('');
    } catch (error) {
      setStatus(readPhoneError(error, 'transferFailed'));
    }
  }

  function copyNumber() {
    const value = displayNumber.trim();
    if (!value) return;
    void navigator.clipboard?.writeText(value);
  }

  function finishCall(nextState: WebphoneCallState, nextStatus: WebphoneStatus) {
    const context = activeCallContextRef.current;
    const durationSeconds = callStartedAtRef.current ? Math.min(86_400, elapsedSecondsSince(callStartedAtRef.current)) : 0;
    const finalDuration = callStartedAtRef.current ? formatDuration(durationSeconds) : undefined;

    if (context) {
      const cause = nextStatus.detail ? `${nextStatus.code}: ${nextStatus.detail}` : nextStatus.code;
      const completedContext = {
        ...context,
        endedAt: nowIso(),
        durationSeconds,
        cause: cause.slice(0, 120),
      };
      setCurrentActiveCallContext(null);
      void saveCallLog(completedContext);
    }

    callStartedAtRef.current = null;
    sessionRef.current = null;
    stopLocalAudioStream();
    resetRemoteAudio();
    stopIncomingRingTone();
    setIncomingPopupDismissed(true);
    setCallState(nextState);
    setStatus(nextStatus);
    setLastCallDuration(finalDuration);
    setCallDurationSeconds(0);
    setMuted(false);
    setHeld(false);
    setDialTarget('');
    // Cleared with the rest, not on the timer below. `displayNumber` reads
    // `remoteParty || dialTarget`, so leaving it behind kept the number of a
    // finished call sitting in the dial box -- next to a call button that was
    // live again, one press away from redialling somebody by accident.
    setRemoteParty('');

    // The delay is only for the state label: it holds "ended" or "failed" long
    // enough to be read before the phone settles back to idle.
    window.setTimeout(() => {
      setCallState((current) => (current === nextState ? 'idle' : current));
    }, 1400);

    // The line is free again, so a failover held back for the caller's sake
    // can finally happen.
    resumePendingFailover();
  }

  function markCallAnswered() {
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();

    if (!callStartedAtRef.current) {
      callStartedAtRef.current = Date.now();
      setCallDurationSeconds(0);
      setLastCallDuration(undefined);
    }

    const context = activeCallContextRef.current ?? {
      direction: 'outgoing' as const,
      number: displayNumber || dialTarget || 'Unknown',
      displayName: null,
      startedAt: nowIso(),
    };

    setCurrentActiveCallContext({
      ...context,
      answeredAt: context.answeredAt ?? nowIso(),
    });
    setCallState('active');
    setStatus({ code: 'inCall' });
  }

  function setCurrentActiveCallContext(context: ActiveCallContext | null) {
    activeCallContextRef.current = context;
    setActiveCallContext(context);
  }

  /**
   * Rings the phone with no SIP session behind it.
   *
   * The incoming-call surface is otherwise unreachable until a server accepts a
   * registration and someone dials in — which means the one screen a caller
   * sees first is the one nobody can look at while the telephony is still being
   * set up. This drives the real popup with real state; only the session is
   * absent, and every control below already tolerates that.
   */
  function toggleTestIncomingCall() {
    if (simulatedIncoming) {
      endSimulatedCall();
      return;
    }
    setSimulatedIncoming(true);
    setIncomingPopupDismissed(false);
    setCurrentActiveCallContext({
      direction: 'incoming',
      number: SIMULATED_CALLER_NUMBER,
      displayName: 'Test caller',
      startedAt: nowIso(),
    });
    // A real call sets this in `bindSession`, and `displayNumber` reads from it
    // to put the far end's number in the dial field. Leaving it out made the
    // simulator diverge from the thing it simulates in exactly the place a
    // layout change would be checked — the field stayed empty and the copy
    // control stayed disabled, which is not what a real call does.
    setRemoteParty(SIMULATED_CALLER_NUMBER);
    setCallState('ringing');
    setStatus({ code: 'incomingCall' });
  }

  function endSimulatedCall() {
    setSimulatedIncoming(false);
    setIncomingPopupDismissed(true);
    setCurrentActiveCallContext(null);
    setCallState('idle');
    setStatus({ code: registered ? 'registered' : 'ready' });
    setTransferring(false);
    setTransferTarget('');
    // A real call leaves its number behind so it can be redialled. A test ring
    // must not: the number is fictional, and leaving it sitting in the dial
    // field is an invitation to place a real call to it.
    setRemoteParty('');
    setDialTarget('');
  }

  async function saveCallLog(context: ActiveCallContext) {
    const payload: CreateWebphoneCallLogPayload = {
      type: callLogTypeFor(context),
      displayName: context.displayName ?? null,
      phoneNumber: context.number.slice(0, 80),
      startedAt: context.startedAt,
      answeredAt: context.answeredAt ?? null,
      endedAt: context.endedAt ?? null,
      durationSeconds: context.durationSeconds ?? null,
      cause: context.cause ?? null,
    };
    const temporaryId = `local-${Date.now()}`;

    setCallLogs((current) => [{ ...payload, id: temporaryId, createdAt: nowIso() }, ...current].slice(0, 50));

    try {
      const saved = await api.createCallLog(payload);
      if (saved) {
        setCallLogs((current) => [saved, ...current.filter((log) => log.id !== temporaryId)].slice(0, 50));
      }
    } catch {
      // Call logging is deliberately non-blocking for the phone runtime.
    }
  }

  async function getLocalAudioStream() {
    assertMediaEnvironment();

    const currentStream = localStreamRef.current;
    const currentAudioTrack = currentStream?.getAudioTracks().find((track) => track.readyState === 'live');

    if (currentStream && currentAudioTrack) {
      setLocalAudioEnabled(!muted);
      startMicLevelMeter(currentStream);
      setMediaNotice(undefined);
      return currentStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;
    startMicLevelMeter(stream);
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
      track.addEventListener('ended', () => {
        if (!stoppingLocalStreamRef.current) {
          setMediaNotice('stopped');
        }
      });
      track.addEventListener('mute', () => setMediaNotice('muted'));
      track.addEventListener('unmute', () => setMediaNotice(undefined));
    });
    setMediaNotice(undefined);
    return stream;
  }

  function setLocalAudioEnabled(enabled: boolean) {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function stopLocalAudioStream() {
    stoppingLocalStreamRef.current = true;
    stopMicLevelMeter();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    window.setTimeout(() => {
      stoppingLocalStreamRef.current = false;
    }, 0);
  }

  function bindPeerConnection(peerconnection: RTCPeerConnection) {
    if (boundPeerConnectionsRef.current.has(peerconnection)) return;
    boundPeerConnectionsRef.current.add(peerconnection);

    // The sampler reads from whichever connection is current. Failover builds a
    // new one, and pointing at the old one would keep reporting a call that
    // ended.
    qualityPeerRef.current = peerconnection;

    /**
     * Ends a call whose media has actually died.
     *
     * Nothing watched this before, and a call could hang forever: the SIP
     * socket dropping is deliberately *not* treated as the end of a call --
     * RTP travels its own path and a call survives a signalling blip -- but
     * that also means a call whose media is gone has nothing left to notice
     * it. The far end's BYE can never arrive over a dead path, so `ended`
     * never fires and the timer runs on a conversation that stopped minutes
     * ago.
     *
     * `failed` is terminal in the WebRTC spec: ICE has exhausted every
     * candidate pair and will not retry. `disconnected` is not -- it recovers
     * routinely on a network switch -- so it gets a bounded window first, and
     * cancels the moment connectivity returns.
     */
    let mediaGraceTimer: number | undefined;
    const clearMediaGrace = () => {
      if (mediaGraceTimer !== undefined) {
        window.clearTimeout(mediaGraceTimer);
        mediaGraceTimer = undefined;
      }
    };

    peerconnection.addEventListener('connectionstatechange', () => {
      // Only for the connection this call is actually on: failover leaves the
      // old one behind, and its death is not this call's business.
      if (qualityPeerRef.current !== peerconnection) return;
      const state = peerconnection.connectionState;

      if (state === 'connected') {
        clearMediaGrace();
        return;
      }
      if (state === 'failed') {
        clearMediaGrace();
        if (sessionRef.current) finishCall('failed', { code: 'callFailed' });
        return;
      }
      if (state === 'disconnected' && mediaGraceTimer === undefined) {
        mediaGraceTimer = window.setTimeout(() => {
          mediaGraceTimer = undefined;
          if (
            qualityPeerRef.current === peerconnection &&
            peerconnection.connectionState === 'disconnected' &&
            sessionRef.current
          ) {
            finishCall('failed', { code: 'callFailed' });
          }
        }, MEDIA_RECOVERY_GRACE_MS);
      }
    });

    const legacyPeerConnection = peerconnection as LegacyPeerConnection;
    legacyPeerConnection.addEventListener('track', (event) => {
      attachRemoteTrack(event.track, event.streams);
    });
    legacyPeerConnection.addEventListener('addstream', (event) => {
      attachRemoteStream((event as Event & { stream?: MediaStream }).stream);
    });
    attachRemoteStream(legacyPeerConnection.getRemoteStreams?.()[0]);
  }

  function bindIceCandidate(session: RTCSession) {
    if (boundIceSessionsRef.current.has(session)) return;
    boundIceSessionsRef.current.add(session);
    session.on('icecandidate', createIceCandidateHandler());
  }

  function createIceCandidateHandler() {
    let iceReadyTimer: number | undefined;
    let readySent = false;

    return (event: { candidate?: RTCIceCandidate | null; ready: () => void }) => {
      const candidate = event.candidate?.candidate ?? '';
      const candidateType = candidate.match(/ typ ([a-z0-9]+)/i)?.[1] ?? 'unknown';
      const hasPublicMediaCandidate = candidateType === 'srflx' || candidateType === 'relay';

      tracePhone(currentServer, 'ice.candidate', {
        candidateType,
        ready: hasPublicMediaCandidate,
      });

      const markReady = () => {
        if (readySent) return;
        readySent = true;
        if (iceReadyTimer) window.clearTimeout(iceReadyTimer);
        event.ready();
      };

      if (!event.candidate || hasPublicMediaCandidate) {
        markReady();
        return;
      }

      iceReadyTimer ??= window.setTimeout(() => {
        tracePhone(currentServer, 'ice.ready_timeout', { candidateType });
        markReady();
      }, 1200);
    };
  }

  function attachRemoteTrack(track: MediaStreamTrack, streams: readonly MediaStream[]) {
    const [stream] = streams;
    if (stream) {
      attachRemoteStream(stream);
      return;
    }

    const remoteStream = remoteStreamRef.current ?? new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
      remoteStream.addTrack(track);
    }
    attachRemoteStream(remoteStream);
  }

  function attachRemoteStream(stream?: MediaStream | null) {
    if (!stream || !remoteAudioRef.current) return;
    remoteStreamRef.current = stream;
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.muted = speakerMuted;
    remoteAudioRef.current.volume = speakerMuted ? 0 : speakerVolume / 100;
    startSpeakerLevelMeter(stream);
    void remoteAudioRef.current
      .play()
      .then(() => setMediaNotice(undefined))
      .catch(() => setMediaNotice('clickToAllow'));
  }

  function resetRemoteAudio() {
    stopSpeakerLevelMeter();
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;
  }

  function startMicLevelMeter(stream: MediaStream) {
    micMeterStopRef.current?.();
    micMeterStopRef.current = createAudioLevelMeter(stream, setMicLevel);
  }

  function startSpeakerLevelMeter(stream: MediaStream) {
    speakerMeterStopRef.current?.();
    speakerMeterStopRef.current = createAudioLevelMeter(stream, setSpeakerLevel);
  }

  function stopMicLevelMeter() {
    micMeterStopRef.current?.();
    micMeterStopRef.current = null;
    setMicLevel(0);
  }

  function stopSpeakerLevelMeter() {
    speakerMeterStopRef.current?.();
    speakerMeterStopRef.current = null;
    setSpeakerLevel(0);
  }

  function startIncomingRingTone() {
    ringToneStopRef.current?.();
    ringToneStopRef.current = createIncomingRingTone();
  }

  function stopIncomingRingTone() {
    ringToneStopRef.current?.();
    ringToneStopRef.current = null;
  }

  const canConnect = isWebphoneReady(me);
  const registered = connectionState === 'registered';
  const callActive = callState === 'active';
  const callBusy = callState !== 'idle' && callState !== 'ended' && callState !== 'failed';
  const displayNumber = remoteParty || dialTarget;
  const timerLabel = callActive ? formatDuration(callDurationSeconds) : lastCallDuration;
  const phoneDisplayName = me?.displayName?.trim() || copy.phoneName;
  const phoneIdentity = me?.outboundCallerId?.trim() || me?.extension?.trim() || '';
  const callContext = activeCallContext;
  const incomingCallWaiting = callContext?.direction === 'incoming' && callBusy && !callActive;
  const callPeerNumber = callContext?.number || displayNumber || phoneIdentity;
  const callPeerName = callContext?.displayName?.trim() || (callBusy ? callPeerNumber : phoneDisplayName);
  // What the followers are told. Recomputed on every render and published only
  // when it actually differs, so a leader in a call does not flood the channel
  // once a second as the timer ticks -- the timer is not in the snapshot for
  // exactly that reason, and a follower showing a live second counter it cannot
  // keep accurate would be worse than showing none.
  const sharedSnapshot: WebphoneSharedSnapshot = {
    registered: connectionState === 'registered',
    extension: me?.extension?.trim() ?? '',
    callBusy,
    callActive,
    incomingCallWaiting,
    callPeerNumber: callBusy ? callPeerNumber : '',
    callPeerName: callBusy ? callPeerName : '',
    connectionState,
    statusCode: status.code,
    statusDetail: status.detail,
    // The timer is in the snapshot after all. It changes once a second, which
    // is why it was left out at first -- but a follower cannot derive it, and a
    // call surface with a frozen clock is worse than one extra small message a
    // second on a channel that carries nothing else.
    timerLabel: callActive ? timerLabel : undefined,
    muted,
    held,
    simulatedIncoming,
    mediaNotice,
  };

  // Reassigned every render so the keyboard listener, which is bound once,
  // always reaches the handler this tab is currently using -- the leader's own
  // `pressDigit`, or the follower's version that forwards DTMF.
  makeCallRef.current = makeCall;

  phoneKeyRef.current = (digit: string) => {
    if (follower) {
      if (!viewMuted) playDtmfTone(digit, speakerVolume);
      if (viewCallActive) {
        send({ kind: 'dtmf', digit });
        return;
      }
      if (!viewCallBusy) setDialTarget((current) => `${current}${digit}`);
      return;
    }
    pressDigit(digit);
  };

  /**
   * Places a call this tab asked for before it owned the phone.
   *
   * The claim above is asynchronous — the browser grants the lock, the UA is
   * built, a REGISTER goes out — so the number waits here until the phone is
   * genuinely able to dial it. Waiting on `registered` rather than on
   * leadership alone is the difference between dialling and a call that fails
   * because the UA had not finished coming up.
   *
   * The deadline exists because a claim can simply not arrive: another tab may
   * hold the lock through a call, or registration may fail outright. A number
   * that sits pending forever would fire minutes later at a moment nobody
   * expects, which is worse than not dialling at all.
   */
  useEffect(() => {
    if (!pendingCallRef.current) return;

    if (tabRole === 'leader' && connectionState === 'registered') {
      const target = pendingCallRef.current;
      pendingCallRef.current = null;
      void makeCallRef.current?.(target);
      return;
    }

    const deadline = window.setTimeout(() => {
      if (!pendingCallRef.current) return;
      pendingCallRef.current = null;
      setStatus({ code: 'callFailed' });
    }, PENDING_CALL_DEADLINE_MS);
    return () => window.clearTimeout(deadline);
  }, [tabRole, connectionState]);

  const publishSnapshotRef = useRef<(() => void) | null>(null);
  publishSnapshotRef.current = () => tabsRef.current?.publish(sharedSnapshot);

  // Runs what a follower asked for. Reassigned every render so it always closes
  // over the current session and UA rather than the ones that existed when the
  // election effect first ran.
  commandHandlerRef.current = (command: WebphoneCommand) => {
    switch (command.kind) {
      case 'call':
        setDialTarget(command.target);
        // Come forward *before* dialling, not after.
        //
        // Placing the call needs the microphone, and a browser will not hand a
        // hidden tab a capture stream -- the request simply waits until the tab
        // is visible. From the operator's side that looked like a call that
        // refused to start until they switched tabs by hand, with nothing
        // saying why. Asking for the screen first is what makes a call placed
        // from another tab behave like one placed here.
        try {
          window.focus();
        } catch {
          // Browsers may refuse a focus with no user gesture behind it. The
          // call is still placed; it starts when the tab is next looked at.
        }
        // The target has to reach `makeCall` without waiting for a render, so
        // it is passed rather than read back out of state.
        void makeCall(command.target);
        return;
      case 'answer':
        answerCall();
        // Answering from elsewhere still puts the audio here, so this tab has
        // to be where the person is looking.
        try {
          window.focus();
        } catch {
          // Blocked by the browser; the call is still answered.
        }
        return;
      case 'decline':
        declineCall();
        return;
      case 'hangup':
        hangupCall();
        return;
      case 'toggle-mute':
        toggleMute();
        return;
      case 'toggle-hold':
        toggleHold();
        return;
      case 'dtmf':
        pressDigit(command.digit);
        return;
      case 'transfer':
        setTransferTarget(command.target);
        confirmTransfer(command.target);
        return;
      case 'test-incoming':
        toggleTestIncomingCall();
        return;
      default:
        return;
    }
  };

  const snapshotKey = JSON.stringify(sharedSnapshot);
  useEffect(() => {
    if (tabRole !== 'leader') return;
    publishSnapshotRef.current?.();
  }, [snapshotKey, tabRole]);

  const visibleMicVolume = muted ? 0 : micVolume;
  const visibleSpeakerVolume = speakerMuted ? 0 : speakerVolume;
  // Every tab rings, not just the one holding the session. A follower has no
  // call context of its own, so without the leader's view of it the popup —
  // the thing a person actually reacts to — appeared on exactly one tab and the
  // others showed a line in the dock nobody was looking at.
  //
  // Dismissing stays local: waving the popup away on one screen is a statement
  // about that screen, not an instruction to hide a ringing call from every
  // other one. Answering and declining are the opposite, and those already
  // travel to the leader as commands.
  const ringingHere = tabRole === 'leader' ? incomingCallWaiting : (leaderSnapshot?.incomingCallWaiting ?? false);
  const showIncomingPopup = ringingHere && !incomingPopupDismissed;

  // A follower never runs `bindSession`, which is where the leader clears this
  // for a new call. Without its own reset, the first call a follower dismissed
  // would be the last one it ever showed.
  const previouslyRingingRef = useRef(false);
  useEffect(() => {
    const wasRinging = previouslyRingingRef.current;
    previouslyRingingRef.current = ringingHere;
    if (tabRole !== 'leader' && ringingHere && !wasRinging) {
      setIncomingPopupDismissed(false);
    }
  }, [ringingHere, tabRole]);

  // The popup appears on every tab; the sound comes from one.
  //
  // These were the same condition until the popup went everywhere, and then
  // every open tab rang at once — four copies of the same ringtone, slightly
  // out of phase, from a browser the person cannot easily silence. The tab that
  // holds the call is the one that owns its audio, here as everywhere else.
  useEffect(() => {
    if (showIncomingPopup && tabRole === 'leader') {
      startIncomingRingTone();
    } else {
      stopIncomingRingTone();
    }

    return () => stopIncomingRingTone();
  }, [showIncomingPopup, tabRole]);

  /**
   * The physical keyboard is a keypad too.
   *
   * Typing a digit while the phone is open goes into the dial box and sounds
   * the same tone as pressing the key on screen, because someone who has just
   * clicked a phone open and started typing numbers means the phone. Bound on
   * `keydown` rather than `keypress` so the tone starts on the way down, the
   * same reason the on-screen keys moved to `pointerdown`.
   *
   * It stays out of the way of real typing: anything with focus that accepts
   * text — including the phone's own dial and transfer fields, which already
   * handle their own input — is left alone, and any modifier means the key is
   * part of a shortcut and not a digit.
   */
  useEffect(() => {
    if (!expanded || activeTab !== 'phone') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      const key = event.key;
      if (!/^[0-9*#+]$/.test(key)) return;

      event.preventDefault();
      phoneKeyRef.current?.(key);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, activeTab]);

  // Losing the lock has to take the registration with it.
  //
  // A leader normally holds until its tab dies, but it can be deposed: another
  // tab that gets no answer to `hello` concludes the holder is gone and steals.
  // If this tab was merely busy rather than dead, it now has a live UA and a
  // registered contact while no longer being the phone — the exact duplicate
  // the election exists to prevent, and worse for being invisible. Standing
  // down means standing down completely.
  const wasLeaderRef = useRef(false);
  useEffect(() => {
    const wasLeader = wasLeaderRef.current;
    wasLeaderRef.current = tabRole === 'leader';
    if (!wasLeader || tabRole === 'leader') return;

    const ua = uaRef.current;
    const session = sessionRef.current;
    uaRef.current = null;
    sessionRef.current = null;
    uaGenerationRef.current += 1;
    stopPhone(ua, session);
    setConnectionState('idle');
    setStatus({ code: 'idle' });
  }, [tabRole]);

  /**
   * Warns before the tab holding a live call is closed.
   *
   * This is the browser's own dialog, not one of ours, and that is a hard
   * limit rather than a shortcut: since Chrome 51 and Firefox 44 a page cannot
   * put custom text — or a custom modal — in front of an unload. Returning a
   * string only tells the browser to show *its* wording. Trying to hand-roll a
   * modal here would produce something that renders after the tab is already
   * gone, which is worse than the plain dialog.
   *
   * It is armed only while a call is actually up. A confirmation on every close
   * of a tab that merely holds the registration would be nagging: the
   * registration moves to another tab by itself within a second, so there is
   * nothing to warn about. A call does not move, and that is worth stopping for.
   */
  useEffect(() => {
    if (tabRole !== 'leader' || !callBusy) return;
    const confirmClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Assigning `returnValue` is what still triggers the dialog in browsers
      // that ignore `preventDefault` alone; the string itself is never shown.
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', confirmClose);
    return () => window.removeEventListener('beforeunload', confirmClose);
  }, [tabRole, callBusy]);

  // Hand the registration back before the tab goes, so Asterisk drops the
  // contact immediately instead of forking calls at it for the rest of
  // `register_expires` -- 600 seconds by default, which is a long time to ring
  // a browser that closed. `pagehide` rather than `beforeunload`: the latter is
  // skipped outright on mobile and by the back/forward cache, which is where a
  // tab most often disappears without warning.
  useEffect(() => {
    if (tabRole !== 'leader') return;
    const releaseRegistration = () => {
      try {
        uaRef.current?.unregister({ all: false });
      } catch {
        // The socket may already be gone; the lock is released either way.
      }
    };
    window.addEventListener('pagehide', releaseRegistration);
    return () => window.removeEventListener('pagehide', releaseRegistration);
  }, [tabRole]);

  /**
   * The phone as every tab sees it.
   *
   * A follower has no UA, no session and no microphone, so its own state is
   * empty — but the person looking at it still has a phone in front of them
   * and expects it to work. So a follower renders the leader's state and
   * forwards its actions, and the only thing it keeps of its own is what it is
   * typing: a dial box that reset itself every time the other tab published a
   * snapshot would be unusable.
   *
   * Every action below is the leader's own function when this tab leads, and a
   * message when it does not. Doing that here rather than at each call site is
   * what lets the widget be written once, with no idea which kind of tab it is
   * running in.
   */
  const follower = tabRole !== 'leader';
  const shared = leaderSnapshot;
  const send = (command: WebphoneCommand) => tabsRef.current?.send(command);

  const viewConnectionState = follower
    ? ((shared?.connectionState as WebphoneConnectionState) ?? 'loading')
    : connectionState;
  const viewStatus: WebphoneStatus = follower
    ? { code: (shared?.statusCode as WebphoneStatusCode) ?? 'idle', detail: shared?.statusDetail }
    : status;
  const viewCallBusy = follower ? (shared?.callBusy ?? false) : callBusy;
  const viewCallActive = follower ? (shared?.callActive ?? false) : callActive;
  const viewIncomingWaiting = follower ? (shared?.incomingCallWaiting ?? false) : incomingCallWaiting;
  const viewPeerNumber = follower ? (shared?.callPeerNumber ?? '') : callPeerNumber;
  const viewPeerName = follower ? (shared?.callPeerName ?? '') : callPeerName;
  const viewTimerLabel = follower ? shared?.timerLabel : timerLabel;
  const viewMuted = follower ? (shared?.muted ?? false) : muted;
  const viewHeld = follower ? (shared?.held ?? false) : held;
  const viewSimulated = follower ? (shared?.simulatedIncoming ?? false) : simulatedIncoming;
  // Without this a call that failed on the leader looked, from every other tab,
  // like a button that did nothing at all.
  const viewMediaNotice = follower
    ? (shared?.mediaNotice as WebphoneMediaNoticeCode | undefined)
    : mediaNotice;
  // During a call every tab shows the far end. Otherwise each shows what it is
  // typing, which is local by definition.
  const viewDisplayNumber = follower ? (viewCallBusy ? viewPeerNumber : dialTarget) : displayNumber;

  // A follower types into its own dial box, so nothing the leader does can
  // clear it. Without this the number stayed on screen after the call ended --
  // on every tab except the one that placed it.
  const wasCallBusyRef = useRef(false);
  useEffect(() => {
    const wasBusy = wasCallBusyRef.current;
    wasCallBusyRef.current = viewCallBusy;
    if (follower && wasBusy && !viewCallBusy) setDialTarget('');
  }, [viewCallBusy, follower]);

  return [
    {
      shouldRender: active && shouldRender,
      expanded,
      setExpanded: (next: boolean) => {
        // Opening the dock is a real user gesture, which is exactly what the
        // autoplay policy wants before an AudioContext may start. Warming it
        // here means the first keypad digit does not pay for it.
        if (next) primeDtmfAudio();
        setExpanded(next);
      },
      activeTab,
      setActiveTab,
      connectionState: viewConnectionState,
      // The failover loop, made visible: a phone working its way down a list of
      // dead servers is otherwise indistinguishable from one sitting idle.
      activeServerName: currentServer?.name ?? '',
      activeServerIndex,
      serverCount: servers.length,
      registrationAttempt,
      callState,
      status: viewStatus,
      dialTarget,
      setDialTarget,
      displayNumber: viewDisplayNumber,
      phoneDisplayName,
      phoneIdentity,
      callBusy: viewCallBusy,
      callActive: viewCallActive,
      incomingCallWaiting: viewIncomingWaiting,
      callPeerNumber: viewPeerNumber,
      callPeerName: viewPeerName,
      timerLabel: viewTimerLabel,
      mediaNotice: viewMediaNotice,
      // A follower has no UA to ask, so "can this phone dial" has to come from
      // the tab that owns one. Computing it locally left every follower with a
      // permanently dead call button while the phone beside it was registered
      // and idle.
      canCall: follower
        ? Boolean(shared?.registered) && Boolean(dialTarget.trim()) && !viewCallBusy
        : canConnect && registered && Boolean(dialTarget.trim()) && !callBusy,
      // Distinct from `canCall`: the button turns green on a typed number
      // alone, and only refuses the press when the line cannot carry it.
      hasDialTarget: Boolean(dialTarget.trim()),
      transferring,
      transferTarget,
      setTransferTarget,
      canTransfer: Boolean(transferTarget.trim()) && viewCallActive,
      simulatedIncoming: viewSimulated,
      /** Smoothed inbound quality, or null during the grace window. */
      callQuality,
      /** 'leader' owns the registration; a follower is a read-only view of it. */
      tabRole,
      isLeader: tabRole === 'leader',
      /** What the leader last said it was doing. Null until it answers. */
      leaderSnapshot,
      /** Follower only: ask the tab that owns the phone to come to the front. */
      requestLeaderFocus: () => tabsRef.current?.requestFocus(),
      toggleTestIncomingCall: follower ? () => send({ kind: 'test-incoming' }) : toggleTestIncomingCall,
      beginTransfer,
      cancelTransfer,
      confirmTransfer: follower ? (target?: string) => send({ kind: 'transfer', target: (target ?? transferTarget).trim() }) : confirmTransfer,
      keypad,
      /**
       * A follower placing a call takes the phone rather than delegating it.
       *
       * Delegating cannot work: the leader is by definition the tab nobody is
       * looking at, and a browser rejects `getUserMedia` from a hidden tab with
       * `NotAllowedError` in milliseconds. The call failed instantly and
       * silently, which read as a call button that did nothing.
       *
       * So the tab being used becomes the phone, and places the call itself
       * once it holds the lock and has registered. The claim is refused while a
       * call is already up anywhere — taking the phone mid-conversation would
       * drop it, and the person on the line did not ask for that.
       */
      makeCall: follower
        ? async (target?: string) => {
            const requested = (target ?? dialTarget).trim();
            if (!requested) return;
            if (viewCallBusy) {
              send({ kind: 'call', target: requested });
              return;
            }
            pendingCallRef.current = requested;
            tabsRef.current?.claimLeadership();
          }
        : makeCall,
      retryConnection,
      answerCall: follower ? () => send({ kind: 'answer' }) : answerCall,
      declineCall: follower ? () => send({ kind: 'decline' }) : declineCall,
      hangupCall: follower ? () => send({ kind: 'hangup' }) : hangupCall,
      dismissIncomingPopup,
      showIncomingPopup,
      copyNumber,
      deleteLastDigit,
      // A follower's keypad is still a keypad. Only a digit pressed *during* a
      // call is DTMF and has to travel to the tab holding the session; the rest
      // of the time it is someone typing a number, which is local to the tab
      // they are typing in. Routing every press as DTMF made the dial box
      // impossible to fill on any tab but one.
      pressDigit: follower
        ? (digit: string) => {
            if (!viewMuted) playDtmfTone(digit, speakerVolume);
            if (viewCallActive) {
              send({ kind: 'dtmf', digit });
              return;
            }
            if (!viewCallBusy) setDialTarget((current) => `${current}${digit}`);
          }
        : pressDigit,
      muted: viewMuted,
      toggleMute: follower ? () => send({ kind: 'toggle-mute' }) : toggleMute,
      speakerMuted,
      toggleSpeakerMute,
      held: viewHeld,
      toggleHold: follower ? () => send({ kind: 'toggle-hold' }) : toggleHold,
      micLevel,
      speakerLevel,
      micVolume: visibleMicVolume,
      speakerVolume: visibleSpeakerVolume,
      setMicVolumeLevel,
      setSpeakerVolumeLevel,
      autoAnswer,
      setAutoAnswer,
      doNotDisturb,
      setDoNotDisturb,
      callLogs,
      logsLoading,
    },
    remoteAudioRef,
  ] as const;
}

function nowIso() {
  return new Date().toISOString();
}

function elapsedSecondsSince(startedAt: number) {
  return Math.floor((Date.now() - startedAt) / 1000);
}

function assertMediaEnvironment() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error('Microphone requires HTTPS or localhost.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available in this browser context.');
  }
}

function tracePhone(server: WebphoneServer | undefined, event: string, payload: Record<string, unknown>) {
  if (!server?.traceSip) return;
  console.info(`[WebPhone] ${event}`, payload);
}

function safeErrorDetails(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: 'Unknown error' };
}

function readPhoneError(error: unknown, fallbackCode: WebphoneStatusCode): WebphoneStatus {
  if (!(error instanceof Error) || !error.message.trim()) return { code: fallbackCode };
  return { code: fallbackCode, detail: error.message.slice(0, 120) };
}

type CallStartFailure = {
  status: WebphoneStatus;
  mediaNoticeCode?: WebphoneMediaNoticeCode;
};

function classifyCallStartError(error: unknown): CallStartFailure {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  const combined = `${name} ${message}`;

  if (/permission|denied|notallowed/i.test(combined)) {
    return { status: { code: 'callFailed' }, mediaNoticeCode: 'permissionDenied' };
  }
  // A machine with no capture device at all. This is checked before the HTTPS
  // branch because `NotFoundError` matched neither of the other two and fell
  // through to the generic case, which surfaced the browser's own English
  // "Requested device not found" as the whole explanation — leaving every call
  // failing before its INVITE with nothing on screen naming the cause.
  if (/notfound|devicesnotfound|requested device not found/i.test(combined)) {
    return { status: { code: 'callFailed' }, mediaNoticeCode: 'noMicrophone' };
  }
  if (/secure|https|getUserMedia|microphone is not available/i.test(combined)) {
    return { status: { code: 'callFailed' }, mediaNoticeCode: 'requiresHttps' };
  }
  return { status: { code: 'callFailed', detail: message ? message.slice(0, 120) : undefined } };
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Says out loud why the dock is not on screen.
 *
 * Rendering nothing is correct for an admin with no phone, but it is also what
 * a failed read, a lost session, and a mis-scoped extension all look like —
 * four causes, one blank corner, and no way to tell them apart from the
 * outside. Outside production the legitimate case is announced too, so the
 * answer to "why is it not showing" is always one line in the console rather
 * than an afternoon of bisecting the stack.
 */
// Declared locally rather than pulling @types/node into a browser package:
// bundlers replace this expression at build time, and the guard below keeps it
// safe anywhere that does not.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

function reportHidden(reason: string) {
  if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'production') {
    return;
  }
  console.info(`[webphone] hidden — ${reason}`);
}

function readBooleanPreference(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    return fallback;
  }
  return fallback;
}

function writeBooleanPreference(key: string, value: boolean) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Browser privacy modes can block localStorage.
  }
}

function readVolumePreference(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;

  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue == null) return fallback;
    const value = Number(storedValue);
    if (Number.isFinite(value)) return clampVolume(value);
  } catch {
    return fallback;
  }
  return fallback;
}

function writeVolumePreference(key: string, value: number) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, String(clampVolume(value)));
  } catch {
    // Browser privacy modes can block localStorage.
  }
}

function createAudioLevelMeter(stream: MediaStream, onLevel: (level: number) => void) {
  if (typeof window === 'undefined') return () => undefined;

  const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return () => onLevel(0);

  try {
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const data = new Uint8Array(analyser.fftSize);
    let frameId = 0;

    source.connect(analyser);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      onLevel(Math.min(100, Math.round(rms * 260)));
      frameId = window.requestAnimationFrame(tick);
    };

    void audioContext.resume().catch(() => undefined);
    tick();

    return () => {
      window.cancelAnimationFrame(frameId);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close().catch(() => undefined);
      onLevel(0);
    };
  } catch {
    onLevel(0);
    return () => onLevel(0);
  }
}

function createIncomingRingTone() {
  if (typeof window === 'undefined') return () => undefined;

  const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return () => undefined;

  try {
    const audioContext = new AudioContextCtor();
    let cancelled = false;
    let timerId: number | undefined;

    const playBurst = () => {
      if (cancelled) return;
      const now = audioContext.currentTime;
      const gain = audioContext.createGain();
      const lowTone = audioContext.createOscillator();
      const highTone = audioContext.createOscillator();

      lowTone.type = 'sine';
      highTone.type = 'sine';
      lowTone.frequency.setValueAtTime(440, now);
      highTone.frequency.setValueAtTime(554, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
      gain.gain.setValueAtTime(0.08, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      lowTone.connect(gain);
      highTone.connect(gain);
      gain.connect(audioContext.destination);
      lowTone.start(now);
      highTone.start(now);
      lowTone.stop(now + 0.75);
      highTone.stop(now + 0.75);

      window.setTimeout(() => {
        lowTone.disconnect();
        highTone.disconnect();
        gain.disconnect();
      }, 900);
      timerId = window.setTimeout(playBurst, 1600);
    };

    void audioContext
      .resume()
      .then(playBurst)
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
      void audioContext.close().catch(() => undefined);
    };
  } catch {
    return () => undefined;
  }
}

export function formatWebphoneDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number) {
  return formatWebphoneDuration(totalSeconds);
}

export function formatWebphoneLogTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stopPhone(ua?: UA | null, session?: RTCSession | null) {
  try {
    if (session && !session.isEnded()) session.terminate();
  } catch {
    // Ignore shutdown races from browser media/SIP state.
  }

  try {
    ua?.stop();
  } catch {
    // Ignore shutdown races from browser media/SIP state.
  }
}
