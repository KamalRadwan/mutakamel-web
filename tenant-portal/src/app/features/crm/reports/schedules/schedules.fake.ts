import {
  ApiError,
  FAKE_NOW,
  type InfoPage,
  fakeDelay,
  fakeId,
  idempotencyKeyOf,
  isUuidV7,
  pageOf,
  replayOf,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_ME, FAKE_PEOPLE } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { FAKE_REPORTS } from '../catalogue/catalogue.fake';
import { fakeDashboardVisible } from '../report/report.fake';
import {
  SUBSCRIPTION_PERIOD_TOKENS,
  type CreateSubscription,
  type Delivery,
  type DeliveryCapabilities,
  type DeliverySkipReason,
  type DeliveryStatus,
  type Subscription,
  type SubscriptionAttachmentFormat,
  type SubscriptionListPage,
  type UpdateSubscription,
} from './schedules.model';

// Fake of /api/v1/crm/analytics/subscriptions, following crm-app delivery/subscriptions (controller, DTO, service).

export const REPORT_SUBSCRIPTIONS_WIRED = true;

const MANAGE = 'crm.subscriptions.manage';
const MAX_NAME_LENGTH = 120;
const MAX_RECIPIENTS = 50;
const MAX_ATTACHMENTS = 3;
const MIN_TTL_HOURS = 1;
const MAX_TTL_HOURS = 720;
const MAX_ATTACHMENT_TTL_HOURS = 168;
const DEFAULT_TTL_HOURS = 168;
const FILTERS_MAX_BYTES = 16_384;
const LIST_LIMIT_DEFAULT = 25;
const LIST_LIMIT_MAX = 100;
const MAX_REVISION = 2_147_483_647;
const DAY_MS = 24 * 60 * 60 * 1000;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const RECURRENCES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
const ATTACHMENT_FORMATS: readonly SubscriptionAttachmentFormat[] = ['PDF', 'XLSX', 'CSV'];
const BODY_FIELDS = [
  'name', 'filters', 'periodToken', 'recurrence', 'scheduleWeekday', 'scheduleMonthDay', 'scheduleMinute',
  'timeZone', 'startsOn', 'endsOn', 'recipients', 'attachmentFormats', 'linkTtlHours', 'locale',
];
const CREATE_FIELDS = new Set([...BODY_FIELDS, 'dashboardId', 'reportKey']);
const UPDATE_FIELDS = new Set([...BODY_FIELDS, 'revision']);

/** The PDF renderer is not available: CSV and XLSX only. */
export const FAKE_CAPABILITIES: DeliveryCapabilities = {
  formats: [
    { format: 'CSV', available: true },
    { format: 'XLSX', available: true },
    { format: 'PDF', available: false, reason: 'PDF_RENDERER_UNAVAILABLE' },
  ],
};

/** The owner's REPORT row per report key, created on first use (`ensureReportDashboard`). */
const reportRows = new Map<string, string>([
  ['lead-acquisition', '01934b60-0000-7000-8000-000000000001'],
  ['won-sales-cycle', '01934b60-0000-7000-8000-000000000041'],
]);

function reportRowId(reportKey: string): string {
  if (!FAKE_REPORTS.some((report) => report.reportKey === reportKey)) {
    throw new ApiError(404, 'CRM_REPORT_NOT_FOUND');
  }
  let id = reportRows.get(reportKey);
  if (!id) {
    id = fakeId();
    reportRows.set(reportKey, id);
  }
  return id;
}

let clockTick = 0;

function nextFakeInstant(): string {
  clockTick += 1000;
  return new Date(Date.parse(FAKE_NOW) + clockTick).toISOString();
}

type ScheduleFields = Pick<
  Subscription,
  'recurrence' | 'scheduleWeekday' | 'scheduleMonthDay' | 'scheduleMinute' | 'timeZone' | 'startsOn' | 'endsOn'
>;

