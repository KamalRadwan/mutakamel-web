import { ApiError, FAKE_NOW, fakeId, pageOf, type InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import { FAKE_BRANCHES, FAKE_ME, FAKE_PEOPLE } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { fakeReceipt } from '../../../../shared/widgets/dashboard/fake/fake-receipts';
import { fieldDetails } from '../shared/api-error-details';
import {
  DEFAULT_COOLDOWN_MINUTES,
  DEFAULT_EVALUATION_WINDOW_DAYS,
  DEFAULT_TIME_ZONE,
  MAX_ALERT_NAME_LENGTH,
  MAX_COOLDOWN_MINUTES,
  MAX_EVALUATION_WINDOW_DAYS,
  MAX_RECIPIENTS_COUNT,
  MAX_THRESHOLD_ABS,
  type AlertChannel,
  type AlertComparator,
  type AlertConditionKind,
  type AlertEvaluation,
  type AlertEvaluationOutcome,
  type AlertOwnerMode,
  type AlertRecipientMode,
  type AlertRule,
  type AlertScheduleKind,
  type AlertSourceKind,
  type AlertValueUnit,
  type CreateAlertRule,
  type ListAlertsQuery,
  type ListEvaluationsQuery,
  type PublishedWidgetOption,
  type TestAlertResult,
  type UpdateAlertRule,
} from './alerts.model';

/** Backend BE-C2 switch: email alert delivery enabled. */
export const EMAIL_CHANNEL_AVAILABLE = true;

export const FAKE_PUBLISHED_WIDGETS: readonly PublishedWidgetOption[] = [
  {
    id: '01934b10-0000-7000-8000-000000000801',
    name: { en: 'Lead conversion rate KPI', ar: 'بطاقة معدل تحويل العملاء المحتملين' },
    metricKey: 'crm.leads.conversion.rate',
    activeVersionNumber: 3,
    versions: [1, 2, 3],
  },
  {
    id: '01934b10-0000-7000-8000-000000000802',
    name: { en: 'Monthly won deal value', ar: 'قيمة الصفقات الرابحة شهريًا' },
    metricKey: 'crm.opportunities.won.value',
    activeVersionNumber: 2,
    versions: [1, 2],
  },
  {
    id: '01934b10-0000-7000-8000-000000000803',
    name: { en: 'Open opportunities snapshot', ar: 'لقطة الفرص المفتوحة' },
    metricKey: 'crm.opportunities.open.count',
    activeVersionNumber: 2,
    versions: [1, 2],
  },
  {
    id: '01934b10-0000-7000-8000-000000000804',
    name: { en: 'First response time SLA', ar: 'متوسط زمن الاستجابة الأولى' },
    metricKey: 'crm.leads.first_response.duration',
    activeVersionNumber: 1,
    versions: [1],
  },
  {
    id: '01934b10-0000-7000-8000-000000000805',
    name: { en: 'Team win rate tracker', ar: 'مؤشر معدل ربح الفريق' },
    metricKey: 'crm.opportunities.win.rate',
    activeVersionNumber: 2,
    versions: [1, 2],
  },
  {
    id: '01934b10-0000-7000-8000-000000000806',
    name: { en: 'Open pipeline value card', ar: 'بطاقة قيمة مسار البيع المفتوح' },
    metricKey: 'crm.opportunities.pipeline.value',
    activeVersionNumber: 4,
    versions: [1, 2, 3, 4],
  },
];

const VALID_UNITS = new Set<AlertValueUnit>(['PERCENT', 'COUNT', 'MONEY', 'DURATION', 'RATIO']);
const VALID_COMPARATORS = new Set<AlertComparator>(['LT', 'LTE', 'GT', 'GTE']);
const VALID_CONDITIONS = new Set<AlertConditionKind>(['THRESHOLD', 'CHANGE_ABS', 'CHANGE_PCT']);
const VALID_SCHEDULES = new Set<AlertScheduleKind>(['HOURLY', 'DAILY', 'WEEKLY']);

const RULE_IDS = [
  '01934b10-0000-7000-8000-000000000901',
  '01934b10-0000-7000-8000-000000000902',
  '01934b10-0000-7000-8000-000000000903',
  '01934b10-0000-7000-8000-000000000904',
  '01934b10-0000-7000-8000-000000000905',
  '01934b10-0000-7000-8000-000000000906',
  '01934b10-0000-7000-8000-000000000907',
] as const;

const OUTCOMES: readonly AlertEvaluationOutcome[] = [
  'NOTIFIED',
  'NOT_MET',
  'MET_COOLDOWN',
  'MET_QUIET_DEFERRED',
  'MET_QUIET_DROPPED',
  'BELOW_MIN_COHORT',
  'SOURCE_UNAVAILABLE',
  'RECIPIENT_INELIGIBLE',
  'ERROR',
];

const INITIAL_RULES: AlertRule[] = [
  {
    id: RULE_IDS[0],
    ownerUserId: FAKE_ME.id,
    name: 'Lead conversion drop alert',
    sourceKind: 'METRIC',
    widgetId: null,
    widgetVersionPolicy: null,
    widgetVersionNumber: null,
    metricKey: 'crm.leads.conversion.rate',
    filters: {},
    scope: { branchIds: [FAKE_BRANCHES[0].id], ownerMode: 'ALL' },
    conditionKind: 'THRESHOLD',
    comparator: 'LT',
    threshold: '20.0',
    valueUnit: 'PERCENT',
    currencyCode: null,
    minimumCohortSize: 50,
    cooldownMinutes: 1440,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'DAILY',
    scheduleMinute: 540,
    scheduleWeekday: null,
    quietStartMinute: 1320,
    quietEndMinute: 480,
    quietBehavior: 'DEFER',
    recipientMode: 'USERS',
    recipientUserIds: [FAKE_ME.id, FAKE_PEOPLE[1].id],
    channels: ['IN_APP'],
    state: 'ENABLED',
    enabled: true,
    suspendedReason: null,
    nextEvaluationAt: '2026-11-22T07:00:00.000Z',
    lastEvaluatedAt: '2026-11-21T07:00:00.000Z',
    revision: 3,
    updatedByUserId: FAKE_ME.id,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-11-18T11:30:00.000Z',
  },
  {
    id: RULE_IDS[1],
    ownerUserId: FAKE_ME.id,
    name: 'Weekly won revenue milestone',
    sourceKind: 'WIDGET',
    widgetId: FAKE_PUBLISHED_WIDGETS[1].id,
    widgetVersionPolicy: 'FOLLOW_ACTIVE',
    widgetVersionNumber: null,
    metricKey: 'crm.opportunities.won.value',
    filters: { currencyCode: 'EGP' },
    scope: { branchIds: [], ownerMode: 'ALL' },
    conditionKind: 'THRESHOLD',
    comparator: 'GT',
    threshold: '1000000.000',
    valueUnit: 'MONEY',
    currencyCode: 'EGP',
    minimumCohortSize: null,
    cooldownMinutes: 2880,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'WEEKLY',
    scheduleMinute: 510,
    scheduleWeekday: 0,
    quietStartMinute: null,
    quietEndMinute: null,
    quietBehavior: 'DEFER',
    recipientMode: 'OWNER_ONLY',
    recipientUserIds: [],
    channels: ['IN_APP'],
    state: 'ENABLED',
    enabled: true,
    suspendedReason: null,
    nextEvaluationAt: '2026-11-22T06:30:00.000Z',
    lastEvaluatedAt: '2026-11-15T06:30:00.000Z',
    revision: 2,
    updatedByUserId: FAKE_ME.id,
    createdAt: '2026-10-05T09:15:00.000Z',
    updatedAt: '2026-11-15T06:35:00.000Z',
  },
  {
    id: RULE_IDS[2],
    ownerUserId: FAKE_PEOPLE[1].id,
    name: 'First response SLA breach',
    sourceKind: 'METRIC',
    widgetId: null,
    widgetVersionPolicy: null,
    widgetVersionNumber: null,
    metricKey: 'crm.leads.first_response.duration',
    filters: {},
    scope: { branchIds: [FAKE_BRANCHES[0].id, FAKE_BRANCHES[1].id], ownerMode: 'TEAM' },
    conditionKind: 'THRESHOLD',
    comparator: 'GTE',
    threshold: '45',
    valueUnit: 'DURATION',
    currencyCode: null,
    minimumCohortSize: 10,
    cooldownMinutes: 180,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'HOURLY',
    scheduleMinute: 15,
    scheduleWeekday: null,
    quietStartMinute: 1260,
    quietEndMinute: 480,
    quietBehavior: 'DROP',
    recipientMode: 'USERS',
    recipientUserIds: [FAKE_PEOPLE[1].id, FAKE_ME.id, FAKE_PEOPLE[2].id],
    channels: ['IN_APP'],
    state: 'ENABLED',
    enabled: true,
    suspendedReason: null,
    nextEvaluationAt: '2026-11-21T09:15:00.000Z',
    lastEvaluatedAt: '2026-11-21T08:15:00.000Z',
    revision: 5,
    updatedByUserId: FAKE_PEOPLE[1].id,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-11-20T14:00:00.000Z',
  },
  {
    id: RULE_IDS[3],
    ownerUserId: FAKE_ME.id,
    name: 'Open opportunities spike',
    sourceKind: 'METRIC',
    widgetId: null,
    widgetVersionPolicy: null,
    widgetVersionNumber: null,
    metricKey: 'crm.opportunities.open.count',
    filters: {},
    scope: { branchIds: [], ownerMode: 'OWN' },
    conditionKind: 'CHANGE_PCT',
    comparator: 'GT',
    threshold: '10.0',
    valueUnit: 'COUNT',
    currencyCode: null,
    minimumCohortSize: 20,
    cooldownMinutes: 1440,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'DAILY',
    scheduleMinute: 600,
    scheduleWeekday: null,
    quietStartMinute: null,
    quietEndMinute: null,
    quietBehavior: 'DEFER',
    recipientMode: 'OWNER_ONLY',
    recipientUserIds: [],
    channels: ['IN_APP'],
    state: 'DISABLED',
    enabled: false,
    suspendedReason: null,
    nextEvaluationAt: null,
    lastEvaluatedAt: '2026-11-12T08:00:00.000Z',
    revision: 1,
    updatedByUserId: FAKE_ME.id,
    createdAt: '2026-10-12T11:20:00.000Z',
    updatedAt: '2026-11-12T08:05:00.000Z',
  },
  {
    id: RULE_IDS[4],
    ownerUserId: FAKE_PEOPLE[2].id,
    name: 'Pipeline value contraction watch',
    sourceKind: 'WIDGET',
    widgetId: FAKE_PUBLISHED_WIDGETS[5].id,
    widgetVersionPolicy: 'PINNED',
    widgetVersionNumber: 3,
    metricKey: 'crm.opportunities.pipeline.value',
    filters: { currencyCode: 'EGP' },
    scope: { branchIds: [FAKE_BRANCHES[0].id], ownerMode: 'TEAM' },
    conditionKind: 'CHANGE_ABS',
    comparator: 'LTE',
    threshold: '150000.000',
    valueUnit: 'MONEY',
    currencyCode: 'EGP',
    minimumCohortSize: null,
    cooldownMinutes: 720,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'DAILY',
    scheduleMinute: 1020,
    scheduleWeekday: null,
    quietStartMinute: null,
    quietEndMinute: null,
    quietBehavior: 'DEFER',
    recipientMode: 'USERS',
    recipientUserIds: [FAKE_PEOPLE[2].id, FAKE_PEOPLE[3].id],
    channels: ['IN_APP'],
    state: 'DISABLED',
    enabled: false,
    suspendedReason: null,
    nextEvaluationAt: null,
    lastEvaluatedAt: '2026-11-10T15:00:00.000Z',
    revision: 4,
    updatedByUserId: FAKE_PEOPLE[2].id,
    createdAt: '2026-10-14T13:00:00.000Z',
    updatedAt: '2026-11-10T15:05:00.000Z',
  },
  {
    id: RULE_IDS[5],
    ownerUserId: FAKE_PEOPLE[4].id,
    name: 'Alexandria win rate floor',
    sourceKind: 'METRIC',
    widgetId: null,
    widgetVersionPolicy: null,
    widgetVersionNumber: null,
    metricKey: 'crm.opportunities.win.rate',
    filters: {},
    scope: { branchIds: [FAKE_BRANCHES[1].id], ownerMode: 'TEAM' },
    conditionKind: 'THRESHOLD',
    comparator: 'LT',
    threshold: '25.0',
    valueUnit: 'PERCENT',
    currencyCode: null,
    minimumCohortSize: 15,
    cooldownMinutes: 1440,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'WEEKLY',
    scheduleMinute: 540,
    scheduleWeekday: 1,
    quietStartMinute: null,
    quietEndMinute: null,
    quietBehavior: 'DEFER',
    recipientMode: 'OWNER_ONLY',
    recipientUserIds: [],
    channels: ['IN_APP'],
    state: 'SUSPENDED',
    enabled: false,
    suspendedReason: 'OWNER_ACCESS_LOST',
    nextEvaluationAt: null,
    lastEvaluatedAt: '2026-11-09T07:00:00.000Z',
    revision: 3,
    updatedByUserId: FAKE_PEOPLE[4].id,
    createdAt: '2026-09-28T07:45:00.000Z',
    updatedAt: '2026-11-09T07:01:00.000Z',
  },
  {
    id: RULE_IDS[6],
    ownerUserId: FAKE_ME.id,
    name: 'Legacy forecast floor check',
    sourceKind: 'METRIC',
    widgetId: null,
    widgetVersionPolicy: null,
    widgetVersionNumber: null,
    metricKey: 'crm.opportunities.legacy_forecast.value',
    filters: { currencyCode: 'EGP' },
    scope: { branchIds: [], ownerMode: 'ALL' },
    conditionKind: 'THRESHOLD',
    comparator: 'LT',
    threshold: '500000.000',
    valueUnit: 'MONEY',
    currencyCode: 'EGP',
    minimumCohortSize: null,
    cooldownMinutes: 1440,
    timeZone: DEFAULT_TIME_ZONE,
    scheduleKind: 'DAILY',
    scheduleMinute: 540,
    scheduleWeekday: null,
    quietStartMinute: null,
    quietEndMinute: null,
    quietBehavior: 'DEFER',
    recipientMode: 'OWNER_ONLY',
    recipientUserIds: [],
    channels: ['IN_APP'],
    state: 'SUSPENDED',
    enabled: false,
    suspendedReason: 'METRIC_RETIRED',
    nextEvaluationAt: null,
    lastEvaluatedAt: '2026-11-02T07:00:00.000Z',
    revision: 2,
    updatedByUserId: FAKE_ME.id,
    createdAt: '2026-09-10T09:00:00.000Z',
    updatedAt: '2026-11-02T07:01:00.000Z',
  },
];

function buildEvaluationsForRule(rule: AlertRule, ruleIndex: number): AlertEvaluation[] {
  const baseMs = Date.parse(FAKE_NOW);
  const stepMs = Math.floor((29 * 24 * 60 * 60 * 1000) / 40);
  const list: AlertEvaluation[] = [];

  for (let i = 0; i < 40; i++) {
    const outcome = OUTCOMES[(i + ruleIndex) % OUTCOMES.length];
    const scheduledMs = baseMs - (i + 1) * stepMs;
    const scheduledFor = new Date(scheduledMs).toISOString();
    const evaluatedAt = new Date(scheduledMs + 42_000).toISOString();
    const cohortDen = outcome === 'BELOW_MIN_COHORT'
      ? Math.max(1, (rule.minimumCohortSize ?? 20) - 5)
      : Math.max(rule.minimumCohortSize ?? 40, 80 + ((i * 7) % 60));

    let observedNum: number | null = null;
    if (outcome !== 'SOURCE_UNAVAILABLE' && outcome !== 'ERROR') {
      const thresh = Number(rule.threshold);
      const metSample = rule.comparator === 'LT' || rule.comparator === 'LTE'
        ? thresh * 0.85
        : thresh * 1.15;
      const notMetSample = rule.comparator === 'LT' || rule.comparator === 'LTE'
        ? thresh * 1.25
        : thresh * 0.75;
      const rawVal = outcome === 'NOT_MET' ? notMetSample : metSample;
      if (rule.valueUnit === 'MONEY') {
        observedNum = Math.round(rawVal * 1000) / 1000;
      } else if (rule.valueUnit === 'PERCENT' || rule.conditionKind === 'CHANGE_PCT') {
        observedNum = Math.round(rawVal * 10) / 10;
      } else {
        observedNum = Math.round(rawVal);
      }
    }

    const numerator =
      observedNum !== null && rule.valueUnit === 'PERCENT'
        ? String(Math.round((observedNum / 100) * cohortDen))
        : null;
    const denominator =
      observedNum !== null && (rule.valueUnit === 'PERCENT' || rule.minimumCohortSize !== null)
        ? String(cohortDen)
        : null;

    let reasonCode: string | null = null;
    if (outcome === 'SOURCE_UNAVAILABLE') {
      reasonCode =
        rule.suspendedReason === 'METRIC_RETIRED'
          ? 'METRIC_RETIRED'
          : 'SOURCE_NOT_READY:crm.leads.current';
    } else if (outcome === 'RECIPIENT_INELIGIBLE') {
      reasonCode = 'CRM_SCOPED_PERMISSION_DENIED';
    } else if (outcome === 'ERROR') {
      reasonCode = 'METRIC_EXECUTION_FAILED';
    }

    const receiptId =
      observedNum !== null
        ? fakeReceipt(rule.metricKey ?? 'crm.leads.conversion.rate', {
            value: observedNum,
            numerator: numerator ? Number(numerator) : undefined,
            denominator: denominator ? Number(denominator) : undefined,
            unit: rule.valueUnit ?? 'COUNT',
            currencyCode: rule.currencyCode ?? undefined,
          })
        : null;

    list.push({
      id: `01934b10-0000-7000-81${String(ruleIndex).padStart(2, '0')}-${String(i + 1).padStart(12, '0')}`,
      ruleId: rule.id,
      ruleRevision: rule.revision,
      recipientUserId: rule.recipientUserIds?.[0] ?? rule.ownerUserId,
      scheduledFor,
      evaluatedAt,
      outcome,
      conditionKind: rule.conditionKind ?? 'THRESHOLD',
      comparator: rule.comparator ?? 'LT',
      threshold: rule.threshold,
      valueUnit: rule.valueUnit ?? 'COUNT',
      currencyCode: rule.currencyCode ?? null,
      minimumCohortSize: rule.minimumCohortSize ?? null,
      observedValue:
        observedNum === null
          ? null
          : rule.valueUnit === 'MONEY'
            ? observedNum.toFixed(3)
            : rule.valueUnit === 'PERCENT' || rule.conditionKind === 'CHANGE_PCT'
              ? observedNum.toFixed(1)
              : String(observedNum),
      numerator,
      denominator,
      executionReceiptId: receiptId,
      dataWatermark: scheduledFor,
      reasonCode,
      deferredUntil:
        outcome === 'MET_QUIET_DEFERRED'
          ? new Date(scheduledMs + 8 * 60 * 60 * 1000).toISOString()
          : null,
      notificationOutboxId:
        outcome === 'NOTIFIED' ? `outbox-${ruleIndex}-${i + 1}` : null,
    });
  }

  return list;
}

const rulesStore: AlertRule[] = INITIAL_RULES.map((r) => structuredClone(r));
const evaluationsStore = new Map<string, AlertEvaluation[]>(
  rulesStore.map((rule, index) => [rule.id, buildEvaluationsForRule(rule, index)]),
);
const idempotencyStore = new Map<string, { fingerprint: string; result: AlertRule }>();

/** `roundAlertThreshold`: numeric text, MONEY 2 places, COUNT 0, every other unit 4. */
function formatThresholdString(
  threshold: number,
  unit: AlertValueUnit,
  _conditionKind: AlertConditionKind,
): string {
  if (unit === 'MONEY') return threshold.toFixed(2);
  if (unit === 'COUNT') return threshold.toFixed(0);
  return threshold.toFixed(4);
}

function computeNextEvaluationAt(rule: {
  scheduleKind?: AlertScheduleKind;
  scheduleMinute?: number;
  scheduleWeekday?: number | null;
}): string {
  const now = new Date(FAKE_NOW);
  const minute = rule.scheduleMinute ?? 540;
  if (rule.scheduleKind === 'HOURLY') {
    const next = new Date(now);
    next.setUTCMinutes(minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setUTCHours(next.getUTCHours() + 1);
    }
    return next.toISOString();
  }
  const next = new Date(now);
  next.setUTCHours(Math.floor(minute / 60), minute % 60, 0, 0);
  if (rule.scheduleKind === 'WEEKLY') {
    const targetDay = rule.scheduleWeekday ?? 0;
    const diff = (targetDay - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + (diff === 0 && next.getTime() <= now.getTime() ? 7 : diff));
    return next.toISOString();
  }
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METRIC_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const TIME_ZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/;

/** ValidationPipe (alerts.dto.ts decorators): 400 CRM_VALIDATION_FAILED, details { field: [reason] }. */
function invalidField(field: string, reason: string): never {
  throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails(field, reason));
}

/** The service's `validationFailed(message)`: 400 CRM_VALIDATION_FAILED with a message and no details. */
function validationFailed(): never {
  throw new ApiError(400, 'CRM_VALIDATION_FAILED');
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function checkIntRange(field: string, value: unknown, min: number, max: number): void {
  if (value === null || value === undefined) return;
  if (!isInt(value)) invalidField(field, 'is_int');
  if (value < min) invalidField(field, 'min');
  if (value > max) invalidField(field, 'max');
}

function checkIn(field: string, value: unknown, allowed: readonly string[]): void {
  if (value === null || value === undefined) return;
  if (!allowed.includes(value as string)) invalidField(field, 'is_in');
}

/** Field decorators shared by create and update (`@IsOptional()` lets null and undefined through). */
function validateBodyFields(body: Partial<CreateAlertRule>): void {
  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') invalidField('name', 'is_string');
    const name = body.name.trim();
    if (name.length < 1) invalidField('name', 'min_length');
    if (name.length > MAX_ALERT_NAME_LENGTH) invalidField('name', 'max_length');
    if (/[\r\n]/.test(name)) invalidField('name', 'matches');
  }
  checkIn('sourceKind', body.sourceKind, ['METRIC', 'WIDGET']);
  if (body.widgetId != null && !UUID_ANY.test(body.widgetId)) invalidField('widgetId', 'is_uuid');
  checkIn('widgetVersionPolicy', body.widgetVersionPolicy, ['FOLLOW_ACTIVE', 'PINNED']);
  checkIntRange('widgetVersionNumber', body.widgetVersionNumber, 1, Number.MAX_SAFE_INTEGER);
  if (body.metricKey != null) {
    if (body.metricKey.length > 160) invalidField('metricKey', 'max_length');
    if (!METRIC_KEY.test(body.metricKey)) invalidField('metricKey', 'matches');
  }
  checkIn('conditionKind', body.conditionKind, [...VALID_CONDITIONS]);
  checkIn('comparator', body.comparator, [...VALID_COMPARATORS]);
  if (body.threshold !== undefined && body.threshold !== null) {
    if (typeof body.threshold !== 'number' || !Number.isFinite(body.threshold)) invalidField('threshold', 'is_number');
    if (body.threshold < -MAX_THRESHOLD_ABS) invalidField('threshold', 'min');
    if (body.threshold > MAX_THRESHOLD_ABS) invalidField('threshold', 'max');
  }
  checkIn('valueUnit', body.valueUnit, [...VALID_UNITS]);
  if (body.currencyCode != null && !/^[A-Z]{3}$/.test(body.currencyCode)) invalidField('currencyCode', 'matches');
  checkIntRange('minimumCohortSize', body.minimumCohortSize, 1, 2_147_483_647);
  checkIntRange('cooldownMinutes', body.cooldownMinutes, 0, MAX_COOLDOWN_MINUTES);
  if (body.timeZone != null && body.timeZone.trim().length > 64) invalidField('timeZone', 'max_length');
  checkIn('scheduleKind', body.scheduleKind, [...VALID_SCHEDULES]);
  checkIntRange('scheduleMinute', body.scheduleMinute, 0, 1439);
  checkIntRange('scheduleWeekday', body.scheduleWeekday, 0, 6);
  checkIntRange('quietStartMinute', body.quietStartMinute, 0, 1439);
  checkIntRange('quietEndMinute', body.quietEndMinute, 0, 1439);
  checkIn('quietBehavior', body.quietBehavior, ['DEFER', 'DROP']);
  checkIn('recipientMode', body.recipientMode, ['OWNER_ONLY', 'USERS']);
  if (body.channels !== undefined) {
    const channels = body.channels as unknown;
    if (!Array.isArray(channels)) invalidField('channels', 'is_array');
    if (channels.length < 1) invalidField('channels', 'array_min_size');
    if (channels.length > 2) invalidField('channels', 'array_max_size');
    if (new Set(channels).size !== channels.length) invalidField('channels', 'array_unique');
    if (channels.some((ch) => ch !== 'IN_APP' && ch !== 'EMAIL')) invalidField('channels', 'is_in');
  }
  if (body.recipientUserIds != null) {
    if (!Array.isArray(body.recipientUserIds)) invalidField('recipientUserIds', 'is_array');
    if (body.recipientUserIds.length > MAX_RECIPIENTS_COUNT * 2) invalidField('recipientUserIds', 'array_max_size');
    if (body.recipientUserIds.some((id) => !UUID_ANY.test(id))) invalidField('recipientUserIds', 'is_uuid');
  }
}

type AlertDefinition = Omit<
  AlertRule,
  | 'id'
  | 'ownerUserId'
  | 'state'
  | 'enabled'
  | 'suspendedReason'
  | 'nextEvaluationAt'
  | 'lastEvaluatedAt'
  | 'revision'
  | 'updatedByUserId'
  | 'createdAt'
  | 'updatedAt'
  | 'threshold'
  | 'metricKey'
> & { threshold: number; metricKey: string | null };

function scopeSpec(scope: CreateAlertRule['scope']): AlertRule['scope'] {
  const spec: { branchIds?: string[]; ownerMode?: AlertOwnerMode } = {};
  if (scope?.branchIds?.length) spec.branchIds = [...new Set(scope.branchIds.map((id) => id.toLowerCase()))].sort();
  if (scope?.ownerMode) spec.ownerMode = scope.ownerMode;
  return spec;
}

function sortedRecipients(ids: readonly string[] | undefined | null): string[] {
  return [...new Set((ids ?? []).map((id) => id.toLowerCase()))].sort();
}

/** `createDefinition`: the required fields are checked here (400, message only), then the backend defaults apply. */
function createDefinition(dto: CreateAlertRule): AlertDefinition {
  if (
    !dto.name ||
    !dto.sourceKind ||
    !dto.comparator ||
    dto.threshold === undefined ||
    !dto.valueUnit ||
    !dto.timeZone ||
    dto.scheduleMinute === undefined
  ) {
    validationFailed();
  }
  return {
    name: dto.name.trim(),
    sourceKind: dto.sourceKind,
    widgetId: dto.widgetId?.toLowerCase() ?? null,
    widgetVersionPolicy: dto.widgetVersionPolicy ?? (dto.sourceKind === 'WIDGET' ? 'FOLLOW_ACTIVE' : null),
    widgetVersionNumber: dto.widgetVersionNumber ?? null,
    metricKey: dto.metricKey ?? null,
    filters: dto.filters ?? {},
    scope: scopeSpec(dto.scope),
    conditionKind: dto.conditionKind ?? 'THRESHOLD',
    comparator: dto.comparator,
    threshold: dto.threshold,
    valueUnit: dto.valueUnit,
    currencyCode: dto.currencyCode ?? null,
    minimumCohortSize: dto.minimumCohortSize ?? null,
    cooldownMinutes: dto.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
    timeZone: dto.timeZone.trim(),
    scheduleKind: dto.scheduleKind ?? 'DAILY',
    scheduleMinute: dto.scheduleMinute,
    scheduleWeekday: dto.scheduleWeekday ?? null,
    quietStartMinute: dto.quietStartMinute ?? null,
    quietEndMinute: dto.quietEndMinute ?? null,
    quietBehavior: dto.quietBehavior ?? 'DEFER',
    recipientMode: dto.recipientMode ?? 'OWNER_ONLY',
    recipientUserIds: sortedRecipients(dto.recipientUserIds),
    channels: dto.channels === undefined ? ['IN_APP'] : [...dto.channels],
  };
}

function pick<T>(patch: T | null | undefined, current: T): T {
  if (patch === undefined || patch === null) return current;
  return patch;
}

function pickNullable<T>(patch: T | null | undefined, current: T | null): T | null {
  return patch === undefined ? current : patch;
}

/** `mergeDefinition`: stored rule + patch; null clears an optional field; a source or schedule switch drops unused fields. */
function mergeDefinition(current: AlertRule, dto: UpdateAlertRule): AlertDefinition {
  const sourceKind = pick(dto.sourceKind, current.sourceKind ?? 'METRIC');
  const widget = sourceKind === 'WIDGET';
  const widgetVersionPolicy = widget
    ? (pickNullable(dto.widgetVersionPolicy, current.widgetVersionPolicy ?? null) ?? 'FOLLOW_ACTIVE')
    : null;
  const scheduleKind = pick(dto.scheduleKind, current.scheduleKind ?? 'DAILY');
  const recipientMode = pick(dto.recipientMode, current.recipientMode ?? 'OWNER_ONLY');
  return {
    name: pick(dto.name, current.name ?? '').trim(),
    sourceKind,
    widgetId: widget
      ? pickNullable(dto.widgetId === null ? null : dto.widgetId?.toLowerCase(), current.widgetId ?? null)
      : null,
    widgetVersionPolicy,
    widgetVersionNumber:
      widgetVersionPolicy === 'PINNED'
        ? pickNullable(dto.widgetVersionNumber, current.widgetVersionNumber ?? null)
        : null,
    // A WIDGET rule re-derives its metric from the widget version unless the body names one to check against.
    metricKey: dto.metricKey ?? (widget ? null : (current.metricKey ?? null)),
    filters: dto.filters ?? current.filters ?? {},
    scope: dto.scope === undefined ? (current.scope ?? {}) : scopeSpec(dto.scope),
    conditionKind: pick(dto.conditionKind, current.conditionKind ?? 'THRESHOLD'),
    comparator: pick(dto.comparator, current.comparator ?? 'LT'),
    threshold: dto.threshold ?? Number(current.threshold),
    valueUnit: pick(dto.valueUnit, current.valueUnit ?? 'COUNT'),
    currencyCode: pickNullable(dto.currencyCode, current.currencyCode ?? null),
    minimumCohortSize: pickNullable(dto.minimumCohortSize, current.minimumCohortSize ?? null),
    cooldownMinutes: pick(dto.cooldownMinutes, current.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES),
    timeZone: pick(dto.timeZone, current.timeZone ?? DEFAULT_TIME_ZONE).trim(),
    scheduleKind,
    scheduleMinute: pick(dto.scheduleMinute, current.scheduleMinute ?? 540),
    scheduleWeekday:
      scheduleKind === 'WEEKLY' ? pickNullable(dto.scheduleWeekday, current.scheduleWeekday ?? null) : null,
    quietStartMinute: pickNullable(dto.quietStartMinute, current.quietStartMinute ?? null),
    quietEndMinute: pickNullable(dto.quietEndMinute, current.quietEndMinute ?? null),
    quietBehavior: pick(dto.quietBehavior, current.quietBehavior ?? 'DEFER'),
    recipientMode,
    channels: dto.channels === undefined ? [...(current.channels ?? ['IN_APP'])] : [...dto.channels],
    recipientUserIds:
      recipientMode === 'OWNER_ONLY' && dto.recipientUserIds === undefined
        ? []
        : dto.recipientUserIds === undefined
          ? [...(current.recipientUserIds ?? [])]
          : sortedRecipients(dto.recipientUserIds),
  };
}

function isValidSchedule(def: AlertDefinition): boolean {
  const minute = def.scheduleMinute ?? -1;
  if (!Number.isInteger(minute) || minute < 0) return false;
  if (def.scheduleKind === 'HOURLY') return minute <= 59 && def.scheduleWeekday === null;
  if (minute > 1439) return false;
  if (def.scheduleKind === 'DAILY') return def.scheduleWeekday === null;
  return def.scheduleKind === 'WEEKLY' && isInt(def.scheduleWeekday) && def.scheduleWeekday >= 0 && def.scheduleWeekday <= 6;
}

/**
 * `AlertRuleService.validate` + `validateShape`, in the backend order: source, metric, unit and currency, shape
 * (channels, schedule, quiet window, cooldown, filter size, recipients), then recipients are active. Returns the
 * metric key to store.
 */
function validateDefinition(def: AlertDefinition): string {
  let metricKey = def.metricKey;
  if (def.sourceKind === 'WIDGET') {
    if (!def.widgetId) validationFailed();
    if ((def.widgetVersionPolicy === 'PINNED') !== (def.widgetVersionNumber !== null)) validationFailed();
    const widget = FAKE_PUBLISHED_WIDGETS.find((w) => w.id === def.widgetId);
    // DashboardAccessService.widget: a widget the caller cannot see is its 404.
    if (!widget) throw new ApiError(404, 'CRM_WIDGET_NOT_FOUND');
    if (def.widgetVersionPolicy === 'PINNED' && !widget.versions.includes(def.widgetVersionNumber ?? -1)) {
      throw new ApiError(404, 'CRM_WIDGET_VERSION_NOT_FOUND');
    }
    if (metricKey && metricKey !== widget.metricKey) throw new ApiError(422, 'CRM_WIDGET_METRIC_INVALID');
    metricKey = widget.metricKey;
  } else if (def.widgetId || def.widgetVersionPolicy || def.widgetVersionNumber !== null) {
    validationFailed();
  }
  if (!metricKey) validationFailed();
  const metric = FAKE_CATALOG.metrics.find((m) => m.key === metricKey);
  if (!metric) throw new ApiError(422, 'CRM_WIDGET_METRIC_INVALID');
  if (metric.availability !== 'AVAILABLE') throw new ApiError(409, 'CRM_ALERT_SOURCE_UNAVAILABLE');
  if (def.valueUnit !== metric.unit) throw new ApiError(422, 'CRM_ALERT_UNIT_MISMATCH');
  if ((def.valueUnit === 'MONEY') !== (def.currencyCode !== null)) throw new ApiError(422, 'CRM_ALERT_UNIT_MISMATCH');

  const channels = def.channels ?? [];
  if (
    channels.length < 1 ||
    channels.length > 2 ||
    new Set(channels).size !== channels.length ||
    channels.some((ch) => ch !== 'IN_APP' && ch !== 'EMAIL')
  ) {
    validationFailed();
  }
  if ((def.timeZone !== 'UTC' && !TIME_ZONE.test(def.timeZone ?? '')) || !isValidSchedule(def)) {
    throw new ApiError(422, 'CRM_ALERT_SCHEDULE_INVALID');
  }
  if (
    (def.quietStartMinute === null) !== (def.quietEndMinute === null) ||
    (def.quietStartMinute !== null && def.quietStartMinute === def.quietEndMinute)
  ) {
    throw new ApiError(422, 'CRM_ALERT_SCHEDULE_INVALID');
  }
  const cooldown = def.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  if (!Number.isInteger(cooldown) || cooldown < 0 || cooldown > MAX_COOLDOWN_MINUTES) {
    throw new ApiError(422, 'CRM_ALERT_SCHEDULE_INVALID');
  }
  const recipients = def.recipientUserIds ?? [];
  if (def.recipientMode === 'OWNER_ONLY' ? recipients.length !== 0 : recipients.length < 1 || recipients.length > MAX_RECIPIENTS_COUNT) {
    throw new ApiError(422, 'CRM_ALERT_RECIPIENTS_INVALID');
  }
  if (def.recipientMode === 'USERS' && recipients.some((id) => !FAKE_PEOPLE.some((p) => p.id.toLowerCase() === id))) {
    throw new ApiError(422, 'CRM_ALERT_RECIPIENTS_INVALID');
  }
  return metricKey;
}

function definitionToRule(def: AlertDefinition, metricKey: string): Omit<AlertDefinition, 'threshold' | 'metricKey'> & {
  threshold: string;
  metricKey: string;
} {
  return {
    ...def,
    metricKey,
    threshold: formatThresholdString(def.threshold, def.valueUnit as AlertValueUnit, def.conditionKind as AlertConditionKind),
  };
}

/** Owner sees own rules; an admin (alerts + settings manage) sees all; anyone else gets the same 404. */
function findRuleIndex(id: string): number {
  const index = rulesStore.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new ApiError(404, 'CRM_ALERT_NOT_FOUND');
  }
  return index;
}

