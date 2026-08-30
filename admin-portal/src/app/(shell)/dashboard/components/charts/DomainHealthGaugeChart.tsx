"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import { ChartTooltip } from "./ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  formatChartNumber,
  getChartCopy,
  summarizeChartValues,
  useReducedMotion,
} from "./ChartAccessibility";

interface DomainHealthGaugeChartProps {
  verified: number;
  unverified?: number;
  invalid: number;
  total: number;
  title?: string;
  height?: number;
}

export function DomainHealthGaugeChart({
  verified,
  unverified,
  invalid,
  total,
  title,
  height = 40,
}: DomainHealthGaugeChartProps) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const chartTitle = title ?? t.dashboard.tenantsTab.domainHealthTitle;
  const verifiedValue = safeCount(verified);
  const invalidValue = safeCount(invalid);
  const totalValue = safeCount(total);
  const unverifiedValue =
    unverified === undefined ? Math.max(0, totalValue - verifiedValue - invalidValue) : safeCount(unverified);

  if (totalValue <= 0) return <ChartEmptyState title={chartTitle} lang={lang} height={Math.max(height, 128)} />;

  const series = [
    {
      key: "verified",
      label: t.dashboard.domainVerifiedActive,
      value: verifiedValue,
      color: CHART_COLORS.success,
    },
    {
      key: "unverified",
      label: t.dashboard.tenantsTab.unverifiedDomains,
      value: unverifiedValue,
      color: CHART_COLORS.neutral,
    },
    {
      key: "invalid",
      label: t.dashboard.domainPendingInvalid,
      value: invalidValue,
      color: CHART_COLORS.warning,
    },
  ];
  const chartData = [
    {
      category: chartTitle,
      verified: verifiedValue,
      unverified: unverifiedValue,
      invalid: invalidValue,
    },
  ];
  const axisMaximum = Math.max(totalValue, verifiedValue + unverifiedValue + invalidValue);
  const formattedSeries = series.map((item) => ({
    ...item,
    formattedValue: formatChartNumber(lang, item.value),
  }));
  const totalLabel = copy.total;

  return (
    <ChartFigure
      title={chartTitle}
      summary={summarizeChartValues(
        chartTitle,
        [
          ...formattedSeries.map((item) => ({ label: item.label, value: item.formattedValue })),
          { label: totalLabel, value: formatChartNumber(lang, totalValue) },
        ],
        lang,
      )}
      lang={lang}
      height={height}
      legend={formattedSeries.map((item) => ({
        key: item.key,
        label: item.label,
        color: item.color,
        value: item.formattedValue,
      }))}
      columns={[copy.category, copy.value]}
      rows={[
        ...formattedSeries.map((item) => ({
          key: item.key,
          cells: [item.label, item.formattedValue],
        })),
        { key: "total", cells: [totalLabel, formatChartNumber(lang, totalValue)] },
      ]}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          accessibilityLayer={false}
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, axisMaximum]} hide reversed={dir === "rtl"} />
          <Tooltip
            isAnimationActive={!reducedMotion}
            content={<ChartTooltip valueFormatter={(value) => formatChartNumber(lang, Number(value))} />}
          />
          <Bar
            dataKey="verified"
            name={t.dashboard.domainVerifiedActive}
            stackId="domains"
            fill={CHART_COLORS.success}
            radius={dir === "rtl" ? [0, 6, 6, 0] : [6, 0, 0, 6]}
            barSize={14}
            isAnimationActive={!reducedMotion}
          />
          <Bar
            dataKey="unverified"
            name={t.dashboard.tenantsTab.unverifiedDomains}
            stackId="domains"
            fill={CHART_COLORS.neutral}
            barSize={14}
            isAnimationActive={!reducedMotion}
          />
          <Bar
            dataKey="invalid"
            name={t.dashboard.domainPendingInvalid}
            stackId="domains"
            fill={CHART_COLORS.warning}
            radius={dir === "rtl" ? [6, 0, 0, 6] : [0, 6, 6, 0]}
            barSize={14}
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
