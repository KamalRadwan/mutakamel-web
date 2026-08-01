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
import { ChartTooltip } from "./ChartTooltip";

export interface AgingDataPoint {
  bucket: string;
  amount: number;
}

interface Props {
  data: AgingDataPoint[];
  height?: number;
}

export function BillingAgingReportBarChart({ data, height = 280 }: Props) {
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
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(value) =>
                  `$${Number(value ?? 0).toLocaleString()}`
                }
              />
            }
            cursor={{ fill: "currentColor", opacity: 0.05 }}
          />
          
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