function lockedRule(id: string, revision: number): { idx: number; current: AlertRule } {
  const idx = findRuleIndex(id);
  const current = rulesStore[idx];
  if (revision !== current.revision) {
    throw new ApiError(409, 'CRM_ALERT_REVISION_STALE');
  }
  return { idx, current };
}

// GET {B}/analytics/alerts?mine=&state=&cursor=&limit= (default limit 25, max 100).
export function fakeListAlerts(q: ListAlertsQuery = {}): InfoPage<AlertRule> {
  const filtered = rulesStore.filter((rule) => {
    if (q.mine && rule.ownerUserId !== FAKE_ME.id) return false;
    if (q.state && rule.state !== q.state) return false;
    return true;
  });
  return pageOf(filtered, q.cursor ?? null, q.limit ?? 25);
}

export function fakeGetAlert(id: string): AlertRule {
  const idx = findRuleIndex(id);
  return rulesStore[idx];
}

/** UUIDv7 check the gateway runs on WRITE_SENSITIVE routes. */
function gatewayIdempotencyKey(key: string): string {
  const value = (key ?? '').trim();
  if (!value) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7.test(value)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  return value.toLowerCase();
}

// POST {B}/analytics/alerts (header x-idempotency-key). The rule is created disabled. 201.
export function fakeCreateAlert(body: CreateAlertRule, key: string): AlertRule {
  const idemKey = gatewayIdempotencyKey(key);
  validateBodyFields(body);
  // CrmRequestIdempotencyService runs before the command: same key + other body = 422; same body = stored result.
  const fingerprint = JSON.stringify(body);
  const existingIdem = idempotencyStore.get(idemKey);
  if (existingIdem) {
    if (existingIdem.fingerprint !== fingerprint) {
      throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
    }
    return existingIdem.result;
  }

  const def = createDefinition(body);
  const metricKey = validateDefinition(def);
  const rule: AlertRule = {
    ...definitionToRule(def, metricKey),
    id: fakeId(),
    ownerUserId: FAKE_ME.id,
    state: 'DISABLED',
    enabled: false,
    suspendedReason: null,
    nextEvaluationAt: null,
    lastEvaluatedAt: null,
    revision: 1,
    updatedByUserId: FAKE_ME.id,
    createdAt: FAKE_NOW,
    updatedAt: FAKE_NOW,
  };

  rulesStore.unshift(rule);
  evaluationsStore.set(rule.id, []);
  idempotencyStore.set(idemKey, { fingerprint, result: rule });
  return rule;
}

