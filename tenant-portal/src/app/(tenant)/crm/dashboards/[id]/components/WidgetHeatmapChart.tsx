"use client";
import { MatrixHeatmapChart, type HeatmapCell } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { WidgetSeries } from "../../dashboard-run-contract";
import { formatWidgetValue } from "../../widget-presentation";
import { cohortMaturityCell } from "../../widget-cohort-maturity";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ARRIVAL_DAY_KEYS = ["weekday-6", "weekday-7", "weekday-1", "weekday-2", "weekday-3", "weekday-4", "weekday-5"];
export function HeatmapChartView({ allSeries, label, summary, currency, displaySpec = {}, cohortTimeZone, leadArrival, onDrilldown }: { allSeries: readonly WidgetSeries[]; label: string; summary: string; currency?: string | null; displaySpec?: Record<string, unknown>; cohortTimeZone?: string; leadArrival?: boolean; onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void }) {
  const { t, lang } = useI18n();
  if (allSeries.length > 24 || allSeries.reduce((sum, row) => sum + row.points.length, 0) > 1000) return <p className="text-xs text-muted-foreground">{t.crmDashboards.chartLimitNotice}</p>;
  const maturity = t.crmDashboards.maturity;
  const date = cohortTimeZone ? new Intl.DateTimeFormat(INTL_LOCALE[lang], { year: "numeric", month: "short", day: "numeric", timeZone: cohortTimeZone }) : undefined;
  const groups = new Map<string, WidgetSeries[]>();
  for (const series of allSeries) { const key = `${series.unit}:${series.unit === "MONEY" ? series.currency ?? currency ?? "" : ""}`; groups.set(key, [...(groups.get(key) ?? []), series]); }
  return <div className="space-y-4">{groups.size > 1 && <p className="text-2xs text-muted-foreground">{t.crmDashboards.currencyFacetNotice}</p>}{[...groups].map(([key, series]) => {
    const points = new Map<string, string>(); for (const row of series) for (const point of row.points) points.set(point.key, point.label);
    const keys = [...points.keys()].sort((a, b) => {
      const order = leadArrival ? ARRIVAL_DAY_KEYS : DAYS;
      const left = order.indexOf(leadArrival ? a : points.get(a)!);
      const right = order.indexOf(leadArrival ? b : points.get(b)!);
      return left >= 0 && right >= 0 ? left - right : 0;
    });
    const compared = series.some((row) => row.points.some((point) => point.previousValue !== undefined));
    const format = (value: number | null) => formatWidgetValue(value, series[0].unit, series[0].currency ?? currency ?? null, lang, displaySpec);
    const indexes = series.map((row) => new Map(row.points.map((point) => [point.key, point])));
    const rowEvidence = date ? { label: maturity.eligible, values: keys.map((pointKey) => {
      const denominator = cohortMaturityCell(indexes[0].get(pointKey)?.meta ?? {})?.denominator;
      return denominator == null ? "—" : formatNumber(denominator, lang);
    }) } : undefined;
    return <div key={key} className="space-y-3">{groups.size > 1 && <h4 className="text-xs font-semibold"><bdi>{series[0].currency ?? (series[0].unit ? t.crmDashboards.metricUnits[series[0].unit] : "—")}</bdi></h4>}{(compared ? [false, true] : [false]).map((previous) => {
      const cells: Array<Array<HeatmapCell | null>> = keys.map((pointKey) => series.map((row, index) => { const point = indexes[index].get(pointKey); if (!point) return null;
        const value = previous ? point.previousValue ?? null : point.value;
        const evidence = date ? cohortMaturityCell(point.meta) : null;
        const description = evidence?.reason ? [maturity.reasons[evidence.reason],
          evidence.reason === "AGE_NOT_REACHED" && date ? maturity.maturesAt.replace("{date}", date.format(new Date(evidence.matureAt))) : "",
        ].filter(Boolean).join(" · ") : evidence?.numerator != null && evidence.denominator != null
          ? `${formatNumber(evidence.numerator, lang)} / ${formatNumber(evidence.denominator, lang)}` : undefined;
        return { key: point.key, label: `${t.crmDashboards.weekdays[point.label] ?? point.label} · ${row.label}${previous && point.previousKey ? ` · ${point.previousKey}` : ""}`, value, formatted: format(value),
          description,
          ...(!previous && value !== null && onDrilldown ? { onSelect: () => onDrilldown(point.key, point.label, row.key) } : {}) };
      }));
      const values = cells.flatMap((row) => row.flatMap((cell) => cell?.value == null ? [] : [cell.value]));
      const completeArrivalMatrix = leadArrival && cells.length === 7 && series.length === 4 && values.length === 28;
      const arrivalTotals = completeArrivalMatrix ? cells.map(row => row.reduce((total, cell) => total + (cell?.value ?? 0), 0)) : null;
      return <div key={String(previous)} className="space-y-1">{compared && <h5 className="text-2xs font-medium">{previous ? t.crmDashboards.pointPreviousValue : t.crmDashboards.currentValue}</h5>}
        <MatrixHeatmapChart label={`${label}${previous ? ` · ${t.crmDashboards.pointPreviousValue}` : ""}`} summary={summary} columns={series.map((row) => row.label)} rows={keys.map((pointKey) => t.crmDashboards.weekdays[points.get(pointKey)!] ?? points.get(pointKey)!)} cells={cells}
          lowLabel={`${t.crmDashboards.lowIntensity} · ${format(values.length ? Math.min(...values) : null)}`} highLabel={`${t.crmDashboards.highIntensity} · ${format(values.length ? Math.max(...values) : null)}`} emptyLabel="—"
          rowEvidence={arrivalTotals ? { label: t.crmDashboards.leadArrivalTotals.row, values: arrivalTotals.map(format), position: "end" } : rowEvidence} />
        {arrivalTotals && <p className="flex items-center justify-between gap-2 rounded-sm bg-muted px-3 py-2 text-xs font-medium">
          {t.crmDashboards.leadArrivalTotals.all}
          <bdi className="tabular-nums">{format(arrivalTotals.reduce((total, value) => total + value, 0))}</bdi>
        </p>}
      </div>;
    })}</div>;
  })}</div>;
}
