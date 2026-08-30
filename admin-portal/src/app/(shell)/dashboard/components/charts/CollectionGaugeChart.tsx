"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import {
  CHART_COLORS,
  ChartFigure,
  formatChartPercent,
  getChartCopy,
  summarizeChartValues,
  useReducedMotion,
} from "./ChartAccessibility";

interface CollectionGaugeChartProps {
  collectedRatio: number; // 0..1
  title?: string;
  height?: number;
}

export function CollectionGaugeChart({
  collectedRatio,
  title,
  height = 180,
}: CollectionGaugeChartProps) {
  const { lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const chartTitle = title ?? t.dashboard.billingTab.collectionRatioTitle;
  const ratio = clampRatio(collectedRatio);
  const remainingRatio = 1 - ratio;
  const collectedValue = formatChartPercent(lang, ratio);
  const remainingValue = formatChartPercent(lang, remainingRatio);
  const data = [
    { name: t.dashboard.collectedLabel, value: ratio, color: CHART_COLORS.action },
    { name: t.dashboard.remainingLabel, value: remainingRatio, color: CHART_COLORS.grid },
  ];
  const values = [
    { label: t.dashboard.collectedLabel, value: collectedValue },
    { label: t.dashboard.remainingLabel, value: remainingValue },
  ];

  return (
    <ChartFigure
      title={chartTitle}
      summary={summarizeChartValues(chartTitle, values, lang)}
      lang={lang}
      height={height}
      legend={data.map((item) => ({
        key: item.name,
        label: item.name,
        color: item.color,
        value: formatChartPercent(lang, item.value),
      }))}
      columns={[copy.category, copy.percentage]}
      rows={data.map((item) => ({
        key: item.name,
        cells: [item.name, formatChartPercent(lang, item.value)],
      }))}
    >
      <div className="relative flex size-full items-center justify-center">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer={false} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie
              data={data}
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius={65}
              outerRadius={90}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              isAnimationActive={!reducedMotion}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute bottom-4 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-semibold tracking-tight text-chart-action" dir="auto">
            {collectedValue}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {t.dashboard.billingTab.actualCollectedRatio}
          </span>
        </div>
      </div>
    </ChartFigure>
  );
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
