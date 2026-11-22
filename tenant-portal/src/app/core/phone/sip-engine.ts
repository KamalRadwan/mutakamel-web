import { InjectionToken } from '@angular/core';
import { PhoneMe, PhoneServer } from './phone.model';

export type SipEngineEvent = 'connected' | 'registered' | 'registrationFailed' | 'disconnected' | 'incoming';
export type SipLegEvent =
  | 'progress'
  | 'accepted'
  | 'ended'
  | 'failed'
  | 'referAccepted'
  | 'referFailed'
  | 'remoteStream';

export interface SipCallOptions {
  fromUserName: string | null;
  fromDisplayName: string | null;
  stream: MediaStream;
}

export interface SipCauseEvent {
  cause?: string;
  statusCode?: number;
  detail?: string;
}

export interface SipEngine {
  connect(server: PhoneServer, me: PhoneMe, ice: RTCIceServer[]): Promise<void>;
  register(): void;
  unregister(): void;
  stop(): void;
  call(target: string, opts: SipCallOptions): SipLeg;
  readonly events: {
    on(event: SipEngineEvent, handler: (arg?: unknown) => void): () => void;
  };
}

export interface SipLeg {
  readonly id: string;
  readonly remoteNumber: string;
  readonly remoteName: string | null;
  readonly peer: RTCPeerConnection | null;
  answer(stream: MediaStream): void;
  terminate(status?: 480 | 486 | 603): void;
  hold(): boolean;
  unhold(): boolean;
  mute(): void;
  unmute(): void;
  dtmf(tone: string): void;
  refer(target: string, replaces?: SipLeg): void;
  on(event: SipLegEvent, handler: (arg?: unknown) => void): () => void;
}

export type SipEngineFactory = () => SipEngine;

export const SIP_ENGINE_FACTORY = new InjectionToken<SipEngineFactory>('SIP_ENGINE_FACTORY');
