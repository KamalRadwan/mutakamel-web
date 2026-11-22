/**
 * Fake sales-target source. It follows the crm-app code, not the docs:
 * - routes and DTOs: crm/dashboards/dashboard-sales-targets.controller.ts, dto/dashboard-sales-target.dto.ts,
 *   governance/targets/targets-approval.dto.ts;
 * - service checks and their order: dashboard-sales-targets.service.ts, governance/targets/target-approval.service.ts;
 * - the global ValidationPipe runs first (400 CRM_VALIDATION_FAILED, details keyed by property path);
 * - x-idempotency-key is checked by the Gateway on approve and corrections only (WRITE_SENSITIVE + idempotent),
 *   and the CRM owner replays or rejects a reused key (request-idempotency.service.ts).
 * Error details are string arrays only; every other field is dropped by the shared error filter.
 */
import {
  ApiError,
  FAKE_NOW,
  FlatPage,
  InfoPage,
  fakeDelay,
  fakeId,
  isUuidV7,
  pageOf,
  requestFingerprint,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_BRANCHES, FAKE_ME, FAKE_PEOPLE, FAKE_TEAMS } from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  ApproveTargetBody,
  CorrectTargetBody,
  CreateTargetBody,
  ListTargetsQuery,
  RejectTargetBody,
  SalesTarget,
  SubmitTargetBody,
  TARGETABLE_METRICS,
  TARGET_MAX_TEAMS,
  TARGET_MAX_VALUE,
  TARGET_MIN_TEAMS,
  TARGET_TIME_ZONE,
  TargetApprovalResult,
  TargetApprovalState,
  TargetMeasureKind,
  TargetMetricUnit,
  TargetPeriodGrain,
  TargetRelease,
  TargetSubjectType,
  TargetTeamSubject,
  TargetableMetric,
  UpdateTargetBody,
  isPeriodClosed,
  periodBounds,
  resolveTargetSubjectName,
  validateTargetValue,
} from './targets.model';

const BR_CAIRO = FAKE_BRANCHES[0].id;
const BR_ALEX = FAKE_BRANCHES[1].id;
const BR_GIZA = FAKE_BRANCHES[2].id;

const TM_CAIRO_SALES = FAKE_TEAMS[0].id;
const TM_CAIRO_CORP = FAKE_TEAMS[1].id;
const TM_ALEX_SALES = FAKE_TEAMS[2].id;
const TM_GIZA_SALES = FAKE_TEAMS[3].id;

const USR_NADA = FAKE_PEOPLE[0].id;
const USR_ALI = FAKE_PEOPLE[1].id;
const USR_SARA = FAKE_PEOPLE[2].id;
const USR_OMAR = FAKE_PEOPLE[3].id;
const USR_MONA = FAKE_PEOPLE[4].id;
const USR_KARIM = FAKE_PEOPLE[5].id;
const USR_HEBA = FAKE_PEOPLE[6].id;
const USR_YOUSSEF = FAKE_PEOPLE[7].id;

const METRIC_WON_VALUE = 'crm.opportunities.won.estimated_value';
const METRIC_WON_COUNT = 'crm.opportunities.won.count.trend';
const METRIC_CONV_RATE = 'crm.leads.conversion.rate';

// DTO limits (dashboard-sales-target.dto.ts, targets-approval.dto.ts).
const MAX_REVISION = 2_147_483_647;
const NOTE_MAX_LENGTH = 500;
const RELEASE_PAGE_LIMIT = 100;
const RELEASE_DEFAULT_LIMIT = 25;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const METRIC_KEY = /^crm(?:\.[a-z][a-z0-9_]*){2,}$/;
const SUBJECT_TYPES: readonly TargetSubjectType[] = ['USER', 'TEAM', 'BRANCH', 'TEAM_SET'];
const GRAINS: readonly TargetPeriodGrain[] = ['MONTH', 'QUARTER', 'YEAR'];
const MEASURES: readonly TargetMeasureKind[] = ['MONEY', 'COUNT', 'RATE'];
const STATES: readonly TargetApprovalState[] = ['DRAFT', 'SUBMITTED', 'APPROVED'];
const SORTS = ['periodStart', 'metricKey', 'createdAt'] as const;

