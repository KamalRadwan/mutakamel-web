"use client";

import { ResponsiveContainer, AreaChart, Area } from "recharts";

interface SparklineChartProps {
  data: Array<{ value: number }>;
  color?: string;
  height?: number;
}

export function SparklineChart({
  data,
  color = "#3b82f6",
  height = 36,
}: SparklineChartProps) {
  if (!data || data.length === 0) return null;

  const gradientId = `sparkline-gradient-${color.replace("#", "")}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.8}
            fill={`url(#${gradientId})`}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