// PATCH {B}/analytics/alerts/:id  body { revision, ...fields } (or If-Match). 200.
export function fakeUpdateAlert(id: string, body: UpdateAlertRule): AlertRule {
  validateBodyFields(body);
  const { idx, current } = lockedRule(id, body.revision);
  const def = mergeDefinition(current, body);
  const metricKey = validateDefinition(def);
  const next = definitionToRule(def, metricKey);
  const scheduleChanged =
    current.timeZone !== next.timeZone ||
    current.scheduleKind !== next.scheduleKind ||
    current.scheduleMinute !== next.scheduleMinute ||
    current.scheduleWeekday !== next.scheduleWeekday;
  const updated: AlertRule = {
    ...current,
    ...next,
    revision: current.revision + 1,
    updatedByUserId: FAKE_ME.id,
    updatedAt: FAKE_NOW,
    nextEvaluationAt:
      current.enabled && scheduleChanged ? computeNextEvaluationAt(next) : current.nextEvaluationAt,
  };

  rulesStore[idx] = updated;
  return updated;
}

// POST {B}/analytics/alerts/:id/enable  body { revision }. 200. Already enabled: the rule unchanged.
export function fakeEnableAlert(id: string, revision: number): AlertRule {
  const { idx, current } = lockedRule(id, revision);
  if (current.suspendedReason) {
    throw new ApiError(409, 'CRM_ALERT_SUSPENDED');
  }
  if (current.enabled) return current;
  const metric = FAKE_CATALOG.metrics.find((m) => m.key === current.metricKey);
  if (!metric || metric.availability !== 'AVAILABLE') {
    throw new ApiError(409, 'CRM_ALERT_SOURCE_UNAVAILABLE');
  }
  const updated: AlertRule = {
    ...current,
    state: 'ENABLED',
    enabled: true,
    nextEvaluationAt: computeNextEvaluationAt(current),
    revision: current.revision + 1,
    updatedByUserId: FAKE_ME.id,
    updatedAt: FAKE_NOW,
  };
  rulesStore[idx] = updated;
  return updated;
}

