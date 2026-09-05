"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual, DashboardVisualSeries } from "@/types/dashboard";
import { ChartTooltip } from "../../charts/ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import {
  formatVisualExactValue,
  formatVisualTick,
  formatVisualValue,
  visualColor,
} from "../visual-format";

type MultiSeriesModel = Extract<DashboardVisual, { kind: "multi-series" }>;

/**
 * Three or more named lines over one shared time axis.
 *
 * Overlaid, never stacked: each line answers its own question ("how many are
 * verified", "how many need attention") and a stack would invent a total
 * neither of them means. Bars would do the same thing worse, by implying the
 * buckets are categories rather than a chronology.
 *
 * Like `TimeSeriesVisual`, chronology is never reversed for RTL — only the
 * value axis moves to the other side.
 */
export function MultiSeriesVisual({
  visual,
  height = 280,
}: {
  visual: MultiSeriesModel;
  height?: number;
}) {
  const { dir, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const series = visual.data.series.filter((entry) => entry.points.length > 0);

  if (series.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  // Bounded like every other visual: the SVG draws at most the house limit of
  // lines, while the exact-value table below keeps every series Core sent.
  const drawn = dashboardChartVisualItems(series);
  const buckets = mergeBuckets(series);
  const plotted = drawn.map((entry, index) => ({
    ...entry,
    // Recharts keys a line by a field name on the merged row, and a series key
    // could collide with `label`; the positional field never can.
    field: `value${index}`,
    color: visualColor(index, entry.tone),
    total: entry.points.reduce((sum, point) => sum + point.value, 0),
  }));

  const rows = buckets.map((bucket) => {
    const row: Record<string, string | number> = { label: bucket.label };
    plotted.forEach((entry) => {
      const point = entry.points.find((candidate) => candidate.key === bucket.key);
      if (point) row[entry.field] = point.value;
    });
    return row;
  });

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const totals = plotted
    .map((entry) => `${entry.label} ${formatVisualValue(lang, entry.total, visual.unit)}`)
    .join(lang === "ar" ? "، " : ", ");

  const summary =
    lang === "ar"
      ? `${visual.title}: ${plotted.length} سلسلة عبر ${buckets.length} فترة من ${first.label} إلى ${last.label}. الإجماليات: ${totals}.`
      : `${visual.title}: ${plotted.length} series across ${buckets.length} periods from ${first.label} to ${last.label}. Totals: ${totals}.`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      legend={plotted.map((entry) => ({
        key: entry.key,
        label: entry.label,
        color: entry.color,
        value: formatVisualValue(lang, entry.total, visual.unit),
      }))}
      columns={[copy.period, ...series.map((entry) => entry.label)]}
      rows={buckets.map((bucket) => ({
        key: bucket.key,
        cells: [
          bucket.label,
          ...series.map((entry) => {
            const point = entry.points.find((candidate) => candidate.key === bucket.key);
            return point ? formatVisualExactValue(lang, point.value, visual.unit) : "—";
          }),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          accessibilityLayer={false}
          data={rows}
          margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={20}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <YAxis
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatVisualTick(lang, Number(value), visual.unit)}
          />
          <Tooltip
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value) => formatVisualValue(lang, Number(value), visual.unit)}
              />
            }
          />
          {plotted.map((entry) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.field}
              name={entry.label}
              stroke={entry.color}
              strokeWidth={2.5}
              connectNulls
              dot={buckets.length <= 20 ? { r: 3, fill: entry.color, strokeWidth: 0 } : false}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

/**
 * One shared axis out of series that need not agree on their buckets: first
 * appearance wins the order, so a series missing an early month does not
 * reorder the chronology the others established.
 */
function mergeBuckets(
  series: DashboardVisualSeries[],
): Array<{ key: string; label: string }> {
  const buckets = new Map<string, string>();
  for (const entry of series) {
    for (const point of entry.points) {
      if (!buckets.has(point.key)) buckets.set(point.key, point.label);
    }
  }
  return [...buckets].map(([key, label]) => ({ key, label }));
}
