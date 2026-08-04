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
import { ChartTooltip } from "./ChartTooltip";

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
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={<ChartTooltip />}
          />
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
