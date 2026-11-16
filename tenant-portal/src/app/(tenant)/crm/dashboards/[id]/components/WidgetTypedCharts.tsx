"use client";
import { Badge, HierarchyChart, WaterfallChart } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { WidgetResult } from "../../dashboard-run-contract";
import type { CrmMetricUnit } from "../../widget-contract";
import { formatWidgetValue } from "../../widget-presentation";
import { hierarchyNodes, hierarchyTree, rankedRows, scorecardRows, typedReferences, waterfallSteps, type TypedMeasure, type TypedReference } from "../../widget-typed-model";

export function WidgetTypedCharts({ mode, result, label, displaySpec = {} }: { mode: "WATERFALL" | "TREEMAP" | "LEADERBOARD" | "SCORECARD"; result: WidgetResult; label: string; displaySpec?: Record<string, unknown> }) {
  const { t, lang } = useI18n(); const typed = result.typedResult;
  const invalid = <p className="text-xs text-muted-foreground">{t.crmDashboards.invalidChartGeometry}</p>;
  if (!typed) return invalid;
  const unit = (typeof typed.unit === "string" ? typed.unit : result.unit) as CrmMetricUnit | null;
  const currency = typeof typed.currencyCode === "string" ? typed.currencyCode : result.currency;
  const format = (value: number) => formatWidgetValue(value, unit, currency, lang, displaySpec);
  const summary = t.crmDashboards.chartExactTable;
  const references = (refs: TypedReference[]) => refs.length ? <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">{refs.map((ref) => <li key={ref.key}>
    {ref.label} · {t.crmDashboards.referenceKinds[ref.kind]}: <bdi className="tabular-nums">{formatWidgetValue(ref.value, ref.unit, ref.currencyCode ?? null, lang, displaySpec)}</bdi>
  </li>)}</ul> : null;
  const measures = (items: TypedMeasure[]) => <dl className="flex flex-wrap gap-x-5 gap-y-2">{items.map((measure) => <div key={measure.key}>
    <dt className="text-2xs text-muted-foreground">{measure.label}</dt><dd className="text-sm font-semibold tabular-nums"><bdi>{formatWidgetValue(measure.value, measure.unit, measure.currencyCode ?? null, lang, displaySpec)}</bdi></dd>
    {references(measure.references)}
  </div>)}</dl>;
  if (mode === "WATERFALL") {
    const steps = waterfallSteps(typed); const refs = typedReferences(typed.references);
    if (!steps?.length || refs === null || steps.some((step) => !Number.isFinite(step.cumulativeValue - step.value))) return invalid;
    return <div className="space-y-2"><WaterfallChart steps={steps} label={label} summary={summary} formatValue={format} />{references(refs)}</div>;
  }
  if (mode === "TREEMAP") {
    const nodes = hierarchyNodes(typed); const tree = nodes ? hierarchyTree(nodes) : null;
    if (!tree?.length || !tree.some((node) => node.value > 0)) return invalid;
    return <HierarchyChart data={tree} label={label} summary={summary} formatValue={format} />;
  }
  if (mode === "LEADERBOARD") {
    const rows = rankedRows(typed); if (!rows?.length) return invalid;
    const maxima = new Map<string, number>();
    const group = (measure: TypedMeasure) => `${measure.key}:${measure.unit}:${measure.currencyCode ?? ""}`;
    for (const row of rows) maxima.set(group(row.primaryMeasure), Math.max(maxima.get(group(row.primaryMeasure)) ?? 0, Math.abs(row.primaryMeasure.value)));
    return <section aria-label={label} className="max-h-80 space-y-3 overflow-y-auto pe-1">{rows.map((row) => <article key={row.id} className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2"><Badge tone="neutral">{formatNumber(row.rank, lang)}</Badge><h4 className="min-w-0 text-xs font-semibold"><bdi>{row.label}</bdi></h4></div>
      {measures([row.primaryMeasure, ...row.secondaryMeasures])}
      <div className="h-1.5 rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.abs(row.primaryMeasure.value) / (maxima.get(group(row.primaryMeasure)) || 1) * 100}%` }} /></div>
    </article>)}</section>;
  }
  const rows = scorecardRows(typed); if (!rows?.length) return invalid;
  const tones = { ON_TRACK: "positive", AT_RISK: "caution", OFF_TRACK: "negative", UNKNOWN: "neutral" } as const;
  return <section aria-label={label} className="max-h-80 space-y-3 overflow-y-auto pe-1">{rows.map((row) => <article key={row.id} className="space-y-2 rounded-md border border-border bg-card p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold"><bdi>{row.label}</bdi></h4><Badge tone={tones[row.status]}>{t.crmDashboards.scorecardStatuses[row.status]}</Badge></div>
    {measures(row.measures)}
  </article>)}</section>;
}
