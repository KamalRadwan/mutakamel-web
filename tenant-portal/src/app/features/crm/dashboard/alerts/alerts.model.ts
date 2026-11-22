import {
  DASH,
  formatNumber,
  formatPercent,
  formatValue,
} from '../../../../shared/ui/chart/chart-format';
import type { SeriesUnit } from '../../../../shared/ui/chart/chart.model';

export type AlertSourceKind = 'METRIC' | 'WIDGET';
export type AlertWidgetVersionPolicy = 'FOLLOW_ACTIVE' | 'PINNED';
export type AlertOwnerMode = 'ALL' | 'TEAM' | 'OWN';
export type AlertConditionKind = 'THRESHOLD' | 'CHANGE_ABS' | 'CHANGE_PCT';
export type AlertComparator = 'LT' | 'LTE' | 'GT' | 'GTE';
export type AlertValueUnit = 'PERCENT' | 'COUNT' | 'MONEY' | 'DURATION' | 'RATIO';
export type AlertScheduleKind = 'HOURLY' | 'DAILY' | 'WEEKLY';
export type AlertQuietBehavior = 'DEFER' | 'DROP';
export type AlertRecipientMode = 'OWNER_ONLY' | 'USERS';
export type AlertChannel = 'IN_APP' | 'EMAIL';
export type AlertState = 'ENABLED' | 'DISABLED' | 'SUSPENDED';
export type AlertSuspendedReason =
  | 'OWNER_INACTIVE'
  | 'OWNER_ACCESS_LOST'
  | 'METRIC_RETIRED'
  | 'WIDGET_UNAVAILABLE';
export type AlertEvaluationOutcome =
  | 'NOTIFIED'
  | 'MET_COOLDOWN'
  | 'MET_QUIET_DEFERRED'
  | 'MET_QUIET_DROPPED'
  | 'NOT_MET'
  | 'BELOW_MIN_COHORT'
  | 'SOURCE_UNAVAILABLE'
  | 'RECIPIENT_INELIGIBLE'
  | 'ERROR';

export interface AlertScope {
  branchIds?: string[];
  ownerMode?: AlertOwnerMode;
}

export interface CreateAlertRule {
  name?: string;
  sourceKind?: AlertSourceKind;
  widgetId?: string | null;
  widgetVersionPolicy?: AlertWidgetVersionPolicy | null;
  widgetVersionNumber?: number | null;
  metricKey?: string;
  filters?: Record<string, unknown>;
  scope?: AlertScope | null;
  conditionKind?: AlertConditionKind;
  comparator?: AlertComparator;
  threshold?: number;
  valueUnit?: AlertValueUnit;
  currencyCode?: string | null;
  minimumCohortSize?: number | null;
  cooldownMinutes?: number;
  timeZone?: string;
  scheduleKind?: AlertScheduleKind;
  scheduleMinute?: number;
  scheduleWeekday?: number | null;
  quietStartMinute?: number | null;
  quietEndMinute?: number | null;
  quietBehavior?: AlertQuietBehavior;
  recipientMode?: AlertRecipientMode;
  recipientUserIds?: string[];
  channels?: AlertChannel[];
}