/** Next slot after FAKE_NOW (UTC approximation), or null when the schedule has ended. */
function computeNextRunAt(sub: ScheduleFields): string | null {
  const now = new Date(FAKE_NOW);
  const startMs = Math.max(Date.parse(`${sub.startsOn}T00:00:00.000Z`), now.getTime() + DAY_MS);
  const anchor = new Date(startMs);
  let target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  if (sub.recurrence === 'WEEKLY' && sub.scheduleWeekday !== null) {
    target = new Date(target.getTime() + ((sub.scheduleWeekday - target.getUTCDay() + 7) % 7) * DAY_MS);
  } else if (sub.recurrence === 'MONTHLY' && sub.scheduleMonthDay !== null) {
    const monthDay = sub.scheduleMonthDay;
    const slotIn = (year: number, month: number) =>
      new Date(Date.UTC(year, month, monthDay === -1 ? new Date(Date.UTC(year, month + 1, 0)).getUTCDate() : monthDay));
    const year = target.getUTCFullYear();
    const month = target.getUTCMonth();
    const candidate = slotIn(year, month);
    target = candidate < target ? slotIn(year, month + 1) : candidate;
  }
  target.setUTCHours(Math.floor(sub.scheduleMinute / 60), sub.scheduleMinute % 60, 0, 0);
  if (sub.endsOn && target.toISOString().slice(0, 10) > sub.endsOn) return null;
  return target.toISOString();
}

const initialSubscriptions: Subscription[] = [
  {
    id: '01934b30-0000-7000-8000-000000000001',
    name: 'Weekly sales executive digest',
    ownerUserId: FAKE_ME.id,
    enabled: true,
    suspendedReason: null,
    dashboardId: '01934b10-0000-7000-8000-000000001003',
    reportKey: null,
    periodToken: 'LAST_COMPLETED_WEEK',
    filters: {},
    locale: 'en',
    recurrence: 'WEEKLY',
    scheduleWeekday: 0,
    scheduleMonthDay: null,
    scheduleMinute: 540,
    timeZone: 'Africa/Cairo',
    startsOn: '2026-09-01',
    endsOn: null,
    recipients: [FAKE_PEOPLE[0].id, FAKE_PEOPLE[1].id, FAKE_PEOPLE[2].id],
    attachmentFormats: ['CSV'],
    linkTtlHours: 168,
    nextRunAt: '2026-11-22T09:00:00.000Z',
    lastRunAt: '2026-11-15T09:00:00.000Z',
    revision: 4,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-11-15T09:05:00.000Z',
  },
  {
    id: '01934b30-0000-7000-8000-000000000002',
    name: 'ملخص مسار بيع القاهرة اليومي',
    ownerUserId: FAKE_ME.id,
    enabled: false,
    suspendedReason: null,
    dashboardId: '01934b10-0000-7000-8000-000000001002',
    reportKey: null,
    periodToken: 'PREVIOUS_DAY',
    filters: {},
    locale: 'ar',
    recurrence: 'DAILY',
    scheduleWeekday: null,
    scheduleMonthDay: null,
    scheduleMinute: 510,
    timeZone: 'Africa/Cairo',
    startsOn: '2026-10-01',
    endsOn: '2026-12-31',
    recipients: [FAKE_PEOPLE[0].id, FAKE_PEOPLE[3].id],
    attachmentFormats: [],
    linkTtlHours: 240,
    nextRunAt: null,
    lastRunAt: '2026-11-19T08:30:00.000Z',
    revision: 3,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-11-19T12:15:00.000Z',
  },
  {
    id: '01934b30-0000-7000-8000-000000000003',
    name: 'Monthly lead acquisition report',
    ownerUserId: FAKE_ME.id,
    enabled: true,
    suspendedReason: null,
    dashboardId: '01934b60-0000-7000-8000-000000000001',
    reportKey: 'lead-acquisition',
    periodToken: 'LAST_COMPLETED_MONTH',
    filters: {},
    locale: 'en',
    recurrence: 'MONTHLY',
    scheduleWeekday: null,
    scheduleMonthDay: 1,
    scheduleMinute: 540,
    timeZone: 'Africa/Cairo',
    startsOn: '2026-08-01',
    endsOn: null,
    recipients: [FAKE_PEOPLE[0].id, FAKE_PEOPLE[1].id, FAKE_PEOPLE[4].id, FAKE_PEOPLE[5].id],
    attachmentFormats: ['CSV', 'XLSX'],
    linkTtlHours: 168,
    nextRunAt: '2026-12-01T09:00:00.000Z',
    lastRunAt: '2026-11-01T09:00:00.000Z',
    revision: 2,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:02:00.000Z',
  },
  {
    id: '01934b30-0000-7000-8000-000000000004',
    name: 'تقرير الإيرادات الرابحة الشهري',
    ownerUserId: FAKE_ME.id,
    enabled: false,
    suspendedReason: null,
    dashboardId: '01934b60-0000-7000-8000-000000000041',
    reportKey: 'won-sales-cycle',
    periodToken: 'LAST_COMPLETED_QUARTER',
    filters: {},
    locale: 'ar',
    recurrence: 'MONTHLY',
    scheduleWeekday: null,
    scheduleMonthDay: -1,
    scheduleMinute: 1020,
    timeZone: 'Africa/Cairo',
    startsOn: '2026-07-01',
    endsOn: null,
    recipients: [FAKE_PEOPLE[2].id, FAKE_PEOPLE[6].id],
    attachmentFormats: ['XLSX'],
    linkTtlHours: 72,
    nextRunAt: null,
    lastRunAt: '2026-10-31T17:00:00.000Z',
    revision: 5,
    createdAt: '2026-07-01T11:00:00.000Z',
    updatedAt: '2026-11-02T14:20:00.000Z',
  },
  {
    id: '01934b30-0000-7000-8000-000000000005',
    name: 'Branch conversion review',
    ownerUserId: FAKE_ME.id,
    enabled: true,
    suspendedReason: 'OWNER_ACCESS_LOST',
    dashboardId: '01934b10-0000-7000-8000-000000001001',
    reportKey: null,
    periodToken: 'WEEK_TO_DATE',
    filters: {},
    locale: 'en',
    recurrence: 'WEEKLY',
    scheduleWeekday: 1,
    scheduleMonthDay: null,
    scheduleMinute: 600,
    timeZone: 'Africa/Cairo',
    startsOn: '2026-09-15',
    endsOn: null,
    recipients: [FAKE_PEOPLE[0].id, FAKE_PEOPLE[4].id, FAKE_PEOPLE[7].id],
    attachmentFormats: ['CSV'],
    linkTtlHours: 120,
    nextRunAt: null,
    lastRunAt: '2026-11-16T10:00:00.000Z',
    revision: 6,
    createdAt: '2026-09-15T09:00:00.000Z',
    updatedAt: '2026-11-18T08:00:00.000Z',
  },
];

