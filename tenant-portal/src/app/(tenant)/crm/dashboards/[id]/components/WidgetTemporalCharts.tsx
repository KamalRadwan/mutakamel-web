"use client";
import { DateTime, DirectedGraphChart, IntervalChart, MatrixHeatmapChart, type HeatmapCell } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { WidgetResult } from "../../dashboard-run-contract";
import { civilDay, flowData, intervalData } from "../../widget-temporal-model";
import { formatWidgetValue } from "../../widget-presentation";
import { record } from "../../widget-typed-model";
import type { WidgetQuerySpec } from "../../widget-contract";
const DAY = 86_400_000;
export function WidgetTemporalCharts({ mode, result, label, displaySpec = {}, querySpec }: { mode: "GANTT" | "FLOWCHART" | "CALENDAR" | "TIMELINE" | "CALENDAR_HEATMAP"; result: WidgetResult; label: string; displaySpec?: Record<string, unknown>; querySpec?: WidgetQuerySpec }) {
  const { t, lang } = useI18n();
  const invalid = <p className="text-xs text-muted-foreground">{t.crmDashboards.invalidChartGeometry}</p>;
  const summary = t.crmDashboards.chartExactTable;
  const date = (value: number) => new Intl.DateTimeFormat(INTL_LOCALE[lang], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(value);
  if (mode === "FLOWCHART") {
    const graph = flowData(result.series); if (!graph?.nodes.length) return invalid;
    return <div className="space-y-2"><DirectedGraphChart {...graph} label={label} summary={summary} formatValue={(value) => formatWidgetValue(value, result.unit, result.currency, lang, displaySpec)} /><p className="text-2xs text-muted-foreground">{t.crmDashboards.flowTransitionNotice}</p></div>;
  }
  if (mode === "CALENDAR_HEATMAP") {
    const series = result.series[0];
    if (result.series.length !== 1 || !series?.points.length || series.points.length > 732 || querySpec?.dimension?.grain && querySpec.dimension.grain !== "DAY") return invalid;
    const points = series.points.map((point) => ({ point, day: civilDay(point.key) }));
    if (points.some(({ point, day }) => day === null || point.start && point.end && Date.parse(point.end) - Date.parse(point.start) > DAY * 1.15) || new Set(points.map((item) => item.day)).size !== points.length) return invalid;
    const first = Math.min(...points.map((item) => item.day!)); const last = Math.max(...points.map((item) => item.day!));
    const origin = first - new Date(first).getUTCDay() * DAY; const weeks = Math.ceil((last - origin + DAY) / (7 * DAY)); if (weeks > 106) return invalid;
    const byDay = new Map(points.map(({ point, day }) => [day, point]));
    const cells: Array<Array<HeatmapCell | null>> = Array.from({ length: 7 }, (_, day) => Array.from({ length: weeks }, (_, week) => {
      const instant = origin + (week * 7 + day) * DAY; const point = byDay.get(instant);
      return point ? { key: point.key, label: point.key, value: point.value, formatted: formatWidgetValue(point.value, series.unit, series.currency ?? result.currency, lang, displaySpec) } : null;
    }));
    return <MatrixHeatmapChart label={label} summary={summary} columns={Array.from({ length: weeks }, (_, week) => new Date(origin + week * 7 * DAY).toISOString().slice(0, 10))}
      rows={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((key) => t.crmDashboards.weekdays[key])} cells={cells} lowLabel={t.crmDashboards.lowIntensity} highLabel={t.crmDashboards.highIntensity} emptyLabel="—" />;
  }
  const intervals = result.shape === "INTERVAL" ? intervalData(result.series) : null;
  const events = mode === "TIMELINE" && result.typedResult?.shape === "EVENT_STREAM" && Array.isArray(result.typedResult.events)
    ? result.typedResult.events.flatMap((item) => { const event = record(item); const start = typeof event?.occurredAt === "string" ? Date.parse(event.occurredAt) : NaN;
      return event && Number.isFinite(start) && typeof event.title === "string" ? [{ key: String(event.id), label: lang === "ar" && typeof event.titleAr === "string" ? event.titleAr : event.title, start, end: start }] : []; }) : null;
  const data = intervals ?? events;
  if (!data?.length || data.length > 100 || events && events.length !== (result.typedResult?.events as unknown[]).length) return invalid;
  if (mode === "GANTT") return <div className="space-y-2"><p className="text-2xs text-muted-foreground">{t.crmDashboards.intervalUtcNotice}</p><IntervalChart data={data} label={label} summary={summary} formatDate={date} /></div>;
  if (mode === "TIMELINE") return <section aria-label={label} className="max-h-80 space-y-3 overflow-y-auto pe-1"><p className="text-2xs text-muted-foreground">{t.crmDashboards.intervalUtcNotice}</p><ol className="space-y-3 border-s-2 border-border ps-4">{[...data].sort((a, b) => a.start - b.start).map((item) => <li key={item.key} className="space-y-1 rounded-md border border-border p-2">
    <p className="text-xs font-semibold"><bdi>{item.label}</bdi></p><p className="text-2xs text-muted-foreground"><DateTime value={new Date(item.start).toISOString()} timeZone="UTC" />{item.end !== item.start && <> – <DateTime value={new Date(item.end).toISOString()} timeZone="UTC" /></>}</p>
  </li>)}</ol></section>;
  const first = Math.min(...data.map((row) => row.start)); const last = Math.max(...data.map((row) => row.end));
  if (last - first > DAY * 366) return invalid;
  const firstMonth = new Date(first); firstMonth.setUTCDate(1); firstMonth.setUTCHours(0, 0, 0, 0);
  const months: number[] = []; for (let cursor = firstMonth.getTime(); cursor <= last; ) { months.push(cursor); const next = new Date(cursor); next.setUTCMonth(next.getUTCMonth() + 1); cursor = next.getTime(); }
  return <section aria-label={label} className="max-h-96 space-y-4 overflow-auto"><p className="text-2xs text-muted-foreground">{t.crmDashboards.intervalUtcNotice}</p>{months.map((month) => {
    const start = new Date(month); const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(); const offset = start.getUTCDay();
    return <div key={month} className="space-y-2"><h4 className="text-xs font-semibold"><DateTime value={start.toISOString()} precision="date" timeZone="UTC" /></h4><div className="grid min-w-lg grid-cols-7 gap-1">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((key) => <div key={key} className="text-center text-2xs text-muted-foreground">{t.crmDashboards.weekdays[key]}</div>)}
      {Array.from({ length: offset }, (_, index) => <div key={`empty:${index}`} />)}{Array.from({ length: count }, (_, index) => { const day = month + index * DAY; const dayEvents = data.filter((row) => row.start < day + DAY && (row.end > day || row.start === row.end && row.start >= day));
        return <div key={day} className="min-h-20 space-y-1 rounded-sm border border-border bg-card p-1"><span className="text-2xs tabular-nums">{index + 1}</span>{dayEvents.map((event) => <p key={event.key} title={`${event.label}: ${date(event.start)} – ${date(event.end)}`} className="rounded-xs bg-muted p-1 text-2xs"><bdi>{event.label}</bdi></p>)}</div>; })}
    </div></div>;
  })}</section>;
}