/** The stored head; the response is built from it by `toView`, like the backend's `targetView`. */
interface Head {
  id: string;
  branchId: string | null;
  subjectType: TargetSubjectType;
  subjectId: string | null;
  teamIds: string[];
  metricKey: string;
  measureKind: TargetMeasureKind;
  periodGrain: TargetPeriodGrain;
  periodStart: string;
  currencyCode: string | null;
  targetValue: number;
  revision: number;
  approvalState: TargetApprovalState;
  submittedAt: string | null;
  submittedByUserId: string | null;
  reviewNote: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

type SeedRow = Pick<
  Head,
  | 'id'
  | 'branchId'
  | 'subjectType'
  | 'subjectId'
  | 'metricKey'
  | 'measureKind'
  | 'periodGrain'
  | 'periodStart'
  | 'currencyCode'
  | 'targetValue'
  | 'revision'
  | 'approvalState'
  | 'submittedAt'
  | 'submittedByUserId'
  | 'reviewNote'
> & { teamIds?: string[] };

const SEED: readonly SeedRow[] = [
  { id: '01934c00-0000-7000-8000-000000000001', branchId: BR_CAIRO, subjectType: 'BRANCH', subjectId: BR_CAIRO, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-09-01', currencyCode: 'EGP', targetValue: 1_850_000, revision: 3, approvalState: 'APPROVED', submittedAt: '2026-08-27T10:15:00.000Z', submittedByUserId: USR_NADA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000002', branchId: BR_CAIRO, subjectType: 'TEAM', subjectId: TM_CAIRO_SALES, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-10-01', currencyCode: 'EGP', targetValue: 950_000, revision: 2, approvalState: 'APPROVED', submittedAt: '2026-09-25T09:00:00.000Z', submittedByUserId: USR_ALI, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000003', branchId: BR_CAIRO, subjectType: 'USER', subjectId: USR_NADA, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-11-01', currencyCode: 'EGP', targetValue: 320_000, revision: 2, approvalState: 'APPROVED', submittedAt: '2026-10-26T10:00:00.000Z', submittedByUserId: USR_NADA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000004', branchId: null, subjectType: 'TEAM_SET', subjectId: null, teamIds: [TM_CAIRO_SALES, TM_CAIRO_CORP, TM_ALEX_SALES], metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'QUARTER', periodStart: '2026-10-01', currencyCode: 'USD', targetValue: 180_000, revision: 3, approvalState: 'APPROVED', submittedAt: '2026-09-29T12:00:00.000Z', submittedByUserId: USR_SARA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000005', branchId: BR_ALEX, subjectType: 'BRANCH', subjectId: BR_ALEX, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'YEAR', periodStart: '2026-01-01', currencyCode: 'EGP', targetValue: 12_500_000, revision: 2, approvalState: 'SUBMITTED', submittedAt: '2026-11-18T11:20:00.000Z', submittedByUserId: USR_MONA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000006', branchId: BR_CAIRO, subjectType: 'TEAM', subjectId: TM_CAIRO_CORP, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-12-01', currencyCode: 'EGP', targetValue: 1_400_000, revision: 2, approvalState: 'SUBMITTED', submittedAt: '2026-11-19T14:05:00.000Z', submittedByUserId: USR_SARA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000007', branchId: BR_CAIRO, subjectType: 'USER', subjectId: USR_ALI, metricKey: METRIC_WON_COUNT, measureKind: 'COUNT', periodGrain: 'MONTH', periodStart: '2026-11-01', currencyCode: null, targetValue: 24, revision: 2, approvalState: 'SUBMITTED', submittedAt: '2026-11-02T09:30:00.000Z', submittedByUserId: USR_ALI, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000008', branchId: BR_CAIRO, subjectType: 'USER', subjectId: USR_SARA, metricKey: METRIC_CONV_RATE, measureKind: 'RATE', periodGrain: 'MONTH', periodStart: '2026-11-01', currencyCode: null, targetValue: 28.5, revision: 2, approvalState: 'SUBMITTED', submittedAt: '2026-11-03T13:10:00.000Z', submittedByUserId: USR_SARA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000009', branchId: BR_ALEX, subjectType: 'TEAM', subjectId: TM_ALEX_SALES, metricKey: METRIC_WON_COUNT, measureKind: 'COUNT', periodGrain: 'QUARTER', periodStart: '2026-10-01', currencyCode: null, targetValue: 65, revision: 2, approvalState: 'SUBMITTED', submittedAt: '2026-10-05T08:40:00.000Z', submittedByUserId: USR_KARIM, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000010', branchId: BR_ALEX, subjectType: 'USER', subjectId: USR_MONA, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-10-01', currencyCode: 'EGP', targetValue: 410_000, revision: 2, approvalState: 'SUBMITTED', submittedAt: '2026-10-02T10:00:00.000Z', submittedByUserId: USR_MONA, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000011', branchId: BR_ALEX, subjectType: 'BRANCH', subjectId: BR_ALEX, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-12-01', currencyCode: 'USD', targetValue: 85_000, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: 'Adjust USD allocation after Q4 enterprise renewal pipeline review.' },
  { id: '01934c00-0000-7000-8000-000000000012', branchId: BR_GIZA, subjectType: 'BRANCH', subjectId: BR_GIZA, metricKey: METRIC_WON_VALUE, measureKind: 'MONEY', periodGrain: 'MONTH', periodStart: '2026-11-01', currencyCode: 'EGP', targetValue: 640_000, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000013', branchId: BR_GIZA, subjectType: 'TEAM', subjectId: TM_GIZA_SALES, metricKey: METRIC_CONV_RATE, measureKind: 'RATE', periodGrain: 'MONTH', periodStart: '2026-12-01', currencyCode: null, targetValue: 22, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000014', branchId: BR_CAIRO, subjectType: 'USER', subjectId: USR_OMAR, metricKey: METRIC_WON_COUNT, measureKind: 'COUNT', periodGrain: 'MONTH', periodStart: '2026-12-01', currencyCode: null, targetValue: 18, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000015', branchId: BR_ALEX, subjectType: 'USER', subjectId: USR_KARIM, metricKey: METRIC_CONV_RATE, measureKind: 'RATE', periodGrain: 'QUARTER', periodStart: '2026-10-01', currencyCode: null, targetValue: 24.5, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000016', branchId: BR_CAIRO, subjectType: 'TEAM', subjectId: TM_CAIRO_SALES, metricKey: METRIC_WON_COUNT, measureKind: 'COUNT', periodGrain: 'YEAR', periodStart: '2026-01-01', currencyCode: null, targetValue: 240, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000017', branchId: BR_GIZA, subjectType: 'USER', subjectId: USR_HEBA, metricKey: METRIC_WON_COUNT, measureKind: 'COUNT', periodGrain: 'MONTH', periodStart: '2026-09-01', currencyCode: null, targetValue: 14, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
  { id: '01934c00-0000-7000-8000-000000000018', branchId: BR_GIZA, subjectType: 'USER', subjectId: USR_YOUSSEF, metricKey: METRIC_CONV_RATE, measureKind: 'RATE', periodGrain: 'MONTH', periodStart: '2026-11-01', currencyCode: null, targetValue: 19.5, revision: 1, approvalState: 'DRAFT', submittedAt: null, submittedByUserId: null, reviewNote: null },
];

interface ReleaseSeed {
  targetId: string;
  id: string;
  releaseNumber: number;
  targetValue: number;
  headRevision: number;
  approvalBasis: TargetRelease['approvalBasis'];
  correctionReason: string | null;
  approvedByUserId: string;
  approvedAt: string;
}

const RELEASE_SEED: readonly ReleaseSeed[] = [
  { targetId: SEED[0].id, id: '01934c10-0000-7000-8000-000000000101', releaseNumber: 1, targetValue: 1_750_000, headRevision: 2, approvalBasis: 'REVIEWED', correctionReason: null, approvedByUserId: USR_OMAR, approvedAt: '2026-08-29T13:00:00.000Z' },
  { targetId: SEED[0].id, id: '01934c10-0000-7000-8000-000000000102', releaseNumber: 2, targetValue: 1_850_000, headRevision: 3, approvalBasis: 'CORRECTION', correctionReason: 'Reallocated Q3 enterprise renewal quota split between Cairo and Giza branches.', approvedByUserId: USR_OMAR, approvedAt: '2026-10-03T11:30:00.000Z' },
  { targetId: SEED[1].id, id: '01934c10-0000-7000-8000-000000000201', releaseNumber: 1, targetValue: 950_000, headRevision: 2, approvalBasis: 'REVIEWED', correctionReason: null, approvedByUserId: USR_OMAR, approvedAt: '2026-09-28T14:20:00.000Z' },
  { targetId: SEED[2].id, id: '01934c10-0000-7000-8000-000000000301', releaseNumber: 1, targetValue: 320_000, headRevision: 2, approvalBasis: 'REVIEWED', correctionReason: null, approvedByUserId: USR_SARA, approvedAt: '2026-10-29T16:10:00.000Z' },
  { targetId: SEED[3].id, id: '01934c10-0000-7000-8000-000000000401', releaseNumber: 1, targetValue: 165_000, headRevision: 2, approvalBasis: 'LEGACY_BACKFILL', correctionReason: null, approvedByUserId: USR_OMAR, approvedAt: '2026-09-20T10:00:00.000Z' },
  { targetId: SEED[3].id, id: '01934c10-0000-7000-8000-000000000402', releaseNumber: 2, targetValue: 180_000, headRevision: 3, approvalBasis: 'REVIEWED', correctionReason: null, approvedByUserId: USR_OMAR, approvedAt: '2026-10-01T08:45:00.000Z' },
];

let heads: Head[] = [];
/** Releases per target, newest first. */
let releases = new Map<string, TargetRelease[]>();
/** CRM owner idempotency store, keyed `routeKey:key` (request-idempotency.service.ts). */
let idempotency = new Map<string, { fingerprint: string; response: TargetApprovalResult }>();

function seedState(): void {
  heads = SEED.map((row, index) => {
    const createdAt = `2026-10-${String(1 + index).padStart(2, '0')}T09:00:00.000Z`;
    return {
      ...row,
      teamIds: row.teamIds ? [...row.teamIds] : [],
      createdByUserId: USR_OMAR,
      updatedByUserId: USR_OMAR,
      createdAt,
      updatedAt: createdAt,
      deleted: false,
    };
  });
  releases = new Map();
  for (const seed of RELEASE_SEED) {
    const head = heads.find((h) => h.id === seed.targetId)!;
    const list = releases.get(head.id) ?? [];
    list.unshift(releaseRow(head, seed));
    releases.set(head.id, list);
  }
  idempotency = new Map();
}
seedState();

/** Test hook: restores the seed state. */
export function resetTargetsFake(): void {
  seedState();
}

function releaseRow(
  head: Head,
  r: Omit<ReleaseSeed, 'targetId'>,
): TargetRelease {
  const bounds = periodBounds(head.periodGrain, head.periodStart)!;
  return {
    id: r.id,
    targetId: head.id,
    releaseNumber: r.releaseNumber,
    targetValue: r.targetValue.toFixed(2),
    measureKind: head.measureKind,
    currencyCode: head.currencyCode,
    headRevision: r.headRevision,
    approvalBasis: r.approvalBasis,
    correctionReason: r.correctionReason,
    submittedByUserId: head.submittedByUserId,
    approvedByUserId: r.approvedByUserId,
    approvedAt: r.approvedAt,
    periodStartAt: bounds.startAt,
    periodEndAt: bounds.endAt,
    periodTimeZone: TARGET_TIME_ZONE,
    legacyLastEditedAt: null,
  };
}

function teamSubjects(teamIds: readonly string[]): TargetTeamSubject[] {
  return teamIds
    .map((teamId) => {
      const team = FAKE_TEAMS.find((t) => t.id === teamId)!;
      const branch = FAKE_BRANCHES.find((b) => b.id === team.branchId)!;
      return { teamId: team.id, teamName: team.name.en, branchId: branch.id, branchName: branch.name.en };
    })
    .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.teamId.localeCompare(b.teamId));
}

function unitOf(measure: TargetMeasureKind): TargetMetricUnit {
  return measure === 'RATE' ? 'PERCENT' : measure;
}

function periodEndExclusive(grain: TargetPeriodGrain, start: string): string {
  const [y, m] = start.split('-').map(Number);
  const months = grain === 'MONTH' ? 1 : grain === 'QUARTER' ? 3 : 12;
  const end = new Date(Date.UTC(y, m - 1 + months, 1));
  return end.toISOString().slice(0, 10);
}

/** `targetView`: the head plus labels, the latest release and the TEAM_SET subjects. */
function toView(head: Head): SalesTarget {
  const metric = TARGETABLE_METRICS.find((m) => m.key === head.metricKey);
  const latest = releases.get(head.id)?.[0] ?? null;
  const subjects = head.subjectType === 'TEAM_SET' ? teamSubjects(head.teamIds) : [];
  const branch = head.branchId ? FAKE_BRANCHES.find((b) => b.id === head.branchId) : undefined;
  const subjectName =
    head.subjectType === 'TEAM_SET'
      ? subjects.map((s) => s.teamName).join(' + ')
      : resolveTargetSubjectName({ ...head, subjects }, 'en');
  return {
    id: head.id,
    branchId: head.branchId,
    subjectType: head.subjectType,
    subjectId: head.subjectId,
    metricKey: head.metricKey,
    currencyCode: head.currencyCode,
    revision: head.revision,
    periodGrain: head.periodGrain,
    periodStart: head.periodStart,
    targetValue: head.targetValue.toFixed(2),
    branchName: branch?.name.en ?? null,
    subjectName: subjectName || null,
    periodEndExclusive: periodEndExclusive(head.periodGrain, head.periodStart),
    measureKind: head.measureKind,
    approvalState: head.approvalState,
    submittedAt: head.submittedAt,
    submittedByUserId: head.submittedByUserId,
    reviewNote: head.reviewNote,
    createdByUserId: head.createdByUserId,
    updatedByUserId: head.updatedByUserId,
    createdAt: head.createdAt,
    updatedAt: head.updatedAt,
    latestRelease: latest
      ? {
          id: latest.id,
          releaseNumber: latest.releaseNumber,
          targetValue: latest.targetValue,
          approvalBasis: latest.approvalBasis,
          approvedAt: latest.approvedAt,
        }
      : null,
    subjects,
    metricLabel: metric?.labelEn ?? head.metricKey,
    metricLabelAr: metric?.labelAr ?? head.metricKey,
    unit: unitOf(head.measureKind),
  };
}

// ---- ValidationPipe -------------------------------------------------------------------------------------------

/** Collects class-validator failures for one request; `throwIfAny` raises 400 CRM_VALIDATION_FAILED. */
class Violations {
  private readonly out: Record<string, string[]> = {};

