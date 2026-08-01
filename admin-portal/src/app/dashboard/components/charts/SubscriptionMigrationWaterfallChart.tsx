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

export function SubscriptionMigrationWaterfallChart({ data, height = 280 }: Props) {
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
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "transparent" }} />
          
          {/* Invisible bar to act as the float base for waterfall */}
          <Bar dataKey="start" stackId="a" fill="transparent" />
          
          {/* The visible step block */}
          <Bar dataKey="value" stackId="a" radius={4}>
            {data.map((entry, index) => {
              let fill = "#94a3b8"; // neutral (totals)
              if (entry.isTotal) fill = "#3b82f6"; // blue
              else if (entry.value > 0) fill = "#10b981"; // green (upgrades/new)
              else if (entry.value < 0) fill = "#ef4444"; // red (downgrades/churn)
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
