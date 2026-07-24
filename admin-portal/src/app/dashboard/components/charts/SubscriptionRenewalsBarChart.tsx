"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface RenewalsDataPoint {
  month: string;
  renewals: number;
}

interface Props {
  data: RenewalsDataPoint[];
  height?: number;
}

export function SubscriptionRenewalsBarChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis 
            type="number"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis 
            dataKey="month" 
            type="category"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "currentColor", opacity: 0.05 }} />
          
          <Bar 
            dataKey="renewals" 
            name={lang === "ar" ? "التجديدات القادمة" : "Upcoming Renewals"} 
            fill="#3b82f6" 
            radius={[0, 4, 4, 0]} 
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
