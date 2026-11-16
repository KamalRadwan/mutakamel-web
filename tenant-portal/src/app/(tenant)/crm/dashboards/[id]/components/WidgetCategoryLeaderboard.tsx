"use client";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { WidgetResult } from "../../dashboard-run-contract";
import { formatWidgetValue } from "../../widget-presentation";
import type { WidgetQuerySpec } from "../../widget-contract";
/** Category rows have source ordering, not the authoritative rank/tie policy of typed RANKED rows. */
export function WidgetCategoryLeaderboard({ result, label, displaySpec = {}, querySpec, onDrilldown }: { result: WidgetResult; label: string; displaySpec?: Record<string, unknown>; querySpec?: WidgetQuerySpec; onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void }) {
  const { t, lang } = useI18n(); const first = result.series[0];
  const primaryKey = querySpec?.series[0]?.metricKey ?? (first?.currency && first.key.endsWith(`:${first.currency}`) ? first.key.slice(0, -(first.currency.length + 1)) : first?.key);
  const primaries = result.series.filter((row) => row.key === primaryKey || row.key.startsWith(`${primaryKey}:`));
  if (!first || result.series.reduce((sum, row) => sum + row.points.length, 0) > 1000) return <p className="text-xs text-muted-foreground">{t.crmDashboards.chartLimitNotice}</p>;
  const indexes = result.series.map((row) => new Map(row.points.map((point) => [point.key, point])));
  return <section aria-label={label} className="max-h-80 space-y-4 overflow-y-auto pe-1"><p className="text-2xs text-muted-foreground">{t.crmDashboards.categoryOrderNotice}</p>{primaries.map((primary) => {
    const max = Math.max(1, ...primary.points.map((point) => Math.abs(point.value ?? 0)));
    // A currency facet carries its own source measures. Never copy a global count into each financial facet.
    const included = primaries.length > 1 ? [primary] : result.series;
    return <div key={primary.key} className="space-y-2">{primaries.length > 1 && <h4 className="text-xs font-semibold"><bdi>{primary.label}</bdi></h4>}{primary.points.map((point) => <article key={point.key} className="space-y-2 rounded-md border border-border p-3">
      {onDrilldown && point.value !== null ? <Button variant="link" size="sm" onClick={() => onDrilldown(point.key, point.label, primary.key)}>{point.label}</Button> : <h5 className="text-xs font-semibold"><bdi>{point.label}</bdi></h5>}
      <dl className="flex flex-wrap gap-x-5 gap-y-2">{included.map((row) => { const value = indexes[result.series.indexOf(row)].get(point.key)?.value ?? null;
        return <div key={row.key}><dt className="text-2xs text-muted-foreground"><bdi>{row.label}</bdi></dt><dd className="text-sm font-semibold tabular-nums"><bdi>{formatWidgetValue(value, row.unit, row.currency ?? result.currency, lang, displaySpec)}</bdi></dd></div>;
      })}</dl><div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full bg-primary" style={{ width: `${Math.abs(point.value ?? 0) / max * 100}%` }} /></div>
    </article>)}</div>;
  })}</section>;
}