// POST {B}/analytics/alerts/:id/disable  body { revision }. 200. Already disabled: the rule unchanged.
export function fakeDisableAlert(id: string, revision: number): AlertRule {
  const { idx, current } = lockedRule(id, revision);
  if (!current.enabled) return current;
  const updated: AlertRule = {
    ...current,
    state: current.suspendedReason ? 'SUSPENDED' : 'DISABLED',
    enabled: false,
    nextEvaluationAt: null,
    revision: current.revision + 1,
    updatedByUserId: FAKE_ME.id,
    updatedAt: FAKE_NOW,
  };
  rulesStore[idx] = updated;
  return updated;
}

// POST {B}/analytics/alerts/:id/resume  body { revision }. 200. Not suspended: the rule unchanged.
export function fakeResumeAlert(id: string, revision: number): AlertRule {
  const { idx, current } = lockedRule(id, revision);
  if (!current.suspendedReason) return current;
  if (current.suspendedReason === 'OWNER_INACTIVE') {
    throw new ApiError(409, 'CRM_ALERT_SOURCE_UNAVAILABLE');
  }
  if (current.suspendedReason === 'OWNER_ACCESS_LOST') {
    throw new ApiError(403, 'CRM_ALERT_OWNER_ACCESS_LOST');
  }
  const metric = FAKE_CATALOG.metrics.find((m) => m.key === current.metricKey);
  if (current.suspendedReason === 'METRIC_RETIRED' && (!metric || metric.availability !== 'AVAILABLE')) {
    throw new ApiError(409, 'CRM_ALERT_SOURCE_UNAVAILABLE');
  }
  if (
    current.suspendedReason === 'WIDGET_UNAVAILABLE' &&
    current.widgetId &&
    !FAKE_PUBLISHED_WIDGETS.some((w) => w.id === current.widgetId)
  ) {
    throw new ApiError(409, 'CRM_ALERT_SOURCE_UNAVAILABLE');
  }
  const updated: AlertRule = {
    ...current,
    state: current.enabled ? 'ENABLED' : 'DISABLED',
    suspendedReason: null,
    nextEvaluationAt: current.enabled ? computeNextEvaluationAt(current) : null,
    revision: current.revision + 1,
    updatedByUserId: FAKE_ME.id,
    updatedAt: FAKE_NOW,
  };
  rulesStore[idx] = updated;
  return updated;
}