export interface AlertRule extends Omit<CreateAlertRule, 'threshold'> {
  id: string;
  ownerUserId: string;
  state: AlertState;
  enabled: boolean;
  suspendedReason: AlertSuspendedReason | null;
  threshold: string;
  nextEvaluationAt: string | null;
  lastEvaluatedAt: string | null;
  revision: number;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type UpdateAlertRule = Partial<CreateAlertRule> & { revision: number };

export interface AlertEvaluation {
  id: string;
  ruleId: string;
  ruleRevision: number;
  recipientUserId: string;
  scheduledFor: string;
  evaluatedAt: string;
  outcome: AlertEvaluationOutcome;
  conditionKind: string;
  comparator: string;
  threshold: string;
  valueUnit: string;
  currencyCode: string | null;
  minimumCohortSize: number | null;
  observedValue: string | null;
  numerator: string | null;
  denominator: string | null;
  executionReceiptId: string | null;
  dataWatermark: string | null;
  reasonCode: string | null;
  deferredUntil: string | null;
  notificationOutboxId: string | null;
}

export interface ListAlertsQuery {
  mine?: boolean;
  state?: AlertState;
  cursor?: string | null;
  limit?: number;
}

export interface ListEvaluationsQuery {
  from?: string;
  to?: string;
  cursor?: string | null;
  limit?: number;
}

export interface TestAlertResult {
  value: number | null;
  met: boolean;
  cohortSize: number | null;
  wouldNotify: boolean;
  reasonCode?: string;
}

export interface PublishedWidgetOption {
  id: string;
  name: { en: string; ar: string };
  metricKey: string;
  activeVersionNumber: number;
  versions: number[];
}

export interface IsolatedPhrase {
  before: string;
  value: string;
  after: string;
}

export const ALERT_CURRENCIES = ['EGP', 'USD', 'SAR', 'EUR', 'AED'] as const;
export const ALERT_TIME_ZONES = [
  'Africa/Cairo',
  'UTC',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
] as const;

export const DEFAULT_TIME_ZONE = 'Africa/Cairo';
export const DEFAULT_COOLDOWN_MINUTES = 1440;
export const MAX_COOLDOWN_MINUTES = 43200;
export const MAX_THRESHOLD_ABS = 1e15;
export const MAX_ALERT_NAME_LENGTH = 120;
export const MAX_RECIPIENTS_COUNT = 50;
export const MAX_EVALUATION_WINDOW_DAYS = 92;
export const DEFAULT_EVALUATION_WINDOW_DAYS = 30;
export const PHRASE_SENTINEL = '__VALUE__';

export function parseDecimal(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function minutesToTime24(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return '09:00';
  }
  const clamped = Math.max(0, Math.min(1439, Math.trunc(minutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function time24ToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

export function formatAlertAmount(
  value: number | string | null | undefined,
  unit: string | undefined,
  currencyCode: string | null | undefined,
  lang: 'ar' | 'en',
  conditionKind?: AlertConditionKind | string,
): string {
  const num = parseDecimal(value);
  if (num === null) return DASH;
  if (conditionKind === 'CHANGE_PCT') {
    return formatPercent(num, 1);
  }
  const resolvedUnit = (unit ?? 'COUNT') as SeriesUnit;
  return formatValue(num, resolvedUnit, currencyCode ?? undefined, lang);
}

export function formatAlertRate(
  numerator: string | null | undefined,
  denominator: string | null | undefined,
  lang: 'ar' | 'en',
  ofWord: string,
): string {
  const num = parseDecimal(numerator);
  const den = parseDecimal(denominator);
  if (num !== null && den !== null) {
    return `${formatNumber(num, lang)} ${ofWord} ${formatNumber(den, lang)}`;
  }
  if (den !== null) {
    return formatNumber(den, lang);
  }
  return DASH;
}

export function splitPhrase(
  templateWithSentinel: string,
  sentinel: string,
  value: string,
): IsolatedPhrase {
  const idx = templateWithSentinel.indexOf(sentinel);
  if (idx === -1) {
    return { before: templateWithSentinel, value: '', after: '' };
  }
  return {
    before: templateWithSentinel.slice(0, idx),
    value,
    after: templateWithSentinel.slice(idx + sentinel.length),
  };
}

export function conditionKeyFor(
  conditionKind: AlertConditionKind | string | undefined,
  comparator: AlertComparator | string | undefined,
): string {
  if (conditionKind === 'CHANGE_ABS' || conditionKind === 'CHANGE_PCT') {
    switch (comparator) {
      case 'GTE':
        return 'changeAtLeast';
      case 'LT':
        return 'changeLess';
      case 'LTE':
        return 'changeAtMost';
      case 'GT':
      default:
        return 'changeMore';
    }
  }
  switch (comparator) {
    case 'LTE':
      return 'atMost';
    case 'GT':
      return 'above';
    case 'GTE':
      return 'atLeast';
    case 'LT':
    default:
      return 'below';
  }
}
