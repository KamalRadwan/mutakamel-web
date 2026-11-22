import type { AnswerOptions, RTCSession } from 'jssip/lib/RTCSession';
import type { SipCauseEvent, SipLeg, SipLegEvent } from './sip-engine';

export const ICE_GATE_TIMEOUT_MS = 1_200;

export interface IceCandidateEventLike {
  candidate?: RTCIceCandidate | null;
  ready: () => void;
}

interface LegacyRemoteStreamEvent extends Event {
  stream?: MediaStream;
}

interface LegacyPeerConnection extends RTCPeerConnection {
  getRemoteStreams?: () => MediaStream[];
}

interface ReferFailurePayload {
  cause?: unknown;
  status_line?: {
    status_code?: number;
    reason_phrase?: string;
  };
}

/**
 * Releases JsSIP's ICE gathering gate as soon as a server-reflexive/relay candidate appears,
 * on end-of-candidates, or after 1 200 ms so INVITE/answer setup never stalls on slow interfaces.
 */
export function createIceGate(traceSip = false): (event: IceCandidateEventLike) => void {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let readyFn: (() => void) | null = null;

  const finish = () => {
    if (settled) return;
    settled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    readyFn?.();
  };

  return (event: IceCandidateEventLike) => {
    if (settled) return;
    readyFn = event.ready;
    const candidate = event.candidate ?? null;
    const candidateType = extractCandidateType(candidate);
    if (traceSip) {
      console.info('[phone] icecandidate', { type: candidateType ?? 'end' });
    }

    if (!candidate || candidateType === 'srflx' || candidateType === 'relay') {
      finish();
      return;
    }

    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        finish();
      }, ICE_GATE_TIMEOUT_MS);
    }
  };
}

/** Wraps one JsSIP `RTCSession` behind P2's `SipLeg` contract. */
export class JsSipLeg implements SipLeg {
  readonly id: string;
  readonly remoteNumber: string;
  readonly remoteName: string | null;
  readonly session: RTCSession;

  private readonly listeners = new Map<SipLegEvent, Set<(arg?: unknown) => void>>();
  private attachedPeer: RTCPeerConnection | null = null;
  private emittedRemoteStream: MediaStream | null = null;
  private acceptedEmitted = false;

  constructor(
    session: RTCSession,
    private readonly pcConfig: RTCConfiguration,
    private readonly traceSip = false,
  ) {
    this.id = createLegId();
    this.session = session;
    this.remoteNumber = session.remote_identity?.uri?.user ?? '';
    this.remoteName = session.remote_identity?.display_name || null;

    if (session.connection) {
      this.attachPeer(session.connection);
    }

    session.on('peerconnection', (event) => {
      if (event?.peerconnection) {
        this.attachPeer(event.peerconnection);
      }
    });
    session.on('progress', () => {
      this.emit('progress');
    });
    session.on('accepted', () => {
      this.handleAccepted();
    });
    session.on('confirmed', () => {
      this.handleAccepted();
    });
    session.on('ended', (event) => {
      this.emit('ended', { cause: event?.cause } satisfies SipCauseEvent);
    });
    session.on('failed', (event) => {
      this.emit('failed', { cause: event?.cause } satisfies SipCauseEvent);
    });
  }

  get peer(): RTCPeerConnection | null {
    return this.attachedPeer ?? (this.session.connection as RTCPeerConnection | null) ?? null;
  }

  answer(stream: MediaStream): void {
    this.session.on('icecandidate', createIceGate(this.traceSip));
    const options: AnswerOptions = {
      mediaStream: stream,
      mediaConstraints: { audio: true, video: false },
      pcConfig: this.pcConfig,
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
    };
    this.session.answer(options);
    if (this.session.connection) {
      this.attachPeer(this.session.connection);
    }
  }

  terminate(status?: 480 | 486 | 603): void {
    try {
      if (this.session.isEnded()) return;
      if (status === 603) {
        this.session.terminate({ status_code: 603, reason_phrase: 'Decline' });
      } else if (status === 486) {
        this.session.terminate({ status_code: 486, reason_phrase: 'Busy Here' });
      } else if (status === 480) {
        this.session.terminate({ status_code: 480, reason_phrase: 'Temporarily Unavailable' });
      } else {
        this.session.terminate();
      }
    } catch {
      // Terminating over a dead WebSocket throws in JsSIP; swallow so PhoneState can still clear UI state.
    }
  }

  hold(): boolean {
    try {
      return Boolean(this.session.hold());
    } catch {
      return false;
    }
  }

