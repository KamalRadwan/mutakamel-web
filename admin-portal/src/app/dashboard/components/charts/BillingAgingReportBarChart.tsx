"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";

export interface AgingDataPoint {
  bucket: string;
  amount: number;
}

interface Props {
  data: AgingDataPoint[];
  height?: number;
}

export function BillingAgingReportBarChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-lg text-xs">
          <p className="font-bold mb-1 text-slate-800 dark:text-slate-200">{data.bucket}</p>
          <p className="text-slate-600 dark:text-slate-400">
            {lang === "ar" ? "المبلغ" : "Amount"}: <span className="font-mono font-bold">${data.amount.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis 
            type="number"
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(val) => `$${val/1000}k`}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis 
            dataKey="bucket" 
            type="category"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "currentColor", opacity: 0.05 }} />
          
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((entry, index) => {
              // Color based on how old the debt is (0-30 = green/yellow, 30-60 = orange, 90+ = red)
              let color = "#10b981"; // default green
              if (index === 1) color = "#f59e0b"; // 31-60
              if (index === 2) color = "#f97316"; // 61-90
              if (index >= 3) color = "#ef4444"; // 90+
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
