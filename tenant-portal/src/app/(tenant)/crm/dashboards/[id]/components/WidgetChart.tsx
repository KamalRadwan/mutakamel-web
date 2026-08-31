"use client";

import {
  AreaChart,
  BarChart,
  DonutChart,
  LineChart,
  topNWithOther,
  type CartesianSeries,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetResult } from "../../dashboard-run-contract";
import { primarySeries, seriesRole, type WidgetRenderMode } from "../../widget-view";

interface WidgetChartProps {
  mode: Exclude<WidgetRenderMode, "SCALAR" | "TABLE">;
  result: WidgetResult;
  label: string;
}

const CHART_HEIGHT = 220;

/**
 * Draws one executed widget.
 *
 * Only the four renderers the design system actually has. The accessible text
 * equivalent is the data table the tile always renders beside this — the
 * `summary` here is the one-line orientation a screen-reader user gets before
 * reaching it, not a substitute for it.
 */
export function WidgetChart({ mode, result, label }: WidgetChartProps) {
  const { t } = useI18n();
  const series = primarySeries(result);

  const summary = formatTemplate(t.crmDashboards.chartSummary, {
    series: series.length,
    points: series[0]?.points.length ?? 0,
  });

  if (mode === "DONUT") {
    const slices = topNWithOther(
      series[0].points.map((point) => ({
        key: point.key,
        label: point.label,
        value: point.value,
      })),
      t.crmDashboards.otherSlice,
    );
    return (
      <DonutChart
        slices={slices}
        label={label}
        summary={summary}
        height={CHART_HEIGHT}
        numberFormat={{ notation: "compact" }}
      />
    );
  }

  // One row per point key, in the first series' order, with a column per
  // series — recharts wants the transpose of what the wire sends.
  const order: string[] = [];
  const rows = new Map<string, Record<string, string | number>>();
  for (const entry of series) {
    for (const point of entry.points) {
      const existing = rows.get(point.key);
      if (existing) {
        existing[entry.key] = point.value;
        continue;
      }
      order.push(point.key);
      rows.set(point.key, { label: point.label, [entry.key]: point.value });
    }
  }

  const chartSeries: CartesianSeries[] = series.map((entry) => ({
    key: entry.key,
    label: entry.label,
    role: seriesRole(entry.key),
  }));

  const props = {
    data: order.map((key) => rows.get(key) as Record<string, string | number>),
    xKey: "label",
    series: chartSeries,
    label,
    summary,
    height: CHART_HEIGHT,
    showLegend: series.length > 1,
    numberFormat: { notation: "compact" as const },
  };

  if (mode === "LINE") return <LineChart {...props} />;
  if (mode === "AREA") return <AreaChart {...props} />;
  return <BarChart {...props} />;
}
