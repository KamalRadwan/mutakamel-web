"use client";

import { MetricDonutChart, type DonutSegment } from "./MetricDonutChart";
import type { DashboardMetricTone } from "@/types/dashboard";
import { STATUS_TONE_COLOR } from "./ChartAccessibility";
import { useI18n } from "@/i18n/I18nContext";

interface TenantStatusDonutChartProps {
  items: Array<{
    key: string;
    label: string;
    count: number;
    description: string;
    ratio: number;
    tone: DashboardMetricTone;
  }>;
  total: number;
  title?: string;
  height?: number;
}

export function TenantStatusDonutChart({
  items,
  total,
  title,
  height = 240,
}: TenantStatusDonutChartProps) {
  const { t } = useI18n();
  const chartTitle = title ?? t.dashboard.tenantsTab.statusBreakdownTitle;

  const donutSegments: DonutSegment[] = (Array.isArray(items) ? items : []).map((item) => ({
    key: item.key,
    name: item.label,
    value: item.count,
    color: STATUS_TONE_COLOR[item.tone],
  }));

  return (
    <MetricDonutChart
      data={donutSegments}
      title={chartTitle}
      centerValue={total}
      centerLabel={t.dashboard.tenantsTab.totalTenantsLabel}
      height={height}
      innerRadius={65}
      outerRadius={90}
    />
  );
}
