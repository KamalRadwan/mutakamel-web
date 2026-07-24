"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export interface DonutSegment {
  key: string;
  name: string;
  value: number;
  color: string;
}

interface MetricDonutChartProps {
  data: DonutSegment[];
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export function MetricDonutChart({
  data,
  centerLabel,
  centerValue,
  height = 220,
  innerRadius = 60,
  outerRadius = 85,
}: MetricDonutChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="relative flex items-center justify-center" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {(centerValue !== undefined || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {centerValue !== undefined && (
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
