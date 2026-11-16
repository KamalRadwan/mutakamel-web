"use client";
import { ChartFrame, useChartDirection } from "./chart-common";
export interface IntervalChartDatum { key: string; label: string; start: number; end: number }
export function IntervalChart({ data, label, summary, formatDate }: { data: IntervalChartDatum[]; label: string; summary: string; formatDate: (instant: number) => string }) {
  const { reversed, dir } = useChartDirection();
  const start = Math.min(...data.map((row) => row.start)); const end = Math.max(...data.map((row) => row.end));
  const span = Math.max(1, end - start); const width = 720; const height = 48 + data.length * 32;
  const x = (value: number) => 180 + (reversed ? 1 - (value - start) / span : (value - start) / span) * 520;
  return <ChartFrame label={label} summary={summary} height={Math.min(340, height + 12)}><div className="h-full overflow-auto" dir="ltr">
    <svg width={width} height={height} aria-hidden="true">
      {[start, start + span / 2, end].map((value, index) => <g key={index}><line x1={x(value)} x2={x(value)} y1={30} y2={height} stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <text x={x(value)} y={16} textAnchor={index === 0 ? reversed ? "end" : "start" : index === 2 ? reversed ? "start" : "end" : "middle"} fontSize={10} fill="var(--chart-axis)">{formatDate(value)}</text></g>)}
      {data.map((row, index) => <g key={row.key}><title>{`${row.label}: ${formatDate(row.start)} – ${formatDate(row.end)}`}</title>
        <text x={170} y={52 + index * 32} textAnchor="end" fontSize={11} fill="var(--foreground)" direction={dir}>{row.label.length > 22 ? `${row.label.slice(0, 21)}…` : row.label}</text>
        <rect x={Math.min(x(row.start), x(row.end))} y={40 + index * 32} width={Math.max(1, Math.abs(x(row.end) - x(row.start)))} height={18} rx={3} fill="var(--primary)" />
      </g>)}
    </svg></div></ChartFrame>;
}
