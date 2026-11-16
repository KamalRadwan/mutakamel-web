import { boundedArray, finiteNumber, invalidResponse, record, stringArray } from "../dashboard-parse";
import { durationDistribution, parseDurationGroup } from "../widget-duration-distribution";
import { branchCohortQuery, parseCohortReportContext, type BranchCohortFilters } from "./branch-cohort-report-contract";

const REPORT_PATH = "/api/tenant/crm/v1/dashboards/won-sales-cycle";
const PAGE_SIZE = 24;
const fail = () => invalidResponse("won sales cycle report");

export interface WonCycleFilters extends BranchCohortFilters {
  afterMinutes: number | null;
}

export function wonCycleQuery(filters: WonCycleFilters) {
  const path = branchCohortQuery(filters, REPORT_PATH);
  return filters.afterMinutes === null ? path : `${path}&afterMinutes=${encodeURIComponent(String(filters.afterMinutes))}`;
}

export function parseWonCycleReport(value: unknown, filters: WonCycleFilters) {
  const { root, branchById, companyId, branchId, context } = parseCohortReportContext(value, filters, fail);
  const { state, warnings } = root;
  const frequency = record(root.frequency);
  if ((state !== "READY" && state !== "EMPTY" && state !== "UNAVAILABLE") || !stringArray(warnings, 10)
    || !frequency || frequency.afterMinutes !== filters.afterMinutes || !boundedArray(frequency.values, PAGE_SIZE)) return fail();
  const next = frequency.nextAfterMinutes;
  if (next !== null && (!finiteNumber(next) || next < 0 || frequency.values.length !== PAGE_SIZE)) return fail();
  if (state === "UNAVAILABLE") {
    if (root.totals !== null || root.distribution !== null || frequency.values.length || next !== null) return fail();
    return { ...context, state, warnings, totals: null, distribution: null, values: [], nextAfterMinutes: null };
  }

  const totalsRecord = record(root.totals);
  const totals = totalsRecord && parseDurationGroup({ ...totalsRecord, key: "pooled", label: "Pooled" });
  const distribution = durationDistribution(root.distribution);
  if (!totals || !distribution || totals.sampleCount !== distribution.totalCount || totals.excludedCount !== distribution.excludedCount
    || (state === "READY") !== (totals.sampleCount > 0)) return fail();
  const byGroup = new Map(distribution.groups.map((group) => [group.key, group]));
  for (const group of distribution.groups) {
    const branch = branchById.get(group.key);
    if (!branch || (companyId && branch.companyId !== companyId) || (branchId && branch.id !== branchId)
      || group.label !== `${branch.name} · ${branch.companyName}`.trim()) return fail();
  }
  const measured = distribution.groups.filter((group) => group.min !== null && group.max !== null);
  if (measured.length && (totals.min !== Math.min(...measured.map((group) => group.min!))
    || totals.max !== Math.max(...measured.map((group) => group.max!)))) return fail();

  let previous = filters.afterMinutes ?? -1;
  const pageCounts = new Map<string, number>();
  const values = frequency.values.map((value) => {
    const item = record(value);
    if (!item || !finiteNumber(item.minutes) || item.minutes <= previous || item.minutes < 0
      || !boundedArray(item.counts, 500) || item.counts.length === 0) return fail();
    const minutes = item.minutes;
    previous = minutes;
    const seen = new Set<string>();
    const counts = item.counts.map((value) => {
      const row = record(value);
      if (!row || typeof row.branchId !== "string" || seen.has(row.branchId) || !finiteNumber(row.count)
        || !Number.isSafeInteger(row.count) || row.count < 1) return fail();
      const group = byGroup.get(row.branchId);
      if (!group || group.min === null || group.max === null || minutes < group.min || minutes > group.max) return fail();
      seen.add(row.branchId);
      pageCounts.set(row.branchId, (pageCounts.get(row.branchId) ?? 0) + row.count);
      return { branchId: row.branchId, count: row.count };
    });
    return { minutes, counts };
  });
  const full = filters.afterMinutes === null && next === null;
  if ((next !== null && next !== values.at(-1)?.minutes) || (filters.afterMinutes === null && state === "READY" && !values.length)
    || distribution.groups.some((group) => {
      const observed = pageCounts.get(group.key) ?? 0;
      return full ? observed !== group.sampleCount : observed > group.sampleCount;
    })) return fail();
  return { ...context, state, warnings, totals,
    distribution: { ...distribution, shape: "DURATION_DISTRIBUTION", unit: "DURATION", whiskerMethod: "MIN_MAX" },
    values, nextAfterMinutes: next,
  };
}

export type WonCycleReport = ReturnType<typeof parseWonCycleReport>;
