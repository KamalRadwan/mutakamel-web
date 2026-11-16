import { record, timestamp } from "./dashboard-parse";
import type { WidgetResult } from "./dashboard-run-contract";

// Standalone measures from CRM semantic/dashboard-metric-registry.ts.
export const LEAD_MISSING_SOURCE_SHARE = "crm.leads.created.missing_source.rate";
export const LEAD_CURRENT_RATING_MIX = "crm.leads.created.by_current_rating.count";
export const LEAD_INQUIRY_CLASSIFICATION = "crm.leads.created.by_inquiry_classification.count";
const CLASSIFICATION_KEYS = ["FIRST_OBSERVED", "REPEAT_OBSERVED", "AWAITING_REVIEW", "BEFORE_COVERAGE"] as const;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const readable = (result: WidgetResult | undefined) => result && ["READY", "EMPTY"].includes(result.state ?? "") && result.errorCode === null;

export function readMissingSourceShare(result: WidgetResult | undefined) {
  const evidence = record(result?.details?.populationShare);
  const series = result?.series[0];
  if (!readable(result) || !result || result.shape !== "SCALAR" || result.unit !== "PERCENT"
    || result.series.length !== 1 || series?.key !== LEAD_MISSING_SOURCE_SHARE || series.unit !== "PERCENT" || series.points.length !== 1
    || !evidence || !count(evidence.numerator) || !count(evidence.denominator) || evidence.numerator > evidence.denominator
    || evidence.populationBasis !== "CREATED_IN_PERIOD" || evidence.attributionBasis !== "CURRENT_SOURCE") return null;
  const value = evidence.denominator ? Number((100 * evidence.numerator / evidence.denominator).toFixed(2)) : null;
  if (result.state !== (evidence.denominator ? "READY" : "EMPTY") || result.value !== value || evidence.sharePercent !== value
    || series.points[0].value !== value || result.target !== null || result.previousValue !== null) return null;
  return { numerator: evidence.numerator, denominator: evidence.denominator, sharePercent: value };
}

export function readCurrentRatingMix(result: WidgetResult | undefined) {
  const evidence = record(result?.details?.currentRatingMix);
  const series = result?.series[0];
  if (!readable(result) || !result || result.shape !== "CATEGORY" || result.unit !== "COUNT" || result.series.length !== 1
    || series?.key !== LEAD_CURRENT_RATING_MIX || series.unit !== "COUNT" || !evidence || !count(evidence.total)
    || evidence.populationBasis !== "CREATED_IN_PERIOD" || evidence.ratingBasis !== "CURRENT_RATING"
    || evidence.minRating !== 0 || evidence.maxRating !== 3 || result.state !== (evidence.total ? "READY" : "EMPTY")
    || series.points.length !== (evidence.total ? 4 : 0)) return null;
  const rows = [];
  for (const [index, point] of series.points.entries()) {
    const share = evidence.total ? Number((100 * (point.value ?? 0) / evidence.total).toFixed(2)) : null;
    if (point.key !== String(index) || !count(point.value) || point.meta.numerator !== point.value
      || point.meta.denominator !== evidence.total || point.meta.sharePercent !== share || point.previousValue !== undefined) return null;
    rows.push({ key: point.key, label: point.label, count: point.value, sharePercent: share });
  }
  if (rows.reduce((sum, row) => sum + row.count, 0) !== evidence.total) return null;
  return { total: evidence.total, rows };
}

export function readInquiryClassification(result: WidgetResult | undefined) {
  const evidence = record(result?.details?.inquiryClassification);
  const series = result?.series[0];
  if (!readable(result) || !result || result.shape !== "CATEGORY" || result.unit !== "COUNT"
    || result.series.length !== 1 || series?.key !== LEAD_INQUIRY_CLASSIFICATION || series.unit !== "COUNT"
    || !evidence || !count(evidence.total) || !count(evidence.classified) || !timestamp(evidence.coverageStartedAt)
    || Date.parse(evidence.coverageStartedAt) > Date.parse(result.generatedAt)
    || evidence.populationBasis !== "CREATED_IN_PERIOD" || evidence.identityBasis !== "CURRENT_APPROVED_OBSERVED_HISTORY"
    || evidence.tiePolicy !== "FIRST_AT_SAME_INSTANT" || result.state !== (evidence.total ? "READY" : "EMPTY")
    || result.previousValue !== null || result.target !== null || series.points.length !== (evidence.total ? 4 : 0)) return null;
  const rows = [];
  for (const [index, point] of series.points.entries()) {
    const key = CLASSIFICATION_KEYS[index];
    if (point.key !== key || !count(point.value) || point.meta.numerator !== point.value
      || point.meta.denominator !== evidence.total || point.previousValue !== undefined) return null;
    const share = Number((100 * point.value / evidence.total).toFixed(2));
    if (point.meta.sharePercent !== share) return null;
    rows.push({ key, label: point.label, count: point.value });
  }
  if (rows.reduce((sum, row) => sum + row.count, 0) !== evidence.total
    || (rows[0]?.count ?? 0) + (rows[1]?.count ?? 0) !== evidence.classified) return null;
  return { total: evidence.total, classified: evidence.classified, coverageStartedAt: evidence.coverageStartedAt, rows };
}
