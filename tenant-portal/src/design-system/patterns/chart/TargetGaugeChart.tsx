"use client";
import { ChartFrame, useChartDirection } from "./chart-common";
import { gaugeArc, gaugePoint, targetGaugeScale, type TargetGaugeVariant } from "./target-gauge-geometry";

export interface TargetGaugeChartProps {
  variant: TargetGaugeVariant;
  value: number;
  target: number;
  label: string;
  summary: string;
  valueLabel: string;
  targetLabel: string;
  formatAxis: (value: number) => string;
  valueColor?: string;
  targetColor?: string;
  compact?: boolean;
}

/** Actual value and target only: qualitative thresholds are never fabricated. */
export function TargetGaugeChart({ variant, value, target, label, summary, valueLabel, targetLabel, formatAxis,
  valueColor = "var(--primary)", targetColor = "var(--foreground)", compact = false }: TargetGaugeChartProps) {
  const direction = useChartDirection();
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return null;
  const scale = targetGaugeScale(value, target);
  const bar = variant === "progress" || variant === "bullet";
  const circle = variant === "circle";
  const sweep = variant === "semi" ? 180 : 270;
  const start = variant === "semi" ? 180 : 135;
  const targetAngle = start + scale.targetRatio * sweep;
  const markerStart = gaugePoint(targetAngle, 73);
  const markerEnd = gaugePoint(targetAngle, 95);
  const circleMarkerStart = gaugePoint(-90 + scale.targetRatio * 360, 66, 160, 102);
  const circleMarkerEnd = gaugePoint(-90 + scale.targetRatio * 360, 90, 160, 102);
  const needle = gaugePoint(start + scale.valueRatio * sweep, 66);
  const x = (ratio: number) => direction.reversed ? 296 - ratio * 272 : 24 + ratio * 272;
  const zeroX = x(scale.zeroRatio);
  const valueX = x(scale.valueRatio);
  return <ChartFrame label={label} summary={summary} height={bar ? compact ? 42 : 110 : 200} interactive>
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={scale.min} aria-valuemax={scale.max}
      aria-valuetext={`${valueLabel}; ${targetLabel}`} data-gauge-variant={variant} className="h-full w-full">
      <svg viewBox={bar ? compact ? "0 28 320 60" : "0 0 320 110" : "0 0 320 210"} className="h-full w-full" aria-hidden="true">
        {bar ? <>
          {!compact && <text x={24} y={23} textAnchor="start" fill={valueColor} className="text-base font-semibold">{valueLabel}</text>}
          <rect x={24} y={variant === "bullet" ? 43 : 46} width={272} height={variant === "bullet" ? 28 : 12} rx={variant === "bullet" ? 1 : 6} fill="var(--muted)" />
          <rect x={Math.min(zeroX, valueX)} y={46} width={Math.abs(valueX - zeroX)} height={variant === "bullet" ? 20 : 12} rx={variant === "bullet" ? 1 : 6} fill={valueColor} />
          <line x1={x(scale.targetRatio)} x2={x(scale.targetRatio)} y1={36} y2={78} stroke={targetColor} strokeWidth={3} data-target-marker="true" />
          {!compact && <><text x={x(0)} y={99} textAnchor={direction.reversed ? "end" : "start"} fill="var(--muted-foreground)" className="text-xs">{formatAxis(scale.min)}</text>
          <text x={x(1)} y={99} textAnchor={direction.reversed ? "start" : "end"} fill="var(--muted-foreground)" className="text-xs">{formatAxis(scale.max)}</text></>}
        </> : circle ? <>
          <circle cx={160} cy={102} r={78} fill="none" stroke="var(--border)" strokeWidth={13} />
          {scale.valueRatio > 0 && <circle cx={160} cy={102} r={78} fill="none" stroke={valueColor} strokeWidth={13}
            transform="rotate(-90 160 102)" pathLength={100} strokeDasharray={`${scale.valueRatio * 100} 100`} />}
          <line x1={circleMarkerStart.x} y1={circleMarkerStart.y} x2={circleMarkerEnd.x} y2={circleMarkerEnd.y} stroke={targetColor} strokeWidth={3} data-target-marker="true" />
          <text x={160} y={107} textAnchor="middle" fill={valueColor} className="text-xl font-semibold">{valueLabel}</text>
        </> : <>
          <path d={gaugeArc(start, sweep)} fill="none" stroke="var(--border)" strokeWidth={13} data-arc-degrees={sweep} />
          {scale.valueRatio > 0 && <path d={gaugeArc(start, sweep)} fill="none" stroke={valueColor} strokeWidth={13}
            pathLength={100} strokeDasharray={`${scale.valueRatio * 100} 100`} />}
          <line x1={markerStart.x} y1={markerStart.y} x2={markerEnd.x} y2={markerEnd.y} stroke={targetColor} strokeWidth={3} data-target-marker="true" />
          {variant === "speedometer" && <>
            {Array.from({ length: 6 }, (_, index) => {
              const ratio = index / 5;
              const outer = gaugePoint(start + ratio * sweep, 74);
              const inner = gaugePoint(start + ratio * sweep, 66);
              const text = gaugePoint(start + ratio * sweep, 111);
              const tick = scale.min * (1 - ratio) + scale.max * ratio;
              return <g key={index}><line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="var(--muted-foreground)" />
                <text x={text.x} y={text.y} textAnchor="middle" fill="var(--muted-foreground)" className="text-2xs">{formatAxis(tick)}</text></g>;
            })}
            <line x1={160} y1={108} x2={needle.x} y2={needle.y} stroke={valueColor} strokeWidth={3} data-value-needle="true" />
            <circle cx={160} cy={108} r={5} fill={valueColor} />
          </>}
          <text x={160} y={variant === "speedometer" ? 154 : 111} textAnchor="middle" fill={valueColor} className="text-xl font-semibold">{valueLabel}</text>
          {variant !== "speedometer" && <>
            <text x={58} y={variant === "semi" ? 130 : 181} textAnchor="middle" fill="var(--muted-foreground)" className="text-xs">{formatAxis(scale.min)}</text>
            <text x={262} y={variant === "semi" ? 130 : 181} textAnchor="middle" fill="var(--muted-foreground)" className="text-xs">{formatAxis(scale.max)}</text>
          </>}
        </>}
      </svg>
    </div>
  </ChartFrame>;
}
