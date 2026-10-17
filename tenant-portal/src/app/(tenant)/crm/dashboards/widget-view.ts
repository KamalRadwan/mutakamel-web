// How one executed widget is rendered, and the table every widget also gets.
//
// crm-app offers 34 visualization types; this design system has line, area,
// bar, donut and sparkline (docs/design/patterns.md#chart). The rule here is
// **never approximate**: a treemap, a gantt or a sankey renders as its data
// table rather than as a chart that is not the chart it claims to be. That
// table is also the screen-reader equivalent every chart needs
// (docs/design/accessibility.md), so it is built for all of them.

import type { ChartRole, SwatchHue } from "@/design-system";
import type { Language } from "@/i18n/useLanguage";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import type { CrmMetricUnit, CrmVisualization } from "./widget-contract";
import type { WidgetResult, WidgetSeries } from "./dashboard-run-contract";

export type WidgetRenderMode =
  | "SCALAR"
  | "MULTI_KPI"
  | "GAUGE"
  | "LINE"
  | "AREA"
  | "BAR"
  | "STACKED_BAR"
  | "DONUT"
  | "FUNNEL"
  | "SCATTER"
  | "HEATMAP"
  | "HISTOGRAM"
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
  | { kind: "text"; text: string }
  | { kind: "datetime"; value: string }
  | { kind: "number"; value: number }
  | { kind: "money"; value: number; currency: string | null };

export interface WidgetTableModel {
  columns: Array<{ key: string; label: string; numeric: boolean }>;
  rows: Array<{ key: string; cells: WidgetCell[] }>;
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

/** Series the server appended as a period comparison are not plotted — see below. */
export function primarySeries(result: WidgetResult): WidgetSeries[] {
  return result.series.filter((series) => !series.isComparison);
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
  if (result.errorCode !== null) return "TABLE";
  if (SCALAR_VISUALIZATIONS.has(visualizationType) && result.value !== null) return "SCALAR";
  if (GAUGE_VISUALIZATIONS.has(visualizationType) && result.value !== null) return "GAUGE";

  if (result.typedResult !== null) {
    const typed = result.typedResult;
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
      return "ACTIVITY_FEED";
    }
    return "TABLE";
  }

  const series = primarySeries(result);
  if (series.length === 0 || series.every((entry) => entry.points.length === 0)) return "TABLE";

  if (visualizationType === "MULTI_KPI") return "MULTI_KPI";
  if (visualizationType === "FUNNEL" && series.length === 1) return "FUNNEL";
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

  if (DONUT_VISUALIZATIONS.has(visualizationType) && series.length === 1) return "DONUT";

  if (series.length > 1 && !canPlotMultiSeries(series)) return "TABLE";

  if (LINE_VISUALIZATIONS.has(visualizationType)) return "LINE";
  if (AREA_VISUALIZATIONS.has(visualizationType)) return "AREA";
  if (BAR_VISUALIZATIONS.has(visualizationType)) return "BAR";
  return "TABLE";
}

function canPlotMultiSeries(series: readonly WidgetSeries[]): boolean {
  const units = new Set(series.map((entry) => entry.unit));
  if (units.size > 1) return false;
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
  if (result.previousValue === 0) {
    if (result.value === 0) {
      return { deltaPercent: 0, sign: "flat", tone: "neutral" };
    }
    return null;
  }
  const deltaPercent =
    ((result.value - result.previousValue) / Math.abs(result.previousValue)) * 100;
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
  value: number,
  unit: CrmMetricUnit | null,
  currency: string | null,
  lang: Language,
): string {
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
  headers: { label: string; value: string },
): WidgetTableModel {
  const typed = typedResultTable(result, headers);
  if (typed) return typed;
  const labelHeader = headers.label;

  // Comparison series ARE tabulated: they are a real column of numbers, and
  // only the chart has no honest way to distinguish them.
  const series = result.series;
  if (series.length === 0) return { columns: [], rows: [] };

  const order: string[] = [];
  const labels = new Map<string, string>();
  for (const entry of series) {
    for (const point of entry.points) {
      if (!labels.has(point.key)) {
        labels.set(point.key, point.label);
        order.push(point.key);
      }
    }
  }

  return {
    columns: [
      { key: "__label__", label: labelHeader, numeric: false },
      ...series.map((entry) => ({ key: entry.key, label: entry.label, numeric: true })),
    ],
    rows: order.map((pointKey) => ({
      key: pointKey,
      cells: [
        { kind: "text", text: labels.get(pointKey) ?? pointKey },
        ...series.map((entry): WidgetCell => {
          const point = entry.points.find((candidate) => candidate.key === pointKey);
          if (!point) return { kind: "text", text: "" };
          return entry.unit === "MONEY"
            ? { kind: "money", value: point.value, currency: entry.currency ?? result.currency }
            : { kind: "number", value: point.value };
        }),
      ],
    })),
  };
}

