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
import { useI18n } from "@/i18n/I18nContext";

export interface PlanBreakdownPoint {
  category: string;
  enterprise: number;
  growth: number;
  starter: number;
}

interface SubscriptionRevenueStackChartProps {
  data: PlanBreakdownPoint[];
  height?: number;
}

interface RevenueLegendEntry {
  color?: string;
  value?: string | number;
}

interface RevenueLegendProps {
  payload?: readonly RevenueLegendEntry[];
}

export function SubscriptionRevenueStackChart({
  data,
  height = 260,
}: SubscriptionRevenueStackChartProps) {
  const { lang } = useI18n();

  if (!data || data.length === 0) return null;

  const names = {
    enterprise: lang === "ar" ? "مؤسسات (Enterprise)" : "Enterprise Pro",
    growth: lang === "ar" ? "نمو أعمال (Growth)" : "Business Growth",
    starter: lang === "ar" ? "مبتدئ (Starter)" : "Starter Standard",
  };

  const renderCustomLegend = (props: RevenueLegendProps) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs mb-2 pb-1">
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
        <BarChart data={data} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
          <XAxis
            dataKey="category"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend content={renderCustomLegend} verticalAlign="top" align="right" />
          <Bar dataKey="enterprise" name={names.enterprise} stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="growth" name={names.growth} stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="starter" name={names.starter} stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
