"use client";

import { CalendarDays } from "lucide-react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import type { ComponentProps } from "react";
import type { GovernedTargetEvidence } from "../../won-target-evidence";
import { widgetColor } from "../../widget-presentation";
import { WonTargetTrajectoryChart } from "../../components/WonTargetTrajectoryChart";
import { GaugeChartView } from "./WidgetGaugeChart";

export function GovernedTargetWidgetView(props: ComponentProps<typeof GaugeChartView>) {
  const evidence = props.result.governedTarget;
  if (evidence?.measure === "TRAJECTORY") return <TrajectoryWidget evidence={evidence} label={props.label}
    asOf={props.result.generatedAt} color={widgetColor(props.displaySpec?.color)} />;
  return evidence?.measure === "DAILY_PACE"
    ? <WorkingPaceCard evidence={evidence} color={widgetColor(props.displaySpec?.color)} />
    : <GaugeChartView {...props} />;
}

function TrajectoryWidget({ evidence, label, asOf, color }: { evidence: GovernedTargetEvidence; label: string; asOf: string; color?: string }) {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const { trajectory, workingPace, amounts, state, currencyCode } = evidence;
  if (!trajectory || !workingPace || !amounts) {
    const reason = state in labels.states ? labels.states[state as keyof typeof labels.states]
      : labels.widgetStates[state as keyof typeof labels.widgetStates];
    return <p role="note" className="text-sm text-muted-foreground">{reason ?? t.common.noData}</p>;
  }
  return <WonTargetTrajectoryChart points={trajectory.points} pace={workingPace} currencyCode={currencyCode}
    target={amounts.targetValue} asOf={asOf} timeZone={trajectory.timeZone} label={label} height={240} color={color} />;
}

function WorkingPaceCard({ evidence, color }: { evidence: GovernedTargetEvidence; color?: string }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const { workingPace: pace, state } = evidence;
  const money = (value: string) => formatDecimalString(value, lang, {
    style: "currency", currency: evidence.currencyCode, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 3,
  });
  const reason = pace && pace.state !== "READY" && pace.state !== "ACTUAL_UNAVAILABLE" ? labels.workingPaceStates[pace.state]
    : state !== "READY" ? state in labels.states ? labels.states[state as keyof typeof labels.states]
      : labels.widgetStates[state as keyof typeof labels.widgetStates] : null;
  const remaining = evidence.amounts?.remainingValue;
  return <section aria-label={labels.paceTitle} className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4" aria-hidden="true" />{labels.dailyPace}</p>
      <Badge tone="neutral">{evidence.currencyCode}</Badge>
    </div>
    {pace?.requiredPerWorkday != null
      ? <p className="break-words text-2xl font-semibold tracking-tight tabular-nums" style={{ color }}><bdi>{money(pace.requiredPerWorkday)}</bdi></p>
      : <p role="note" className="text-sm text-muted-foreground">{reason ?? t.common.noData}</p>}
    {pace && <dl className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-2 text-xs">
      <div><dt className="text-muted-foreground">{labels.workdays}</dt>
        <dd className="font-medium tabular-nums">{pace.remainingWorkdays === null ? t.common.noData : formatNumber(pace.remainingWorkdays, lang)}</dd></div>
      <div><dt className="text-muted-foreground">{labels.remaining}</dt>
        <dd className="font-medium tabular-nums"><bdi>{remaining == null ? t.common.noData : money(remaining)}</bdi></dd></div>
      {pace.calendarRevision !== null && <div><dt className="text-muted-foreground">{labels.calendarRevision}</dt>
        <dd className="font-medium tabular-nums">{formatNumber(pace.calendarRevision, lang)}</dd></div>}
    </dl>}
    {evidence.periodStart && <p className="text-xs text-muted-foreground">
      {labels.period} <bdi dir="ltr">{evidence.periodStart} → {evidence.periodEndExclusive}</bdi>
    </p>}
  </section>;
}
