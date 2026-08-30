"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  formatChartPercent,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import {
  foldVisualPoints,
  formatVisualTick,
  formatVisualValue,
  sortPointsDescending,
  sumPoints,
  visualColor,
} from "../visual-format";

type BarVisualModel = Extract<DashboardVisual, { kind: "bar" }>;

const ROW_HEIGHT = 34;

/** Ranked categories, always sorted descending, horizontal so labels read. */
export function BarVisual({ visual }: { visual: BarVisualModel }) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const source = visual.data.categories;

  if (source.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} />;
  }

  const ranked = sortPointsDescending(source);
  const folded = foldVisualPoints(ranked, t.dashboard.visuals.other);
  const total = sumPoints(ranked);
  const rows = folded.map((point, index) => ({
    ...point,
    color: visualColor(index, point.tone),
  }));
  const height = Math.max(160, rows.length * ROW_HEIGHT + 32);
  const leader = ranked[0];
  const summary =
    lang === "ar"
      ? `${visual.title}: ${formatVisualValue(lang, total, visual.unit)} إجمالاً عبر ${ranked.length} فئة. الأعلى ${leader.label} بقيمة ${formatVisualValue(lang, leader.value, visual.unit)}.`
      : `${visual.title}: ${formatVisualValue(lang, total, visual.unit)} total across ${ranked.length} categories. Highest is ${leader.label} at ${formatVisualValue(lang, leader.value, visual.unit)}.`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      columns={[copy.category, copy.value, t.dashboard.visuals.share]}
      rows={ranked.map((point) => ({
        key: point.key,
        cells: [
          point.label,
          formatVisualValue(lang, point.value, visual.unit),
          formatChartPercent(lang, total > 0 ? point.value / total : 0),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          accessibilityLayer={false}
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            orientation="top"
            tickLine={false}
            axisLine={false}
            reversed={dir === "rtl"}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatVisualTick(lang, Number(value), visual.unit)}
          />
          <YAxis
            type="category"
            dataKey="label"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            width={136}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value) => formatVisualValue(lang, Number(value), visual.unit)}
              />
            }
          />
          <Bar
            dataKey="value"
            name={visual.title}
            radius={dir === "rtl" ? [4, 0, 0, 4] : [0, 4, 4, 0]}
            barSize={18}
            isAnimationActive={!reducedMotion}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