// DELETE {B}/analytics/alerts/:id?revision= (or If-Match). 204. Soft delete; history is kept.
export function fakeDeleteAlert(id: string, revision: number): void {
  const { idx } = lockedRule(id, revision);
  rulesStore.splice(idx, 1);
}

export function fakeListEvaluations(
  id: string,
  q: ListEvaluationsQuery = {},
): InfoPage<AlertEvaluation> {
  findRuleIndex(id);
  const nowMs = Date.parse(FAKE_NOW);
  const defaultFromMs = nowMs - DEFAULT_EVALUATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const fromMs = q.from ? Date.parse(q.from) : defaultFromMs;
  const toMs = q.to ? Date.parse(q.to) : nowMs;
  // alert-rule.service.ts: one check, details { maxDays } only (no requestedDays).
  const maxSpanMs = MAX_EVALUATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || !(fromMs < toMs) || toMs - fromMs > maxSpanMs) {
    throw new ApiError(422, 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED', { maxDays: [String(MAX_EVALUATION_WINDOW_DAYS)] });
  }

  const all = evaluationsStore.get(id) ?? [];
  const filtered = all.filter((ev) => {
    const t = Date.parse(ev.scheduledFor);
    return t >= fromMs && t <= toMs;
  });

  return pageOf(filtered, q.cursor ?? null, q.limit ?? 15);
}

