"use client";
import { ChartFrame, useChartDirection } from "./chart-common";

export interface WaterfallDatum { key: string; label: string; kind: "START" | "DELTA" | "SUBTOTAL" | "TOTAL"; value: number; cumulativeValue: number }
/** Floating delta bars use the server's cumulative value, including negative balances. */
export function WaterfallChart({ steps, label, summary, formatValue }: { steps: WaterfallDatum[]; label: string; summary: string; formatValue: (value: number) => string }) {
  const { reversed, dir } = useChartDirection();
  const width = Math.max(480, steps.length * 88); const height = 250; const top = 24; const bottom = 196;
  const ranges = steps.map((step) => ({ step, start: step.kind === "DELTA" ? step.cumulativeValue - step.value : 0, end: step.cumulativeValue }));
  const min = Math.min(0, ...ranges.flatMap((row) => [row.start, row.end]));
  const max = Math.max(0, ...ranges.flatMap((row) => [row.start, row.end]));
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const span = max / scale - min / scale || 1;
  const y = (value: number) => bottom - ((value / scale - min / scale) / span) * (bottom - top);
  const slot = (width - 96) / Math.max(1, steps.length);
  const x = (index: number) => 72 + (reversed ? steps.length - 1 - index : index) * slot;
  return <ChartFrame label={label} summary={summary} height={height}>
    <div className="h-full overflow-x-auto" dir="ltr"><svg width={width} height={height} className="text-foreground" aria-hidden="true">
      {[min, 0, max].filter((value, index, all) => all.indexOf(value) === index).map((value) => <g key={value}>
        <line x1={68} x2={width - 12} y1={y(value)} y2={y(value)} stroke="var(--chart-grid)" strokeDasharray={value === 0 ? undefined : "3 3"} />
        <text x={64} y={y(value) + 4} textAnchor="end" fill="var(--chart-axis)" fontSize={10}>{formatValue(value)}</text>
      </g>)}
      {ranges.map(({ step, start, end }, index) => <g key={step.key} data-kind={step.kind}>
        <title>{`${step.label}: ${formatValue(step.value)} · ${formatValue(step.cumulativeValue)}`}</title>
        <rect x={x(index)} width={slot * .68} y={Math.min(y(start), y(end))} height={Math.max(1, Math.abs(y(end) - y(start)))}
          fill={step.kind === "DELTA" ? step.value < 0 ? "var(--swatch-amber)" : "var(--swatch-teal)" : "var(--primary)"} />
        {index < ranges.length - 1 && <line x1={x(index) + (reversed ? 0 : slot * .68)} x2={x(index + 1) + (reversed ? slot * .68 : 0)} y1={y(end)} y2={y(end)} stroke="var(--chart-axis)" strokeDasharray="3 3" />}
        <text x={x(index) + slot * .34} y={Math.max(12, Math.min(y(start), y(end)) - 6)} textAnchor="middle" fontSize={10} fill="var(--foreground)">{formatValue(step.value)}</text>
        <text x={x(index) + slot * .34} y={218} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" direction={dir}>{step.label.length > 16 ? `${step.label.slice(0, 15)}…` : step.label}</text>
      </g>)}
    </svg></div>
  </ChartFrame>;
}
