'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { RTCSession } from 'jssip/lib/RTCSession';
import type { UA } from 'jssip';
import { useAuth } from '@/context/AuthContext';
import { playDtmfTone } from '../utils/dtmfAudio';
import { createMyWebphoneCallLog, loadAsteriskSettings, loadMyWebphoneCallLogs, loadMyWebphoneConfig } from '../webphone/api';
import { iceServersFromSettings, isWebphoneReady, normalizeCallTarget, sipUri } from '../webphone/config';
import type {
  ActiveCallContext,
  AdminWebphoneConfig,
  AsteriskIntegrationSettings,
  CreateWebphoneCallLogPayload,
  WebphoneCallLog,
  WebphoneCallState,
  WebphoneConnectionState,
  WebphoneTab,
} from '../webphone/types';

type PhoneLifecycle = {
  connectPhone: () => Promise<void>;
  resetRemoteAudio: () => void;
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

const idlePhoneLifecycle: PhoneLifecycle = {
  connectPhone: async () => undefined,
  resetRemoteAudio: () => undefined,
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

export function useWebRTCPhone() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const shouldActivate = isAuthenticated && pathname !== '/login';

  const uaRef = useRef<UA | null>(null);
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

  const [shouldRender, setShouldRender] = useState(false);
  const [expanded, setExpanded] = useState(() => readBooleanPreference(WEBPHONE_STORAGE_KEYS.expanded, false));
  const [incomingPopupDismissed, setIncomingPopupDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState<WebphoneTab>('phone');
  const [settings, setSettings] = useState<AsteriskIntegrationSettings>();
  const [webphone, setWebphone] = useState<AdminWebphoneConfig>();
  const [connectionState, setConnectionState] = useState<WebphoneConnectionState>('idle');
  const [callState, setCallState] = useState<WebphoneCallState>('idle');
  const [status, setStatus] = useState('WebPhone');
  const [dialTarget, setDialTarget] = useState('');
  const [remoteParty, setRemoteParty] = useState('');
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [micVolume, setMicVolume] = useState(() => readVolumePreference(WEBPHONE_STORAGE_KEYS.micVolume, 70));
  const [speakerVolume, setSpeakerVolume] = useState(() => readVolumePreference(WEBPHONE_STORAGE_KEYS.speakerVolume, 60));
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [lastCallDuration, setLastCallDuration] = useState<string>();
  const [mediaNotice, setMediaNotice] = useState<string>();
  const [activeCallContext, setActiveCallContext] = useState<ActiveCallContext | null>(null);
  const [callLogs, setCallLogs] = useState<WebphoneCallLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    phoneLifecycleRef.current = {
      connectPhone,
      resetRemoteAudio,
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
    if (!shouldActivate) return;

    let cancelled = false;

    async function loadPhone() {
      setConnectionState('loading');
      setStatus('Loading phone');

      try {
        const loadedWebphone = await loadMyWebphoneConfig();
        if (cancelled) return;

        setWebphone(loadedWebphone);
        setShouldRender(Boolean(loadedWebphone.enabled));

        if (!loadedWebphone.enabled) {
          setConnectionState('offline');
          setStatus('Disabled');
          return;
        }

        const loadedSettings = await loadAsteriskSettings();
        if (cancelled) return;

        setSettings(loadedSettings);
        const ready = isWebphoneReady(loadedSettings, loadedWebphone);
        setConnectionState(ready ? 'ready' : 'offline');
        setStatus(ready ? 'Ready' : 'Not configured');
      } catch (error) {
        if (cancelled) return;
        setConnectionState('error');
        setStatus(readPhoneError(error, 'Unavailable'));
      }
    }

    void loadPhone();

    return () => {
      cancelled = true;
      phoneLifecycleRef.current.stopIncomingRingTone();
      phoneLifecycleRef.current.stopLocalAudioStream();
      phoneLifecycleRef.current.resetRemoteAudio();
      stopPhone(uaRef.current, sessionRef.current);
      uaRef.current = null;
      sessionRef.current = null;
    };
  }, [shouldActivate]);

  useEffect(() => {
    if (!isWebphoneReady(settings, webphone)) return;
    if (uaRef.current || connectionState === 'connecting' || connectionState === 'registered') {
      return;
    }
    void phoneLifecycleRef.current.connectPhone();
  }, [connectionState, settings, webphone]);

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
        const logs = await loadMyWebphoneCallLogs();
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
  }, [activeTab, shouldRender]);

  useEffect(() => {
    if (!shouldActivate) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled || typeof window === 'undefined') return;
      if (!window.isSecureContext) {
        setMediaNotice('Microphone requires HTTPS');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNotice('Microphone unavailable');
        return;
      }
      setMediaNotice(undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [shouldActivate]);

  async function connectPhone() {
    if (!isWebphoneReady(settings, webphone) || !settings || !webphone) {
      return;
    }

    if (uaRef.current) {
      uaRef.current.register();
      return;
    }

    setConnectionState('connecting');
    setStatus('Connecting');

    try {
      const JsSIP = await import('jssip');
      const socket = new JsSIP.WebSocketInterface(settings.websocketUrl!);
      const extraHeaders = settings.outboundProxy ? [`Route: <${settings.outboundProxy}>`] : undefined;
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: sipUri(webphone.sipUsername!, settings.sipDomain!),
        authorization_user: webphone.sipUsername ?? undefined,
        password: webphone.sipPassword ?? undefined,
        display_name: webphone.displayName ?? webphone.extension ?? undefined,
        realm: settings.realm ?? undefined,
        register: true,
        register_expires: settings.registerExpires ?? 600,
        registrar_server: settings.registrarServer ?? undefined,
        contact_uri: settings.contactUri ?? undefined,
        session_timers: settings.sessionTimers ?? false,
        extra_headers: extraHeaders,
      });

      ua.on('connected', () => {
        setConnectionState('connecting');
        setStatus('Socket connected');
      });
      ua.on('registered', () => {
        setConnectionState('registered');
        setStatus('Registered');
      });
      ua.on('registrationFailed', (event) => {
        setConnectionState('error');
        setStatus(event.cause ? `Registration failed: ${event.cause}` : 'Registration failed');
      });
      ua.on('disconnected', () => {
        uaRef.current = null;
        setConnectionState('offline');
        setStatus('Disconnected');
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
      ua.start();
    } catch (error) {
      setConnectionState('error');
      setStatus(readPhoneError(error, 'Connect failed'));
    }
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
    setStatus(incoming ? 'Incoming call' : 'Calling');

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
        setStatus('Incoming call');
        return;
      }
      setCallState('ringing');
      setStatus('Ringing');
    });
    session.on('accepted', markCallAnswered);
    session.on('confirmed', markCallAnswered);
    session.on('ended', () => finishCall('ended', 'Call ended'));
    session.on('failed', (event) => finishCall('failed', event.cause ? `Failed: ${event.cause}` : 'Call failed'));
    session.on('hold', () => setHeld(true));
    session.on('unhold', () => setHeld(false));
    session.on('muted', () => setMuted(true));
    session.on('unmuted', () => setMuted(false));

    if (incoming && autoAnswerRef.current) {
      window.setTimeout(() => answerCall(session), 250);
    }
  }

  async function makeCall() {
    if (!uaRef.current || !settings?.sipDomain || !dialTarget.trim()) return;

    if (!uaRef.current.isRegistered()) {
      setConnectionState('connecting');
      setStatus('Registering');
      uaRef.current.register();
      return;
    }

    const target = normalizeCallTarget(dialTarget, settings.sipDomain);
    setCurrentActiveCallContext({
      direction: 'outgoing',
      number: dialTarget.trim(),
      displayName: null,
      startedAt: nowIso(),
    });
    setCallState('calling');
    setStatus('Starting call');

    try {
      tracePhone(settings, 'call.start', { target });
      const localStream = await getLocalAudioStream();
      const session = uaRef.current.call(target, {
        eventHandlers: {
          peerconnection: ({ peerconnection }) => bindPeerConnection(peerconnection),
          icecandidate: createIceCandidateHandler(),
        },
        mediaConstraints: { audio: true, video: false },
        mediaStream: localStream,
        pcConfig: { iceServers: iceServersFromSettings(settings) },
        rtcOfferConstraints: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        },
        fromDisplayName: webphone?.displayName ?? undefined,
        fromUserName: webphone?.outboundCallerId ?? settings.defaultCallerId ?? webphone?.extension ?? undefined,
      });
      bindSession(session, false);
    } catch (error) {
      tracePhone(settings, 'call.failed_before_invite', {
        target,
        error: safeErrorDetails(error),
      });
      const message = callStartErrorMessage(error);
      setMediaNotice(mediaFailureNotice(message));
      finishCall('failed', message);
    }
  }

  function answerCall(targetSession?: any) {
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
        pcConfig: { iceServers: iceServersFromSettings(settings) },
        rtcOfferConstraints: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        },
      });
      markCallAnswered();
    } catch (error) {
      const message = callStartErrorMessage(error);
      setMediaNotice(mediaFailureNotice(message));
      finishCall('failed', message);
    }
  }

  function declineCall() {
    const session = sessionRef.current;
    if (!session || session.isEnded()) return;
    session.terminate({ status_code: 603, reason_phrase: 'Decline' });
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();
    finishCall('ended', 'Declined');
  }

  function hangupCall() {
    const session = sessionRef.current;
    if (!session || session.isEnded()) return;
    session.terminate();
    setIncomingPopupDismissed(true);
    stopIncomingRingTone();
    finishCall('ended', 'Call ended');
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
    if (callState === 'active' && sessionRef.current) {
      sessionRef.current.sendDTMF(value);
      return;
    }
    if (!callBusy) setDialTarget((current) => `${current}${value}`);
  }

  function deleteLastDigit() {
    if (callBusy) return;
    setDialTarget((current) => current.slice(0, -1));
  }

  function copyNumber() {
    const value = displayNumber.trim();
    if (!value) return;
    void navigator.clipboard?.writeText(value);
  }

  function finishCall(nextState: WebphoneCallState, nextStatus: string) {
    const context = activeCallContextRef.current;
    const durationSeconds = callStartedAtRef.current ? Math.min(86_400, elapsedSecondsSince(callStartedAtRef.current)) : 0;
    const finalDuration = callStartedAtRef.current ? formatDuration(durationSeconds) : undefined;

    if (context) {
      const completedContext = {
        ...context,
        endedAt: nowIso(),
        durationSeconds,
        cause: nextStatus.slice(0, 120),
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
    setStatus(finalDuration ? `${nextStatus} · ${finalDuration}` : nextStatus);
    setLastCallDuration(finalDuration);
    setCallDurationSeconds(0);
    setMuted(false);
    setHeld(false);
    setDialTarget('');

    window.setTimeout(() => {
      setCallState((current) => (current === nextState ? 'idle' : current));
      setRemoteParty('');
    }, 1400);
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
    setStatus('In call');
  }

  function setCurrentActiveCallContext(context: ActiveCallContext | null) {
    activeCallContextRef.current = context;
    setActiveCallContext(context);
  }

  async function saveCallLog(context: ActiveCallContext) {
    const payload: CreateWebphoneCallLogPayload = {
      type: context.direction === 'outgoing' ? 'OUT' : context.answeredAt ? 'IN_ANS' : 'IN_NOANS',
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
      const saved = await createMyWebphoneCallLog(payload);
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
          setMediaNotice('Microphone stopped');
        }
      });
      track.addEventListener('mute', () => setMediaNotice('Microphone muted'));
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

      tracePhone(settings, 'ice.candidate', {
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
        tracePhone(settings, 'ice.ready_timeout', { candidateType });
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
      .catch(() => setMediaNotice('Click to allow audio'));
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

  const canConnect = isWebphoneReady(settings, webphone);
  const registered = connectionState === 'registered';
  const callActive = callState === 'active';
  const callBusy = callState !== 'idle' && callState !== 'ended' && callState !== 'failed';
  const displayNumber = remoteParty || dialTarget;
  const timerLabel = callActive ? formatDuration(callDurationSeconds) : lastCallDuration;
  const phoneDisplayName = webphoneDisplayName(webphone, 'Admin Phone');
  const phoneIdentity = webphone?.outboundCallerId?.trim() || webphone?.extension?.trim() || status;
  const callContext = activeCallContext;
  const incomingCallWaiting = callContext?.direction === 'incoming' && callBusy && !callActive;
  const callPeerNumber = callContext?.number || displayNumber || phoneIdentity;
  const callPeerName = callContext?.displayName?.trim() || (callBusy ? callPeerNumber : phoneDisplayName);
  const visibleMicVolume = muted ? 0 : micVolume;
  const visibleSpeakerVolume = speakerMuted ? 0 : speakerVolume;
  const showIncomingPopup = incomingCallWaiting && !incomingPopupDismissed;

  useEffect(() => {
    if (showIncomingPopup) {
      startIncomingRingTone();
    } else {
      stopIncomingRingTone();
    }

    return () => stopIncomingRingTone();
  }, [showIncomingPopup]);

  return [
    {
      shouldRender: shouldActivate && shouldRender,
      expanded,
      setExpanded,
      activeTab,
      setActiveTab,
      connectionState,
      connectionLabel: connectionBadgeLabel(connectionState),
      callState,
      status,
      dialTarget,
      setDialTarget,
      displayNumber,
      phoneDisplayName,
      phoneIdentity,
      callBusy,
      callActive,
      incomingCallWaiting,
      callPeerNumber,
      callPeerName,
      timerLabel,
      mediaNotice,
      canCall: canConnect && registered && Boolean(dialTarget.trim()) && !callBusy,
      keypad,
      makeCall,
      answerCall,
      declineCall,
      hangupCall,
      dismissIncomingPopup,
      showIncomingPopup,
      copyNumber,
      deleteLastDigit,
      pressDigit,
      muted,
      toggleMute,
      speakerMuted,
      toggleSpeakerMute,
      held,
      toggleHold,
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

function webphoneDisplayName(webphone: AdminWebphoneConfig | undefined, fallback: string) {
  const configuredName = webphone?.displayName?.trim();
  if (configuredName) return configuredName;

  const fullName = [webphone?.firstName, webphone?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return fullName || fallback;
}

function connectionBadgeLabel(state: WebphoneConnectionState) {
  if (state === 'registered') return 'Registered';
  if (state === 'connecting' || state === 'loading') return 'Connecting';
  if (state === 'error') return 'Error';
  if (state === 'offline') return 'Offline';
  return 'Ready';
}

function assertMediaEnvironment() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error('Microphone requires HTTPS or localhost.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available in this browser context.');
  }
}

function tracePhone(settings: AsteriskIntegrationSettings | undefined, event: string, payload: Record<string, unknown>) {
  if (!settings?.traceSip) return;
  console.info(`[WebPhone] ${event}`, payload);
}

function safeErrorDetails(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: 'Unknown error' };
}

function readPhoneError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;
  return error.message.slice(0, 120);
}

function callStartErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  const combined = `${name} ${message}`;

  if (/permission|denied|notallowed/i.test(combined)) {
    return 'Microphone permission denied';
  }
  if (/secure|https|getUserMedia|microphone is not available/i.test(combined)) {
    return 'Microphone requires HTTPS';
  }
  return message ? `Call failed: ${message}`.slice(0, 120) : 'Call failed before invite';
}

function mediaFailureNotice(message: string) {
  return /microphone/i.test(message) ? message : undefined;
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
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
