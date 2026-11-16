"use client";
import { Badge, BarChart } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { WidgetResult } from "../../dashboard-run-contract";
import { distributionBins, finite } from "../../widget-typed-model";
import { formatWidgetValue } from "../../widget-presentation";
import type { CrmMetricUnit } from "../../widget-contract";
export function HistogramChartView({ result, label, displaySpec = {} }: { result: WidgetResult; label: string; displaySpec?: Record<string, unknown> }) {
  const { t, lang } = useI18n(); const typed = result.typedResult;
  const bins = typed ? distributionBins(typed) : null;
  if (!bins?.length || !finite(typed?.totalCount) || bins.reduce((sum, bin) => sum + bin.count, 0) !== typed.totalCount) return <p className="text-xs text-muted-foreground">{t.crmDashboards.invalidChartGeometry}</p>;
  const currency = typeof typed.currencyCode === "string" ? typed.currencyCode : result.currency;
  const unit = (typeof typed.unit === "string" ? typed.unit : result.unit) as CrmMetricUnit | null;
  const boundary = (value: number) => formatWidgetValue(value, unit, currency, lang, displaySpec);
  const data = bins.map((bin) => ({ label: bin.lowerBound !== undefined && bin.upperBound !== undefined ? `${boundary(bin.lowerBound)} – < ${boundary(bin.upperBound)}`
    : bin.kind === "UNDERFLOW" && bin.upperBound !== undefined ? `< ${boundary(bin.upperBound)}`
    : bin.kind === "OVERFLOW" && bin.lowerBound !== undefined ? `≥ ${boundary(bin.lowerBound)}` : bin.label, count: bin.count }));
  return <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2 text-2xs"><span>{t.crmDashboards.metricUnits[unit ?? "COUNT"]}</span>
    <Badge tone="neutral">{formatNumber(typed.totalCount, lang)} · {t.crmDashboards.displayedTotal}</Badge></div>
    <BarChart data={data} xKey="label" series={[{ key: "count", label: t.crmDashboards.metricUnits.COUNT, role: "brand" }]} label={label} summary={t.crmDashboards.chartExactTable}
      height={240} showLegend={false} showValues valueFormatter={(value) => formatNumber(value, lang, { maximumFractionDigits: 0 })} />
  </div>;
}
