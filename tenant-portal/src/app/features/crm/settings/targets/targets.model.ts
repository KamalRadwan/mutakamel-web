import {
  DASH,
  formatMoney,
  formatNumber,
  formatPercent,
  formatShortDate,
} from '../../../../shared/ui/chart/chart-format';

export type TargetSubjectType = 'USER' | 'TEAM' | 'BRANCH' | 'TEAM_SET';
export type TargetMeasureKind = 'MONEY' | 'COUNT' | 'RATE';
export type TargetPeriodGrain = 'MONTH' | 'QUARTER' | 'YEAR';
export type TargetApprovalState = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
export type TargetApprovalBasis = 'REVIEWED' | 'LEGACY_BACKFILL' | 'CORRECTION';
export type TargetSortBy = 'periodStart' | 'metricKey' | 'createdAt';
/** UI sort direction (DataTable). */
export type TargetSortDir = 'asc' | 'desc';
/** Wire sort direction: `SortDirectionEnum` (ASC | DESC), crm-app ListDashboardSalesTargetsDto. */
export type TargetWireSortDir = 'ASC' | 'DESC';
/** Metric unit the backend returns next to each target (`targetView`). */
export type TargetMetricUnit = 'MONEY' | 'COUNT' | 'PERCENT';

/** The server returns decimal target values as text (`round(x, 2)::text`). */
export interface TargetLatestRelease {
  id: string;
  releaseNumber: number;
  targetValue: string;
  approvalBasis: string;
  approvedAt: string;
}

export interface TargetTeamSubject {
  teamId: string;
  teamName: string;
  branchId: string;
  branchName: string;
}

/** One target head as `targetView` (crm-app dashboard-sales-targets.service.ts) returns it. */
export interface SalesTarget {
  id: string;
  branchId: string | null;
  subjectType: TargetSubjectType;
  subjectId: string | null;
  metricKey: string;
  currencyCode: string | null;
  revision: number;
  periodGrain: TargetPeriodGrain;
  periodStart: string;
  /** Decimal text with two places, for example "1850000.00". */
  targetValue: string;
  branchName: string | null;
  subjectName: string | null;
  periodEndExclusive: string;
  measureKind: TargetMeasureKind;
  approvalState: TargetApprovalState;
  submittedAt: string | null;
  submittedByUserId: string | null;
  reviewNote: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  latestRelease: TargetLatestRelease | null;
  /** TEAM_SET members; an empty array for the other subject types. */
  subjects: TargetTeamSubject[];
  metricLabel: string;
  metricLabelAr: string;
  unit: TargetMetricUnit;
}

export interface TargetRelease {
  id: string;
  targetId: string;
  releaseNumber: number;
  targetValue: string;
  measureKind: string;
  currencyCode: string | null;
  headRevision: number;
  approvalBasis: TargetApprovalBasis;
  correctionReason: string | null;
  submittedByUserId: string | null;
  approvedByUserId: string;
  approvedAt: string;
  periodStartAt: string;
  periodEndAt: string;
  periodTimeZone: string;
  legacyLastEditedAt: string | null;
}

export interface TargetableMetric {
  key: string;
  labelEn: string;
  labelAr: string;
  measureKind: TargetMeasureKind;
  unit: TargetMetricUnit;
}

export interface TargetSubjectOptions {
  users: { id: string; displayName: string }[];
  teams: { id: string; name: string }[];
}

export interface TargetCurrency {
  code: string;
  nameEn: string;
  nameAr: string;
  decimals: number;
  isDefault: boolean;
}

/** ListDashboardSalesTargetsDto: `branchId` is required (BranchListQueryDto). */
export interface ListTargetsQuery {
  branchId: string;
  page?: number;
  limit?: number;
  sortBy?: TargetSortBy;
  sortDir?: TargetWireSortDir;
  subjectType?: TargetSubjectType;
  subjectId?: string;
  metricKey?: string;
  periodGrain?: TargetPeriodGrain;
  approvalState?: TargetApprovalState;
  periodFrom?: string;
  periodTo?: string;
}

export interface CreateTargetBody {
  subjectType: TargetSubjectType;
  branchId?: string | null;
  subjectId?: string | null;
  teamIds?: string[];
  metricKey: string;
  measureKind?: TargetMeasureKind;
  periodGrain: TargetPeriodGrain;
  periodStart: string;
  currencyCode?: string | null;
  targetValue: number;
}

/** `revision` in the body is required: without it the service answers 400 CRM_DASHBOARD_REVISION_MISMATCH. */
export interface UpdateTargetBody {
  revision: number;
  targetValue: number;
}

export interface SubmitTargetBody {
  revision: number;
}

export interface ApproveTargetBody {
  revision: number;
  note?: string;
}

export interface RejectTargetBody {
  revision: number;
  note?: string;
}

export interface CorrectTargetBody {
  revision: number;
  value: number;
  reason?: string;
}

/** The approve/correct command result; the head keeps its revision on approve. */
export interface TargetApprovalResult {
  target: SalesTarget;
  release: TargetRelease;
}

