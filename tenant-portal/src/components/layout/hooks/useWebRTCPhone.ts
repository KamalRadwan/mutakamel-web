'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { RTCSession } from 'jssip/lib/RTCSession';
import type { UA } from 'jssip';
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
  const pathname = usePathname();
  const shouldActivate = typeof window !== 'undefined' && pathname !== '/login';

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
  const [autoAnswer, setAutoAnswerState] = useState(false);
  const [doNotDisturb, setDoNotDisturbState] = useState(false);
  const [callLogs, setCallLogs] = useState<WebphoneCallLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [micVolume, setMicVolumeState] = useState(() => readNumberPreference(WEBPHONE_STORAGE_KEYS.micVolume, 100));
  const [speakerVolume, setSpeakerVolumeState] = useState(() => readNumberPreference(WEBPHONE_STORAGE_KEYS.speakerVolume, 100));
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [timerLabel, setTimerLabel] = useState('00:00');
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  const setAutoAnswer = (enabled: boolean) => {
    autoAnswerRef.current = enabled;
    setAutoAnswerState(enabled);
  };

  const setDoNotDisturb = (enabled: boolean) => {
    doNotDisturbRef.current = enabled;
    setDoNotDisturbState(enabled);
  };

  const handleSetExpanded = (value: boolean | ((prev: boolean) => boolean)) => {
    setExpanded((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      writePreference(WEBPHONE_STORAGE_KEYS.expanded, next);
      return next;
    });
  };

  const setMicVolumeLevel = (value: string | number) => {
    const next = Math.max(0, Math.min(100, typeof value === 'number' ? value : Number(value)));
    setMicVolumeState(next);
    writePreference(WEBPHONE_STORAGE_KEYS.micVolume, next);
  };

  const setSpeakerVolumeLevel = (value: string | number) => {
    const next = Math.max(0, Math.min(100, typeof value === 'number' ? value : Number(value)));
    setSpeakerVolumeState(next);
    writePreference(WEBPHONE_STORAGE_KEYS.speakerVolume, next);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = speakerMuted ? 0 : next / 100;
    }
  };

  const toggleMute = () => {
    const session = sessionRef.current;
    if (!session || !localStreamRef.current) {
      setMuted((prev) => !prev);
      return;
    }

    const targetState = !muted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !targetState;
    });

    if (targetState) {
      session.mute({ audio: true, video: false });
    } else {
      session.unmute({ audio: true, video: false });
    }

    setMuted(targetState);
  };

  const toggleSpeakerMute = () => {
    setSpeakerMuted((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? 0 : speakerVolume / 100;
      }
      return next;
    });
  };

  const toggleHold = () => {
    const session = sessionRef.current as any;
    if (!session) return;

    if (session.isLocalHeld?.() || session.isOnHold?.()?.local) {
      session.unhold?.();
      setHeld(false);
    } else {
      session.hold?.();
      setHeld(true);
    }
  };

  const pressDigit = (digit: string) => {
    playDtmfTone(digit, speakerVolume);
    setDialTarget((prev) => prev + digit);

    if (sessionRef.current && (callState === 'active' || callState === 'ringing' || callState === 'calling')) {
      sessionRef.current.sendDTMF(digit);
    }
  };

  const deleteLastDigit = () => {
    setDialTarget((prev) => prev.slice(0, -1));
  };

  const copyNumber = () => {
    if (dialTarget && typeof navigator !== 'undefined') {
      void navigator.clipboard.writeText(dialTarget);
    }
  };

  const makeCall = async () => {
    if (!settings?.sipDomain || !dialTarget.trim()) return;

    try {
      const targetUri = normalizeCallTarget(dialTarget, settings.sipDomain);
      setStatus('Connecting...');
      setCallState('calling');
      handleSetExpanded(true);

      if (!uaRef.current) {
        await phoneLifecycleRef.current.connectPhone();
      }

      if (uaRef.current) {
        uaRef.current.call(targetUri, {
          mediaConstraints: { audio: true, video: false },
          pcConfig: { iceServers: iceServersFromSettings(settings) },
        });
      }
    } catch {
      setStatus('Call Failed');
      setCallState('failed');
    }
  };

  const answerCall = () => {
    const session = sessionRef.current;
    if (!session) return;

    phoneLifecycleRef.current.stopIncomingRingTone();
    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: iceServersFromSettings(settings) },
    });
    setIncomingPopupDismissed(true);
  };

  const declineCall = () => {
    const session = sessionRef.current;
    phoneLifecycleRef.current.stopIncomingRingTone();

    if (session) {
      session.terminate({ status_code: 486, reason_phrase: 'Busy Here' });
    }

    setIncomingPopupDismissed(true);
    setCallState('idle');
  };

  const hangupCall = () => {
    const session = sessionRef.current;
    phoneLifecycleRef.current.stopIncomingRingTone();

    if (session) {
      session.terminate();
    }

    setCallState('idle');
  };

  const dismissIncomingPopup = () => {
    setIncomingPopupDismissed(true);
  };

  const ready = isWebphoneReady(settings, webphone);
  const callBusy = callState !== 'idle';
  const callActive = callState === 'active';
  const incomingCallWaiting = callState === 'incoming';
  const showIncomingPopup = incomingCallWaiting && !incomingPopupDismissed;
  const canCall = ready && !callBusy && Boolean(dialTarget.trim());

  const callPeerNumber = remoteParty || dialTarget;
  const callPeerName = webphone?.displayName || callPeerNumber;

  return [
    {
      shouldRender: shouldActivate && ready,
      expanded,
      setExpanded: handleSetExpanded,
      activeTab,
      setActiveTab,
      connectionState,
      callState,
      status,
      dialTarget,
      setDialTarget,
      displayNumber: dialTarget,
      remoteParty,
      muted,
      speakerMuted,
      held,
      autoAnswer,
      setAutoAnswer,
      doNotDisturb,
      setDoNotDisturb,
      callLogs,
      logsLoading,
      micVolume,
      speakerVolume,
      setMicVolumeLevel,
      setSpeakerVolumeLevel,
      micLevel,
      speakerLevel,
      timerLabel,
      mediaNotice,
      ready,
      callBusy,
      callActive,
      incomingCallWaiting,
      showIncomingPopup,
      canCall,
      callPeerNumber,
      callPeerName,
      phoneDisplayName: webphone?.displayName || webphone?.extension || 'WebPhone',
      keypad,
      toggleMute,
      toggleSpeakerMute,
      toggleHold,
      pressDigit,
      deleteLastDigit,
      copyNumber,
      makeCall,
      answerCall,
      declineCall,
      hangupCall,
      dismissIncomingPopup,
    },
    remoteAudioRef,
  ] as const;
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}

function readNumberPreference(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function writePreference(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(value));
}

export function formatWebphoneLogTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
