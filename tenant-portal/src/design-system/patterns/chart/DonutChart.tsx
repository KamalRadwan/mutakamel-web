"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  CHART_ANIMATION,
  ChartFrame,
  ChartTooltipCard,
  useChartDirection,
  useChartNumberFormat,
} from "./chart-common";
import {
  orderStatusRoles,
  SEGMENT_SEPARATOR,
  STATUS_FILL,
  type QualitativeSlice,
  type ChartRole,
} from "./chart-palette";

export interface StatusSlice {
  key: string;
  /** Already translated — a `t.status.*` label, never a raw wire value. */
  label: string;
  value: number;
  role: ChartRole;
}

export interface DonutChartProps {
  /**
   * Either a **status** breakdown (four roles) or a **qualitative** one
   * (`topNWithOther`, single-hue ramp). There is no third option, and no
   * generic categorical palette — docs/design/tokens.md#charts.
   */
  slices: StatusSlice[] | QualitativeSlice[];
  label: string;
  summary: string;
  height?: number;
  /** Rendered in the hole. A total, a percentage — already formatted by the caller. */
  centerValue?: string;
  centerLabel?: string;
  showLegend?: boolean;
  numberFormat?: Intl.NumberFormatOptions;
  className?: string;
}

interface ResolvedSlice {
  key: string;
  label: string;
  value: number;
  fill: string;
}

function isStatusSlice(slice: StatusSlice | QualitativeSlice): slice is StatusSlice {
  return "role" in slice;
}

function resolve(slices: StatusSlice[] | QualitativeSlice[]): ResolvedSlice[] {
  if (slices.length === 0) return [];

  if (isStatusSlice(slices[0])) {
    // Canonical role order puts brand between caution and negative, so in any
    // breakdown with three or more roles they never share an edge.
    return orderStatusRoles(slices as StatusSlice[]).map((slice) => ({
      key: slice.key,
      label: slice.label,
      value: slice.value,
      fill: STATUS_FILL[slice.role],
    }));
  }

  // A qualitative breakdown is already ordered largest-to-smallest by
  // topNWithOther, and the ramp is assigned in that order. Re-sorting here
  // would break the fill-to-rank correspondence that IS the encoding.
  return (slices as QualitativeSlice[]).map((slice) => ({
    key: slice.key,
    label: slice.label,
    value: slice.value,
    fill: slice.fill,
  }));
}

/**
 * A part-to-whole breakdown.
 *
 * A **donut**, not a pie: the hole carries the total, which is the number most
 * readers actually want, and it is the one thing a pie cannot show without a
 * caption.
 *
 * Every segment is separated by a background-coloured stroke. That is not
 * decoration — it is what keeps two adjacent fills from reading as one
 * gradient, and it is the answer for a `{caution, negative}` breakdown, where
 * reordering has nowhere to put a separating role.
 */
export function DonutChart({
  slices,
  label,
  summary,
  height = 240,
  centerValue,
  centerLabel,
  showLegend = true,
  numberFormat,
  className,
}: DonutChartProps) {
  const direction = useChartDirection();
  const { format } = useChartNumberFormat(numberFormat);
  const resolved = resolve(slices);

  return (
    <ChartFrame label={label} summary={summary} height={height} className={className}>
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={resolved}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="82%"
              // Arabic reads right to left, so the sweep does too.
              startAngle={direction.reversed ? -270 : 90}
              endAngle={direction.reversed ? 90 : -270}
              stroke={SEGMENT_SEPARATOR}
              strokeWidth={2}
              {...CHART_ANIMATION}
            >
              {resolved.map((slice) => (
                <Cell key={slice.key} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    dir={direction.dir}
                    entries={payload.map((entry) => ({
                      label: String(entry.name),
                      value: format(Number(entry.value ?? 0)),
                      fill: typeof entry.payload?.fill === "string" ? entry.payload.fill : undefined,
                    }))}
                  />
                ) : null
              }
            />
            {showLegend && (
              <Legend
                align={direction.legendAlign}
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ direction: direction.dir, fontSize: 11 }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        {centerValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              <bdi>{centerValue}</bdi>
            </span>
            {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
