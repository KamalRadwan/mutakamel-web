// How one executed widget is rendered, and the table every widget also gets.
//
// Current visualization enums have native adapters. Invalid, incomplete,
// unavailable or over-budget geometry keeps its exact accessible data table.

import type { ChartRole, SwatchHue } from "@/design-system";
import type { Language } from "@/i18n/useLanguage";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import type { CrmMetricUnit, CrmVisualization } from "./widget-contract";
import type { WidgetResult, WidgetSeries } from "./dashboard-run-contract";
import { typedTableModel } from "./widget-typed-table";
import { WIDGET_RENDER_CAPABILITIES } from "./widget-render-capabilities";
import { seriesTableModel, type WidgetTableHeaders } from "./widget-series-table";
import { durationDistribution } from "./widget-duration-distribution";
export type { WidgetTableHeaders } from "./widget-series-table";

export type WidgetRenderMode =
  | "SCALAR"
  | "MULTI_KPI"
  | "GAUGE"
  | "LINE"
  | "AREA"
  | "COMPOSED"
  | "BAR"
  | "STACKED_BAR"
  | "DONUT"
  | "FUNNEL"
  | "SCATTER"
  | "HEATMAP"
  | "HISTOGRAM"
  | "BOX_PLOT"
  | "WATERFALL"
  | "TREEMAP"
  | "LEADERBOARD"
  | "SCORECARD"
  | "GANTT"
  | "FLOWCHART"
  | "CALENDAR"
  | "TIMELINE"
  | "CALENDAR_HEATMAP"
  | "ALERT_LIST"
  | "ACTIVITY_FEED"
  | "TABLE";

export const COLORFUL_SWATCH_FILLS = [
  "var(--swatch-blue)",
  "var(--swatch-teal)",
  "var(--swatch-purple)",
  "var(--swatch-amber)",
  "var(--swatch-green)",
  "var(--swatch-indigo)",
  "var(--swatch-pink)",
  "var(--swatch-orange)",
] as const;

export const COLORFUL_SWATCH_HUES: readonly SwatchHue[] = [
  "blue",
  "teal",
  "purple",
  "amber",
  "green",
  "indigo",
  "pink",
  "orange",
];

export type WidgetCell =
  | { kind: "missing" }
  | { kind: "text"; text: string; swatch?: string }
  | { kind: "datetime"; value: string }
  | { kind: "number"; value: number; unit?: CrmMetricUnit; signed?: boolean }
  | { kind: "decimal"; value: string; currency?: string }
  | { kind: "money"; value: number; currency: string | null };

export interface WidgetTableModel {
  columns: Array<{ key: string; label: string; numeric: boolean }>;
  rows: Array<{ key: string; cells: WidgetCell[]; total?: boolean }>;
  compactMissing?: boolean;
}

/** Single-value KPI card. */
const SCALAR_VISUALIZATIONS = new Set<CrmVisualization>(["METRIC_CARD"]);

/** Target-based gauges, progress cards, and bullets. */
const GAUGE_VISUALIZATIONS = new Set<CrmVisualization>([
  "PROGRESS_CARD",
  "BULLET",
  "SEMI_CIRCLE_GAUGE",
  "THREE_QUARTER_GAUGE",
  "CIRCULAR_PROGRESS_GAUGE",
  "DETAILED_SPEEDOMETER",
]);

const LINE_VISUALIZATIONS = new Set<CrmVisualization>(["LINE"]);
const AREA_VISUALIZATIONS = new Set<CrmVisualization>(["AREA", "LINE_AREA"]);
const BAR_VISUALIZATIONS = new Set<CrmVisualization>([
  "COLUMN",
  "BAR",
  "COMBO",
  "LEADERBOARD",
]);
const STACKED_BAR_VISUALIZATIONS = new Set<CrmVisualization>([
  "STACKED_BAR",
  "STACKED_BAR_100",
]);
const DONUT_VISUALIZATIONS = new Set<CrmVisualization>(["PIE", "DONUT"]);
const SCATTER_VISUALIZATIONS = new Set<CrmVisualization>(["SCATTER", "BUBBLE"]);
const HEATMAP_VISUALIZATIONS = new Set<CrmVisualization>(["HEATMAP", "CALENDAR_HEATMAP"]);

