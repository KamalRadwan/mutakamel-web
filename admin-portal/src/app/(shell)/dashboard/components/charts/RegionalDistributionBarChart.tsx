"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardMetricTone } from "@/types/dashboard";
import { ChartTooltip } from "./ChartTooltip";
import {
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
  formatChartNumber,
  formatChartPercent,
  getChartCopy,
  qualitativeColor,
  useReducedMotion,
} from "./ChartAccessibility";

interface RegionalPoint {
  key: string;
  countryName: string;
  countryIsoCode: string;
  count: number;
  ratio: number; // 0..1
  tone: DashboardMetricTone;
}

interface RegionalDistributionBarChartProps {
  regions: RegionalPoint[];
  title?: string;
  height?: number;
}

export function RegionalDistributionBarChart({
  regions,
  title,
  height = 220,
}: RegionalDistributionBarChartProps) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const chartTitle = title ?? t.dashboard.tenantsTab.regionalDistributionTitle;
  const chartData = (Array.isArray(regions) ? regions : []).map((region, index) => ({
    ...region,
    countryName: region.countryName || region.countryIsoCode || region.key,
    count: Number.isFinite(region.count) ? Math.max(0, region.count) : 0,
    color: qualitativeColor(index),
  }));

  if (chartData.length === 0) return <ChartEmptyState title={chartTitle} lang={lang} height={height} />;

  const countLabel = t.dashboard.tenantCountLabel;
  const total = chartData.reduce((sum, region) => sum + region.count, 0);
  const visualData = dashboardChartVisualItems(chartData);
  const omittedCount = chartData.length - visualData.length;
  const effectiveHeight = Math.max(height, visualData.length * 32 + 24);
  const visualScope =
    omittedCount > 0
      ? lang === "ar"
        ? ` يعرض الرسم أول ${formatChartNumber(lang, visualData.length)} مناطق؛ ويحتفظ جدول القيم الدقيقة بكل المناطق وعددها ${formatChartNumber(lang, chartData.length)}.`
        : ` The chart shows the first ${formatChartNumber(lang, visualData.length)} regions; the exact-values table retains all ${formatChartNumber(lang, chartData.length)}.`
      : "";
  const summary =
    lang === "ar"
      ? `${chartTitle}: ${formatChartNumber(lang, chartData.length)} مناطق، ${formatChartNumber(lang, total)} ${countLabel}.${visualScope}`
      : `${chartTitle}: ${formatChartNumber(lang, chartData.length)} regions, ${formatChartNumber(lang, total)} ${countLabel}.${visualScope}`;

  return (
    <ChartFigure
      title={chartTitle}
      summary={summary}
      lang={lang}
      height={effectiveHeight}
      columns={[copy.category, countLabel, copy.percentage]}
      rows={chartData.map((region) => ({
        key: region.key,
        cells: [region.countryName, formatChartNumber(lang, region.count), formatChartPercent(lang, region.ratio)],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          accessibilityLayer={false}
          layout="vertical"
          data={visualData}
          margin={dir === "rtl" ? { top: 4, right: 128, left: 28, bottom: 4 } : { top: 4, right: 28, left: 128, bottom: 4 }}
        >
          <XAxis type="number" hide reversed={dir === "rtl"} />
          <YAxis
            dataKey="countryName"
            type="category"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 13, fill: "var(--chart-axis)" }}
            width={112}
          />
          <Tooltip
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value) => `${formatChartNumber(lang, Number(value))} ${countLabel}`}
              />
            }
          />
          <Bar
            dataKey="count"
            name={countLabel}
            radius={dir === "rtl" ? [6, 0, 0, 6] : [0, 6, 6, 0]}
            barSize={18}
            isAnimationActive={!reducedMotion}
          >
            {visualData.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
            <LabelList
              dataKey="count"
              position={dir === "rtl" ? "left" : "right"}
              fill="var(--chart-axis)"
              fontSize={13}
              formatter={(value) => formatChartNumber(lang, Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
