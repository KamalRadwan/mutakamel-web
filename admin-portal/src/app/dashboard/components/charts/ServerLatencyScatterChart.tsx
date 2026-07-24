"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface ScatterServerPoint {
  name: string;
  tenants: number;
  latencyMs: number;
  capacity: number;
}

interface ServerLatencyScatterChartProps {
  data?: ScatterServerPoint[];
  height?: number;
}

const defaultScatterData: ScatterServerPoint[] = [
  { name: "DB-PRIMARY-EG-01", tenants: 42, latencyMs: 12, capacity: 50 },
  { name: "DB-PRIMARY-SA-01", tenants: 38, latencyMs: 18, capacity: 50 },
  { name: "DB-PRIMARY-AE-01", tenants: 25, latencyMs: 24, capacity: 50 },
  { name: "DB-PRIMARY-QA-01", tenants: 10, latencyMs: 8, capacity: 50 },
];

export function ServerLatencyScatterChart({
  data = defaultScatterData,
  height = 220,
}: ServerLatencyScatterChartProps) {
  const { lang } = useI18n();

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.2} />
          <XAxis
            type="number"
            dataKey="tenants"
            name={lang === "ar" ? "المستأجرين" : "Tenants"}
            unit={lang === "ar" ? " شركة" : " tenants"}
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="latencyMs"
            name={lang === "ar" ? "الاستجابة" : "Latency"}
            unit=" ms"
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <ZAxis type="number" dataKey="capacity" range={[60, 200]} />
          <Tooltip content={<ChartTooltip />} />
          <Scatter name="Servers" data={data} fill="#8b5cf6" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
