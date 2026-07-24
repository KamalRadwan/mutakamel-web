"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface CashFlowDataPoint {
  month: string;
  expected: number;
  actual: number;
}

interface Props {
  data: CashFlowDataPoint[];
  height?: number;
}

export function BillingCashFlowComposedChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            tickFormatter={(val) => `$${val/1000}k`}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "transparent" }} />
          <Legend 
            iconType="circle" 
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>}
          />
          
          <Bar 
            dataKey="expected" 
            name={lang === "ar" ? "المتوقع تحصيله" : "Expected Cash"} 
            fill="#cbd5e1" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
          <Line 
            type="monotone" 
            dataKey="actual" 
            name={lang === "ar" ? "التحصيل الفعلي" : "Actual Collected"} 
            stroke="#10b981" 
            strokeWidth={3}
            dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
