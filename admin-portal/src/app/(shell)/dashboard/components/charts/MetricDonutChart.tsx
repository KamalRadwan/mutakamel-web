"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import { ChartTooltip } from "./ChartTooltip";
import {
  ChartEmptyState,
  ChartFigure,
  formatChartNumber,
  getChartCopy,
  summarizeChartValues,
  useReducedMotion,
} from "./ChartAccessibility";

export interface DonutSegment {
  key: string;
  name: string;
  value: number;
  color: string;
}

interface MetricDonutChartProps {
  data: DonutSegment[];
  title: string;
  summary?: string;
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export function MetricDonutChart({
  data,
  title,
  summary,
  centerLabel,
  centerValue,
  height = 220,
  innerRadius = 60,
  outerRadius = 85,
}: MetricDonutChartProps) {
  const { lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const safeData = Array.isArray(data)
    ? data.map((entry) => ({ ...entry, value: Number.isFinite(entry.value) ? Math.max(0, entry.value) : 0 }))
    : [];

  if (safeData.length === 0) return <ChartEmptyState title={title} lang={lang} height={height} />;

  const formattedData = safeData.map((entry) => ({
    ...entry,
    formattedValue: formatChartNumber(lang, entry.value),
  }));
  const formattedCenterValue =
    typeof centerValue === "number" ? formatChartNumber(lang, centerValue) : centerValue;
  const centerAccessibleLabel = centerLabel ?? copy.total;
  const summaryValues = [
    ...formattedData.map((entry) => ({ label: entry.name, value: entry.formattedValue })),
    ...(formattedCenterValue !== undefined
      ? [{ label: centerAccessibleLabel, value: formattedCenterValue }]
      : []),
  ];
  const chartSummary =
    summary ??
    summarizeChartValues(title, summaryValues, lang);

  return (
    <ChartFigure
      title={title}
      summary={chartSummary}
      lang={lang}
      height={height}
      legend={formattedData.map((entry) => ({
        key: entry.key,
        label: entry.name,
        color: entry.color,
        value: entry.formattedValue,
      }))}
      columns={[copy.category, copy.value]}
      rows={[
        ...formattedData.map((entry) => ({
          key: entry.key,
          cells: [entry.name, entry.formattedValue],
        })),
        ...(formattedCenterValue !== undefined
          ? [
              {
                key: "chart-center-value",
                cells: [centerAccessibleLabel, formattedCenterValue],
              },
            ]
          : []),
      ]}
    >
      <div className="relative flex size-full items-center justify-center">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer={false}>
            <Tooltip
              isAnimationActive={!reducedMotion}
              content={<ChartTooltip valueFormatter={(value) => formatChartNumber(lang, Number(value))} />}
            />
            <Pie
              data={formattedData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={3}
              dataKey="value"
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={!reducedMotion}
            >
              {formattedData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {(formattedCenterValue !== undefined || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {formattedCenterValue !== undefined && (
              <span className="text-2xl font-semibold tracking-tight text-foreground" dir="auto">
                {formattedCenterValue}
              </span>
            )}
            {centerLabel && <span className="text-xs font-semibold text-muted-foreground">{centerLabel}</span>}
          </div>
        )}
      </div>
    </ChartFigure>
  );
}
