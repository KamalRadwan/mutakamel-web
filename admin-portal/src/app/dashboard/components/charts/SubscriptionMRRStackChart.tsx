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

export interface MRRStackDataPoint {
  month: string;
  basic: number;
  pro: number;
  enterprise: number;
}

interface Props {
  data: MRRStackDataPoint[];
  height?: number;
}

export function SubscriptionMRRStackChart({ data, height = 280 }: Props) {
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            tickFormatter={(val) => `$${val / 1000}k`}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "transparent" }} />
          <Legend 
            iconType="circle" 
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            formatter={(value) => <span className="text-slate-600 dark:text-slate-300 capitalize">{value}</span>}
          />
          <Bar dataKey="basic" name="Basic Plan" stackId="a" fill="#60a5fa" radius={[0, 0, 4, 4]} />
          <Bar dataKey="pro" name="Pro Plan" stackId="a" fill="#3b82f6" />
          <Bar dataKey="enterprise" name="Enterprise" stackId="a" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
