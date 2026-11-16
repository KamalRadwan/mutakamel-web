import { record } from "./dashboard-parse";
import type { WidgetResult } from "./dashboard-run-contract";

export const LEAD_SOURCE_MIX_METRIC = "crm.leads.by_source.count";

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function readSourceMix(result: WidgetResult | undefined) {
  const series = result?.series[0];
  const evidence = record(result?.details?.sourceMix);
  if (!result || !["READY", "EMPTY"].includes(result.state ?? "") || result.errorCode !== null
    || result.shape !== "CATEGORY" || result.series.length !== 1 || series?.key !== LEAD_SOURCE_MIX_METRIC
    || series.unit !== "COUNT" || series.points.length > 102 || !evidence || !count(evidence.total)
    || !count(evidence.unspecifiedCount) || !count(evidence.foldedSourceCount)
    || (result.state === "EMPTY" && evidence.total !== 0)
    || evidence.attributionBasis !== "CURRENT_SOURCE" || evidence.populationBasis !== "CREATED_IN_PERIOD") return null;
  const keys = new Set<string>();
  const rows = [];
  for (const point of series.points) {
    const share = evidence.total ? Number((100 * (point.value ?? 0) / evidence.total).toFixed(2)) : null;
    if (keys.has(point.key) || !count(point.value) || point.meta.numerator !== point.value
      || point.meta.denominator !== evidence.total || point.meta.sharePercent !== share) return null;
    keys.add(point.key);
    rows.push({ key: point.key, label: point.label, count: point.value, sharePercent: share });
  }
  if (rows.reduce((sum, row) => sum + row.count, 0) !== evidence.total
    || (rows.find(row => row.key === "UNSPECIFIED")?.count ?? 0) !== evidence.unspecifiedCount
    || keys.has("OTHER") !== (evidence.foldedSourceCount > 0)) return null;
  return { total: evidence.total, unspecifiedCount: evidence.unspecifiedCount, foldedSourceCount: evidence.foldedSourceCount, rows };
}
