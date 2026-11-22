import type { Language } from '../../../../../core/i18n/language';

export const SESSION_CLIENT_TYPES = ['WEB', 'IOS', 'ANDROID', 'DESKTOP'] as const;
export type SessionClientType = (typeof SESSION_CLIENT_TYPES)[number];

export const SESSION_END_REASONS = [
  'LOGOUT',
  'LOGOUT_ALL',
  'PASSWORD_CHANGED',
  'USER_DISABLED',
  'USER_DELETED',
  'ADMIN_REVOKED',
  'DEVICE_REVOKED',
  'CREDENTIAL_COMPROMISED',
  'IDLE_EXPIRED',
  'ABSOLUTE_EXPIRED',
  'DEVICE_KEY_LOST',
  'SESSION_LIMIT',
  'LEGACY_CUTOVER',
] as const;
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

export interface AuthSession {
  id: string;
  clientType: SessionClientType;
  clientId: string;
  deviceLabel: string | null;
  createdAt: string;
  lastRefreshAt: string | null;
  lastAccessIssuedAt: string;
  lastUserActivityAt: string | null;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  endedAt: string | null;
  endReason: SessionEndReason | null;
  // Decimal strings from core API — never parse as numbers.
  refreshUseCount: string;
  accessIssueCount: string;
  credentialVersion: number;
  sessionEpoch: number;
  current: boolean;
}

export interface SessionList {
  items: AuthSession[];
  endedHistory: {
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export const SESSION_HISTORY_PAGE_SIZE = 50;

export function lastActive(s: AuthSession): string {
  return s.lastUserActivityAt ?? s.lastAccessIssuedAt;
}

export function expiresAt(s: AuthSession): string {
  const idleMs = Date.parse(s.idleExpiresAt);
  const absMs = Date.parse(s.absoluteExpiresAt);
  if (Number.isNaN(idleMs)) return s.absoluteExpiresAt;
  if (Number.isNaN(absMs)) return s.idleExpiresAt;
  return idleMs <= absMs ? s.idleExpiresAt : s.absoluteExpiresAt;
}

const KNOWN_END_REASONS: ReadonlySet<string> = new Set(SESSION_END_REASONS);

const CLIENT_ICONS: Readonly<Record<SessionClientType, string>> = {
  WEB: 'tablerWorld',
  IOS: 'tablerDeviceMobile',
  ANDROID: 'tablerDeviceMobile',
  DESKTOP: 'tablerDeviceDesktop',
};

const DATE_FORMATTERS: Record<Language, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }),
  ar: new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }),
};

const DATE_TIME_FORMATTERS: Record<Language, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-u-nu-latn', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
  ar: new Intl.DateTimeFormat('ar-u-nu-latn', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
};

const RELATIVE_FORMATTERS: Record<Language, Intl.RelativeTimeFormat> = {
  en: new Intl.RelativeTimeFormat('en-u-nu-latn', { numeric: 'auto' }),
  ar: new Intl.RelativeTimeFormat('ar-u-nu-latn', { numeric: 'auto' }),
};

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export function sessionDeviceIcon(clientType: SessionClientType): string {
  return CLIENT_ICONS[clientType];
}

export function sessionEndReasonKey(reason: string | null | undefined): string {
  return reason && KNOWN_END_REASONS.has(reason)
    ? `wsAccSessions.reasons.${reason}`
    : 'wsAccSessions.reasons.unknown';
}

export function formatSessionDate(iso: string, lang: Language): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return DATE_FORMATTERS[lang].format(new Date(ms));
}

export function formatSessionDateTime(iso: string, lang: Language): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return DATE_TIME_FORMATTERS[lang].format(new Date(ms));
}

export function formatRelativeTime(iso: string, lang: Language, nowMs = Date.now()): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const diffMs = ms - nowMs;
  const rtf = RELATIVE_FORMATTERS[lang];

  const minutes = Math.round(diffMs / MS_PER_MINUTE);
  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes === 0 ? 0 : minutes, 'minute');
  }

  const hours = Math.round(diffMs / MS_PER_HOUR);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours === 0 ? 0 : hours, 'hour');
  }

  const days = Math.round(diffMs / MS_PER_DAY);
  return rtf.format(days === 0 ? 0 : days, 'day');
}
