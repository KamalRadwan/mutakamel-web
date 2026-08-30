"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual, DashboardVisualPoint } from "@/types/dashboard";
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
} from "../visual-format";

type ParetoVisualModel = Extract<DashboardVisual, { kind: "pareto" }>;

/**
 * Ranked bars plus a cumulative-share line. Answers "which cause dominates"
 * in one read, which a list of counts never does.
 */
export function ParetoVisual({
  visual,
  height = 300,
}: {
  visual: ParetoVisualModel;
  height?: number;
}) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const source = visual.data.categories.filter((point) => point.value > 0);

  if (source.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  const ranked = sortPointsDescending(source);
  const total = sumPoints(ranked);
  const folded = foldVisualPoints(ranked, t.dashboard.visuals.other, 8);

  const rows = withCumulativeShare(folded, total);
  const tableRows = withCumulativeShare(ranked, total).map((point) => ({
    key: point.key,
    cells: [
      point.label,
      formatVisualValue(lang, point.value, visual.unit),
      formatChartPercent(lang, point.cumulative),
    ],
  }));

  const dominant = ranked[0];
  const dominantShare = total > 0 ? dominant.value / total : 0;
  const rotateLabels = rows.length > 5;

  return (
    <ChartFigure
      title={visual.title}
      summary={
        lang === "ar"
          ? `${visual.title}: ${formatVisualValue(lang, total, visual.unit)} إجمالاً عبر ${ranked.length} سببًا. السبب الأكبر ${dominant.label} يمثل ${formatChartPercent(lang, dominantShare)} من الإجمالي.`
          : `${visual.title}: ${formatVisualValue(lang, total, visual.unit)} total across ${ranked.length} causes. The leading cause ${dominant.label} accounts for ${formatChartPercent(lang, dominantShare)} of the total.`
      }
      lang={lang}
      height={height}
      legend={[
        { key: "value", label: copy.value, color: CHART_COLORS.qualitative[0] },
        {
          key: "cumulative",
          label: t.dashboard.visuals.cumulative,
          color: CHART_COLORS.warning,
        },
      ]}
      columns={[copy.category, copy.value, t.dashboard.visuals.cumulative]}
      rows={tableRows}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          accessibilityLayer={false}
          data={rows}
          margin={{ top: 8, right: 52, left: 52, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            reversed={dir === "rtl"}
            interval={0}
            angle={rotateLabels ? -28 : 0}
            textAnchor={rotateLabels ? "end" : "middle"}
            height={rotateLabels ? 68 : 30}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <YAxis
            yAxisId="value"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatVisualTick(lang, Number(value), visual.unit)}
          />
          <YAxis
            yAxisId="cumulative"
            orientation={dir === "rtl" ? "left" : "right"}
            domain={[0, 1]}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatChartPercent(lang, Number(value), 0)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value, item) =>
                  item.dataKey === "cumulative"
                    ? formatChartPercent(lang, Number(value))
                    : formatVisualValue(lang, Number(value), visual.unit)
                }
              />
            }
          />
          <Bar
            yAxisId="value"
            dataKey="value"
            name={copy.value}
            fill={CHART_COLORS.qualitative[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={!reducedMotion}
          />
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulative"
            name={t.dashboard.visuals.cumulative}
            stroke={CHART_COLORS.warning}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS.warning, strokeWidth: 0 }}
            isAnimationActive={!reducedMotion}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

/**
 * Running share of the ranked total. Kept outside the component because a
 * fold accumulator reassigned during render trips react-hooks/immutability.
 */
function withCumulativeShare(
  points: DashboardVisualPoint[],
  total: number,
): Array<DashboardVisualPoint & { cumulative: number }> {
  return points.map((point, index) => {
    const running = points
      .slice(0, index + 1)
      .reduce((sum, earlier) => sum + earlier.value, 0);
    return { ...point, cumulative: total > 0 ? running / total : 0 };
  });
}
