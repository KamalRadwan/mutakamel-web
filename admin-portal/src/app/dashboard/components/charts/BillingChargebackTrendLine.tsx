"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface ChargebackDataPoint {
  month: string;
  chargebacks: number;
  refunds: number;
}

interface Props {
  data: ChargebackDataPoint[];
  height?: number;
}

export function BillingChargebackTrendLine({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            tickFormatter={(val) => `$${val}`}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ef4444", strokeWidth: 1, strokeDasharray: "4 4" }} />
          
          <Line 
            type="monotone" 
            dataKey="chargebacks" 
            name={lang === "ar" ? "المبالغ المستردة بالقوة" : "Chargebacks"} 
            stroke="#ef4444" 
            strokeWidth={3}
            dot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }}
          />
          <Line 
            type="monotone" 
            dataKey="refunds" 
            name={lang === "ar" ? "المستردة طوعياً" : "Refunds"} 
            stroke="#f59e0b" 
            strokeWidth={3}
            dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
