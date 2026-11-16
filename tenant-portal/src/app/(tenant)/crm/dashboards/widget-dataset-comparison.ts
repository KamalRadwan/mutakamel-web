import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { boundedArray, finiteNumber, record, timestamp } from "./dashboard-parse";
import { TIME_GRAINS, type TimeGrain } from "./widget-contract";

export interface DatasetComparisonLabels {
  baseline: string; unavailable: string; unobserved: string; unmatched: string; partial: string;
  observedAt: string; date: string; delta: string; bucket: string;
  grains: Record<TimeGrain, string>; periodsHint: string; branchesHint: string;
}

function civilDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(`${value}T00:00:00Z`);
}

function parseDatasetEntry(value: unknown) {
  const row = record(value);
  if (!row || typeof row.key !== "string" || typeof row.label !== "string"
    || (row.state !== "READY" && row.state !== "UNAVAILABLE" && row.state !== "UNOBSERVED")) return null;
  const window = record(row.window);
  return { key: row.key, label: row.label, state: row.state,
    total: finiteNumber(row.total) ? row.total : null,
    absoluteChange: finiteNumber(row.absoluteChange) ? row.absoluteChange : null,
    percentChange: finiteNumber(row.percentChange) ? row.percentChange : null,
    window: civilDate(window?.from) && civilDate(window?.to) && window.from <= window.to ? { from: window.from, to: window.to } : null,
  } as const;
}

export function datasetComparisonDetails(details?: Record<string, unknown>) {
  const comparison = record(details?.datasetComparison);
  if (!comparison || (comparison.basis !== "PERIOD" && comparison.basis !== "BRANCH") || !timestamp(comparison.asOf)
    || typeof comparison.timeZone !== "string" || !TIME_GRAINS.includes(comparison.grain as TimeGrain)
    || !boundedArray(comparison.entries, 3) || comparison.entries.length < 2) return null;
  const entries = comparison.entries.map(parseDatasetEntry).filter((row) => row !== null);
  if (entries.length !== comparison.entries.length) return null;
  return { basis: comparison.basis, asOf: comparison.asOf, timeZone: comparison.timeZone, grain: comparison.grain as TimeGrain, entries } as const;
}

export function datasetComparisonLabel(entry: NonNullable<ReturnType<typeof parseDatasetEntry>>, basis: "PERIOD" | "BRANCH", lang: Language, labels: DatasetComparisonLabels): string {
  if (entry.state === "UNAVAILABLE") return labels.unavailable;
  if (basis === "BRANCH" || !entry.window) return entry.label;
  const { from, to } = entry.window;
  const format = new Intl.DateTimeFormat(INTL_LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return format.formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
}

export function datasetPointEvidence(meta: Record<string, unknown>) {
  const point = record(meta.datasetPoint);
  return point ? { sourceKey: civilDate(point.sourceKey) ? point.sourceKey : null,
    absoluteChange: finiteNumber(point.absoluteChange) ? point.absoluteChange : null,
    complete: point.complete === true, reason: point.reason } : null;
}