/** Current execution pairs comparison values on each primary point. */
export function primarySeries(result: WidgetResult): WidgetSeries[] {
  return result.series;
}

/** canonicalSeries splits one categorical money metric by its actual currency. */
export function hasSingleMeasureCurrencyFacets(series: readonly WidgetSeries[]): boolean {
  if (series.length < 2 || series.some((row) => row.unit !== "MONEY" || !row.currency || !row.key.endsWith(`:${row.currency}`))) return false;
  return new Set(series.map((row) => row.currency)).size === series.length && new Set(series.map((row) => row.key.slice(0, -(row.currency!.length + 1)))).size === 1;
}

export function hasPointComparison(result: WidgetResult): boolean {
  return result.series.some((series) => series.points.some((point) => point.previousValue !== undefined));
}

export function plotsPointComparison(mode: WidgetRenderMode): boolean {
  return ["LINE", "AREA", "BAR", "STACKED_BAR", "COMPOSED", "HEATMAP"].includes(mode);
}

export function widgetDataUnavailable(result: WidgetResult): boolean {
  return result.state !== undefined && ["UNAVAILABLE", "RETIRED", "FAILED", "DEADLINE_EXCEEDED"].includes(result.state);
}

/**
 * Chooses the renderer.
 *
 * Every widget still builds its accessible `WidgetTableModel` alongside the
 * visual representation.
 */
