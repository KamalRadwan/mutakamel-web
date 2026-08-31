// How one executed widget is rendered, and the table every widget also gets.
//
// crm-app offers 34 visualization types; this design system has line, area,
// bar, donut and sparkline (docs/design/patterns.md#chart). The rule here is
// **never approximate**: a treemap, a gantt or a sankey renders as its data
// table rather than as a chart that is not the chart it claims to be. That
// table is also the screen-reader equivalent every chart needs
// (docs/design/accessibility.md), so it is built for all of them.

import type { ChartRole } from "@/design-system";
import type { Language } from "@/i18n/useLanguage";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import type { CrmMetricUnit, CrmVisualization } from "./widget-contract";
import type { WidgetResult, WidgetSeries } from "./dashboard-run-contract";

export type WidgetRenderMode = "SCALAR" | "LINE" | "AREA" | "BAR" | "DONUT" | "TABLE";

export type WidgetCell =
  | { kind: "text"; text: string }
  | { kind: "datetime"; value: string }
  | { kind: "number"; value: number }
  | { kind: "money"; value: number; currency: string | null };

export interface WidgetTableModel {
  columns: Array<{ key: string; label: string; numeric: boolean }>;
  rows: Array<{ key: string; cells: WidgetCell[] }>;
}

/** The visualizations whose whole content is one number. */
const SCALAR_VISUALIZATIONS = new Set<CrmVisualization>([
  "METRIC_CARD",
  "PROGRESS_CARD",
  "BULLET",
  "SEMI_CIRCLE_GAUGE",
  "THREE_QUARTER_GAUGE",
  "CIRCULAR_PROGRESS_GAUGE",
  "DETAILED_SPEEDOMETER",
]);

const LINE_VISUALIZATIONS = new Set<CrmVisualization>(["LINE", "LINE_AREA", "CALENDAR_HEATMAP"]);
const AREA_VISUALIZATIONS = new Set<CrmVisualization>(["AREA"]);
const BAR_VISUALIZATIONS = new Set<CrmVisualization>([
  "COLUMN",
  "BAR",
  "STACKED_BAR",
  "STACKED_BAR_100",
  "COMBO",
  "FUNNEL",
]);
const DONUT_VISUALIZATIONS = new Set<CrmVisualization>(["PIE", "DONUT"]);

/** Series the server appended as a period comparison are not plotted — see below. */
export function primarySeries(result: WidgetResult): WidgetSeries[] {
  return result.series.filter((series) => !series.isComparison);
}

/**
 * Chooses the renderer.
 *
 * A **multi-series** cartesian widget falls through to the table on purpose.
 * `CartesianChart` colours a series by its outcome role, and
 * docs/design/tokens.md#charts forbids inventing an identity palette; two
 * series that resolve to the same role would be drawn in one colour and read
 * as one line. Where the roles differ — won vs lost — the chart is used.
 */
export function widgetRenderMode(
  visualizationType: CrmVisualization,
  result: WidgetResult,
): WidgetRenderMode {
  if (result.errorCode !== null) return "TABLE";
  if (SCALAR_VISUALIZATIONS.has(visualizationType) && result.value !== null) return "SCALAR";
  if (result.typedResult !== null) return "TABLE";

  const series = primarySeries(result);
  if (series.length === 0 || series.every((entry) => entry.points.length === 0)) return "TABLE";
  if (series.length > 1 && !hasDistinctRoles(series)) return "TABLE";

  if (LINE_VISUALIZATIONS.has(visualizationType)) return "LINE";
  if (AREA_VISUALIZATIONS.has(visualizationType)) return "AREA";
  if (BAR_VISUALIZATIONS.has(visualizationType)) return "BAR";
  // A donut needs one categorical series; a second would have nowhere to go.
  if (DONUT_VISUALIZATIONS.has(visualizationType) && series.length === 1) return "DONUT";
  return "TABLE";
}

function hasDistinctRoles(series: readonly WidgetSeries[]): boolean {
  const roles = series.map((entry) => seriesRole(entry.key));
  return new Set(roles).size === roles.length;
}

/**
 * The outcome a series carries, derived from its metric key.
 *
 * The key prefix of a series is the metric key it was built from
 * (`canonicalSeries`: `` `${metric.key}${keySuffix}` ``), and the metric keys
 * are server-owned constants in `dashboard-catalog.ts`. Only the four keys
 * that *state* an outcome take a hue; everything else is `brand`, because a
 * category is never a colour (docs/design/tokens.md).
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
