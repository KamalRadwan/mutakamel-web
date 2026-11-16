import { civilDateRange, finiteNumber, record } from "./dashboard-parse";
import type { WidgetResult } from "./dashboard-run-contract";

export const LEAD_SOURCE_GROWTH_METRIC = "crm.leads.created.by_source.growth_percent";

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function growthCounts(value: unknown) {
  const source = record(value);
  if (!source || !count(source.currentCount) || !count(source.previousCount)
    || source.absoluteChange !== source.currentCount - source.previousCount) return null;
  const rate = source.growthPercent;
  if (source.previousCount === 0 ? rate !== null : !finiteNumber(rate) || rate < -100) return null;
  return {
    currentCount: source.currentCount, previousCount: source.previousCount,
    absoluteChange: source.absoluteChange, growthPercent: rate as number | null,
  };
}

export function readSourceGrowth(result: WidgetResult) {
  const series = result.series[0];
  if (result.shape !== "CATEGORY" || result.series.length !== 1
    || series.key !== LEAD_SOURCE_GROWTH_METRIC || series.unit !== "PERCENT" || series.points.length > 13) return null;
  const details = record(result.details?.sourceGrowth);
  const current = civilDateRange(details?.current);
  const previous = civilDateRange(details?.previous);
  const totals = growthCounts(details?.totals);
  if (!current || !previous || previous.to >= current.from || !totals || typeof details?.timeZone !== "string"
    || !details.timeZone || !count(details.foldedSourceCount)) return null;

  const rows = [];
  const keys = new Set<string>();
  for (const point of series.points) {
    const evidence = growthCounts(point.meta);
    if (!evidence || point.value !== evidence.growthPercent || keys.has(point.key)) return null;
    keys.add(point.key);
    rows.push({ ...evidence, key: point.key, label: point.label });
  }
  if ((details.foldedSourceCount > 0) !== keys.has("OTHER")
    || rows.reduce((sum, row) => sum + row.currentCount, 0) !== totals.currentCount
    || rows.reduce((sum, row) => sum + row.previousCount, 0) !== totals.previousCount) return null;
  return { current, previous, totals, rows, timeZone: details.timeZone, foldedSourceCount: details.foldedSourceCount };
}