  add(path: string, constraint: string): void {
    (this.out[path] ??= []).push(constraint);
  }

  throwIfAny(): void {
    if (Object.keys(this.out).length > 0) throw new ApiError(400, 'CRM_VALIDATION_FAILED', this.out);
  }
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function checkUuid(v: Violations, path: string, value: unknown, required: boolean): void {
  if (!required && !present(value)) return;
  if (!isUuidV7(value)) v.add(path, 'is_uuid');
}

function checkIn(v: Violations, path: string, value: unknown, allowed: readonly string[], required: boolean): void {
  if (!required && !present(value)) return;
  if (typeof value !== 'string' || !allowed.includes(value)) v.add(path, 'is_in');
}

function checkInt(v: Violations, path: string, value: unknown, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    v.add(path, 'is_int');
    if (typeof value !== 'number' || Number.isNaN(value)) return;
  }
  if (value < min) v.add(path, 'min');
  if (value > max) v.add(path, 'max');
}

/** `@Transform(number or NaN) @IsNumber @Min(0) @Max(max)`. */
function checkAmount(v: Violations, path: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    v.add(path, 'is_number');
    return;
  }
  if (value < 0) v.add(path, 'min');
  if (value > TARGET_MAX_VALUE) v.add(path, 'max');
}

function checkCivilDate(v: Violations, path: string, value: unknown, required: boolean): void {
  if (!required && !present(value)) return;
  const text = typeof value === 'string' ? value : '';
  if (!CIVIL_DATE.test(text)) v.add(path, 'matches');
  if (!CIVIL_DATE.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) v.add(path, 'is_date_string');
}