export const TARGET_MAX_VALUE = 999_999_999_999.99;
export const TARGET_MIN_YEAR = 2000;
export const TARGET_MAX_YEAR = 2100;
export const TARGET_MIN_TEAMS = 2;
export const TARGET_MAX_TEAMS = 50;
const QUARTER_START_MONTHS = new Set([1, 4, 7, 10]);

export function parsePeriodStart(
  periodStart: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodStart.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function isValidPeriodStart(grain: TargetPeriodGrain, periodStart: string): boolean {
  const parts = parsePeriodStart(periodStart);
  if (!parts) return false;
  if (parts.year < TARGET_MIN_YEAR || parts.year > TARGET_MAX_YEAR || parts.day !== 1) return false;
  switch (grain) {
    case 'MONTH':
      return parts.month >= 1 && parts.month <= 12;
    case 'QUARTER':
      return QUARTER_START_MONTHS.has(parts.month);
    case 'YEAR':
      return parts.month === 1;
  }
}

export function periodBounds(
  grain: TargetPeriodGrain,
  periodStart: string,
): { startAt: string; endAt: string } | null {
  if (!isValidPeriodStart(grain, periodStart)) return null;
  const parts = parsePeriodStart(periodStart);
  if (!parts) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const startAt = `${parts.year}-${pad(parts.month)}-01T00:00:00.000Z`;
  const endMonth = grain === 'MONTH' ? parts.month : grain === 'QUARTER' ? parts.month + 2 : 12;
  const lastDay = new Date(Date.UTC(parts.year, endMonth, 0)).getUTCDate();
  const endAt = `${parts.year}-${pad(endMonth)}-${pad(lastDay)}T23:59:59.999Z`;
  return { startAt, endAt };
}

export function isPeriodClosed(
  grain: TargetPeriodGrain,
  periodStart: string,
  nowIso = new Date().toISOString(),
  timeZone = 'UTC',
  periodEndExclusive?: string,
): boolean {
  const bounds = periodBounds(grain, periodStart);
  if (!bounds) return false;
  const end =
    periodEndExclusive ?? new Date(Date.parse(bounds.endAt) + 1).toISOString().slice(0, 10);
  return targetDateInZone(nowIso, timeZone) >= end;
}

export function targetDateInZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function targetBranchAllowed(
  target: Pick<SalesTarget, 'branchId' | 'subjectType' | 'subjects'>,
  grants: 'ALL' | Set<string>,
): boolean {
  const ids =
    target.subjectType === 'TEAM_SET' ? target.subjects.map((s) => s.branchId) : [target.branchId];
  return ids.length > 0 && ids.every((id) => !!id && (grants === 'ALL' || grants.has(id)));
}

export function validateTargetValue(value: number, measureKind: TargetMeasureKind): boolean {
  // targetValueForMeasure: at most two decimals (cents) as well.
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > TARGET_MAX_VALUE ||
    Math.round(value * 100) / 100 !== value
  ) {
    return false;
  }
  if (measureKind === 'COUNT' && !Number.isInteger(value)) {
    return false;
  }
  if (measureKind === 'RATE' && value > 100) {
    return false;
  }
  return true;
}

export function formatTargetPeriod(
  grain: TargetPeriodGrain,
  periodStart: string,
  lang: 'ar' | 'en',
  formatQuarter: (n: number, year: number) => string,
): string {
  const parts = parsePeriodStart(periodStart);
  if (!parts) return periodStart || DASH;
  switch (grain) {
    case 'MONTH':
      return formatShortDate(periodStart, lang, 'MONTH_YEAR');
    case 'QUARTER': {
      const quarter = Math.floor((parts.month - 1) / 3) + 1;
      return formatQuarter(quarter, parts.year);
    }
    case 'YEAR':
      return String(parts.year);
  }
}

export function formatTargetValue(
  value: number | string | null | undefined,
  measureKind: TargetMeasureKind | string,
  currencyCode: string | null,
  lang: 'ar' | 'en' = 'en',
): string {
  if (value === null || value === undefined || value === '') return DASH;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return DASH;
  switch (measureKind) {
    case 'MONEY':
      return currencyCode ? formatMoney(num, currencyCode) : DASH;
    case 'RATE':
      return formatPercent(num, 1);
    case 'COUNT':
    default:
      return formatNumber(num, lang, Number.isInteger(num) ? 0 : 1);
  }
}

export function resolvePersonName(userId: string | null, _lang: 'ar' | 'en'): string {
  return userId || DASH;
}

export function resolveTargetSubjectName(
  target: Pick<SalesTarget, 'subjectType' | 'subjectId' | 'branchId' | 'subjects'> &
    Partial<Pick<SalesTarget, 'subjectName' | 'branchName'>>,
  _lang: 'ar' | 'en',
): string {
  if (target.subjectName) return target.subjectName;
  if (target.subjectType === 'TEAM_SET')
    return target.subjects.map((s) => s.teamName).join(' · ') || DASH;
  return (target.subjectType === 'BRANCH' ? target.branchName : null) || target.subjectId || DASH;
}

export function resolveMetricLabel(
  metricKey: string,
  lang: 'ar' | 'en',
  metrics: readonly TargetableMetric[] = [],
): string {
  const found = metrics.find((m) => m.key === metricKey);
  return found ? (lang === 'ar' ? found.labelAr : found.labelEn) : metricKey;
}
