export type IceKind = 'STUN' | 'TURN';
export type IceTransportPolicy = 'all' | 'relay';
export type WebsocketProtocol = 'wss' | 'ws';

export interface IceEntry {
  id: string;
  kind: IceKind;
  urls: string[];
  username: string | null;
  credentialConfigured: boolean;
  enabled: boolean;
}

export interface PhoneServer {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  sipDomain: string;
  websocketUrl: string;
  realm: string | null;
  outboundProxy: string | null;
  fromDomain: string | null;
  registrarServer: string | null;
  contactUri: string | null;
  registerExpires: number;
  defaultCallerId: string | null;
  iceTransportPolicy: IceTransportPolicy;
  iceEnabled: boolean;
  traceSip: boolean;
  sessionTimers: boolean;
  allowInvalidTlsCertificate: boolean;
  defaultTimeoutSeconds: number | null;
  defaultMaxRetries: number | null;
  iceServers: IceEntry[];
}

export interface PhoneConfig {
  enabled: boolean;
}

export interface PhoneSeats {
  allowed: number;
  occupied: number;
  available: number;
  overAllowance: boolean;
}

export interface CreatePhoneServerBody {
  name: string;
  sipDomain: string;
  websocketUrl: string;
  enabled?: boolean;
}

export interface UpdatePhoneServerPatch {
  name?: string;
  enabled?: boolean;
  sipDomain?: string;
  websocketUrl?: string;
  realm?: string | null;
  outboundProxy?: string | null;
  fromDomain?: string | null;
  registrarServer?: string | null;
  contactUri?: string | null;
  registerExpires?: number;
  defaultCallerId?: string | null;
  iceTransportPolicy?: IceTransportPolicy;
  iceEnabled?: boolean;
  traceSip?: boolean;
  sessionTimers?: boolean;
  allowInvalidTlsCertificate?: boolean;
  defaultTimeoutSeconds?: number | null;
  defaultMaxRetries?: number | null;
}

export interface CreateIceEntryBody {
  kind: IceKind;
  urls: string[];
  username?: string | null;
  credential?: string | null;
  enabled?: boolean;
}

export interface UpdateIceEntryPatch {
  kind?: IceKind;
  urls?: string[];
  username?: string | null;
  credential?: string | null;
  enabled?: boolean;
}

export interface IceEntryDraft {
  uid: string;
  id: string | null;
  kind: IceKind;
  urlsText: string;
  username: string;
  credentialConfigured: boolean;
  credentialAction: 'keep' | 'set' | 'clear';
  credentialValue: string;
  enabled: boolean;
}

export interface IceEntryValidationErrors {
  urls?: string | null;
  username?: string | null;
  credential?: string | null;
  entry?: string | null;
}

export const PHONE_SERVER_LIMIT = 10;
export const PHONE_SERVER_NAME_MAX = 80;
export const REGISTER_EXPIRES_MIN = 30;
export const REGISTER_EXPIRES_MAX = 86_400;
export const REGISTER_EXPIRES_DEFAULT = 600;
export const TIMEOUT_SECONDS_MIN = 3;
export const TIMEOUT_SECONDS_MAX = 120;
export const TIMEOUT_SECONDS_DEFAULT = 10;
export const MAX_RETRIES_MIN = 0;
export const MAX_RETRIES_MAX = 10;
export const MAX_RETRIES_DEFAULT = 2;

export const WEBSOCKET_URL_PATTERN = /^wss?:\/\/\S+$/i;
export const SIP_DOMAIN_PATTERN = /^[a-z0-9.-]+(:[0-9]+)?$/i;
export const ICE_URL_PATTERN = /^(stun|stuns|turn|turns):\S+$/i;
export const SIP_URI_PATTERN = /^sips?:\S+$/i;
export const CALLER_ID_PATTERN = /^\+?[0-9]+$/;

export function protocolOfUrl(url: string): WebsocketProtocol {
  return /^ws:\/\//i.test(url.trim()) ? 'ws' : 'wss';
}

export function rewriteUrlScheme(url: string, scheme: WebsocketProtocol): string {
  const trimmed = url.trim();
  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^wss?:\/\//i, `${scheme}://`);
  }
  return trimmed ? `${scheme}://${trimmed}` : `${scheme}://`;
}

export function parseIceUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function hasEnabledTurn(entries: readonly { kind: IceKind; enabled: boolean }[]): boolean {
  return entries.some((entry) => entry.kind === 'TURN' && entry.enabled);
}