export function widgetRenderMode(
  visualizationType: CrmVisualization,
  result: WidgetResult,
): WidgetRenderMode {
  if (result.errorCode !== null || widgetDataUnavailable(result)) return "TABLE";
  if (!(WIDGET_RENDER_CAPABILITIES[visualizationType] as readonly string[]).includes(result.shape)) return "TABLE";
  const plotted = primarySeries(result);
  if (visualizationType === "MULTI_KPI" && result.shape === "SCALAR" && plotted.length >= 2 && plotted.length <= 4) return "MULTI_KPI";
  if (visualizationType === "LEADERBOARD" && result.shape === "CATEGORY" && plotted.length >= 1 && plotted.length <= 4) return "LEADERBOARD";
  const units = new Set(plotted.map((series) => series.unit));
  const dualAxis = ["LINE", "LINE_AREA", "COLUMN", "COMBO"].includes(visualizationType);
  if (units.size > 2 || (units.size > 1 && !dualAxis)) return "TABLE";
  // An axis has one unit. Do not place money and counts on the same scale.
  if (["LEFT", "RIGHT"].some((axis) => new Set(plotted.filter((series) => series.axis === axis).map((series) => series.unit)).size > 1)) return "TABLE";
  if (SCALAR_VISUALIZATIONS.has(visualizationType) && result.value !== null) return "SCALAR";
  if (GAUGE_VISUALIZATIONS.has(visualizationType) && result.value !== null) return "GAUGE";

  if (result.typedResult !== null) {
    const typed = result.typedResult;
    if (visualizationType === "BOX_PLOT" && durationDistribution(typed)?.totalCount) return "BOX_PLOT";
    if (visualizationType === "WATERFALL" && typed.shape === "WATERFALL") return "WATERFALL";
    if (visualizationType === "TREEMAP" && typed.shape === "HIERARCHY") return "TREEMAP";
    if (visualizationType === "LEADERBOARD" && typed.shape === "ROWS" && typed.rowKind === "RANKED") return "LEADERBOARD";
    if (visualizationType === "SCORECARD" && typed.shape === "ROWS" && typed.rowKind === "SCORECARD") return "SCORECARD";
    if (
      visualizationType === "HISTOGRAM" &&
      typed.shape === "BINNED_DISTRIBUTION" &&
      Array.isArray(typed.bins) &&
      typed.bins.length > 0
    ) {
      return "HISTOGRAM";
    }
    if (
      visualizationType === "ALERT_LIST" &&
      typed.shape === "ROWS" &&
      Array.isArray(typed.rows) &&
      typed.rows.length > 0
    ) {
      return "ALERT_LIST";
    }
    if (
      (visualizationType === "ACTIVITY_FEED" || visualizationType === "TIMELINE") &&
      typed.shape === "EVENT_STREAM" &&
      Array.isArray(typed.events) &&
      typed.events.length > 0
    ) {
      return visualizationType === "TIMELINE" ? "TIMELINE" : "ACTIVITY_FEED";
    }
    return "TABLE";
  }

  const series = primarySeries(result);
  if (series.length === 0 || series.every((entry) => entry.points.length === 0)) return "TABLE";
  if (visualizationType === "FLOWCHART" && result.shape === "GRAPH") return "FLOWCHART";
  if ((visualizationType === "GANTT" || visualizationType === "CALENDAR" || visualizationType === "TIMELINE") && result.shape === "INTERVAL") return visualizationType;
  if (visualizationType === "CALENDAR_HEATMAP" && result.shape === "TIME_SERIES" && series.length === 1) return "CALENDAR_HEATMAP";
  if (visualizationType === "HEATMAP" && (result.shape === "CATEGORY" || result.shape === "TIME_SERIES")) return "HEATMAP";
  // A partial donut/funnel is a different population; do not draw missing
  // categories as zero or quietly omit them from a percentage denominator.
  if (["DONUT", "FUNNEL", "STACKED_BAR_100"].includes(visualizationType)
    && series.some((entry) => entry.points.some((point) => point.value === null))) return "TABLE";
  if (["PIE", "DONUT", "FUNNEL", "STACKED_BAR_100"].includes(visualizationType)
    && series.some((entry) => !["COUNT", "MONEY"].includes(entry.unit ?? "") || entry.points.some((point) => point.value === null || point.value < 0))) return "TABLE";
  if (["SCATTER", "BUBBLE"].includes(visualizationType)
    && series.some((entry) => entry.points.some((point) => point.value === null || point.secondaryValue === null
      || (visualizationType === "BUBBLE" && point.size == null)))) return "TABLE";
  // The current XY producer declares probability/amount/capped-age by this
  // registered metric. A future generic XY source needs explicit axis metadata.
  if (["SCATTER", "BUBBLE"].includes(visualizationType)
    && !series.every((entry) => entry.key === "crm.opportunities.value_probability" || entry.key.startsWith("crm.opportunities.value_probability:"))) return "TABLE";

  if (visualizationType === "MULTI_KPI") return "MULTI_KPI";
  if (visualizationType === "FUNNEL" && (series.length === 1 || hasSingleMeasureCurrencyFacets(series))) return "FUNNEL";
  if (STACKED_BAR_VISUALIZATIONS.has(visualizationType) && series.length <= 8) return "STACKED_BAR";
  if (
    SCATTER_VISUALIZATIONS.has(visualizationType) &&
    series.length === 1 &&
    (result.shape === "XY" || series[0].points.some((point) => point.secondaryValue !== null))
  ) {
    return "SCATTER";
  }
  if (
    HEATMAP_VISUALIZATIONS.has(visualizationType) &&
    series.length >= 1 &&
    (series[0].key.includes("intensity") ||
      series[0].key.includes("heatmap") ||
      series[0].points.some(
        (point) => point.key.includes(":") || typeof point.meta.dayOfWeek === "number",
      ))
  ) {
    return "HEATMAP";
  }

  if (DONUT_VISUALIZATIONS.has(visualizationType) && (series.length === 1 || hasSingleMeasureCurrencyFacets(series))) return "DONUT";

  if (series.length > 1 && !canPlotMultiSeries(series)) return "TABLE";

  if (visualizationType === "COMBO" || visualizationType === "LINE_AREA") return "COMPOSED";

  if (LINE_VISUALIZATIONS.has(visualizationType)) return "LINE";
  if (AREA_VISUALIZATIONS.has(visualizationType)) return "AREA";
  if (BAR_VISUALIZATIONS.has(visualizationType)) return "BAR";
  return "TABLE";
}

