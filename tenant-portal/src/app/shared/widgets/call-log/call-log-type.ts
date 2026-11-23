import type { CallLog } from '../../../core/phone/phone.model';
import type { CallLogColumn, CallLogRow, CallLogType } from './call-log.model';

export type {
  CallLogColumn,
  CallLogLoader,
  CallLogQuery,
  CallLogRow,
  CallLogType,
  CallRecordType,
} from './call-log.model';

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
    labelKey: 'callLog.types.IN_ANS',
    missed: false,
    answered: true,
  },
  IN_NOANS: {
    icon: 'tablerPhoneX',
    tile: 'bg-icon-red',
    labelKey: 'callLog.types.IN_NOANS',
    missed: true,
    answered: false,
  },
  IN_BUSY: {
    icon: 'tablerPhoneOff',
    tile: 'bg-icon-gray',
    labelKey: 'callLog.types.IN_BUSY',
    missed: false,
    answered: false,
  },
  OUT_ANS: {
    icon: 'tablerPhoneOutgoing',
    tile: 'bg-icon-blue',
    labelKey: 'callLog.types.OUT_ANS',
    missed: false,
    answered: true,
  },
  OUT_NOANS: {
    icon: 'tablerPhoneOutgoing',
    tile: 'bg-icon-orange',
    labelKey: 'callLog.types.OUT_NOANS',
    missed: false,
    answered: false,
  },
  OUT_BUSY: {
    icon: 'tablerPhoneOff',
    tile: 'bg-icon-orange',
    labelKey: 'callLog.types.OUT_BUSY',
    missed: false,
    answered: false,
  },
  OUT: {
    icon: 'tablerPhoneOutgoing',
    tile: 'bg-icon-gray',
    labelKey: 'callLog.types.OUT',
    missed: false,
    answered: false,
  },
};

const MS_PER_DAY = 86_400_000;

/**
 * Named column-track utility for a call-log table row (`grid-cols-call-log-*` in styles/utilities.css).
 * Supported layouts: type, party | owner, date, duration, optionally followed by actions.
 */
export function callLogGridClass(columns: readonly CallLogColumn[]): string {
  const withActions = columns.includes('actions');
  if (columns.includes('owner')) {
    return withActions ? 'grid-cols-call-log-owner-row-actions' : 'grid-cols-call-log-owner-row';
  }
  return withActions ? 'grid-cols-call-log-party-row-actions' : 'grid-cols-call-log-party-row';
}

export function callLogTypeLook(type: CallLogType): CallLogTypeLook {
  return CALL_LOG_TYPE_MAP[type];
}

export function callLogDayGroup(iso: string | null, now = new Date()): CallLogDayKey {
  if (!iso) return 'earlier';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'earlier';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfItem = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfItem) / MS_PER_DAY);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'earlier';
}

export function isCallRowAnswered(item: Pick<CallLogRow, 'type' | 'durationSeconds'>): boolean {
  return item.durationSeconds !== null && (CALL_LOG_TYPE_MAP[item.type].answered || item.durationSeconds > 0);
}

export function formatCallDuration(item: Pick<CallLogRow, 'type' | 'durationSeconds'>): string | null {
  if (!isCallRowAnswered(item)) return null;
  const totalSeconds = Math.max(0, Math.floor(item.durationSeconds ?? 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatCallTime(iso: string | null, timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '00:00';
  if (timeZone) return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatCallDateTime(iso: string | null, lang: 'ar' | 'en', timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (timeZone) {
    const parts = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    return `${part('day')} ${part('month')} ${part('year')} · ${formatCallTime(iso, timeZone)}`;
  }
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { month: 'short' }).format(date);
  const year = date.getFullYear();
  return `${day} ${month} ${year} · ${formatCallTime(iso)}`;
}

export function callRecordRoute(record: CallLogRow['record']): string | null {
  if (!record || !record.label || !record.type || !record.id) return null;
  switch (record.type) {
    case 'LEAD':
      return `/crm/leads/${record.id}`;
    case 'CUSTOMER_PROFILE':
      return `/crm/customers/${record.id}`;
    case 'OPPORTUNITY':
      return `/crm/opportunities/${record.id}`;
    case 'PARTY':
      return '/workspace/operations/party-directory';
  }
}

export function toCallLogRow(item: CallLog): CallLogRow {
  const answered = (CALL_LOG_TYPE_MAP[item.type].answered || item.answeredAt !== null) && item.durationSeconds !== null;
  return {
    id: item.id,
    type: item.type,
    number: item.phoneNumber,
    name: item.displayName ?? item.sourceLabel,
    startedAt: item.startedAt ?? item.createdAt,
    durationSeconds: answered ? item.durationSeconds : null,
    ownerName: item.ownerName ?? null,
    record:
      item.sourceType && item.sourceId
        ? { type: item.sourceType, id: item.sourceId, label: item.sourceLabel ?? item.displayName ?? item.phoneNumber }
        : null,
    linkKind: null,
  };
}
