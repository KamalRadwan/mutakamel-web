import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, nonEmptyString, record, stringArray, timestamp } from "../dashboard-parse";
import { DATE_PRESETS } from "../dashboard-run-contract";
import { parseReportOrganizationScope } from "../dashboard-organization-scope";
export { parseReportOrganizationScope } from "../dashboard-organization-scope";

export const BRANCH_COHORT_REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-cohort-branches";

export interface BranchCohortFilters {
  datePreset: (typeof DATE_PRESETS)[number];
  dateFrom: string;
  dateTo: string;
  companyId: string | null;
  branchId: string | null;
}

export const BRANCH_COHORT_DEFAULT_FILTERS: BranchCohortFilters = {
  datePreset: "CURRENT_MONTH", dateFrom: "", dateTo: "", companyId: null, branchId: null,
};

export function branchCohortQuery(filters: BranchCohortFilters, path = BRANCH_COHORT_REPORT_PATH) {
  const params = new URLSearchParams({ datePreset: filters.datePreset });
  if (filters.datePreset === "CUSTOM") {
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
  }
  if (filters.companyId) params.set("companyId", filters.companyId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  return `${path}?${params}`;
}

interface CountEvidence { eligible: number; converted: number; remaining: number; rate: number | null }
const fail = () => invalidResponse("lead branch cohort report");
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const civilDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && timestamp(value) && new Date(value).toISOString().slice(0, 10) === value;

function parseCounts(value: Record<string, unknown>): CountEvidence {
  const { eligible, converted, remaining, rate } = value;
  if (!count(eligible) || !count(converted) || !count(remaining) || converted + remaining !== eligible) return fail();
  const expectedRate = eligible === 0 ? null : Math.round(10_000 * converted / eligible) / 100;
  if (rate !== expectedRate) return fail();
  return { eligible, converted, remaining, rate: expectedRate };
}

export function parseCohortReportContext(value: unknown, filters: BranchCohortFilters, onInvalid: () => never) {
  const root = record(value);
  const range = record(root?.range);
  if (!root || !timestamp(root.asOf)
    || !range || range.preset !== filters.datePreset || !civilDate(range.from) || !civilDate(range.to) || range.from > range.to
    || (filters.datePreset === "CUSTOM" && (range.from !== filters.dateFrom || range.to !== filters.dateTo))
    || !nonEmptyString(range.timeZone)) return onInvalid();
  try { new Intl.DateTimeFormat("en", { timeZone: range.timeZone }); } catch { return onInvalid(); }
  const { branchById, companyId, branchId, companies, branches, partialAccess } = parseReportOrganizationScope(root.scope, filters, onInvalid);
  return { root, branchById, companyId, branchId, context: { asOf: root.asOf, from: range.from, to: range.to, timeZone: range.timeZone,
    companies, branches, partialAccess } };
}

export function parseBranchCohortReport(value: unknown, filters: BranchCohortFilters) {
  const { root, branchById, companyId, branchId, context } = parseCohortReportContext(value, filters, fail);
  if ((root.state !== "READY" && root.state !== "EMPTY" && root.state !== "UNAVAILABLE")
    || !boundedArray(root.rows, 500) || !stringArray(root.warnings, 10)) return fail();

  const rows = root.rows.map((value) => {
    const item = record(value);
    if (!item || !isUUIDv7(item.branchId)) return fail();
    const branch = branchById.get(item.branchId);
    if (!branch || (companyId && branch.companyId !== companyId) || (branchId && branch.id !== branchId)
      || item.branchName !== branch.name || item.companyId !== branch.companyId || item.companyName !== branch.companyName) return fail();
    const counts = parseCounts(item);
    if (!counts.eligible) return fail();
    return { branch, ...counts };
  });
  if (new Set(rows.map(({ branch }) => branch.id)).size !== rows.length || (root.state === "READY") !== Boolean(rows.length)) return fail();
  const totalEvidence = record(root.totals);
  const totals = totalEvidence && count(totalEvidence.invalidIntervals)
    ? { ...parseCounts(totalEvidence), invalidIntervals: totalEvidence.invalidIntervals } : null;
  if (root.state === "UNAVAILABLE" ? root.totals !== null || context.branches.length > 0 : !totals) return fail();
  if (totals && (totals.eligible !== rows.reduce((sum, row) => sum + row.eligible, 0)
    || totals.converted !== rows.reduce((sum, row) => sum + row.converted, 0)
    || totals.invalidIntervals > totals.remaining)) return fail();
  return { ...context, state: root.state, rows, totals, warnings: root.warnings };
}

export type BranchCohortReport = ReturnType<typeof parseBranchCohortReport>;