function canPlotMultiSeries(series: readonly WidgetSeries[]): boolean {
  return series.length <= COLORFUL_SWATCH_FILLS.length;
}

/**
 * The outcome a series carries, derived from its metric key.
 */
export function seriesRole(seriesKey: string): ChartRole {
  if (seriesKey.includes(".won")) return "positive";
  if (seriesKey.includes(".lost") || seriesKey.includes(".failed")) return "negative";
  if (
    seriesKey.includes(".stale") ||
    seriesKey.includes(".overdue") ||
    seriesKey.includes(".untouched") ||
    seriesKey.includes(".missing_")
  ) {
    return "caution";
  }
  return "brand";
}

/** True when a higher metric number represents an operational problem rather than growth. */
export function isInverseMetricKey(metricKey?: string | null): boolean {
  if (!metricKey) return false;
  return (
    metricKey.includes(".overdue") ||
    metricKey.includes(".stale") ||
    metricKey.includes(".untouched") ||
    metricKey.includes(".missing_") ||
    metricKey.includes(".failed") ||
    metricKey.includes(".lost") ||
    metricKey.includes(".duplicate")
  );
}

/** Accent swatch hue for a widget tile's top border and icon badge. */
export function widgetAccentHue(
  visualizationType: CrmVisualization,
  metricKey?: string | null,
): SwatchHue {
  const key = metricKey ?? "";
  if (visualizationType === "ALERT_LIST" || key.includes(".overdue") || key.includes(".failed") || key.includes(".lost")) {
    return "red";
  }
  if (key.includes(".stale") || key.includes(".untouched") || key.includes(".missing_") || key.includes(".duplicate")) {
    return "amber";
  }
  if (
    key.includes("pipeline.estimated_value") ||
    key.includes("pipeline.weighted_value") ||
    key.includes(".won") ||
    key.includes("conversion.rate") ||
    key.includes("win.rate")
  ) {
    return "green";
  }
  if (
    key.includes("data_quality") ||
    key.includes("coverage") ||
    visualizationType === "SEMI_CIRCLE_GAUGE" ||
    visualizationType === "CIRCULAR_PROGRESS_GAUGE"
  ) {
    return "teal";
  }
  if (key.includes("activities") || key.includes("calendar") || key.includes("reminders") || visualizationType === "ACTIVITY_FEED") {
    return "purple";
  }
  if (key.includes("by_source") || visualizationType === "DONUT" || visualizationType === "PIE") {
    return "amber";
  }
  if (key.includes("opportunities") || visualizationType === "FUNNEL" || visualizationType === "BUBBLE") {
    return "indigo";
  }
  if (key.includes("customer_profiles")) {
    return "pink";
  }
  return "blue";
}

export interface ScalarDeltaSummary {
  deltaPercent: number;
  sign: "up" | "down" | "flat";
  tone: "positive" | "negative" | "neutral";
}

/** Computes period-over-period percentage change and semantic tone for scalar cards. */
export function scalarDelta(
  result: WidgetResult,
  inverse = false,
): ScalarDeltaSummary | null {
  if (result.value === null || result.previousValue === null) return null;
  if (result.comparison?.percentChange === null) return null;
  if (result.previousValue === 0) {
    if (result.value === 0) {
      return { deltaPercent: 0, sign: "flat", tone: "neutral" };
    }
    return null;
  }
  const deltaPercent = result.comparison?.percentChange
    ?? ((result.value - result.previousValue) / Math.abs(result.previousValue)) * 100;
  if (!Number.isFinite(deltaPercent)) return null;
  if (Math.abs(deltaPercent) < 0.05) {
    return { deltaPercent: 0, sign: "flat", tone: "neutral" };
  }
  const sign = deltaPercent > 0 ? "up" : "down";
  const isGood = (deltaPercent > 0 && !inverse) || (deltaPercent < 0 && inverse);
  return {
    deltaPercent,
    sign,
    tone: isGood ? "positive" : "negative",
  };
}

