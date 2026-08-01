import type { CrmDashboardFilters, DashboardDatePreset } from "./dashboard-types";

export const DASHBOARD_COLUMN_COUNT = 12;
export const DASHBOARD_MAX_ROW = 10_000;
export const DASHBOARD_DATE_PRESETS: readonly DashboardDatePreset[] = [
  "CURRENT_MONTH",
  "CURRENT_QUARTER",
  "CURRENT_YEAR",
  "LAST_30_DAYS",
];

const dashboardDatePresetSet = new Set<string>(DASHBOARD_DATE_PRESETS);
const dashboardComparisonSet = new Set<string>(["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR"]);
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeDashboardFiltersForApi(value: unknown): CrmDashboardFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const normalized: CrmDashboardFilters = {};

  if (typeof input.datePreset === "string" && dashboardDatePresetSet.has(input.datePreset)) {
    normalized.datePreset = input.datePreset as DashboardDatePreset;
  }
  if (typeof input.compare === "string" && dashboardComparisonSet.has(input.compare)) {
    normalized.compare = input.compare as NonNullable<CrmDashboardFilters["compare"]>;
  }
  if (!normalized.datePreset) {
    for (const key of ["dateFrom", "dateTo"] as const) {
      if (typeof input[key] === "string" && Number.isFinite(Date.parse(input[key]))) normalized[key] = input[key];
    }
  }
  for (const key of ["branchId", "ownerUserId", "pipelineId"] as const) {
    if (typeof input[key] === "string" && uuidV7Pattern.test(input[key])) normalized[key] = input[key];
  }
  if (typeof input.currencyCode === "string" && /^[A-Za-z]{3}$/.test(input.currencyCode.trim())) {
    normalized.currencyCode = input.currencyCode.trim().toUpperCase();
  }
  if (isBoundedInteger(input.staleDays, 365)) normalized.staleDays = input.staleDays;
  if (isBoundedInteger(input.closingWindowDays, 365)) normalized.closingWindowDays = input.closingWindowDays;
  if (isBoundedInteger(input.limit, 100)) normalized.limit = input.limit;

  return normalized;
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= maximum;
}
