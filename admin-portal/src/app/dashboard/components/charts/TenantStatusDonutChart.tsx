"use client";

import { MetricDonutChart, DonutSegment } from "./MetricDonutChart";
import { toneToColorClass } from "../../utils/formatters";
import { DashboardMetricTone } from "@/types/dashboard";

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
  height?: number;
}

const toneColorMap: Record<DashboardMetricTone, string> = {
  green: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

import { useI18n } from "@/i18n/I18nContext";

export function TenantStatusDonutChart({
  items,
  total,
  height = 240,
}: TenantStatusDonutChartProps) {
  const { t } = useI18n();

  if (!items || items.length === 0) return null;

  const donutSegments: DonutSegment[] = items.map((item) => ({
    key: item.key,
    name: item.label,
    value: item.count,
    color: toneColorMap[item.tone] || "#3b82f6",
  }));

  return (
    <MetricDonutChart
      data={donutSegments}
      centerValue={total}
      centerLabel={t.dashboard.tenantsTab.totalTenantsLabel}
      height={height}
      innerRadius={65}
      outerRadius={90}
    />
  );
}

