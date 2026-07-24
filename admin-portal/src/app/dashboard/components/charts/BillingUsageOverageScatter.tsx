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
  Cell,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";

export interface OverageDataPoint {
  computeUsage: number;
  overageFee: number;
  tenants: number;
}

interface Props {
  data: OverageDataPoint[];
  height?: number;
}

export function BillingUsageOverageScatter({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-lg text-xs">
          <p className="font-bold mb-1 text-slate-800 dark:text-slate-200">
            {lang === "ar" ? "الاستهلاك الزائد (GB)" : "Excess Compute (GB)"}: {data.computeUsage}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            {lang === "ar" ? "الرسوم الإضافية" : "Overage Fee"}: <span className="font-mono font-bold text-rose-500">${data.overageFee}</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            {lang === "ar" ? "المستأجرين" : "Tenants"}: <span className="font-mono font-bold text-indigo-500">{data.tenants}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis 
            type="number" 
            dataKey="computeUsage" 
            name="Usage (GB)" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis 
            type="number" 
            dataKey="overageFee" 
            name="Fee ($)" 
            tickFormatter={(val) => `$${val}`}
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <ZAxis type="number" dataKey="tenants" range={[50, 400]} name="Tenants" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          <Scatter name="Overages" data={data} fill="#8b5cf6" fillOpacity={0.6}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.overageFee > 500 ? "#ef4444" : "#8b5cf6"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
