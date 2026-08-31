"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "../../lib/cn";
import { useChartDirection } from "./chart-common";
import { CHART_ANIMATION } from "./chart-common";
import { STATUS_FILL, type ChartRole } from "./chart-palette";

export interface SparklineProps {
  /** Plain numbers in time order. The caller parses; this draws. */
  values: number[];
  /**
   * Accessible name **and** the value in words — a sparkline inside a
   * `StatCard` is decoration to a screen reader unless the trend it shows is
   * also stated. e.g. "New leads, up 12% over 30 days".
   */
  label: string;
  role?: ChartRole;
  height?: number;
  className?: string;
}

/**
 * A trend inline in a `StatCard` or a table cell.
 *
 * No axes, no grid, no tooltip, no dots: at this size every one of them is
 * noise, and the shape is the whole message. The precise numbers live in the
 * cell beside it.
 */
export function Sparkline({ values, label, role = "brand", height = 28, className }: SparklineProps) {
  const direction = useChartDirection();
  const data = values.map((value, index) => ({ index, value }));
  const ordered = direction.reversed ? [...data].reverse() : data;

  return (
    <div role="img" aria-label={label} className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={ordered} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          {/* Domain from the data, not from zero: a sparkline shows change, and
              anchoring at zero flattens every real series into a straight line. */}
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={STATUS_FILL[role]}
            strokeWidth={1.5}
            dot={false}
            {...CHART_ANIMATION}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
