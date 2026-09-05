"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import { ChartTooltip } from "./ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  formatChartCurrency,
  formatChartCurrencyExact,
  formatChartNumber,
  formatChartNumberExact,
  getChartCopy,
  useReducedMotion,
} from "./ChartAccessibility";

interface GrowthPoint {
  month: string;
  tenants: number;
  collected: number;
}

interface TenantGrowthRevenueChartProps {
  points: GrowthPoint[];
  title?: string;
  currencyCode?: string;
  height?: number;
}

export function TenantGrowthRevenueChart({
  points,
  title,
  currencyCode = "USD",
  height = 320,
}: TenantGrowthRevenueChartProps) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const chartTitle = title ?? t.dashboard.overviewTab.growthTitle;
  const chartData = (Array.isArray(points) ? points : []).map((point, index) => ({
    month: point.month || formatChartNumber(lang, index + 1),
    tenants: safeNumber(point.tenants),
    collected: safeNumber(point.collected),
  }));

  if (chartData.length === 0) return <ChartEmptyState title={chartTitle} lang={lang} height={height} />;

  const firstPoint = chartData[0];
  const finalPoint = chartData[chartData.length - 1];
  const finalValues = `${t.dashboard.overviewTab.tenantCount}: ${formatChartNumber(lang, finalPoint.tenants)}; ${t.dashboard.overviewTab.collectedRevenue}: ${formatChartCurrency(lang, finalPoint.collected, currencyCode)}`;
  const summary =
    lang === "ar"
      ? `${chartTitle}: ${formatChartNumber(lang, chartData.length)} فترات من ${firstPoint.month} إلى ${finalPoint.month}. القيمة النهائية: ${finalValues}.`
      : `${chartTitle}: ${formatChartNumber(lang, chartData.length)} periods from ${firstPoint.month} to ${finalPoint.month}. Final point: ${finalValues}.`;
  const legend = [
    {
      key: "tenants",
      label: t.dashboard.overviewTab.tenantCount,
      color: CHART_COLORS.qualitative[0],
    },
    {
      key: "collected",
      label: `${t.dashboard.overviewTab.collectedRevenue} (${currencyCode})`,
      color: CHART_COLORS.qualitative[1],
    },
  ];

  return (
    <ChartFigure
      title={chartTitle}
      summary={summary}
      lang={lang}
      height={height}
      legend={legend}
      columns={[
        copy.period,
        t.dashboard.overviewTab.tenantCount,
        `${t.dashboard.overviewTab.collectedRevenue} (${currencyCode})`,
      ]}
      // The axis and the tooltip may round; this table is titled "Exact
      // values", so the collected revenue keeps its minor unit rather than
      // reporting 10.49 as 10.
      rows={chartData.map((point, index) => ({
        key: `${point.month}-${index}`,
        cells: [
          point.month,
          formatChartNumberExact(lang, point.tenants),
          formatChartCurrencyExact(lang, point.collected, currencyCode),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          accessibilityLayer={false}
          data={chartData}
          margin={{ top: 8, right: 56, left: 56, bottom: 0 }}
        >
          <defs>
            <linearGradient id="dashboard-collected-revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.qualitative[1]} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CHART_COLORS.qualitative[1]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <YAxis
            yAxisId="tenants"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatChartNumber(lang, Number(value))}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            width={48}
          />
          <YAxis
            yAxisId="revenue"
            orientation={dir === "rtl" ? "left" : "right"}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatChartCurrency(lang, Number(value), currencyCode)}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            width={64}
          />
          <Tooltip
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value, item) =>
                  item.dataKey === "collected"
                    ? formatChartCurrency(lang, Number(value), currencyCode)
                    : formatChartNumber(lang, Number(value))
                }
              />
            }
          />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="collected"
            name={t.dashboard.overviewTab.collectedRevenue}
            fill="url(#dashboard-collected-revenue)"
            stroke={CHART_COLORS.qualitative[1]}
            strokeWidth={2.5}
            isAnimationActive={!reducedMotion}
          />
          <Bar
            yAxisId="tenants"
            dataKey="tenants"
            name={t.dashboard.overviewTab.tenantCount}
            fill={CHART_COLORS.qualitative[0]}
            radius={[6, 6, 0, 0]}
            barSize={24}
            isAnimationActive={!reducedMotion}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
