"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { DashboardMetricTone } from "@/types/dashboard";
import { useI18n } from "@/i18n/I18nContext";

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

export function RegionalDistributionBarChart({
  regions,
  height = 220,
}: RegionalDistributionBarChartProps) {
  const { t } = useI18n();
  if (!regions || regions.length === 0) return null;

  const countLabel = t.dashboard.tenantCountLabel;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={regions}
          margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis
            dataKey="countryName"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            width={120}
          />
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(val) => `${val} ${countLabel}`}
              />
            }
          />
          <Bar dataKey="count" name={countLabel} radius={[0, 6, 6, 0]} barSize={18}>
            {regions.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={toneColorMap[entry.tone] || "#3b82f6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