/**
 * The five P2 shapes carry **no series at all** — `executeWidget` `continue`s
 * past series assembly whenever a metric returns a typed result — so they are
 * tabulated from `result` directly or they are not rendered at all.
 */
function typedResultTable(
  result: WidgetResult,
  headers: { label: string; value: string },
): WidgetTableModel | null {
  const typed = result.typedResult;
  if (!typed) return null;
  const money = result.unit === "MONEY";
  const currency = result.currency;

  const rowsOf = (key: string): Array<Record<string, unknown>> =>
    Array.isArray(typed[key])
      ? (typed[key] as unknown[]).flatMap((entry) =>
          entry && typeof entry === "object" ? [entry as Record<string, unknown>] : [],
        )
      : [];

  const numeric = (value: unknown): WidgetCell =>
    money && typeof value === "number"
      ? { kind: "money", value, currency }
      : { kind: "number", value: typeof value === "number" ? value : 0 };

  /**
   * A record count, whatever the metric's unit is.
   *
   * `numeric()` decides on `result.unit` alone, which is right for a value and
   * wrong for a count: a `BINNED_DISTRIBUTION` over a MONEY metric buckets
   * records **by** an amount, and `bin.count` is how many fell in the bucket —
   * "12 opportunities", never "EGP 12.00". The bucket's own money boundaries
   * are already inside `bin.label`, formatted server-side, so they keep their
   * currency. Audit R5.
   */
  const count = (value: unknown): WidgetCell => ({
    kind: "number",
    value: typeof value === "number" ? value : 0,
  });

  const text = (value: unknown): WidgetCell => ({
    kind: "text",
    text: typeof value === "string" ? value : "",
  });

  const instant = (value: unknown): WidgetCell =>
    typeof value === "string" && Number.isFinite(new Date(value).getTime())
      ? { kind: "datetime", value }
      : { kind: "text", text: "" };

  const build = (
    rows: Array<Record<string, unknown>>,
    cells: (row: Record<string, unknown>) => WidgetCell[],
    valueIsNumeric: boolean,
  ): WidgetTableModel => ({
    columns: [
      { key: "__label__", label: headers.label, numeric: false },
      { key: "__value__", label: headers.value, numeric: valueIsNumeric },
    ],
    rows: rows.map((row, index) => ({
      key: typeof row.id === "string" ? row.id : `row-${index}`,
      cells: cells(row),
    })),
  });

  if (typed.shape === "HIERARCHY") {
    return build(rowsOf("nodes"), (node) => [text(node.label), numeric(node.value)], true);
  }
  if (typed.shape === "BINNED_DISTRIBUTION") {
    return build(rowsOf("bins"), (bin) => [text(bin.label), count(bin.count)], true);
  }
  if (typed.shape === "WATERFALL") {
    return build(rowsOf("steps"), (step) => [text(step.label), numeric(step.value)], true);
  }
  if (typed.shape === "EVENT_STREAM") {
    return build(rowsOf("events"), (event) => [text(event.title), instant(event.occurredAt)], false);
  }
  if (typed.shape === "ROWS") {
    // ALERT and RANKED rows both carry `title`/`label`; only ALERT carries an
    // instant, and `severity` is deliberately not shown as a raw wire value.
    return build(
      rowsOf("rows"),
      (row) => [text(row.title ?? row.label), instant(row.occurredAt)],
      false,
    );
  }
  return null;
}
