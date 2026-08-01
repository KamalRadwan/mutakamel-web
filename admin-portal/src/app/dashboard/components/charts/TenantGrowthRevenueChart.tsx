"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Brush,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface GrowthPoint {
  month: string;
  tenants: number;
  collected: number;
}

interface TenantGrowthRevenueChartProps {
  points: GrowthPoint[];
  currencyCode?: string;
  height?: number;
}

interface GrowthLegendEntry {
  color?: string;
  value?: string | number;
}

interface GrowthLegendProps {
  payload?: readonly GrowthLegendEntry[];
}

export function TenantGrowthRevenueChart({
  points,
  currencyCode = "USD",
  height = 320,
}: TenantGrowthRevenueChartProps) {
  const { t } = useI18n();

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-slate-400">
        No growth data available for the selected period.
      </div>
    );
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(val);

  const renderCustomLegend = (props: GrowthLegendProps) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap items-center justify-end gap-4 text-xs mb-3">
        {payload?.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            width={35}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${val}`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            width={45}
          />
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(val) =>
                  typeof val === "number" && val > 100 ? formatCurrency(val) : String(val)
                }
              />
            }
          />
          <Legend content={renderCustomLegend} verticalAlign="top" align="right" />
          <Brush
            dataKey="month"
            height={20}
            stroke="#3b82f6"
            fill="#090d16"
            tickFormatter={() => ""}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="collected"
            name={t.dashboard.overviewTab.collectedRevenue}
            fill="url(#colorCollected)"
            stroke="#10b981"
            strokeWidth={2.5}
          />
          <Bar
            yAxisId="left"
            dataKey="tenants"
            name={t.dashboard.overviewTab.tenantCount}
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
            barSize={24}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
