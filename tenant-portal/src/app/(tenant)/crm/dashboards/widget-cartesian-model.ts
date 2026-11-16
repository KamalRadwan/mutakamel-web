import type { CartesianChartProps, CartesianSeries } from "@/design-system";
import type { WidgetResult, WidgetSeries } from "./dashboard-run-contract";
import type { CrmMetricUnit, CrmVisualization, WidgetQuerySpec } from "./widget-contract";
import { COLORFUL_SWATCH_FILLS, seriesRole } from "./widget-view";
import { widgetSeriesColor } from "./widget-presentation";
import { record } from "./dashboard-parse";
import { LEAD_SOURCE_GROWTH_METRIC } from "./widget-source-growth";

export interface CartesianLabels {
  previous: string;
  value: string;
  units: Record<CrmMetricUnit, string>;
}

export function buildWidgetCartesianModel(result: WidgetResult, visualization: CrmVisualization | undefined,
  labels: CartesianLabels, display: Record<string, unknown>, query: WidgetQuerySpec | undefined,
  format: (value: number, unit: CrmMetricUnit | null, currency: string | null) => string) {
  const rows = new Map<string, Record<string, string | number | null>>();
  const order: string[] = [];
  const plotted: CartesianSeries[] = [];
  const axisLabels: Partial<Record<"LEFT" | "RIGHT", string>> = {};
  const valueAxes: NonNullable<CartesianChartProps["valueAxes"]> = {};
  const normalized = visualization === "STACKED_BAR_100";
  const sourceCohort = Boolean(record(result.details?.sourceCohort));
  const branchCohort = record(result.details?.cohortProgress)?.groupBy === "branch";
  const datasets = Boolean(record(result.details?.datasetComparison));
  const unitLabel = (entry: WidgetSeries) => normalized ? labels.units.PERCENT
    : entry.unit === "MONEY" ? entry.currency ?? result.currency ?? labels.units.MONEY
    : entry.unit ? labels.units[entry.unit] : labels.value;
  result.series.forEach((entry, index) => {
    const paired = entry.points.some((point) => point.previousValue !== undefined);
    const role = seriesRole(entry.key);
    const color = datasets ? (index === 0 && query?.series[0] ? widgetSeriesColor(query.series[0].metricKey, query, display) : undefined)
      : widgetSeriesColor(entry.key, query, display);
    const diverging = entry.key === LEAD_SOURCE_GROWTH_METRIC;
    const fill = color ?? (diverging ? undefined : COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length]);
    const comboKind = (sourceCohort ? entry.unit === "COUNT" : index === 0) ? "bar" : "line";
    const kind = visualization === "LINE" ? "line" : visualization === "AREA" ? "area"
      : visualization === "LINE_AREA" ? index === 0 ? "area" : "line"
      : visualization === "COMBO" ? comboKind : "bar";
    const formatter = (value: number) => format(value, normalized ? "PERCENT" : entry.unit, normalized ? null : entry.currency ?? result.currency);
    axisLabels[entry.axis] = unitLabel(entry);
    let domain: [number, number] | undefined;
    if ((sourceCohort || branchCohort) && entry.unit === "PERCENT") domain = [0, 100];
    if (diverging) {
      const values = entry.points.flatMap(({ value }) => value === null ? [] : [value]);
      const min = Math.min(0, ...values);
      const max = Math.max(0, ...values);
      const padding = (max - min) * 0.2;
      domain = [min < 0 ? min - padding : 0, max > 0 ? max + padding : min === 0 ? 1 : 0];
    }
    valueAxes[entry.axis] = { integers: !normalized && entry.unit === "COUNT", domain };
    const caption = entry.label.endsWith(`(${unitLabel(entry)})`) ? entry.label : `${entry.label} (${unitLabel(entry)})`;
    plotted.push({ key: entry.key, label: caption, role: diverging ? "positive" : role, fill, axis: entry.axis, kind, stackKey: "current",
      ...(diverging ? { diverging: true } : {}), valueFormatter: formatter });
    if (paired) plotted.push({ key: `${entry.key}:matched`, label: `${caption} · ${labels.previous}`, role, fill, axis: entry.axis,
      kind: kind === "area" ? "line" : kind, strokeDasharray: "5 4", opacity: 0.55, stackKey: "previous", valueFormatter: formatter });
    for (const point of entry.points) {
      if (!rows.has(point.key)) { order.push(point.key); rows.set(point.key, { label: point.label }); }
      const row = rows.get(point.key)!;
      row[entry.key] = point.value;
      if (paired) row[`${entry.key}:matched`] = point.previousValue ?? null;
    }
  });
  const data = order.map((key) => {
    const row = rows.get(key)!;
    // Missing categories remain gaps. A zero denominator is not a zero share.
    for (const entry of plotted) if (row[entry.key] === undefined) row[entry.key] = null;
    if (normalized) for (const group of ["current", "previous"]) {
      const entries = plotted.filter((entry) => entry.stackKey === group);
      const complete = entries.every((entry) => typeof row[entry.key] === "number" && (row[entry.key] as number) >= 0);
      const scale = Math.max(0, ...entries.map((entry) => typeof row[entry.key] === "number" ? row[entry.key] as number : 0));
      const total = scale > 0 ? entries.reduce((sum, entry) => sum + (typeof row[entry.key] === "number" ? (row[entry.key] as number) / scale : 0), 0) : 0;
      for (const entry of entries) row[entry.key] = complete && total > 0 ? ((row[entry.key] as number) / scale) / total * 100 : null;
    }
    return row;
  });
  return { data, series: plotted, axisLabels, valueAxes, pointKeys: order, hasComparisons: plotted.length > result.series.length };
}
