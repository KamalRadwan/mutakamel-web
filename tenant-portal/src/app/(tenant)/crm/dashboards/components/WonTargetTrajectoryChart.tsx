"use client";

import type { ComponentProps } from "react";
import { Badge, ComposedChart, DateTime } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { targetMilliunits, type parseWorkingPace, type WonTargetTrajectoryPoints } from "../won-target-evidence";

export function WonTargetTrajectoryChart({ points, pace, currencyCode, target, asOf, timeZone, label, height = 300, color }: {
  points: WonTargetTrajectoryPoints;
  pace: ReturnType<typeof parseWorkingPace>;
  currencyCode: string;
  target: string;
  asOf: string;
  timeZone: string;
  label: string;
  height?: number;
  color?: string;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const paceState = pace.state;
  const hasPlan = paceState === "READY";
  const asPlot = (value: string | null) => value === null ? null : Number(targetMilliunits(value)) / 1000;
  const series: ComponentProps<typeof ComposedChart>["series"] = [
    { key: "won", label: labels.trajectory.dailyWon, role: "positive", kind: "bar" },
    { key: "observed", label: labels.trajectory.observed, role: "brand", kind: "line", fill: color },
    ...(hasPlan ? [{ key: "plan", label: labels.trajectory.plan, role: "caution", kind: "line", strokeDasharray: "5 4" } as const] : []),
  ];
  return <>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <Badge tone="neutral">{currencyCode}</Badge>
      <span><span className="text-muted-foreground">{labels.target} </span><bdi>{formatDecimalString(target, lang,
        { style: "currency", currency: currencyCode, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 3 })}</bdi></span>
      <span><span className="text-muted-foreground">{labels.observed} </span><DateTime value={asOf} timeZone={timeZone} /></span>
      {pace.calendarRevision !== null && <span className="text-muted-foreground">
        {labels.calendarRevision} {formatNumber(pace.calendarRevision, lang)}
      </span>}
    </div>
    <ComposedChart label={label} summary={hasPlan ? labels.trajectory.method : labels.trajectory.observedOnly}
      xKey="date" height={height} showPoints={points.length === 1}
      series={series} data={points.map(point => ({
        date: point.date.slice(5), won: asPlot(point.wonValue), observed: asPlot(point.observedCumulative), plan: asPlot(point.plannedCumulative),
      }))} axisLabels={{ LEFT: currencyCode }} numberFormat={{ notation: "compact", maximumFractionDigits: 2 }} />
    <p className="text-sm text-muted-foreground">{hasPlan ? labels.trajectory.method : labels.workingPaceStates[paceState]}</p>
  </>;
}
