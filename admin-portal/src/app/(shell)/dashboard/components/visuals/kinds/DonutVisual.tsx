"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import { ChartTooltip } from "../../charts/ChartTooltip";
import {
  ChartEmptyState,
  ChartFigure,
  formatChartPercent,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import {
  foldVisualPoints,
  formatVisualExactValue,
  formatVisualValue,
  sortPointsDescending,
  sumPoints,
  visualColor,
} from "../visual-format";

type DonutVisual = Extract<DashboardVisual, { kind: "donut" }>;

export function DonutVisual({
  visual,
  height = 240,
}: {
  visual: DonutVisual;
  height?: number;
}) {
  const { lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const source = visual.data.categories.filter((point) => point.value > 0);

  if (source.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  const ranked = sortPointsDescending(source);
  const folded = foldVisualPoints(ranked, t.dashboard.visuals.other, 6);
  const total = sumPoints(ranked);
  const slices = folded.map((point, index) => ({
    ...point,
    color: visualColor(index, point.tone),
    text: formatVisualValue(lang, point.value, visual.unit),
    share: total > 0 ? point.value / total : 0,
  }));

  return (
    <ChartFigure
      title={visual.title}
      summary={`${visual.title}: ${formatVisualValue(lang, total, visual.unit)} ${copy.total.toLocaleLowerCase(lang === "ar" ? "ar-EG" : "en-US")}. ${slices
        .map((slice) => `${slice.label} ${slice.text} (${formatChartPercent(lang, slice.share)})`)
        .join(lang === "ar" ? "، " : ", ")}.`}
      lang={lang}
      height={height}
      legend={slices.map((slice) => ({
        key: slice.key,
        label: slice.label,
        color: slice.color,
        value: slice.text,
      }))}
      columns={[copy.category, copy.value, t.dashboard.visuals.share]}
      rows={[
        ...ranked.map((point) => ({
          key: point.key,
          cells: [
            point.label,
            formatVisualExactValue(lang, point.value, visual.unit),
            formatChartPercent(lang, total > 0 ? point.value / total : 0),
          ],
        })),
        {
          key: "__total__",
          cells: [
            copy.total,
            formatVisualExactValue(lang, total, visual.unit),
            formatChartPercent(lang, 1),
          ],
        },
      ]}
    >
      <div className="relative flex size-full items-center justify-center">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer={false}>
            <Tooltip
              isAnimationActive={!reducedMotion}
              content={
                <ChartTooltip
                  valueFormatter={(value) =>
                    formatVisualValue(lang, Number(value), visual.unit)
                  }
                />
              }
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={!reducedMotion}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-semibold tracking-tight text-foreground" dir="auto">
            {formatVisualValue(lang, total, visual.unit)}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">{copy.total}</span>
        </div>
      </div>
    </ChartFigure>
  );
}
