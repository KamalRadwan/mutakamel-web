"use client";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { AXIS_TICK, CHART_ANIMATION, ChartFrame, ChartTooltipCard, GRID_STROKE, useChartDirection } from "./chart-common";

export interface ScatterPlotPoint { key: string; label: string; x: number; y: number; z: number; fill?: string; }
export interface ScatterPlotChartProps {
  points: ScatterPlotPoint[];
  bubble?: boolean;
  label: string;
  summary: string;
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  xDomain?: [number, number];
  sizeDomain?: [number, number];
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  formatSize: (value: number) => string;
  formatYAxis?: (value: number) => string;
}

/** Numeric XY coordinates stay conventional; RTL changes labels/tooltips. */
export function ScatterPlotChart({ points, bubble = false, label, summary, xLabel, yLabel, sizeLabel, xDomain, sizeDomain,
  formatX, formatY, formatSize, formatYAxis }: ScatterPlotChartProps) {
  const direction = useChartDirection();
  const maxSize = Math.max(...points.map((point) => point.z), 1);
  return <ChartFrame label={label} summary={summary} height={220}>
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 12 }} accessibilityLayer>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name={xLabel} domain={xDomain} tick={AXIS_TICK} tickLine={false}
          axisLine={{ stroke: GRID_STROKE }} tickFormatter={formatX} />
        <YAxis type="number" dataKey="y" name={yLabel} orientation={direction.valueAxisOrientation}
          tick={AXIS_TICK} tickLine={false} axisLine={false} width="auto" tickFormatter={formatYAxis ?? formatY} />
        <ZAxis type="number" dataKey="z" domain={sizeDomain ?? [0, maxSize]} range={bubble ? [0, 1600] : [64, 64]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
          const point = payload?.[0]?.payload as ScatterPlotPoint | undefined;
          return active && point ? <ChartTooltipCard dir={direction.dir} title={point.label} entries={[
            { label: xLabel, value: formatX(point.x) }, { label: yLabel, value: formatY(point.y) },
            ...(bubble ? [{ label: sizeLabel, value: formatSize(point.z) }] : []),
          ]} /> : null;
        }} />
        <Scatter data={points} {...CHART_ANIMATION}>
          {points.map((point) => <Cell key={point.key} fill={point.fill ?? "var(--primary)"} fillOpacity={0.8} stroke={point.fill ?? "var(--primary)"} strokeWidth={1} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  </ChartFrame>;
}