const DELIVERY_STATUS_PATTERN: readonly DeliveryStatus[] = [
  'SENT', 'SKIPPED', 'SENT', 'SKIPPED', 'FAILED', 'SKIPPED', 'PENDING', 'SENT', 'SKIPPED', 'SENT',
];

const DELIVERY_SKIP_PATTERN: readonly DeliverySkipReason[] = [
  'NO_DELIVERY_ADDRESS',
  'PERMISSION_CHANGED',
  'SOURCE_NOT_READY',
  'RECIPIENT_INACTIVE',
  'ENTITLEMENT_EXPIRED',
  'REPORT_UNAVAILABLE',
  'ENTITLEMENT_REVOKED',
  'OWNER_INACTIVE',
];

function buildSeedDeliveries(subs: readonly Subscription[]): Map<string, Delivery[]> {
  const map = new Map<string, Delivery[]>();
  const baseMs = Date.parse('2026-11-20T09:00:00.000Z');
  subs.forEach((sub, subIdx) => {
    const items = Array.from({ length: 10 }, (_, idx): Delivery => {
      const status = DELIVERY_STATUS_PATTERN[(idx + subIdx) % DELIVERY_STATUS_PATTERN.length];
      const scheduledFor = new Date(baseMs - (idx * 2 + subIdx) * DAY_MS).toISOString();
      const sent = status === 'SENT';
      const openedCount = sent ? (idx % 3 === 0 ? 0 : (idx % 4) + 1) : 0;
      return {
        id: `01934b35-${String(subIdx + 1).padStart(4, '0')}-7000-8000-${String(idx + 1).padStart(12, '0')}`,
        recipientUserId: sub.recipients[idx % sub.recipients.length],
        scheduledFor,
        status,
        ...(status === 'SKIPPED' ? { skipReason: DELIVERY_SKIP_PATTERN[(idx + subIdx) % DELIVERY_SKIP_PATTERN.length] } : {}),
        attempts: status === 'PENDING' ? 0 : status === 'FAILED' ? 3 : 1,
        ...(sent ? { sentAt: new Date(Date.parse(scheduledFor) + 12_000).toISOString() } : {}),
        openedCount,
        ...(openedCount > 0 ? { lastOpenedAt: new Date(Date.parse(scheduledFor) + 45 * 60_000).toISOString() } : {}),
      };
    });
    map.set(sub.id, items);
  });
  return map;
}

