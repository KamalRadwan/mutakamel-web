"use client";

import { ReactNode } from "react";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  height?: number;
  yDataKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xTickFormatter?: (val: any) => string;
  yAxisWidth?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tooltipValueFormatter?: (val: any) => string;
  children: ReactNode;
}

export function BaseBarChart({
  data,
  height = 280,
  yDataKey,
  xTickFormatter,
  yAxisWidth,
  tooltipValueFormatter,
  children,
}: Props) {
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tickFormatter={xTickFormatter}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis
            dataKey={yDataKey}
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
            width={yAxisWidth}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={tooltipValueFormatter} />}
            cursor={{ fill: "currentColor", opacity: 0.05 }}
          />
          {children}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
