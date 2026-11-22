import type { PhoneState } from '../../core/phone/phone';
import type { listCallLogs } from '../../core/phone/phone.api';

export type CallLogEntry = Awaited<ReturnType<typeof listCallLogs>>['data'][number];
export type CallLogType = CallLogEntry['type'];
export type CallSource = NonNullable<Parameters<PhoneState['call']>[1]>;
export type PhoneBlock = ReturnType<PhoneState['block']>;
export type PhonePrefs = ReturnType<PhoneState['prefs']>;

export type CallLogDayKey = 'today' | 'yesterday' | 'earlier';

export interface CallLogTypeLook {
  readonly icon: string;
  readonly tile: string;
  readonly labelKey: string;
  readonly missed: boolean;
  readonly answered: boolean;
}

export const CALL_LOG_FILTER_TYPES: readonly CallLogType[] = [
  'IN_ANS',
  'IN_NOANS',
  'IN_BUSY',
  'OUT_ANS',
  'OUT_NOANS',
  'OUT_BUSY',
];

export const CALL_LOG_TYPE_MAP: Readonly<Record<CallLogType, CallLogTypeLook>> = {
  IN_ANS: {
    icon: 'tablerPhoneIncoming',
    tile: 'bg-icon-green',
    labelKey: 'phoneCalls.types.IN_ANS',
    missed: false,
    answered: true,
  },
  IN_NOANS: {
    icon: 'tablerPhoneX',
    tile: 'bg-icon-red',
    labelKey: 'phoneCalls.types.IN_NOANS',
    missed: true,
    answered: false,
  },
  IN_BUSY: {
    icon: 'tablerPhoneOff',
    tile: 'bg-icon-gray',
    labelKey: 'phoneCalls.types.IN_BUSY',
    missed: false,
    answered: false,
  },
  OUT_ANS: {
    icon: 'tablerPhoneOutgoing',
    tile: 'bg-icon-blue',
    labelKey: 'phoneCalls.types.OUT_ANS',
    missed: false,
    answered: true,
  },
  OUT_NOANS: {
    icon: 'tablerPhoneOutgoing',
    tile: 'bg-icon-orange',
    labelKey: 'phoneCalls.types.OUT_NOANS',
    missed: false,
    answered: false,
  },
  OUT_BUSY: {
    icon: 'tablerPhoneOff',
    tile: 'bg-icon-orange',
    labelKey: 'phoneCalls.types.OUT_BUSY',
    missed: false,
    answered: false,
  },
  OUT: {
    icon: 'tablerPhoneOutgoing',
    tile: 'bg-icon-gray',
    labelKey: 'phoneCalls.types.OUT',
    missed: false,
    answered: false,
  },
};

export const CALL_HISTORY_TABLE_COLUMNS =
  'minmax(0, 1.15fr) minmax(0, 1.35fr) minmax(0, 1.45fr) minmax(0, 0.7fr) var(--table-head-h)';

const MS_PER_DAY = 86_400_000;

export function callLogTypeLook(type: CallLogType): CallLogTypeLook {
  return CALL_LOG_TYPE_MAP[type];
}

export function callLogTimestamp(item: Pick<CallLogEntry, 'startedAt' | 'createdAt'>): string {
  return item.startedAt ?? item.createdAt;
}

export function callLogDayGroup(iso: string, now = new Date()): CallLogDayKey {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'earlier';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfItem = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfItem) / MS_PER_DAY);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'earlier';
}

export function isCallAnswered(item: Pick<CallLogEntry, 'type' | 'answeredAt' | 'durationSeconds'>): boolean {
  return (CALL_LOG_TYPE_MAP[item.type].answered || item.answeredAt !== null) && item.durationSeconds !== null;
}

export function formatCallDuration(item: Pick<CallLogEntry, 'type' | 'answeredAt' | 'durationSeconds'>): string | null {
  if (!isCallAnswered(item)) return null;
  const totalSeconds = Math.max(0, Math.floor(item.durationSeconds ?? 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatCallTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '00:00';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatCallDateTime(iso: string, lang: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { month: 'short' }).format(date);
  const year = date.getFullYear();
  return `${day} ${month} ${year} · ${formatCallTime(iso)}`;
}

export function callSourceOf(item: Pick<CallLogEntry, 'sourceType' | 'sourceId' | 'sourceLabel' | 'displayName' | 'phoneNumber'>): CallSource | null {
  if (!item.sourceType || !item.sourceId) return null;
  const label = item.sourceLabel ?? item.displayName ?? item.phoneNumber;
  return { type: item.sourceType, id: item.sourceId, label };
}

export function callRecordRoute(item: Pick<CallLogEntry, 'sourceType' | 'sourceId' | 'sourceLabel'>): string | null {
  if (!item.sourceLabel || !item.sourceType || !item.sourceId) return null;
  switch (item.sourceType) {
    case 'LEAD':
      return `/crm/leads/${item.sourceId}`;
    case 'CUSTOMER_PROFILE':
      return `/crm/customers/${item.sourceId}`;
    case 'OPPORTUNITY':
      return `/crm/opportunities/${item.sourceId}`;
    case 'PARTY':
      return '/workspace/operations/party-directory';
  }
}
