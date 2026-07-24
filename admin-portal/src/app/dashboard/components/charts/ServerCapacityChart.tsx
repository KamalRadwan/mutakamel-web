"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { DashboardMetricTone } from "@/types/dashboard";

export interface ServerCapacityItem {
  id: string;
  name: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number; // 0..1
  tone?: DashboardMetricTone;
}

interface ServerCapacityChartProps {
  servers: ServerCapacityItem[];
  height?: number;
}

import { useI18n } from "@/i18n/I18nContext";

const defaultMockServers: ServerCapacityItem[] = [
  { id: "1", name: "DB-PRIMARY-01", currentTenants: 42, maxTenants: 50, utilization: 0.84 },
  { id: "2", name: "DB-SECONDARY-01", currentTenants: 28, maxTenants: 50, utilization: 0.56 },
  { id: "3", name: "DB-REPLICA-01", currentTenants: 15, maxTenants: 50, utilization: 0.3 },
];

export function ServerCapacityChart({
  servers,
  height = 240,
}: ServerCapacityChartProps) {
  const { t } = useI18n();

  const dataList = !servers || servers.length === 0 ? defaultMockServers : servers;

  const chartData = dataList.map((s) => ({
    name: s.name,
    used: s.currentTenants,
    remaining: Math.max(0, s.maxTenants - s.currentTenants),
    utilizationPercent: (s.utilization * 100).toFixed(1),
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" opacity={0.2} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(val) => `${val}`}
              />
            }
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }}
          />
          <Bar dataKey="used" name={t.dashboard.serversTab.activeTenants} stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="remaining" name={t.dashboard.serversTab.availableCapacity} stackId="a" fill="#64748b" opacity={0.3} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

