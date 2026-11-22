/**
 * Fake source for the SLA policy endpoints. It follows the backend code, not the docs:
 * crm-app/src/crm/dashboards/governance/sla/sla.controller.ts, sla.dto.ts, sla-policy.service.ts,
 * sla-qualifier.registry.ts, the shared CRM ValidationPipe (400 CRM_VALIDATION_FAILED, details keyed by property
 * path with lowercase snake constraint names) and the gateway row for POST crm/sla/policies (WRITE_SENSITIVE,
 * idempotent, owner replay: the gateway checks the key, the service checks reuse).
 * Service errors carry no details (the backend throws only code + message).
 */
import {
  ApiError,
  FAKE_NOW,
  InfoPage,
  fakeDelay,
  fakeId,
  pageOf,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_BRANCHES, FAKE_ME } from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  ListSlaPoliciesQuery,
  PreviewSlaClockRequest,
  PreviewSlaClockResponse,
  PublishSlaPolicy,
  SLA_APPLIES_TO_RECORDS,
  SLA_CLOCK_KINDS,
  SLA_DIRECTIONS,
  SLA_LIMITS,
  SLA_POLICY_KINDS,
  SLA_STATES,
  SLA_TOUCH_BY_OPTIONS,
  SLA_TOUCH_SOURCES,
  SlaPolicy,
  SlaPolicyQualifying,
  activityTypesFor,
  filtersTouchesOnly,
  maxMinutesForClock,
  slaPolicyShape,
} from './sla.model';

const CAIRO_BRANCH_ID = FAKE_BRANCHES[0].id;
const ALEX_BRANCH_ID = FAKE_BRANCHES[1].id;
const GIZA_BRANCH_ID = FAKE_BRANCHES[2].id;

const BRANCH_IDS = new Set(FAKE_BRANCHES.map((branch) => branch.id.toLowerCase()));
const CALENDAR_BRANCH_IDS = new Set([CAIRO_BRANCH_ID, ALEX_BRANCH_ID].map((id) => id.toLowerCase()));

const EGYPT_FIXED_HOLIDAYS = new Set(['01-07', '04-25', '06-30', '10-06']);
/** Fake working window in UTC wall time (the real clock reads the branch calendar and its time zone). */
const WORKDAY_START_MINUTE = 9 * 60;
const WORKDAY_END_MINUTE = 17 * 60;
const CALENDAR_HORIZON_YEAR = 2027;
const DAY_MS = 86_400_000;

