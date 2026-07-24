"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface DSODataPoint {
  month: string;
  dso: number; // Days Sales Outstanding
}

interface Props {
  data: DSODataPoint[];
  height?: number;
}

export function BillingDSOAreaChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDso" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            tickFormatter={(val) => `${val}d`}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#f59e0b", strokeWidth: 1, strokeDasharray: "4 4" }} />
          
          <Area 
            type="monotone" 
            dataKey="dso" 
            name={lang === "ar" ? "أيام المبيعات غير المحصلة (DSO)" : "Days Sales Outstanding (DSO)"} 
            stroke="#f59e0b" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorDso)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