function checkMetricKey(v: Violations, path: string, value: unknown, required: boolean): void {
  if (!required && !present(value)) return;
  const text = typeof value === 'string' ? value : '';
  if (!METRIC_KEY.test(text)) v.add(path, 'matches');
  if (typeof value !== 'string' || value.length > 160) v.add(path, 'max_length');
}

function checkText(v: Violations, path: string, value: unknown, max: number): void {
  if (!present(value)) return;
  if (typeof value !== 'string') {
    v.add(path, 'is_string');
    v.add(path, 'max_length');
    return;
  }
  if (value.length > max) v.add(path, 'max_length');
}

/** `SalesTargetRevisionDto.revision`: optional int 1..2^31-1. */
function checkRevision(v: Violations, value: unknown): void {
  if (value === undefined || value === null) return;
  checkInt(v, 'revision', value, 1, MAX_REVISION);
}

function validateId(id: string): void {
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  v.throwIfAny();
}

// ---- Service helpers ------------------------------------------------------------------------------------------

/** `resolveExpectedRevision({ required: true })` without If-Match: the body revision or 400. */
function requiredRevision(revision: number | undefined | null): number {
  if (revision === undefined || revision === null) throw new ApiError(400, 'CRM_DASHBOARD_REVISION_MISMATCH');
  return revision;
}