const policies: SlaPolicy[] = [
  // Lineage 1: Tenant default FIRST_RESPONSE (3 versions)
  {
    id: '01934b20-0000-7000-8000-000000000011',
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: null,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 60,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'OWNER',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL'],
      directions: ['OUTBOUND'],
      touchSources: ['CRM_ACTIVITY'],
    },
    nameEn: 'Standard lead first response',
    nameAr: 'الاستجابة الأولى القياسية للعملاء المحتملين',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2026-06-01T00:00:00.000Z',
    state: 'ACTIVE',
    versionNumber: 1,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: null,
    nextPolicyId: '01934b20-0000-7000-8000-000000000012',
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: '01934b20-0000-7000-8000-000000000012',
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: null,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 45,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'OWNER',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL', 'MEETING'],
      directions: ['OUTBOUND'],
      touchSources: ['CORE_ACTIVITY', 'CRM_ACTIVITY'],
    },
    nameEn: 'Standard lead first response',
    nameAr: 'الاستجابة الأولى القياسية للعملاء المحتملين',
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    effectiveTo: '2026-10-01T00:00:00.000Z',
    state: 'ACTIVE',
    versionNumber: 2,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: '01934b20-0000-7000-8000-000000000011',
    nextPolicyId: '01934b20-0000-7000-8000-000000000013',
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: '01934b20-0000-7000-8000-000000000013',
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: null,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 30,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'ANYONE',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL', 'MEETING'],
      directions: ['OUTBOUND'],
      touchSources: ['CORE_ACTIVITY', 'CRM_ACTIVITY'],
    },
    nameEn: 'Standard lead first response',
    nameAr: 'الاستجابة الأولى القياسية للعملاء المحتملين',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
    effectiveTo: null,
    state: 'ACTIVE',
    versionNumber: 3,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: '01934b20-0000-7000-8000-000000000012',
    nextPolicyId: null,
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-10-01T08:00:00.000Z',
  },

  // Lineage 2: Tenant default FOLLOW_UP_CADENCE (2 versions)
  {
    id: '01934b20-0000-7000-8000-000000000021',
    policyKind: 'FOLLOW_UP_CADENCE',
    appliesToRecord: 'LEAD',
    branchId: null,
    clockKind: 'CALENDAR_MINUTES',
    targetMinutes: 10080,
    requiredTouchCount: 2,
    compliancePct: 75,
    qualifyingTouchBy: 'OWNER',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL', 'FOLLOW_UP'],
      directions: ['OUTBOUND'],
      touchSources: ['CRM_ACTIVITY'],
    },
    nameEn: 'Weekly lead follow-up cadence',
    nameAr: 'وتيرة المتابعة الأسبوعية للعملاء المحتملين',
    effectiveFrom: '2026-02-01T00:00:00.000Z',
    effectiveTo: '2026-08-01T00:00:00.000Z',
    state: 'ACTIVE',
    versionNumber: 1,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: null,
    nextPolicyId: '01934b20-0000-7000-8000-000000000022',
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-02-01T08:00:00.000Z',
  },
  {
    id: '01934b20-0000-7000-8000-000000000022',
    policyKind: 'FOLLOW_UP_CADENCE',
    appliesToRecord: 'LEAD',
    branchId: null,
    clockKind: 'CALENDAR_MINUTES',
    targetMinutes: 10080,
    requiredTouchCount: 3,
    compliancePct: 80,
    qualifyingTouchBy: 'OWNER',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL', 'FOLLOW_UP', 'MEETING'],
      directions: ['OUTBOUND'],
      touchSources: ['CORE_ACTIVITY', 'CRM_ACTIVITY'],
    },
    nameEn: 'Weekly lead follow-up cadence',
    nameAr: 'وتيرة المتابعة الأسبوعية للعملاء المحتملين',
    effectiveFrom: '2026-08-01T00:00:00.000Z',
    effectiveTo: null,
    state: 'ACTIVE',
    versionNumber: 2,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: '01934b20-0000-7000-8000-000000000021',
    nextPolicyId: null,
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-08-01T08:00:00.000Z',
  },

  // Lineage 3: Tenant default NEXT_STEP on OPPORTUNITY (2 versions)
  {
    id: '01934b20-0000-7000-8000-000000000031',
    policyKind: 'NEXT_STEP',
    appliesToRecord: 'OPPORTUNITY',
    branchId: null,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 1440,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'OWNER',
    qualifying: {
      activityTypes: ['FOLLOW_UP', 'MEETING', 'TODO'],
      directions: null,
      touchSources: null,
    },
    nameEn: 'Opportunity next step planning',
    nameAr: 'تخطيط الخطوة التالية للفرص البيعية',
    effectiveFrom: '2026-03-01T00:00:00.000Z',
    effectiveTo: '2026-09-01T00:00:00.000Z',
    state: 'ACTIVE',
    versionNumber: 1,
    startEvent: 'STAGE_ENTRY',
    qualifyingFact: 'PLANNED_ACTIVITY',
    supersedesPolicyId: null,
    nextPolicyId: '01934b20-0000-7000-8000-000000000032',
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-03-01T08:00:00.000Z',
  },
  {
    id: '01934b20-0000-7000-8000-000000000032',
    policyKind: 'NEXT_STEP',
    appliesToRecord: 'OPPORTUNITY',
    branchId: null,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 960,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'OWNER',
    qualifying: {
      activityTypes: ['FOLLOW_UP', 'MEETING', 'TODO', 'VISIT'],
      directions: null,
      touchSources: null,
    },
    nameEn: 'Opportunity next step planning',
    nameAr: 'تخطيط الخطوة التالية للفرص البيعية',
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveTo: null,
    state: 'ACTIVE',
    versionNumber: 2,
    startEvent: 'STAGE_ENTRY',
    qualifyingFact: 'PLANNED_ACTIVITY',
    supersedesPolicyId: '01934b20-0000-7000-8000-000000000031',
    nextPolicyId: null,
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-09-01T08:00:00.000Z',
  },

  // Lineage 4: Cairo branch override FIRST_RESPONSE on LEAD (2 versions)
  {
    id: '01934b20-0000-7000-8000-000000000041',
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: CAIRO_BRANCH_ID,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 20,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'ANYONE',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL'],
      directions: ['OUTBOUND'],
      touchSources: ['CORE_ACTIVITY', 'CRM_ACTIVITY'],
    },
    nameEn: 'Cairo priority first response',
    nameAr: 'الاستجابة الأولى السريعة لفرع القاهرة',
    effectiveFrom: '2026-04-01T00:00:00.000Z',
    effectiveTo: '2026-09-15T00:00:00.000Z',
    state: 'ACTIVE',
    versionNumber: 1,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: null,
    nextPolicyId: '01934b20-0000-7000-8000-000000000042',
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-04-01T08:00:00.000Z',
  },
  {
    id: '01934b20-0000-7000-8000-000000000042',
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: CAIRO_BRANCH_ID,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 15,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'ANYONE',
    qualifying: {
      activityTypes: ['CALL', 'EMAIL'],
      directions: ['OUTBOUND'],
      touchSources: ['CORE_ACTIVITY', 'CRM_ACTIVITY'],
    },
    nameEn: 'Cairo priority first response',
    nameAr: 'الاستجابة الأولى السريعة لفرع القاهرة',
    effectiveFrom: '2026-09-15T00:00:00.000Z',
    effectiveTo: null,
    state: 'ACTIVE',
    versionNumber: 2,
    startEvent: 'ASSIGNMENT',
    qualifyingFact: 'TOUCH',
    supersedesPolicyId: '01934b20-0000-7000-8000-000000000041',
    nextPolicyId: null,
    publishedByUserId: FAKE_ME.id,
    publishedAt: '2026-09-15T08:00:00.000Z',
  },
];

