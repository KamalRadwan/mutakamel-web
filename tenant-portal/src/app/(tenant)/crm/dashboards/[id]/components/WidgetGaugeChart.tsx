"use client";
import { Badge, TargetGaugeChart, type TargetGaugeChartProps } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { CrmVisualization } from "../../widget-contract";
import type { WidgetResult } from "../../dashboard-run-contract";
import { formatWidgetValue, widgetColor, widgetOption } from "../../widget-presentation";
import { LEAD_MISSING_SOURCE_SHARE } from "../../widget-acquisition-quality";
import { WidgetPopulationShare } from "./WidgetAcquisitionQuality";

const VARIANTS: Partial<Record<CrmVisualization, TargetGaugeChartProps["variant"]>> = {
  PROGRESS_CARD: "progress", BULLET: "bullet", SEMI_CIRCLE_GAUGE: "semi",
  THREE_QUARTER_GAUGE: "three-quarter", CIRCULAR_PROGRESS_GAUGE: "circle", DETAILED_SPEEDOMETER: "speedometer",
};

export function GaugeChartView({ visualizationType, result, label, displaySpec = {} }: {
  visualizationType?: CrmVisualization; result: WidgetResult; label: string; displaySpec?: Record<string, unknown>;
}) {
  const { t, lang } = useI18n();
  if (visualizationType === "PROGRESS_CARD" && result.series[0]?.key === LEAD_MISSING_SOURCE_SHARE) return <WidgetPopulationShare result={result} label={label} />;
  const evidence = result.governedTarget;
  const labels = t.crmDashboardReports.wonTarget;
  const money = (value: string, currency: string) => formatDecimalString(value, lang, {
    style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 3,
  });
  if (evidence && evidence.state !== "READY") {
    const message = evidence.state in labels.states ? labels.states[evidence.state as keyof typeof labels.states]
      : labels.widgetStates[evidence.state as keyof typeof labels.widgetStates];
    return <div role="note" className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-xs">
      <p className="font-medium text-foreground">{message}</p>
      {evidence.amounts && <p className="text-muted-foreground tabular-nums">{formatTemplate(t.crmDashboards.targetOf, {
        target: money(evidence.amounts.targetValue, evidence.currencyCode),
      })}</p>}
      {evidence.state === "HISTORY_INCOMPLETE" && evidence.coverageStartedAt && <p className="text-muted-foreground">
        {labels.coverage} <time dateTime={evidence.coverageStartedAt} dir="ltr">{evidence.coverageStartedAt.slice(0, 10)}</time>
      </p>}
    </div>;
  }
  if (result.value === null) return <p className="text-xs text-muted-foreground">{t.crmDashboards.noData}</p>;
  if (result.target === null || result.target <= 0) return <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.targetUnavailable}</p>;
  const amounts = evidence?.amounts;
  const formattedValue = evidence && amounts?.actualValue != null
    ? money(amounts.actualValue, evidence.currencyCode) : formatWidgetValue(result.value, result.unit, result.currency, lang, displaySpec);
  const formattedTarget = evidence && amounts ? money(amounts.targetValue, evidence.currencyCode)
    : formatWidgetValue(result.target, result.unit, result.currency, lang, displaySpec);
  const targetLabel = formatTemplate(t.crmDashboards.targetOf, { target: formattedTarget });
  const attainment = result.value / result.target * 100;
  const attainmentLabel = Number.isFinite(attainment) ? formatTemplate(t.crmDashboards.targetAttainment, {
    value: amounts?.attainmentPercent == null ? formatNumber(attainment, lang, { style: "unit", unit: "percent", maximumFractionDigits: 1 })
      : formatDecimalString(amounts.attainmentPercent, lang, { style: "unit", unit: "percent", maximumFractionDigits: 2 }),
  }) : null;
  return <div className="space-y-2">
    <TargetGaugeChart variant={VARIANTS[visualizationType ?? "SEMI_CIRCLE_GAUGE"] ?? "semi"}
      value={result.value} target={result.target} label={label} summary={`${formattedValue}. ${targetLabel}`}
      valueLabel={formattedValue} targetLabel={targetLabel}
      formatAxis={(value) => formatWidgetValue(value, result.unit, result.currency, lang, { ...displaySpec, numberFormat: "compact" })}
      valueColor={widgetColor(displaySpec.color)} targetColor={widgetColor(displaySpec.targetColor)} />
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
      <p className="text-muted-foreground" style={{ color: widgetColor(displaySpec.targetColor) }}>{targetLabel}</p>
      {widgetOption(displaySpec, "showDelta", true) && attainmentLabel && <Badge tone="neutral">{attainmentLabel}</Badge>}
    </div>
    {evidence && <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
      <span>{labels.recordedWon}</span>
      <span dir="ltr">{evidence.periodStart} → {evidence.periodEndExclusive}</span>
      {evidence.revision !== null && <span>{labels.revision} {formatNumber(evidence.revision, lang)}</span>}
    </p>}
  </div>;
}