/**
 * `lockAuthorizedTargetHead`: authority first, so an unknown or deleted id answers like a foreign one
 * (403 BRANCH_CONTEXT_REQUIRED), never 404.
 */
function lockHead(id: string): Head {
  const head = heads.find((h) => h.id === id.toLowerCase() && !h.deleted);
  if (!head) throw new ApiError(403, 'BRANCH_CONTEXT_REQUIRED');
  return head;
}

function lockAtRevision(id: string, revision: number): Head {
  const head = lockHead(id);
  if (head.revision !== revision) throw new ApiError(409, 'CRM_TARGET_REVISION_CONFLICT');
  return head;
}

/** `targetMetric`: the key must be a registered, available targetable metric. */
function targetMetric(key: string): TargetableMetric {
  const metric = TARGETABLE_METRICS.find((m) => m.key === key);
  if (!metric) throw new ApiError(422, 'CRM_TARGET_METRIC_NOT_TARGETABLE');
  return metric;
}

/** `targetValueForMeasure`: positive, at most two decimals, COUNT whole, RATE at most 100. */
function targetValueForMeasure(measure: TargetMeasureKind, value: number): number {
  if (!validateTargetValue(value, measure)) throw new ApiError(422, 'CRM_TARGET_VALUE_INVALID');
  return value;
}

/**
 * Gateway check on WRITE_SENSITIVE + idempotent routes (approve, corrections): a missing key is
 * 400 GW.IDEM.MISSING and a non-UUIDv7 key 400 GW.IDEM.BAD_VALUE, before CRM runs.
 */
function gatewayKey(key: string | undefined): string {
  if (!key) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!isUuidV7(key)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  return key.trim().toLowerCase();
}

/**
 * CRM owner replay: the same key with the same request returns the stored result; a different request is
 * 422 CRM_IDEMPOTENCY_KEY_REUSED. A failed command stores nothing, so a retry with the same key runs again.
 */
function runIdempotent(
  routeKey: string,
  key: string,
  request: unknown,
  run: () => TargetApprovalResult,
): TargetApprovalResult {
  const slot = `${routeKey}:${key}`;
  const fingerprint = requestFingerprint(request);
  const stored = idempotency.get(slot);
  if (stored) {
    if (stored.fingerprint !== fingerprint) throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
    return structuredClone(stored.response);
  }
  const response = run();
  idempotency.set(slot, { fingerprint, response: structuredClone(response) });
  return response;
}

function touch(head: Head, patch: Partial<Head>): void {
  Object.assign(head, patch, { updatedAt: FAKE_NOW, updatedByUserId: FAKE_ME.id });
}

function insertRelease(head: Head, basis: TargetRelease['approvalBasis'], reason: string | null): TargetRelease {
  const list = releases.get(head.id) ?? [];
  const release = releaseRow(head, {
    id: fakeId(),
    releaseNumber: (list[0]?.releaseNumber ?? 0) + 1,
    targetValue: head.targetValue,
    headRevision: head.revision,
    approvalBasis: basis,
    correctionReason: reason,
    approvedByUserId: FAKE_ME.id,
    approvedAt: FAKE_NOW,
  });
  // REVIEWED keeps the submitter; CORRECTION takes it from the head as well (trigger L2984).
  releases.set(head.id, [release, ...list]);
  return release;
}

/** VISIBLE_TARGET for one branch: non-set heads of the branch, TEAM_SET heads with a member team there. */
function visibleInBranch(head: Head, branchId: string): boolean {
  if (head.subjectType !== 'TEAM_SET') return head.branchId === branchId;
  return head.teamIds.some((teamId) => FAKE_TEAMS.find((t) => t.id === teamId)?.branchId === branchId);
}

/** FAKE-ONLY: the backend accepts `search` but never filters on it. */
function matchesSearch(view: SalesTarget, term: string): boolean {
  const parts = [view.metricKey, view.metricLabel, view.metricLabelAr, view.periodStart, view.subjectName ?? '', view.branchName ?? ''];
  if (view.currencyCode) parts.push(view.currencyCode);
  if (view.subjectType === 'USER') {
    const person = FAKE_PEOPLE.find((p) => p.id === view.subjectId);
    if (person) parts.push(person.name, person.nameAr, person.email);
  }
  if (view.subjectType === 'TEAM') {
    const team = FAKE_TEAMS.find((t) => t.id === view.subjectId);
    if (team) parts.push(team.name.en, team.name.ar);
  }
  for (const s of view.subjects) {
    const team = FAKE_TEAMS.find((t) => t.id === s.teamId);
    if (team) parts.push(team.name.ar);
  }
  return parts.some((value) => value.toLowerCase().includes(term));
}