export function fakeTestAlert(id: string): TestAlertResult {
  const idx = findRuleIndex(id);
  const rule = rulesStore[idx];
  const metric = FAKE_CATALOG.metrics.find((m) => m.key === rule.metricKey);
  if (!metric || metric.availability !== 'AVAILABLE') {
    return {
      value: null,
      met: false,
      cohortSize: null,
      wouldNotify: false,
      reasonCode: metric?.unavailableReason ?? 'METRIC_UNAVAILABLE',
    };
  }

  const threshold = Number(rule.threshold);
  const cohortSize = rule.minimumCohortSize ? Math.max(rule.minimumCohortSize + 70, 120) : 120;

  let value: number;
  if (rule.id === RULE_IDS[0]) {
    value = 18.5;
  } else if (rule.id === RULE_IDS[1]) {
    value = 1245000;
  } else if (rule.id === RULE_IDS[2]) {
    value = 52;
  } else if (rule.comparator === 'LT' || rule.comparator === 'LTE') {
    value = Math.round(threshold * 0.9 * 1000) / 1000;
  } else {
    value = Math.round(threshold * 1.1 * 1000) / 1000;
  }

  let met = false;
  switch (rule.comparator) {
    case 'LT':
      met = value < threshold;
      break;
    case 'LTE':
      met = value <= threshold;
      break;
    case 'GT':
      met = value > threshold;
      break;
    case 'GTE':
      met = value >= threshold;
      break;
  }

  const meetsCohort = rule.minimumCohortSize == null || cohortSize >= rule.minimumCohortSize;
  const wouldNotify = met && meetsCohort && rule.state !== 'SUSPENDED';

  return {
    value,
    met,
    cohortSize,
    wouldNotify,
    ...(rule.state === 'SUSPENDED' && rule.suspendedReason === 'OWNER_ACCESS_LOST'
      ? { reasonCode: 'CRM_SCOPED_PERMISSION_DENIED' }
      : {}),
  };
}