/** Stored publish results per idempotency key (the service keeps only successful commands). */
const idemStore = new Map<string, { fingerprint: string; result: SlaPolicy }>();

/** Test hook: clears the stored idempotency results. */
export function resetSlaFakeIdempotency(): void {
  idemStore.clear();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_BRANCH = /^(?:tenant|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

type FieldErrors = Record<string, string[]>;

function addError(errors: FieldErrors, path: string, constraint: string): void {
  (errors[path] ??= []).push(constraint);
}

/** The global ValidationPipe: 400 CRM_VALIDATION_FAILED, details keyed by property path. */
function throwIfInvalid(errors: FieldErrors): void {
  if (Object.keys(errors).length) throw new ApiError(400, 'CRM_VALIDATION_FAILED', errors);
}

/** `forbidNonWhitelisted`: an unknown property is rejected by name. */
function checkWhitelist(errors: FieldErrors, body: object, allowed: readonly string[], prefix = ''): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) addError(errors, `${prefix}${key}`, 'whitelist_validation');
  }
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/** `IsISO8601({ strict: true })`: ISO shape and a real calendar date. */
function isIso8601(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_8601.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value);
}

/** `IsNumber({ maxDecimalPlaces: 2 })`. */
function isNumber2(value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const [, decimals = ''] = String(value).split('.');
  return decimals.length <= 2;
}

function checkIn(errors: FieldErrors, path: string, value: unknown, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) addError(errors, path, 'is_in');
}

