"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import { ChartTooltip } from "../../charts/ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import {
  formatVisualExactValue,
  formatVisualTick,
  formatVisualValue,
} from "../visual-format";

type TimeSeriesModel = Extract<DashboardVisual, { kind: "line" | "area" }>;

/**
 * Chronology is never reversed for RTL — only the axis and legend placement
 * mirror. `reversed` stays off on the category axis for exactly that reason.
 */
export function TimeSeriesVisual({
  visual,
  height = 260,
}: {
  visual: TimeSeriesModel;
  height?: number;
}) {
  const { dir, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const points = visual.data.series;

  if (points.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const peak = points.reduce((found, point) => (point.value > found.value ? point : found), first);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const isArea = visual.kind === "area";
  const gradientId = `visual-area-${visual.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  const summary =
    lang === "ar"
      ? `${visual.title}: ${points.length} فترة من ${first.label} إلى ${last.label}، بإجمالي ${formatVisualValue(lang, total, visual.unit)}. الذروة عند ${peak.label} بقيمة ${formatVisualValue(lang, peak.value, visual.unit)}، والقيمة الأخيرة ${formatVisualValue(lang, last.value, visual.unit)}.`
      : `${visual.title}: ${points.length} periods from ${first.label} to ${last.label}, totalling ${formatVisualValue(lang, total, visual.unit)}. Peak of ${formatVisualValue(lang, peak.value, visual.unit)} at ${peak.label}; final value ${formatVisualValue(lang, last.value, visual.unit)}.`;

  const axes = (
    <>
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
    </>
  );

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      legend={[{ key: visual.key, label: visual.title, color: CHART_COLORS.qualitative[0] }]}
      columns={[copy.period, copy.value]}
      rows={points.map((point, index) => ({
        key: `${point.key}-${index}`,
        cells: [point.label, formatVisualExactValue(lang, point.value, visual.unit)],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {isArea ? (
          <AreaChart
            accessibilityLayer={false}
            data={points}
            margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.qualitative[0]} stopOpacity={0.32} />
                <stop offset="95%" stopColor={CHART_COLORS.qualitative[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              type="monotone"
              dataKey="value"
              name={visual.title}
              stroke={CHART_COLORS.qualitative[0]}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={!reducedMotion}
            />
          </AreaChart>
        ) : (
          <LineChart
            accessibilityLayer={false}
            data={points}
            margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
          >
            {axes}
            <Line
              type="monotone"
              dataKey="value"
              name={visual.title}
              stroke={CHART_COLORS.qualitative[0]}
              strokeWidth={2.5}
              dot={points.length <= 20 ? { r: 3, fill: CHART_COLORS.qualitative[0], strokeWidth: 0 } : false}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartFigure>
  );
}