/**
 * One metric value, formatted for its own unit.
 *
 * `PERCENT` is already 0–100 on the wire (`(converted / total) * 100`), so it
 * goes through `style: "unit"` rather than `style: "percent"`, which would
 * multiply it a second time. `MONEY` goes through `formatDecimalString` — the
 * same `Intl` path `Money` uses — with the number's own exact string form,
 * because the server has already narrowed it to a double.
 */
export function formatMetricValue(
  value: number | null,
  unit: CrmMetricUnit | null,
  currency: string | null,
  lang: Language,
): string {
  if (value === null) return "—";
  if (unit === "MONEY") {
    return formatDecimalString(
      String(value),
      lang,
      currency ? { style: "currency", currency } : { maximumFractionDigits: 2 },
    );
  }
  if (unit === "PERCENT") {
    return formatNumber(value, lang, { style: "unit", unit: "percent", maximumFractionDigits: 2 });
  }
  if (unit === "DURATION") {
    return formatNumber(value, lang, {
      style: "unit",
      unit: "minute",
      unitDisplay: "short",
      maximumFractionDigits: 0,
    });
  }
  return formatNumber(value, lang, { maximumFractionDigits: 2 });
}

/**
 * The data table.
 *
 * Every widget gets one, whatever it also draws — including the ones the
 * design system cannot chart, and including a widget that failed, where the
 * table is empty and the error is what the tile shows instead.
 */
export function widgetTableModel(
  result: WidgetResult,
  headers: WidgetTableHeaders,
): WidgetTableModel {
  const evidence = result.governedTarget;
  if (evidence?.trajectory && headers.governedTarget?.trajectory) {
    const labels = headers.governedTarget.trajectory;
    const { points } = evidence.trajectory;
    const hasPlan = evidence.workingPace?.state === "READY";
    const money = (value: string | null): WidgetCell => value === null ? { kind: "missing" }
      : { kind: "decimal", value, currency: evidence.currencyCode };
    return { columns: [
      { key: "date", label: labels.date, numeric: false },
      { key: "won", label: labels.dailyWon, numeric: true },
      { key: "observed", label: labels.observed, numeric: true },
      ...(hasPlan ? [{ key: "plan", label: labels.plan, numeric: true }, { key: "workday", label: labels.workday, numeric: false }] : []),
    ], rows: points.map(point => ({ key: point.date, cells: [
      { kind: "text", text: point.date }, money(point.wonValue), money(point.observedCumulative),
      ...(hasPlan ? [money(point.plannedCumulative), point.isPlannedWorkday ? { kind: "text", text: labels.workday } as const
        : { kind: "missing" } as const] : []),
    ] })) };
  }
  if (evidence?.amounts && headers.governedTarget) {
    const { amounts, currencyCode, workingPace } = evidence;
    const columns = [
      { key: "actual", label: headers.governedTarget.actual, value: amounts.actualValue, currency: currencyCode },
      { key: "target", label: headers.governedTarget.target, value: amounts.targetValue, currency: currencyCode },
      { key: "remaining", label: headers.governedTarget.remaining, value: amounts.remainingValue, currency: currencyCode },
      { key: "attainment", label: headers.governedTarget.attainment, value: amounts.attainmentPercent },
      ...(workingPace ? [
        { key: "requiredPerWorkday", label: headers.governedTarget.dailyPace, value: workingPace.requiredPerWorkday, currency: currencyCode },
        { key: "remainingWorkdays", label: headers.governedTarget.workdays, value: workingPace.remainingWorkdays },
        { key: "calendarRevision", label: headers.governedTarget.calendarRevision, value: workingPace.calendarRevision },
      ] : []),
    ];
    return { columns: columns.map(({ key, label }) => ({ key, label, numeric: true })),
      rows: [{ key: "__governed_target__", cells: columns.map(({ value, currency }) => value === null
        ? { kind: "missing" } : typeof value === "number" ? { kind: "number", value } : { kind: "decimal", value, currency }) }] };
  }
  if (evidence) return { columns: [], rows: [] };
  if (widgetDataUnavailable(result) || result.errorCode !== null) return { columns: [], rows: [] };
  const typed = typedTableModel(result, headers);
  if (typed) return typed;
  return seriesTableModel(result, headers);
}