const store: Subscription[] = structuredClone(initialSubscriptions);
const deliveriesStore: Map<string, Delivery[]> = buildSeedDeliveries(initialSubscriptions);
const idempotencyStore = new Map<string, { fingerprint: string; response: Subscription & { capabilities: DeliveryCapabilities } }>();

// ---------- validation (global ValidationPipe → 400 CRM_VALIDATION_FAILED, details { field: [constraint] }) ----------

type Details = Record<string, string[]>;

function addDetail(details: Details, field: string, constraint: string): void {
  (details[field] ??= []).push(constraint);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isCivilDate(value: unknown): boolean {
  if (typeof value !== 'string' || !CIVIL_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function checkIntRange(details: Details, field: string, value: unknown, min: number, max: number): void {
  if (value === undefined || value === null) return;
  if (!isInt(value)) addDetail(details, field, 'is_int');
  else if (value < min) addDetail(details, field, 'min');
  else if (value > max) addDetail(details, field, 'max');
}

function checkBodyFields(details: Details, body: Record<string, unknown>): void {
  const { name, periodToken, recurrence, timeZone, startsOn, endsOn, recipients, attachmentFormats, locale, filters } = body;
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string') addDetail(details, 'name', 'is_string');
    else {
      const trimmed = name.trim();
      if (trimmed.length < 1) addDetail(details, 'name', 'min_length');
      if (trimmed.length > MAX_NAME_LENGTH) addDetail(details, 'name', 'max_length');
      if (/[\r\n]/.test(trimmed)) addDetail(details, 'name', 'matches');
    }
  }
  if (filters !== undefined && filters !== null && (typeof filters !== 'object' || Array.isArray(filters))) {
    addDetail(details, 'filters', 'is_object');
  }
  if (periodToken !== undefined && periodToken !== null && !SUBSCRIPTION_PERIOD_TOKENS.includes(periodToken as never)) {
    addDetail(details, 'periodToken', 'is_in');
  }
  if (recurrence !== undefined && recurrence !== null && !RECURRENCES.includes(recurrence as never)) {
    addDetail(details, 'recurrence', 'is_in');
  }
  checkIntRange(details, 'scheduleWeekday', body['scheduleWeekday'], 0, 6);
  checkIntRange(details, 'scheduleMonthDay', body['scheduleMonthDay'], -1, 28);
  checkIntRange(details, 'scheduleMinute', body['scheduleMinute'], 0, 1439);
  if (timeZone !== undefined && timeZone !== null && (typeof timeZone !== 'string' || timeZone.trim().length > 64)) {
    addDetail(details, 'timeZone', typeof timeZone !== 'string' ? 'is_string' : 'max_length');
  }
  if (startsOn !== undefined && startsOn !== null && !isCivilDate(startsOn)) addDetail(details, 'startsOn', 'is_date_string');
  if (endsOn !== undefined && endsOn !== null && !isCivilDate(endsOn)) addDetail(details, 'endsOn', 'is_date_string');
  if (recipients !== undefined && recipients !== null) {
    if (!Array.isArray(recipients)) addDetail(details, 'recipients', 'is_array');
    else {
      if (recipients.length < 1) addDetail(details, 'recipients', 'array_min_size');
      if (recipients.length > MAX_RECIPIENTS * 2) addDetail(details, 'recipients', 'array_max_size');
      if (!recipients.every(isUuidV7)) addDetail(details, 'recipients', 'is_uuid');
    }
  }
  if (attachmentFormats !== undefined && attachmentFormats !== null) {
    if (!Array.isArray(attachmentFormats)) addDetail(details, 'attachmentFormats', 'is_array');
    else {
      if (attachmentFormats.length > MAX_ATTACHMENTS) addDetail(details, 'attachmentFormats', 'array_max_size');
      if (!attachmentFormats.every((format) => ATTACHMENT_FORMATS.includes(format))) addDetail(details, 'attachmentFormats', 'is_in');
    }
  }
  checkIntRange(details, 'linkTtlHours', body['linkTtlHours'], MIN_TTL_HOURS, MAX_TTL_HOURS);
  if (locale !== undefined && locale !== null && locale !== 'ar' && locale !== 'en') addDetail(details, 'locale', 'is_in');
}

function assertDto(body: Record<string, unknown>, allowed: ReadonlySet<string>, extra?: (details: Details) => void): void {
  const details: Details = {};
  // `undefined` values never reach the wire (JSON drops them), so only sent keys are checked.
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && !allowed.has(key)) addDetail(details, key, 'whitelist_validation');
  }
  checkBodyFields(details, body);
  extra?.(details);
  if (Object.keys(details).length > 0) throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
}

