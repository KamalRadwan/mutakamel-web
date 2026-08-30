"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardMetricTone } from "@/types/dashboard";
import { ChartTooltip } from "./ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
  formatChartNumber,
  formatChartPercent,
  getChartCopy,
  useReducedMotion,
} from "./ChartAccessibility";

interface ServerCapacityItem {
  id: string;
  name: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number; // 0..1
  tone?: DashboardMetricTone;
}

interface ServerCapacityChartProps {
  servers: ServerCapacityItem[];
  title?: string;
  height?: number;
}

export function ServerCapacityChart({
  servers,
  title,
  height = 240,
}: ServerCapacityChartProps) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const chartTitle = title ?? t.dashboard.serversTab.capacityComparisonTitle;
  const chartData = (Array.isArray(servers) ? servers : []).map((server) => {
    const used = safeCount(server.currentTenants);
    const maximum = safeCount(server.maxTenants);
    return {
      id: server.id,
      name: server.name || server.id,
      used,
      remaining: Math.max(0, maximum - used),
      utilization: clampRatio(server.utilization),
    };
  });

  if (chartData.length === 0) return <ChartEmptyState title={chartTitle} lang={lang} height={height} />;

  const visualData = dashboardChartVisualItems(chartData);
  const omittedCount = chartData.length - visualData.length;
  const effectiveHeight = Math.max(height, visualData.length * 40 + 80);
  const visualScope =
    omittedCount > 0
      ? lang === "ar"
        ? ` يعرض الرسم أول ${formatChartNumber(lang, visualData.length)} سيرفرات؛ ويحتفظ جدول القيم الدقيقة بكل السيرفرات وعددها ${formatChartNumber(lang, chartData.length)}.`
        : ` The chart shows the first ${formatChartNumber(lang, visualData.length)} servers; the exact-values table retains all ${formatChartNumber(lang, chartData.length)}.`
      : "";
  const summary =
    lang === "ar"
      ? `${chartTitle}: ${formatChartNumber(lang, chartData.length)} سيرفرات. تعرض القيم الاستخدام والسعة المتبقية دون استنتاج حالة تشغيلية.${visualScope}`
      : `${chartTitle}: ${formatChartNumber(lang, chartData.length)} servers. Values show used and remaining capacity without inferring operational health.${visualScope}`;
  const legend = [
    {
      key: "used",
      label: t.dashboard.serversTab.activeTenants,
      color: CHART_COLORS.qualitative[2],
    },
    {
      key: "remaining",
      label: t.dashboard.serversTab.availableCapacity,
      color: CHART_COLORS.neutral,
    },
  ];

  return (
    <ChartFigure
      title={chartTitle}
      summary={summary}
      lang={lang}
      height={effectiveHeight}
      legend={legend}
      columns={[
        copy.server,
        t.dashboard.serversTab.activeTenants,
        t.dashboard.serversTab.availableCapacity,
        copy.utilization,
      ]}
      rows={chartData.map((server) => ({
        key: server.id,
        cells: [
          server.name,
          formatChartNumber(lang, server.used),
          formatChartNumber(lang, server.remaining),
          formatChartPercent(lang, server.utilization),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          accessibilityLayer={false}
          layout="vertical"
          data={visualData}
          margin={
            dir === "rtl"
              ? { top: 8, right: 128, left: 16, bottom: 0 }
              : { top: 8, right: 16, left: 128, bottom: 0 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_COLORS.grid} />
          <XAxis
            type="number"
            reversed={dir === "rtl"}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatChartNumber(lang, Number(value))}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <YAxis
            dataKey="name"
            type="category"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            width={112}
          />
          <Tooltip
            isAnimationActive={!reducedMotion}
            content={<ChartTooltip valueFormatter={(value) => formatChartNumber(lang, Number(value))} />}
          />
          <Bar
            dataKey="used"
            name={t.dashboard.serversTab.activeTenants}
            stackId="capacity"
            fill={CHART_COLORS.qualitative[2]}
            radius={dir === "rtl" ? [0, 4, 4, 0] : [4, 0, 0, 4]}
            isAnimationActive={!reducedMotion}
          />
          <Bar
            dataKey="remaining"
            name={t.dashboard.serversTab.availableCapacity}
            stackId="capacity"
            fill={CHART_COLORS.neutral}
            fillOpacity={0.4}
            radius={dir === "rtl" ? [4, 0, 0, 4] : [0, 4, 4, 0]}
            isAnimationActive={!reducedMotion}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