// ---- Endpoints ------------------------------------------------------------------------------------------------

/** GET /api/tenant/crm/v1/targets */
export async function fakeListTargets(q: ListTargetsQuery): Promise<FlatPage<SalesTarget>> {
  await fakeDelay();
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  const v = new Violations();
  checkInt(v, 'page', page, 1, 10_000);
  checkInt(v, 'limit', limit, 1, 100);
  checkIn(v, 'sortBy', q.sortBy, SORTS, false);
  // PaginationQueryDto.sortDir: @IsEnum(SortDirectionEnum).
  if (present(q.sortDir) && !['ASC', 'DESC'].includes(q.sortDir as string)) v.add('sortDir', 'is_enum');
  checkText(v, 'search', q.search, 200);
  checkUuid(v, 'branchId', q.branchId, true);
  checkIn(v, 'subjectType', q.subjectType, SUBJECT_TYPES, false);
  checkUuid(v, 'subjectId', q.subjectId, false);
  checkMetricKey(v, 'metricKey', q.metricKey, false);
  checkIn(v, 'periodGrain', q.periodGrain, GRAINS, false);
  checkIn(v, 'approvalState', q.approvalState, STATES, false);
  checkCivilDate(v, 'periodFrom', q.periodFrom, false);
  checkCivilDate(v, 'periodTo', q.periodTo, false);
  v.throwIfAny();
  if (q.periodFrom && q.periodTo && q.periodFrom > q.periodTo) throw new ApiError(422, 'CRM_TARGET_PERIOD_INVALID');

  const branchId = q.branchId.toLowerCase();
  const subjectId = q.subjectId?.toLowerCase();
  const term = q.search?.trim().toLowerCase() ?? '';
  const visible = heads
    .filter((h) => !h.deleted && visibleInBranch(h, branchId))
    .filter((h) => !q.subjectType || h.subjectType === q.subjectType)
    .filter((h) => !subjectId || h.subjectId === subjectId || (h.subjectType === 'TEAM_SET' && h.teamIds.includes(subjectId)))
    .filter((h) => !q.metricKey || h.metricKey === q.metricKey)
    .filter((h) => !q.periodGrain || h.periodGrain === q.periodGrain)
    .filter((h) => !q.periodFrom || h.periodStart >= q.periodFrom)
    .filter((h) => !q.periodTo || h.periodStart <= q.periodTo)
    .filter((h) => !q.approvalState || h.approvalState === q.approvalState)
    .map(toView)
    .filter((view) => !term || matchesSearch(view, term));

  const sortBy = q.sortBy ?? 'periodStart';
  const dir = q.sortDir === 'ASC' ? 1 : -1;
  // ORDER BY <sort> <dir>, created_at DESC, id DESC.
  visible.sort((a, b) => {
    const primary = String(a[sortBy]).localeCompare(String(b[sortBy])) * dir;
    if (primary !== 0) return primary;
    return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
  });

  const total = visible.length;
  const totalPages = Math.ceil(total / limit);
  const items = visible.slice((page - 1) * limit, page * limit);
  return { items: structuredClone(items), total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

/** GET /api/tenant/crm/v1/targets/:id */
export async function fakeGetTarget(id: string): Promise<SalesTarget> {
  await fakeDelay();
  validateId(id);
  return structuredClone(toView(lockHead(id)));
}

/** GET /api/tenant/crm/v1/targets/:id/releases */
export async function fakeListReleases(
  id: string,
  cursor?: string | null,
  limit?: number,
): Promise<InfoPage<TargetRelease>> {
  await fakeDelay();
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  checkText(v, 'cursor', cursor, 512);
  if (limit !== undefined) checkInt(v, 'limit', limit, 1, RELEASE_PAGE_LIMIT);
  v.throwIfAny();
  const head = lockHead(id);
  return structuredClone(pageOf(releases.get(head.id) ?? [], cursor ?? null, limit ?? RELEASE_DEFAULT_LIMIT));
}

/** POST /api/tenant/crm/v1/targets */
export async function fakeCreateTarget(body: CreateTargetBody): Promise<SalesTarget> {
  await fakeDelay();
  const currencyCode = typeof body.currencyCode === 'string' ? body.currencyCode.toUpperCase() : body.currencyCode;
  const v = new Violations();
  checkAmount(v, 'targetValue', body.targetValue);
  checkUuid(v, 'branchId', body.branchId, false);
  checkIn(v, 'subjectType', body.subjectType, SUBJECT_TYPES, true);
  checkUuid(v, 'subjectId', body.subjectId, false);
  if (present(body.teamIds)) {
    if (!Array.isArray(body.teamIds)) {
      v.add('teamIds', 'is_array');
    } else {
      if (body.teamIds.length < TARGET_MIN_TEAMS) v.add('teamIds', 'array_min_size');
      if (body.teamIds.length > TARGET_MAX_TEAMS) v.add('teamIds', 'array_max_size');
      const lowered = body.teamIds.map((t) => (typeof t === 'string' ? t.toLowerCase() : t));
      if (new Set(lowered).size !== lowered.length) v.add('teamIds', 'array_unique');
      if (body.teamIds.some((t) => !isUuidV7(t))) v.add('teamIds', 'is_uuid');
    }
  }
  checkMetricKey(v, 'metricKey', body.metricKey, true);
  checkIn(v, 'measureKind', body.measureKind, MEASURES, false);
  checkIn(v, 'periodGrain', body.periodGrain, GRAINS, true);
  checkCivilDate(v, 'periodStart', body.periodStart, true);
  if (present(currencyCode) && !/^[A-Z]{3}$/.test(String(currencyCode))) v.add('currencyCode', 'matches');
  v.throwIfAny();

  const isSet = body.subjectType === 'TEAM_SET';
  const measureKind = targetMetric(body.metricKey).measureKind;
  if (body.measureKind && body.measureKind !== measureKind) throw new ApiError(422, 'CRM_TARGET_MEASURE_INVALID');
  const targetValue = targetValueForMeasure(measureKind, body.targetValue);
  const currency = currencyCode ?? null;
  if ((measureKind === 'MONEY') !== (currency !== null)) throw new ApiError(422, 'CRM_TARGET_CURRENCY_INVALID');
  const [year, month, day] = body.periodStart.split('-').map(Number);
  if (
    !year || year < 2000 || year > 2100 || !month || month > 12 || day !== 1 ||
    (body.periodGrain === 'QUARTER' && (month - 1) % 3 !== 0) || (body.periodGrain === 'YEAR' && month !== 1)
  ) {
    throw new ApiError(422, 'CRM_TARGET_PERIOD_INVALID');
  }
  if (isSet && (body.branchId || body.subjectId || !body.teamIds)) throw new ApiError(422, 'CRM_TARGET_TEAM_SET_INVALID');
  if (!isSet && (!body.branchId || !body.subjectId || body.teamIds !== undefined)) {
    throw new ApiError(422, 'CRM_TARGET_SUBJECT_INVALID');
  }

  let branchId: string | null = null;
  let subjectId: string | null = null;
  let teamIds: string[] = [];
  if (isSet) {
    // resolveTeamSet: 2-50 different, active teams.
    teamIds = [...new Set(body.teamIds!.map((t) => t.toLowerCase()))].sort();
    if (teamIds.length !== body.teamIds!.length || teamIds.some((t) => !FAKE_TEAMS.some((team) => team.id === t))) {
      throw new ApiError(422, 'CRM_TARGET_TEAM_SET_INVALID');
    }
  } else {
    branchId = body.branchId!.toLowerCase();
    subjectId = body.subjectId!.toLowerCase();
    // assertSubject: BRANCH is the branch itself; TEAM and USER must belong to the branch.
    const matches =
      body.subjectType === 'BRANCH'
        ? subjectId === branchId
        : body.subjectType === 'TEAM'
          ? FAKE_TEAMS.some((t) => t.id === subjectId && t.branchId === branchId)
          : FAKE_PEOPLE.some((p) => p.id === subjectId && p.branchId === branchId);
    if (!matches) throw new ApiError(422, 'CRM_TARGET_SUBJECT_INVALID');
  }

  const subjectKey = isSet ? `TEAM_SET:${teamIds.join(',')}` : `${body.subjectType}:${subjectId}:${branchId}`;
  const duplicate = heads.some(
    (h) =>
      !h.deleted &&
      (h.subjectType === 'TEAM_SET' ? `TEAM_SET:${[...h.teamIds].sort().join(',')}` : `${h.subjectType}:${h.subjectId}:${h.branchId}`) === subjectKey &&
      h.metricKey === body.metricKey &&
      h.periodGrain === body.periodGrain &&
      h.periodStart === body.periodStart &&
      (h.currencyCode ?? '') === (currency ?? ''),
  );
  if (duplicate) throw new ApiError(409, 'CRM_TARGET_DUPLICATE');

  const head: Head = {
    id: fakeId(),
    branchId,
    subjectType: body.subjectType,
    subjectId,
    teamIds,
    metricKey: body.metricKey,
    measureKind,
    periodGrain: body.periodGrain,
    periodStart: body.periodStart,
    currencyCode: currency,
    targetValue,
    revision: 1,
    approvalState: 'DRAFT',
    submittedAt: null,
    submittedByUserId: null,
    reviewNote: null,
    createdByUserId: FAKE_ME.id,
    updatedByUserId: FAKE_ME.id,
    createdAt: FAKE_NOW,
    updatedAt: FAKE_NOW,
    deleted: false,
  };
  heads = [head, ...heads];
  return structuredClone(toView(head));
}

/** PATCH /api/tenant/crm/v1/targets/:id */
export async function fakeUpdateTarget(id: string, body: UpdateTargetBody): Promise<SalesTarget> {
  await fakeDelay();
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  checkAmount(v, 'targetValue', body.targetValue);
  checkRevision(v, body.revision);
  v.throwIfAny();
  const revision = requiredRevision(body.revision);

  const head = lockAtRevision(id, revision);
  targetMetric(head.metricKey);
  const value = targetValueForMeasure(head.measureKind, body.targetValue);
  const changed = value !== head.targetValue;
  if (head.approvalState === 'SUBMITTED' && changed) throw new ApiError(409, 'CRM_TARGET_LOCKED_SUBMITTED');
  // The head trigger drops a changed APPROVED head to DRAFT.
  touch(head, {
    targetValue: value,
    revision: head.revision + 1,
    approvalState: head.approvalState === 'APPROVED' && changed ? 'DRAFT' : head.approvalState,
  });
  return structuredClone(toView(head));
}

/** DELETE /api/tenant/crm/v1/targets/:id (If-Match optional). */
export async function fakeDeleteTarget(id: string, revision?: number): Promise<void> {
  await fakeDelay();
  validateId(id);
  const head = revision === undefined ? lockHead(id) : lockAtRevision(id, revision);
  touch(head, { deleted: true, revision: head.revision + 1 });
}

/** POST /api/tenant/crm/v1/targets/:id/submit */
export async function fakeSubmitTarget(id: string, body: SubmitTargetBody): Promise<SalesTarget> {
  await fakeDelay();
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  checkRevision(v, body.revision);
  v.throwIfAny();
  const head = lockAtRevision(id, requiredRevision(body.revision));
  if (head.approvalState === 'SUBMITTED') throw new ApiError(409, 'CRM_TARGET_LOCKED_SUBMITTED');
  if (head.approvalState !== 'DRAFT') throw new ApiError(409, 'CRM_TARGET_NOT_DRAFT');
  touch(head, {
    approvalState: 'SUBMITTED',
    submittedAt: FAKE_NOW,
    submittedByUserId: FAKE_ME.id,
    reviewNote: null,
    revision: head.revision + 1,
  });
  return structuredClone(toView(head));
}

/** POST /api/tenant/crm/v1/targets/:id/approve (x-idempotency-key required). */
export async function fakeApproveTarget(
  id: string,
  body: ApproveTargetBody,
  key: string,
): Promise<TargetApprovalResult> {
  await fakeDelay();
  const idemKey = gatewayKey(key);
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  checkRevision(v, body.revision);
  checkText(v, 'note', body.note, NOTE_MAX_LENGTH);
  v.throwIfAny();
  const revision = requiredRevision(body.revision);
  const note = body.note?.trim() || null;

  return structuredClone(
    runIdempotent('crm.targets.approve', idemKey, { id, revision, note }, () => {
      const head = lockAtRevision(id, revision);
      if (head.approvalState !== 'SUBMITTED') throw new ApiError(409, 'CRM_TARGET_NOT_SUBMITTED');
      if (isPeriodClosed(head.periodGrain, head.periodStart, FAKE_NOW)) throw new ApiError(409, 'CRM_TARGET_PERIOD_CLOSED');
      const release = insertRelease(head, 'REVIEWED', null);
      // The head stays at its revision (L3000).
      touch(head, { approvalState: 'APPROVED', reviewNote: note });
      return { target: toView(head), release };
    }),
  );
}

/** POST /api/tenant/crm/v1/targets/:id/reject */
export async function fakeRejectTarget(id: string, body: RejectTargetBody): Promise<SalesTarget> {
  await fakeDelay();
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  checkRevision(v, body.revision);
  checkText(v, 'note', body.note, NOTE_MAX_LENGTH);
  v.throwIfAny();
  const revision = requiredRevision(body.revision);
  const note = body.note?.trim();
  if (!note) throw new ApiError(422, 'CRM_TARGET_REJECT_NOTE_REQUIRED');
  const head = lockAtRevision(id, revision);
  if (head.approvalState !== 'SUBMITTED') throw new ApiError(409, 'CRM_TARGET_NOT_SUBMITTED');
  touch(head, { approvalState: 'DRAFT', reviewNote: note, revision: head.revision + 1 });
  return structuredClone(toView(head));
}

/** POST /api/tenant/crm/v1/targets/:id/corrections (x-idempotency-key required). */
export async function fakeCorrectTarget(
  id: string,
  body: CorrectTargetBody,
  key: string,
): Promise<TargetApprovalResult> {
  await fakeDelay();
  const idemKey = gatewayKey(key);
  const v = new Violations();
  checkUuid(v, 'id', id, true);
  checkRevision(v, body.revision);
  checkAmount(v, 'value', body.value);
  checkText(v, 'reason', body.reason, NOTE_MAX_LENGTH);
  v.throwIfAny();
  const revision = requiredRevision(body.revision);
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, NOTE_MAX_LENGTH).trim() : '';
  if (!reason) throw new ApiError(422, 'CRM_TARGET_CORRECTION_REASON_REQUIRED');

  return structuredClone(
    runIdempotent('crm.targets.correct', idemKey, { id, revision, value: body.value, reason }, () => {
      const head = lockAtRevision(id, revision);
      if (!isPeriodClosed(head.periodGrain, head.periodStart, FAKE_NOW)) throw new ApiError(409, 'CRM_TARGET_PERIOD_OPEN');
      const value = targetValueForMeasure(head.measureKind, body.value);
      const changed = value !== head.targetValue;
      if (head.approvalState === 'APPROVED' && !changed) throw new ApiError(422, 'CRM_TARGET_VALUE_INVALID');
      let current = head.revision;
      if (head.approvalState === 'SUBMITTED' && changed) current += 1;
      if (changed) current += 1;
      touch(head, { targetValue: value, revision: current });
      const release = insertRelease(head, 'CORRECTION', reason);
      touch(head, { approvalState: 'APPROVED' });
      return { target: toView(head), release };
    }),
  );
}

/** FAKE-ONLY, no backend route: there is no GET /crm/targets/metrics. */
export async function fakeTargetableMetrics(): Promise<TargetableMetric[]> {
  await fakeDelay(120);
  return structuredClone([...TARGETABLE_METRICS]);
}