/** Body revision of update / enable / disable / resume / delete (`SubscriptionRevisionDto`). */
function expectedRevision(revision: number | undefined): number {
  const details: Details = {};
  checkIntRange(details, 'revision', revision, 1, MAX_REVISION);
  if (Object.keys(details).length > 0) throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  if (revision === undefined) throw new ApiError(400, 'CRM_DASHBOARD_REVISION_MISMATCH');
  return revision;
}

// ---------- service rules (422 / 404 / 409 / 403) ----------

/** subscription.service.ts scheduleInvalid: details { problems: [lowercase problem tokens] }, in check order. */
function scheduleInvalid(problems: readonly string[]): ApiError {
  return new ApiError(422, 'CRM_SUBSCRIPTION_SCHEDULE_INVALID', { problems: [...problems] });
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** subscription-schedule.ts `validateSubscriptionSchedule`: the problem tokens, lowercased as the service sends them. */
function scheduleProblems(input: ScheduleFields): string[] {
  const weekly = input.recurrence === 'WEEKLY';
  const monthly = input.recurrence === 'MONTHLY';
  const problems: string[] = [];
  if (!isInt(input.scheduleMinute) || input.scheduleMinute < 0 || input.scheduleMinute > 1439) problems.push('minute_range');
  if (weekly && input.scheduleWeekday === null) problems.push('weekday_required');
  if (!weekly && input.scheduleWeekday !== null) problems.push('weekday_forbidden');
  if (monthly && input.scheduleMonthDay === null) problems.push('month_day_required');
  if (!monthly && input.scheduleMonthDay !== null) problems.push('month_day_forbidden');
  if (!isValidTimeZone(input.timeZone)) problems.push('time_zone_invalid');
  const startsValid = isCivilDate(input.startsOn);
  const endsValid = input.endsOn === null || isCivilDate(input.endsOn);
  if (!startsValid || !endsValid) problems.push('date_invalid');
  if (startsValid && input.endsOn !== null && endsValid && input.endsOn < input.startsOn) problems.push('ends_before_starts');
  return problems;
}

function uniqueRecipients(ids: readonly string[]): string[] {
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
  if (unique.length < 1 || unique.length > MAX_RECIPIENTS) throw new ApiError(422, 'CRM_SUBSCRIPTION_RECIPIENTS_INVALID');
  return unique;
}

function assertActiveRecipients(ids: readonly string[]): void {
  const active = new Set(FAKE_PEOPLE.map((person) => person.id.toLowerCase()));
  if (!ids.every((id) => active.has(id))) throw new ApiError(422, 'CRM_SUBSCRIPTION_RECIPIENTS_INVALID');
}

function normalizedAttachments(formats: readonly SubscriptionAttachmentFormat[], linkTtlHours: number): SubscriptionAttachmentFormat[] {
  const unique = [...new Set(formats)];
  if (unique.length > 0 && linkTtlHours > MAX_ATTACHMENT_TTL_HOURS) {
    throw new ApiError(422, 'CRM_SUBSCRIPTION_ATTACHMENT_TTL_INVALID');
  }
  return unique;
}

function assertPdfAvailable(formats: readonly SubscriptionAttachmentFormat[]): void {
  const pdf = FAKE_CAPABILITIES.formats.find((entry) => entry.format === 'PDF');
  if (formats.includes('PDF') && !pdf?.available) {
    throw new ApiError(422, 'CRM_EXPORT_FORMAT_INVALID', { reason: ['pdf_renderer_unavailable'] });
  }
}

function boundedFilters(filters: Record<string, unknown> | undefined): Record<string, unknown> {
  const value = filters ?? {};
  if (new TextEncoder().encode(JSON.stringify(value)).length > FILTERS_MAX_BYTES) throw scheduleInvalid(['filters_too_large']);
  return value;
}

function assertCanManage(...extra: string[]): void {
  if (![MANAGE, ...extra].every((permission) => can(permission))) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
}

/** A recipient sees the schedule and their own id, not the owner's filters or the other recipients. */
function viewOf(sub: Subscription, viewerId: string): Subscription {
  if (sub.ownerUserId === viewerId) return structuredClone(sub);
  return { ...structuredClone(sub), filters: {}, recipients: [viewerId] };
}

/** `lockOwned`: 404 hides other users' rows, then the revision must match. */
function lockOwned(id: string, expected: number): Subscription {
  const sub = store.find((item) => item.id === id && item.ownerUserId === FAKE_ME.id);
  if (!sub) throw new ApiError(404, 'CRM_SUBSCRIPTION_NOT_FOUND');
  if (sub.revision !== expected) throw new ApiError(409, 'CRM_SUBSCRIPTION_REVISION_STALE');
  return sub;
}

function touch(sub: Subscription): Subscription {
  sub.updatedAt = nextFakeInstant();
  sub.revision += 1;
  return structuredClone(sub);
}

/** `writeLive`: enabled, not suspended, with a computed next run. */
function writeLive(sub: Subscription): Subscription {
  const nextRunAt = computeNextRunAt(sub);
  if (!nextRunAt) throw scheduleInvalid(['no_next_run']);
  sub.enabled = true;
  sub.suspendedReason = null;
  sub.nextRunAt = nextRunAt;
  return touch(sub);
}

/** Fake owner-access check: an access loss stays lost, an inactive owner is a 409. */
function assertOwnerAccess(sub: Subscription): void {
  if (sub.suspendedReason === 'OWNER_INACTIVE') throw new ApiError(409, 'CRM_SUBSCRIPTION_SUSPENDED');
  if (sub.suspendedReason === 'OWNER_ACCESS_LOST' || sub.suspendedReason === 'REPORT_DELETED') {
    throw new ApiError(403, 'CRM_SUBSCRIPTION_OWNER_ACCESS_LOST');
  }
}

function resolveTarget(body: CreateSubscription): string {
  if (body.dashboardId) {
    // The backend checks VIEW access on the dashboard (subscription.service.ts).
    if (!fakeDashboardVisible(body.dashboardId)) throw new ApiError(422, 'CRM_SUBSCRIPTION_TARGET_INVALID');
    return body.dashboardId.toLowerCase();
  }
  if (!REPORT_SUBSCRIPTIONS_WIRED) throw new ApiError(422, 'CRM_SUBSCRIPTION_TARGET_INVALID');
  return reportRowId(body.reportKey!);
}

function listLimit(limit: number | undefined): number {
  const details: Details = {};
  checkIntRange(details, 'limit', limit, 1, LIST_LIMIT_MAX);
  if (Object.keys(details).length > 0) throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  return limit ?? LIST_LIMIT_DEFAULT;
}

// ---------- endpoints ----------

// GET /api/v1/crm/analytics/subscriptions?box=owned|received&cursor&limit
export async function fakeListSubscriptions(
  cursor: string | null = null,
  limit?: number,
  box: 'owned' | 'received' = 'owned',
): Promise<SubscriptionListPage> {
  await fakeDelay();
  assertCanManage();
  const me = FAKE_ME.id;
  const rows = store
    .filter((sub) => (box === 'received' ? sub.recipients.includes(me) : sub.ownerUserId === me))
    .sort((a, b) => (a.updatedAt === b.updatedAt ? (a.id < b.id ? 1 : -1) : a.updatedAt < b.updatedAt ? 1 : -1))
    .map((sub) => viewOf(sub, me));
  return { ...pageOf(rows, cursor, listLimit(limit)), capabilities: structuredClone(FAKE_CAPABILITIES) };
}

// GET /api/v1/crm/analytics/subscriptions/:id (owner or recipient)
export async function fakeGetSubscription(id: string): Promise<Subscription> {
  await fakeDelay();
  assertCanManage();
  const me = FAKE_ME.id;
  const sub = store.find((item) => item.id === id && (item.ownerUserId === me || item.recipients.includes(me)));
  if (!sub) throw new ApiError(404, 'CRM_SUBSCRIPTION_NOT_FOUND');
  return viewOf(sub, me);
}

// POST /api/v1/crm/analytics/subscriptions (201, header x-idempotency-key; created disabled)
export async function fakeCreateSubscription(
  body: CreateSubscription,
  key: string,
): Promise<Subscription & { capabilities: DeliveryCapabilities }> {
  await fakeDelay();
  assertCanManage('crm.dashboards.read');
  assertDto(body as unknown as Record<string, unknown>, CREATE_FIELDS, (details) => {
    if (body.dashboardId !== undefined && body.dashboardId !== null && !isUuidV7(body.dashboardId)) {
      addDetail(details, 'dashboardId', 'is_uuid');
    }
    if (body.reportKey !== undefined && body.reportKey !== null && !REPORT_KEY.test(body.reportKey)) {
      addDetail(details, 'reportKey', 'matches');
    }
  });
  const idemKey = idempotencyKeyOf(key);
  const fingerprint = JSON.stringify(body);
  const replay = replayOf(idempotencyStore, idemKey, fingerprint);
  if (replay) return structuredClone(replay);

  const hasDashboard = typeof body.dashboardId === 'string';
  const hasReport = typeof body.reportKey === 'string';
  if (hasDashboard === hasReport) throw new ApiError(422, 'CRM_SUBSCRIPTION_TARGET_INVALID');
  if (!body.name || !body.periodToken || !body.recurrence || body.scheduleMinute === undefined || !body.timeZone ||
    !body.startsOn || !body.recipients) {
    throw scheduleInvalid(['required_field_missing']);
  }
  const schedule: ScheduleFields = {
    recurrence: body.recurrence,
    scheduleMinute: body.scheduleMinute,
    scheduleWeekday: body.scheduleWeekday ?? null,
    scheduleMonthDay: body.scheduleMonthDay ?? null,
    timeZone: body.timeZone.trim(),
    startsOn: body.startsOn,
    endsOn: body.endsOn ?? null,
  };
  const scheduleIssues = scheduleProblems(schedule);
  if (scheduleIssues.length > 0) throw scheduleInvalid(scheduleIssues);
  const recipients = uniqueRecipients(body.recipients);
  const linkTtlHours = body.linkTtlHours ?? DEFAULT_TTL_HOURS;
  const attachmentFormats = normalizedAttachments(body.attachmentFormats ?? [], linkTtlHours);
  assertPdfAvailable(attachmentFormats);
  const filters = boundedFilters(body.filters);
  assertActiveRecipients(recipients);
  const dashboardId = resolveTarget(body);

  const now = nextFakeInstant();
  const created: Subscription = {
    id: fakeId(),
    name: body.name.trim(),
    ownerUserId: FAKE_ME.id,
    enabled: false,
    suspendedReason: null,
    dashboardId,
    reportKey: body.reportKey ?? null,
    periodToken: body.periodToken,
    filters,
    locale: body.locale ?? 'ar',
    ...schedule,
    recipients,
    attachmentFormats,
    linkTtlHours,
    nextRunAt: null,
    lastRunAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  store.unshift(created);
  deliveriesStore.set(created.id, []);
  const response = { ...structuredClone(created), capabilities: structuredClone(FAKE_CAPABILITIES) };
  idempotencyStore.set(idemKey, { fingerprint, response });
  return structuredClone(response);
}

// PATCH /api/v1/crm/analytics/subscriptions/:id (owner only; revision or If-Match)
export async function fakeUpdateSubscription(id: string, body: UpdateSubscription): Promise<Subscription> {
  await fakeDelay();
  assertCanManage();
  assertDto(body as unknown as Record<string, unknown>, UPDATE_FIELDS);
  const current = lockOwned(id, expectedRevision(body.revision));

  const recurrence = body.recurrence ?? current.recurrence;
  if (body.scheduleWeekday !== undefined && recurrence !== 'WEEKLY') throw scheduleInvalid(['weekday_forbidden']);
  if (body.scheduleMonthDay !== undefined && recurrence !== 'MONTHLY') throw scheduleInvalid(['month_day_forbidden']);
  const next: ScheduleFields = {
    recurrence,
    scheduleMinute: body.scheduleMinute ?? current.scheduleMinute,
    timeZone: body.timeZone?.trim() ?? current.timeZone,
    startsOn: body.startsOn ?? current.startsOn,
    endsOn: body.endsOn === undefined ? current.endsOn : body.endsOn,
    // A recurrence change drops the day column the new recurrence does not use.
    scheduleWeekday: recurrence === 'WEEKLY' ? (body.scheduleWeekday ?? current.scheduleWeekday) : null,
    scheduleMonthDay: recurrence === 'MONTHLY' ? (body.scheduleMonthDay ?? current.scheduleMonthDay) : null,
  };
  const nextIssues = scheduleProblems(next);
  if (nextIssues.length > 0) throw scheduleInvalid(nextIssues);
  const recipients = body.recipients ? uniqueRecipients(body.recipients) : current.recipients;
  if (body.recipients) assertActiveRecipients(recipients);
  const linkTtlHours = body.linkTtlHours ?? current.linkTtlHours;
  const attachmentFormats = normalizedAttachments(body.attachmentFormats ?? current.attachmentFormats, linkTtlHours);
  if (body.attachmentFormats) assertPdfAvailable(attachmentFormats);
  const filters = boundedFilters(body.filters ?? current.filters);

  const scheduleChanged = (Object.keys(next) as (keyof ScheduleFields)[]).some((field) => next[field] !== current[field]);
  const live = current.enabled && !current.suspendedReason;
  Object.assign(current, next, {
    name: body.name?.trim() ?? current.name,
    periodToken: body.periodToken ?? current.periodToken,
    filters,
    locale: body.locale ?? current.locale,
    recipients,
    attachmentFormats,
    linkTtlHours,
    // A name-only edit keeps the slot; a paused or suspended row has no next run.
    nextRunAt: live ? (scheduleChanged ? computeNextRunAt(next) : current.nextRunAt) : null,
  });
  return touch(current);
}

// POST /api/v1/crm/analytics/subscriptions/:id/enable (200)
export async function fakeEnableSubscription(id: string, revision?: number): Promise<Subscription> {
  await fakeDelay();
  assertCanManage();
  const sub = lockOwned(id, expectedRevision(revision));
  if (sub.suspendedReason) throw new ApiError(409, 'CRM_SUBSCRIPTION_SUSPENDED');
  return writeLive(sub);
}

// POST /api/v1/crm/analytics/subscriptions/:id/disable (200)
export async function fakeDisableSubscription(id: string, revision?: number): Promise<Subscription> {
  await fakeDelay();
  assertCanManage();
  const sub = lockOwned(id, expectedRevision(revision));
  sub.enabled = false;
  sub.nextRunAt = null;
  return touch(sub);
}

// POST /api/v1/crm/analytics/subscriptions/:id/resume (200; suspended rows only)
export async function fakeResumeSubscription(id: string, revision?: number): Promise<Subscription> {
  await fakeDelay();
  assertCanManage();
  const sub = lockOwned(id, expectedRevision(revision));
  if (!sub.suspendedReason) throw new ApiError(409, 'CRM_SUBSCRIPTION_REVISION_STALE');
  assertOwnerAccess(sub);
  return writeLive(sub);
}

// DELETE /api/v1/crm/analytics/subscriptions/:id (204; soft delete)
export async function fakeDeleteSubscription(id: string, revision?: number): Promise<void> {
  await fakeDelay();
  assertCanManage();
  const sub = lockOwned(id, expectedRevision(revision));
  store.splice(store.indexOf(sub), 1);
  deliveriesStore.delete(id);
}

// GET /api/v1/crm/analytics/subscriptions/:id/deliveries?cursor&limit&from&to (owner only, newest first)
export async function fakeListDeliveries(
  id: string,
  cursor: string | null = null,
  limit?: number,
): Promise<InfoPage<Delivery>> {
  await fakeDelay();
  assertCanManage();
  const pageLimit = listLimit(limit);
  const sub = store.find((item) => item.id === id && item.ownerUserId === FAKE_ME.id);
  if (!sub) throw new ApiError(404, 'CRM_SUBSCRIPTION_NOT_FOUND');
  const items = [...(deliveriesStore.get(id) ?? [])].sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1));
  return structuredClone(pageOf(items, cursor, pageLimit));
}
