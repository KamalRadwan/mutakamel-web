"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export interface WaterfallDataPoint {
  name: string;
  start: number;
  end: number;
  value: number;
  isTotal?: boolean;
}

interface Props {
  data: WaterfallDataPoint[];
  height?: number;
}

export function BillingDiscountImpactWaterfall({ data, height = 280 }: Props) {
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "currentColor", fontSize: 10 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(val) => `$${val/1000}k`}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(value) =>
                  `$${Number(value ?? 0).toLocaleString()}`
                }
              />
            }
            cursor={{ fill: "transparent" }}
          />
          
          <Bar dataKey="start" stackId="a" fill="transparent" />
          
          <Bar dataKey="value" stackId="a" radius={4}>
            {data.map((entry, index) => {
              let fill = "#3b82f6"; // default blue
              if (entry.isTotal) fill = "#10b981"; // green (totals)
              else if (entry.value < 0) fill = "#ef4444"; // red (deductions)
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
