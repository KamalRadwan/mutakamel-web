import type { DocumentKind } from './document.model';

export type StatusField = 'lifecycle' | 'approval' | 'hold' | 'dispatch';
export type StatusTone = 'none' | 'wait' | 'ok' | 'bad';

export interface StatusBadge {
  labelKey: string;
  tone: StatusTone;
}

export const STATUS_TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  none: 'bg-status-none text-on-neutral-soft',
  wait: 'bg-warning text-on-warning',
  ok: 'bg-success text-on-success',
  bad: 'bg-danger text-on-danger',
};

const LIFECYCLE_TONES: Readonly<Record<string, StatusTone>> = {
  DRAFT: 'none',
  SENT: 'wait',
  ACCEPTED: 'ok',
  CONVERTED: 'ok',
  CONFIRMED: 'ok',
  CLOSED: 'ok',
  ISSUED: 'ok',
  REJECTED: 'bad',
  CANCELLED: 'bad',
  EXPIRED: 'bad',
};

const APPROVAL_TONES: Readonly<Record<string, StatusTone>> = {
  NOT_REQUIRED: 'none',
  PENDING: 'wait',
  APPROVED: 'ok',
  REJECTED: 'bad',
  WITHDRAWN: 'none',
};

const HOLD_TONES: Readonly<Record<string, StatusTone>> = {
  NONE: 'none',
  HELD: 'wait',
};

const DISPATCH_TONES: Readonly<Record<string, StatusTone>> = {
  NOT_REQUESTED: 'none',
  REQUESTED: 'wait',
  SENT: 'ok',
  FAILED: 'bad',
};

function lookupTone(table: Readonly<Record<string, StatusTone>>, value: string): StatusTone {
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : 'none';
}

export function statusBadge(_kind: DocumentKind, field: StatusField, value: string): StatusBadge {
  switch (field) {
    case 'lifecycle':
      return {
        labelKey: `td.status.${value}`,
        tone: lookupTone(LIFECYCLE_TONES, value),
      };
    case 'approval':
      return {
        labelKey: `td.approval.${value}`,
        tone: lookupTone(APPROVAL_TONES, value),
      };
    case 'hold':
      return {
        labelKey: `td.hold.${value}`,
        tone: lookupTone(HOLD_TONES, value),
      };
    case 'dispatch':
      return {
        labelKey: `td.dispatch.${value}`,
        tone: lookupTone(DISPATCH_TONES, value),
      };
  }
}