  unhold(): boolean {
    try {
      return Boolean(this.session.unhold());
    } catch {
      return false;
    }
  }

  mute(): void {
    this.session.mute({ audio: true });
  }

  unmute(): void {
    this.session.unmute({ audio: true });
  }

  dtmf(tone: string): void {
    this.session.sendDTMF(tone);
  }

  refer(target: string, replaces?: SipLeg): void {
    const replacesSession =
      replaces && 'session' in replaces ? (replaces as JsSipLeg).session : undefined;

    if (this.traceSip) {
      console.info('[phone] refer', {
        legId: this.id,
        target,
        attended: Boolean(replacesSession),
      });
    }

    try {
      this.session.refer(target, {
        replaces: replacesSession,
        eventHandlers: {
          requestSucceeded: () => {},
          requestFailed: (event: unknown) => {
            this.emit('referFailed', { cause: extractReferCause(event) } satisfies SipCauseEvent);
          },
          accepted: () => {
            this.emit('referAccepted');
          },
          failed: (event: unknown) => {
            this.emit('referFailed', { cause: extractReferCause(event) } satisfies SipCauseEvent);
          },
        },
      });
    } catch (error) {
      this.emit('referFailed', {
        cause: error instanceof Error ? error.message : 'Transfer failed',
      } satisfies SipCauseEvent);
    }
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

  private handleAccepted(): void {
    if (this.acceptedEmitted) return;
    this.acceptedEmitted = true;
    this.emit('accepted');
    if (!this.emittedRemoteStream && this.peer) {
      this.tryEmitLegacyRemoteStream(this.peer);
    }
  }

  private attachPeer(peer: RTCPeerConnection): void {
    if (!peer || this.attachedPeer === peer) return;
    this.attachedPeer = peer;

    if (typeof peer.addEventListener === 'function') {
      peer.addEventListener('track', (event: RTCTrackEvent) => {
        const stream =
          event.streams?.[0] ??
          (event.track ? buildSingleTrackStream(event.track) : null);
        if (stream) {
          this.emitRemoteStream(stream);
        }
      });

      (peer as EventTarget).addEventListener('addstream', (event: Event) => {
        const legacyEvent = event as LegacyRemoteStreamEvent;
        if (legacyEvent.stream) {
          this.emitRemoteStream(legacyEvent.stream);
        }
      });
    }

    this.tryEmitLegacyRemoteStream(peer);
  }

  private tryEmitLegacyRemoteStream(peer: RTCPeerConnection): void {
    if (this.emittedRemoteStream) return;
    const legacyPeer = peer as LegacyPeerConnection;
    if (typeof legacyPeer.getRemoteStreams !== 'function') return;
    const stream = legacyPeer.getRemoteStreams()?.[0] ?? null;
    if (stream) {
      this.emitRemoteStream(stream);
    }
  }

  private emitRemoteStream(stream: MediaStream): void {
    if (this.emittedRemoteStream === stream) return;
    this.emittedRemoteStream = stream;
    this.emit('remoteStream', stream);
  }

  private emit(event: SipLegEvent, arg?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(arg);
    }
  }
}

function buildSingleTrackStream(track: MediaStreamTrack): MediaStream {
  if (typeof MediaStream !== 'undefined') {
    return new MediaStream([track]);
  }
  return {
    getTracks: () => [track],
    getAudioTracks: () => (track.kind === 'audio' ? [track] : []),
  } as unknown as MediaStream;
}

function extractCandidateType(candidate: RTCIceCandidate | null): string | null {
  if (!candidate) return null;
  if (typeof candidate.type === 'string' && candidate.type.length > 0) {
    return candidate.type.toLowerCase();
  }
  if (typeof candidate.candidate === 'string') {
    const match = /\btyp\s+([a-z0-9]+)/i.exec(candidate.candidate);
    return match?.[1]?.toLowerCase() ?? null;
  }
  return null;
}

function extractReferCause(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const payload = event as ReferFailurePayload;
  if (typeof payload.cause === 'string' && payload.cause.trim().length > 0) {
    return payload.cause;
  }
  const statusLine = payload.status_line;
  if (!statusLine) return undefined;
  const code = statusLine.status_code !== undefined ? String(statusLine.status_code) : '';
  const phrase = statusLine.reason_phrase?.trim() ?? '';
  if (code && phrase) return `${code} ${phrase}`;
  return phrase || code || undefined;
}

function createLegId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `leg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