/** Sorted-key JSON, the service's request fingerprint. */
function fingerprintOf(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprintOf).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${fingerprintOf(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** `assertReader`: crm.sla.manage OR crm.dashboards.read, else 403 CRM_PERMISSION_DENIED. */
function ensureReadPermission(): void {
  if (!can('crm.sla.manage') && !can('crm.dashboards.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
}

/** `@RequirePermissions('crm.sla.manage')` guard: 403 CRM_PERMISSION_DENIED (runs before the pipe). */
function ensureManagePermission(): void {
  if (!can('crm.sla.manage')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
}

/** `assertManager`: the branch must be an active branch the actor manages SLA in. */
function ensureBranchManager(branchId: string | null): void {
  if (branchId !== null && !BRANCH_IDS.has(branchId)) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
}

function shapeInvalid(): never {
  throw new ApiError(422, 'CRM_SLA_POLICY_SHAPE_INVALID');
}

function lineageKeyOf(kind: string, record: string, branchId: string | null | undefined): string {
  return `${kind}|${record}|${branchId?.toLowerCase() ?? 'tenant'}`;
}

function validateListQuery(q: ListSlaPoliciesQuery): void {
  const errors: FieldErrors = {};
  checkWhitelist(errors, q, ['kind', 'record', 'branchId', 'state', 'cursor', 'limit']);
  if (q.kind !== undefined) checkIn(errors, 'kind', q.kind, SLA_POLICY_KINDS);
  if (q.record !== undefined) checkIn(errors, 'record', q.record, SLA_APPLIES_TO_RECORDS);
  if (q.branchId !== undefined && !LIST_BRANCH.test(q.branchId)) addError(errors, 'branchId', 'matches');
  if (q.state !== undefined) checkIn(errors, 'state', q.state, SLA_STATES);
  if (q.cursor !== undefined && q.cursor.length > 512) addError(errors, 'cursor', 'max_length');
  if (q.limit !== undefined && String(q.limit).length > 3) addError(errors, 'limit', 'max_length');
  throwIfInvalid(errors);
}

/** `normalizePageLimit`: default 25, clamped to 1..100. */
function pageLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 25;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

export async function fakeListPolicies(q: ListSlaPoliciesQuery = {}): Promise<InfoPage<SlaPolicy>> {
  await fakeDelay();
  validateListQuery(q);
  const branch = q.branchId?.toLowerCase() ?? null;
  const filtered = policies.filter((policy) => {
    if (q.kind && policy.policyKind !== q.kind) return false;
    if (q.record && policy.appliesToRecord !== q.record) return false;
    if (branch === 'tenant' && policy.branchId !== null) return false;
    if (branch && branch !== 'tenant' && policy.branchId?.toLowerCase() !== branch) return false;
    if (q.state && policy.state !== q.state) return false;
    return true;
  });
  // ORDER BY sla.id DESC: UUIDv7 ids put the newest version first.
  const sorted = [...filtered].sort((a, b) => b.id.localeCompare(a.id));
  // The cursor is decoded before the reader check (400 CRM_DASHBOARD_LIST_CURSOR_INVALID first).
  const page = pageOf(sorted, q.cursor ?? null, pageLimit(q.limit));
  ensureReadPermission();
  return structuredClone(page);
}

export async function fakeGetPolicy(id: string): Promise<SlaPolicy> {
  await fakeDelay();
  if (!UUID.test(id)) throw new ApiError(400, 'CRM_VALIDATION_FAILED', { id: ['is_uuid'] });
  ensureReadPermission();
  const found = policies.find((policy) => policy.id === id.toLowerCase());
  if (!found) {
    throw new ApiError(404, 'CRM_DASHBOARD_RESOURCE_NOT_FOUND');
  }
  return structuredClone(found);
}

const PUBLISH_KEYS = [
  'policyKind',
  'appliesToRecord',
  'branchId',
  'clockKind',
  'targetMinutes',
  'requiredTouchCount',
  'compliancePct',
  'qualifyingTouchBy',
  'qualifying',
  'nameEn',
  'nameAr',
  'effectiveFrom',
  'state',
  'expectedSupersedesPolicyId',
] as const;
const QUALIFIER_KEYS = ['activityTypes', 'directions', 'touchSources'] as const;

/** `PublishSlaPolicyDto` + `SlaQualifyingDto` under the global ValidationPipe. */
function validatePublishBody(body: PublishSlaPolicy): void {
  const errors: FieldErrors = {};
  checkWhitelist(errors, body, PUBLISH_KEYS);
  checkIn(errors, 'policyKind', body.policyKind, SLA_POLICY_KINDS);
  checkIn(errors, 'appliesToRecord', body.appliesToRecord, SLA_APPLIES_TO_RECORDS);
  if (isPresent(body.branchId) && !UUID_V7.test(String(body.branchId))) addError(errors, 'branchId', 'is_uuid');
  checkIn(errors, 'clockKind', body.clockKind, SLA_CLOCK_KINDS);
  if (isPresent(body.targetMinutes) && !isInt(body.targetMinutes)) addError(errors, 'targetMinutes', 'is_int');
  if (isPresent(body.requiredTouchCount) && !isInt(body.requiredTouchCount)) {
    addError(errors, 'requiredTouchCount', 'is_int');
  }
  if (isPresent(body.compliancePct) && !isNumber2(body.compliancePct)) addError(errors, 'compliancePct', 'is_number');
  if (isPresent(body.qualifyingTouchBy)) checkIn(errors, 'qualifyingTouchBy', body.qualifyingTouchBy, SLA_TOUCH_BY_OPTIONS);
  if (isPresent(body.qualifying)) {
    const qualifying = body.qualifying as Record<string, unknown>;
    if (typeof qualifying !== 'object' || Array.isArray(qualifying)) {
      addError(errors, 'qualifying', 'is_object');
    } else {
      checkWhitelist(errors, qualifying, QUALIFIER_KEYS, 'qualifying.');
      for (const key of QUALIFIER_KEYS) {
        const list = qualifying[key];
        if (!isPresent(list)) continue;
        const path = `qualifying.${key}`;
        if (!Array.isArray(list)) {
          addError(errors, path, 'is_array');
          continue;
        }
        if (list.length < 1) addError(errors, path, 'array_min_size');
        if (list.length > SLA_LIMITS.maxQualifierValues) addError(errors, path, 'array_max_size');
        if (list.some((item) => typeof item !== 'string')) addError(errors, path, 'is_string');
      }
    }
  }
  for (const key of ['nameEn', 'nameAr'] as const) {
    const value: unknown = body[key];
    if (typeof value !== 'string') addError(errors, key, 'is_string');
    else if (value.length > SLA_LIMITS.maxNameLength) addError(errors, key, 'max_length');
  }
  if (isPresent(body.effectiveFrom) && !isIso8601(body.effectiveFrom)) addError(errors, 'effectiveFrom', 'is_iso8601');
  checkIn(errors, 'state', body.state, SLA_STATES);
  if (isPresent(body.expectedSupersedesPolicyId) && !UUID_V7.test(String(body.expectedSupersedesPolicyId))) {
    addError(errors, 'expectedSupersedesPolicyId', 'is_uuid');
  }
  throwIfInvalid(errors);
}

interface CheckedPolicy {
  qualifying: SlaPolicyQualifying;
  nameEn: string;
  nameAr: string;
  effectiveFrom: Date | null;
}

/** `checkPolicy`: the kind x record x state rules, answered as 422 before the idempotency reservation. */
function checkPolicy(body: PublishSlaPolicy): CheckedPolicy {
  const shape = slaPolicyShape(body.policyKind, body.appliesToRecord);
  if (!shape) shapeInvalid();
  if (body.expectedSupersedesPolicyId === undefined) shapeInvalid();
  const active = body.state === 'ACTIVE';
  const target = body.targetMinutes ?? null;
  const touches = body.requiredTouchCount ?? null;
  const pct = body.compliancePct ?? null;
  const cadence = body.policyKind === 'FOLLOW_UP_CADENCE';
  if (cadence && body.clockKind !== 'CALENDAR_MINUTES') shapeInvalid();
  if (active !== (target !== null)) shapeInvalid();
  if (target !== null && (target < 1 || target > maxMinutesForClock(body.clockKind))) shapeInvalid();
  if (!cadence && touches !== null) shapeInvalid();
  if (cadence && active && (touches === null || pct === null)) shapeInvalid();
  if (touches !== null && (touches < SLA_LIMITS.minTouchCount || touches > SLA_LIMITS.maxTouchCount)) shapeInvalid();
  if (pct !== null && !(pct > 0 && pct <= SLA_LIMITS.maxCompliancePct)) shapeInvalid();
  const nameEn = body.nameEn.trim();
  const nameAr = body.nameAr.trim();
  if (!nameEn || !nameAr || nameEn.length > SLA_LIMITS.maxNameLength || nameAr.length > SLA_LIMITS.maxNameLength) {
    shapeInvalid();
  }
  const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : null;
  const touchesOnly = filtersTouchesOnly(body.policyKind, body.appliesToRecord);
  const registry: Record<(typeof QUALIFIER_KEYS)[number], readonly string[] | null> = {
    activityTypes: activityTypesFor(body.policyKind, body.appliesToRecord),
    directions: touchesOnly ? SLA_DIRECTIONS : null,
    touchSources: touchesOnly ? SLA_TOUCH_SOURCES : null,
  };
  const qualifying: Record<(typeof QUALIFIER_KEYS)[number], string[] | null> = {
    activityTypes: null,
    directions: null,
    touchSources: null,
  };
  for (const key of QUALIFIER_KEYS) {
    const values = body.qualifying?.[key];
    if (values === undefined || values === null) continue;
    const allowed = registry[key];
    if (!allowed) shapeInvalid();
    if (values.some((value) => !allowed.includes(value))) {
      throw new ApiError(422, 'CRM_SLA_QUALIFIER_UNKNOWN');
    }
    if (new Set(values).size !== values.length) shapeInvalid();
    qualifying[key] = [...values].sort();
  }
  return { qualifying: qualifying as SlaPolicyQualifying, nameEn, nameAr, effectiveFrom };
}

/**
 * POST crm/sla/policies. Order: gateway key check, permission guard, ValidationPipe, `checkPolicy`,
 * idempotency reservation, branch authority, stale head, first-version state, backdating.
 */
export async function fakePublishPolicy(body: PublishSlaPolicy, key: string): Promise<SlaPolicy> {
  await fakeDelay();
  // Gateway (WRITE_SENSITIVE + idempotent, owner replay): only presence and UUIDv7 shape are checked at the edge.
  if (!key) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7.test(key)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  ensureManagePermission();
  validatePublishBody(body);
  const checked = checkPolicy(body);

  // CrmRequestIdempotencyService: same key + other body = 422; same key + same body = the stored result.
  const fingerprint = fingerprintOf(body);
  const normalizedKey = key.trim().toLowerCase();
  const stored = idemStore.get(normalizedKey);
  if (stored) {
    if (stored.fingerprint !== fingerprint) throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
    return structuredClone(stored.result);
  }

  const branchId = body.branchId?.toLowerCase() ?? null;
  ensureBranchManager(branchId);
  const lineage = lineageKeyOf(body.policyKind, body.appliesToRecord, branchId);
  const head =
    policies
      .filter((policy) => lineageKeyOf(policy.policyKind, policy.appliesToRecord, policy.branchId) === lineage)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
  const expectedPrevious = body.expectedSupersedesPolicyId?.toLowerCase() ?? null;
  if ((head?.id ?? null) !== expectedPrevious) {
    throw new ApiError(409, 'CRM_SLA_POLICY_STALE');
  }
  if (!head && body.state === 'RETIRED') shapeInvalid();
  const now = new Date(FAKE_NOW);
  const effective = checked.effectiveFrom ?? now;
  if (effective < now || (head && effective <= new Date(head.effectiveFrom))) {
    throw new ApiError(422, 'CRM_SLA_BACKDATED');
  }

  const shape = slaPolicyShape(body.policyKind, body.appliesToRecord)!;
  const effectiveIso = effective.toISOString();
  const created: SlaPolicy = {
    id: fakeId(),
    policyKind: body.policyKind,
    appliesToRecord: body.appliesToRecord,
    branchId,
    versionNumber: (head?.versionNumber ?? 0) + 1,
    state: body.state,
    effectiveFrom: effectiveIso,
    effectiveTo: null,
    startEvent: shape.startEvent,
    qualifyingFact: shape.qualifyingFact,
    clockKind: body.clockKind,
    targetMinutes: body.targetMinutes ?? null,
    requiredTouchCount: body.requiredTouchCount ?? null,
    compliancePct: body.compliancePct ?? null,
    qualifyingTouchBy: body.qualifyingTouchBy ?? 'OWNER',
    qualifying: checked.qualifying,
    nameEn: checked.nameEn,
    nameAr: checked.nameAr,
    supersedesPolicyId: head?.id ?? null,
    nextPolicyId: null,
    publishedByUserId: FAKE_ME.id,
    publishedAt: FAKE_NOW,
  };
  if (head) {
    // Versions are immutable; the period view closes the previous version at the new start.
    head.nextPolicyId = created.id;
    head.effectiveTo = effectiveIso;
  }
  policies.unshift(created);
  idemStore.set(normalizedKey, { fingerprint, result: structuredClone(created) });
  return structuredClone(created);
}

function validatePreviewBody(body: PreviewSlaClockRequest): void {
  const errors: FieldErrors = {};
  checkWhitelist(errors, body, ['branchId', 'from', 'minutes', 'to']);
  if (typeof body.branchId !== 'string' || !UUID_V7.test(body.branchId)) addError(errors, 'branchId', 'is_uuid');
  if (!isIso8601(body.from)) addError(errors, 'from', 'is_iso8601');
  if (isPresent(body.minutes) && !isInt(body.minutes)) addError(errors, 'minutes', 'is_int');
  if (isPresent(body.to) && !isIso8601(body.to)) addError(errors, 'to', 'is_iso8601');
  throwIfInvalid(errors);
}

function isFakeWorkingDate(utcDayMs: number): boolean {
  const date = new Date(utcDayMs);
  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 5 || dayOfWeek === 6) return false;
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return !EGYPT_FIXED_HOLIDAYS.has(`${mm}-${dd}`);
}

function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** Working minutes between two instants on the fake calendar, or null past its horizon. */
function fakeMinutesBetween(fromMs: number, toMs: number): number | null {
  if (new Date(toMs).getUTCFullYear() > CALENDAR_HORIZON_YEAR) return null;
  let total = 0;
  for (let day = startOfUtcDay(fromMs); day < toMs; day += DAY_MS) {
    if (!isFakeWorkingDate(day)) continue;
    const start = Math.max(day + WORKDAY_START_MINUTE * 60_000, fromMs);
    const end = Math.min(day + WORKDAY_END_MINUTE * 60_000, toMs);
    if (end > start) total += Math.round((end - start) / 60_000);
  }
  return total;
}

/** The instant `minutes` working minutes after `fromMs`, or null past the calendar horizon. */
function fakeDeadline(fromMs: number, minutes: number): string | null {
  let remaining = minutes;
  for (let day = startOfUtcDay(fromMs); ; day += DAY_MS) {
    if (new Date(day).getUTCFullYear() > CALENDAR_HORIZON_YEAR) return null;
    if (!isFakeWorkingDate(day)) continue;
    const start = Math.max(day + WORKDAY_START_MINUTE * 60_000, fromMs);
    const end = day + WORKDAY_END_MINUTE * 60_000;
    if (end <= start) continue;
    const available = Math.round((end - start) / 60_000);
    if (remaining <= available) return new Date(start + remaining * 60_000).toISOString();
    remaining -= available;
  }
}

/** POST crm/sla/clock/preview. Order: permission guard, ValidationPipe, range checks, branch authority. */
export async function fakePreviewClock(body: PreviewSlaClockRequest): Promise<PreviewSlaClockResponse> {
  await fakeDelay();
  ensureManagePermission();
  validatePreviewBody(body);
  const branchId = body.branchId.toLowerCase();
  const from = new Date(body.from);
  const to = isPresent(body.to) ? new Date(body.to as string) : null;
  const minutes = body.minutes ?? null;
  if (to === null && minutes === null) throw new ApiError(422, 'CRM_SLA_CLOCK_RANGE_EXCEEDED');
  if (
    to &&
    !(to.getTime() > from.getTime() && to.getTime() - from.getTime() <= SLA_LIMITS.maxClockHorizonDays * DAY_MS)
  ) {
    throw new ApiError(422, 'CRM_SLA_CLOCK_RANGE_EXCEEDED');
  }
  if (minutes !== null && (minutes < 1 || minutes > SLA_LIMITS.maxPreviewMinutes)) {
    throw new ApiError(422, 'CRM_SLA_CLOCK_RANGE_EXCEEDED');
  }
  ensureBranchManager(branchId);

  const missing =
    branchId === GIZA_BRANCH_ID.toLowerCase()
      ? ('CALENDAR_HOURS_MISSING' as const)
      : CALENDAR_BRANCH_IDS.has(branchId)
        ? null
        : ('CALENDAR_UNAVAILABLE' as const);
  let deadline: string | null = null;
  let workingMinutes: number | null = null;
  let missingReason: PreviewSlaClockResponse['missingReason'] = null;
  if (minutes !== null) {
    deadline = missing ? null : fakeDeadline(from.getTime(), minutes);
    if (!deadline) missingReason = missing ?? 'DEADLINE_BEYOND_HORIZON';
  }
  if (to !== null) {
    workingMinutes = missing ? null : fakeMinutesBetween(from.getTime(), to.getTime());
    if (workingMinutes === null) missingReason ??= missing ?? 'CALENDAR_UNAVAILABLE';
  }
  return {
    branchId,
    from: from.toISOString(),
    to: to?.toISOString() ?? null,
    minutes,
    asOf: FAKE_NOW,
    deadline,
    workingMinutes,
    missingReason,
  };
}
