import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { record } from "./dashboard-parse";
import type { CrmMetricUnit, CrmVisualization, WidgetQuerySpec } from "./widget-contract";
import { formatMetricValue } from "./widget-view";

const CARTESIAN = new Set<string>(["LINE", "AREA", "LINE_AREA", "COMBO", "COLUMN", "BAR", "STACKED_BAR", "STACKED_BAR_100"]);
const GAUGES = new Set<string>(["SEMI_CIRCLE_GAUGE", "THREE_QUARTER_GAUGE", "CIRCULAR_PROGRESS_GAUGE", "DETAILED_SPEEDOMETER", "PROGRESS_CARD", "BULLET"]);
export type PresentationControl = "numberFormat" | "legendPosition" | "showDelta" | "showPoints" | "showValues" | "showTable" | "seriesColor" | "targetColor";
export function supportsWidgetPresentation(type: string | undefined, control: PresentationControl): boolean {
  if (!type) return false;
  if (control === "showTable") return type !== "TABLE";
  if (control === "legendPosition" || control === "showValues") return CARTESIAN.has(type) || type === "DONUT" || type === "PIE";
  if (control === "showPoints") return ["LINE", "AREA", "LINE_AREA", "COMBO"].includes(type);
  if (control === "showDelta") return type === "METRIC_CARD" || GAUGES.has(type);
  if (control === "targetColor") return type === "METRIC_CARD" || GAUGES.has(type);
  if (control === "seriesColor") return CARTESIAN.has(type) || ["DONUT", "PIE", "SCATTER", "BUBBLE"].includes(type);
  return CARTESIAN.has(type) || GAUGES.has(type) || ["METRIC_CARD", "MULTI_KPI", "DONUT", "PIE", "SCATTER", "BUBBLE", "WATERFALL", "TREEMAP", "HISTOGRAM", "BOX_PLOT", "LEADERBOARD", "SCORECARD", "HEATMAP", "CALENDAR_HEATMAP", "FLOWCHART"].includes(type);
}
export const widgetColor = (value: unknown): string | undefined => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
export function widgetDisplayTitle(name: string, display: Record<string, unknown>): string {
  return typeof display.title === "string" && display.title.trim() ? display.title.trim() : name;
}
export function widgetDisplaySubtitle(display: Record<string, unknown>): string | undefined {
  return typeof display.subtitle === "string" && display.subtitle.trim() ? display.subtitle.trim() : undefined;
}
export function conversionSampleCaption(details: Record<string, unknown> | undefined, template: string, lang: Language): string | undefined {
  const sample = record(details?.conversionSample);
  const valid = sample?.validCount;
  const excluded = sample?.excludedCount;
  if (typeof valid !== "number" || typeof excluded !== "number"
    || !Number.isSafeInteger(valid) || !Number.isSafeInteger(excluded) || valid < 0 || excluded < 0) return undefined;
  return formatTemplate(template, { valid: formatNumber(valid, lang), excluded: formatNumber(excluded, lang) });
}
export function widgetOption(display: Record<string, unknown>, key: string, fallback = false): boolean {
  const options = display.options;
  const value = options && typeof options === "object" ? (options as Record<string, unknown>)[key] : undefined;
  return typeof value === "boolean" ? value : fallback;
}
export function widgetSeriesColor(key: string, query: WidgetQuerySpec | undefined, display: Record<string, unknown>): string | undefined {
  const entry = query?.series.find((item) => key === item.metricKey || key.startsWith(`${item.metricKey}:`));
  return widgetColor(entry?.color) ?? widgetColor(display.color);
}
/** Execution units are minutes for DURATION; conversion changes labels, never source data. */
export function formatWidgetValue(value: number | null, unit: CrmMetricUnit | null, currency: string | null, lang: Language, display: Record<string, unknown>): string {
  if (value === null) return "—";
  const preset = typeof display.numberFormat === "string" ? display.numberFormat : "auto";
  if (unit === "DURATION" && preset.startsWith("duration-")) {
    const duration = preset === "duration-auto" ? Math.abs(value) >= 1440 ? "days" : Math.abs(value) >= 60 ? "hours" : "minutes" : preset.slice(9);
    const divisor = duration === "days" ? 1440 : duration === "hours" ? 60 : 1;
    const converted = value / divisor;
    return formatNumber(converted, lang, { style: "unit", unit: duration === "days" ? "day" : duration === "hours" ? "hour" : "minute", unitDisplay: "short", maximumFractionDigits: converted !== 0 && Math.abs(converted) < 0.01 ? 20 : 2 });
  }
  if (value !== 0 && Math.abs(value) < 0.01) return formatNumber(value, lang, {
    maximumFractionDigits: 20,
    ...(Math.abs(value) < 1e-20 ? { notation: "scientific", maximumSignificantDigits: 17 } : {}),
    ...(unit === "MONEY" && currency ? { style: "currency", currency }
      : unit === "PERCENT" ? { style: "unit", unit: "percent" }
      : unit === "DURATION" ? { style: "unit", unit: "minute", unitDisplay: "short" } : {}),
  });
  if (preset !== "compact" && preset !== "full") return formatMetricValue(value, unit, currency, lang);
  const options: Intl.NumberFormatOptions = { notation: preset === "compact" ? "compact" : "standard", maximumFractionDigits: 2 };
  if (unit === "MONEY" && currency) Object.assign(options, { style: "currency", currency });
  if (unit === "PERCENT") Object.assign(options, { style: "unit", unit: "percent" });
  if (unit === "DURATION") Object.assign(options, { style: "unit", unit: "minute", unitDisplay: "short" });
  return formatNumber(value, lang, options);
}
export function unsupportedWidgetPresentation(type: CrmVisualization | undefined, display: Record<string, unknown>, query?: WidgetQuerySpec): PresentationControl[] {
  const configured: PresentationControl[] = [];
  if (display.numberFormat && display.numberFormat !== "auto") configured.push("numberFormat");
  if (display.legendPosition && display.legendPosition !== "none") configured.push("legendPosition");
  for (const key of ["showDelta", "showPoints", "showValues", "showTable"] as const) if (widgetOption(display, key)) configured.push(key);
  if (query?.series.some((entry) => widgetColor(entry.color))) configured.push("seriesColor");
  if (widgetColor(display.targetColor)) configured.push("targetColor");
  return configured.filter((key) => !supportsWidgetPresentation(type, key));
}
