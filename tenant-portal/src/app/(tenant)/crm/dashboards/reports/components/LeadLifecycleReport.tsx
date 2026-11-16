"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, ChartPie, Info, RefreshCw, UserRoundCheck } from "lucide-react";
import { BarChart, Button, Card, DateTime, DonutChart, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatCivilDateRange } from "@/lib/format/date";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { DashboardFilterBar } from "../../[id]/components/DashboardFilterBar";
import { WidgetDataTable } from "../../[id]/components/WidgetDataTable";
import { localizeWidgetResult } from "../../widget-labels";
import { leadLifecycleTable, readLeadLifecycle, type LeadLifecycle } from "../../widget-lead-lifecycle";
import { LEAD_LIFECYCLE_REPORT_PATH, parseLeadLifecycleReport } from "../lead-lifecycle-report-contract";
import { useLeadCatalogueReport } from "../hooks/useLeadAcquisitionReport";

const STATUS_COLORS = ["var(--color-brand-500)", "var(--swatch-teal)", "var(--swatch-indigo)", "var(--swatch-purple)", "var(--swatch-slate)"];
const STAGE_COLORS = ["var(--color-brand-500)", "var(--swatch-blue)", "var(--swatch-indigo)", "var(--swatch-teal)", "var(--swatch-purple)"];
const PANEL_ICON = { "current-status": ChartPie, "current-stage": BarChart3, "qualified-open": UserRoundCheck };

function StageChart({ data, label }: { data: Extract<LeadLifecycle, { kind: "stage" }>; label: string }) {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.leadLifecycle;
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 540));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const limited = data.rows.length > 8;
  const rows = limited ? [...data.rows.slice(0, 7), {
    key: "__remaining_stages__", label: copy.chartOther, count: data.rows.slice(7).reduce((sum, row) => sum + row.count, 0),
  }] : data.rows;
  const maximum = Math.max(...rows.map(row => row.count));
  return <div ref={container} className="min-w-0 space-y-2">
    {compact ? <ul role="list" aria-label={label} className="space-y-2.5">
      {rows.map((row, index) => <li key={row.key}>
        <div className="flex min-w-0 justify-between gap-2 text-sm">
          <bdi className="min-w-0 break-words">{row.label}</bdi>
          <span className="shrink-0 font-semibold tabular-nums">{formatNumber(row.count, lang)}</span>
        </div>
        <div aria-hidden="true" className="mt-1 h-2.5 rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${row.count / maximum * 100}%`, backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length] }} />
        </div>
      </li>)}
    </ul> : <BarChart xKey="label" height={220} label={label} summary={t.crmDashboards.chartExactTable}
      data={rows.map((row, index) => ({ label: row.label, [`stage${index}`]: row.count }))}
      series={rows.map((row, index) => ({ key: `stage${index}`, label: row.label, role: "brand", fill: STAGE_COLORS[index % STAGE_COLORS.length] }))}
      valueAxes={{ LEFT: { integers: true } }} stacked showLegend={false} showValues />}
    {limited && <p role="note" className="text-xs text-muted-foreground">{copy.chartLimited}</p>}
  </div>;
}

function LifecycleEvidence({ data, title }: { data: LeadLifecycle; title: string }) {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.leadLifecycle;
  const count = (value: number) => formatNumber(value, lang);
  const table = <div className="min-w-0 overflow-hidden rounded-md border border-border [&_td]:px-2 [&_th]:px-2 [&_th]:normal-case [&_th]:tracking-normal [&_td:first-child]:break-words">
    <WidgetDataTable model={leadLifecycleTable(data, copy, STATUS_COLORS)} caption={title} />
  </div>;
  if (data.kind === "status") {
    const share = (value: number) => formatNumber(value / data.total, lang, { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });
    return <div className="grid min-w-0 items-center gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <DonutChart label={title} summary={t.crmDashboards.chartExactTable}
        slices={data.rows.map((row, index) => ({ key: row.key, label: row.label, value: row.count, fill: STATUS_COLORS[index], isOther: row.key === "OTHER" }))}
        centerValue={count(data.total)} centerLabel={copy.totalLeads} valueFormatter={share} showValues showLegend={false} />
      {table}
    </div>;
  }
  if (data.kind === "stage") return <div className="space-y-4">
    <StageChart data={data} label={title} />
    {data.omitted > 0 && <p role="note" className="text-xs text-muted-foreground">{formatTemplate(copy.stageGroups, { count: count(data.omitted) })}</p>}
    {table}
  </div>;
  return <div className="space-y-4">
    <div className="rounded-lg border border-border bg-muted p-5 text-center">
      <p className="text-4xl font-semibold tabular-nums">{count(data.qualified.open)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{formatTemplate(copy.qualifiedOf, { count: count(data.qualified.total) })}</p>
    </div>
    {table}
  </div>;
}

export function LeadLifecycleReport() {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.leadLifecycle;
  const { selection, options, result, error, busy, apply, reload, reset, methodId, showMethod, toggleMethod } =
    useLeadCatalogueReport(LEAD_LIFECYCLE_REPORT_PATH, parseLeadLifecycleReport);
  const denied = error?.status === 403;
  const empty = result?.panels.every(panel => panel.widget.state === "EMPTY");
  return <section aria-labelledby="lead-lifecycle-title" aria-busy={busy} className="flex min-w-0 flex-col gap-3">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id="lead-lifecycle-title" className="text-xl font-semibold">{copy.title}</h2>
        {result && <p className="text-sm text-muted-foreground">
          {copy.creationPeriod} <bdi>{formatCivilDateRange(result.period.from, result.period.to, lang)}</bdi>
          {" · "}{copy.observed} <DateTime value={result.asOf} timeZone={result.period.timeZone} />
        </p>}
      </div>
      {!denied && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xl" aria-controls={methodId} aria-expanded={showMethod} onClick={toggleMethod}>
          <Info className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.explain}
        </Button>
        <Button variant="outline" size="xl" onClick={reload} disabled={busy}>
          <RefreshCw className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.runAgain}
        </Button>
      </div>}
    </header>
    {options && <DashboardFilterBar selection={selection} onChange={apply} disabled={busy} branchIds={[]} currencyCodes={[]}
      organization={options.organization} population={options.population} reportDefaultPeriod={t.crmDashboards.datePresets.LAST_MONTH} />}
    <div id={methodId} hidden={denied || !showMethod}><Card className="p-4 text-sm text-muted-foreground">{copy.method}</Card></div>
    {denied && <PermissionGate require={[]} denied>{null}</PermissionGate>}
    {error && !denied && <>
      <ErrorState title={t.crmDashboardReports.loadFailed} description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
        onRetry={reload} retryLabel={t.common.retry} />
      <Button className="self-start" variant="outline" onClick={reset}>{t.crmDashboardReports.acquisition.resetFilters}</Button>
    </>}
    {busy && <div role="status"><span className="sr-only">{copy.loading}</span><Skeleton className="h-80" /></div>}
    {result?.partialAccess && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
    {result && (empty ? <Card className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm">
      <BarChart3 className="size-8 text-primary" aria-hidden="true" />
      <p role="status">{copy.empty}</p>
    </Card> :
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {result.panels.map(panel => {
          const Icon = PANEL_ICON[panel.key];
          const title = localizedName(panel, lang);
          const data = panel.data?.total ? readLeadLifecycle(localizeWidgetResult(panel.widget, null, lang)) : null;
          const message = panel.widget.state === "EMPTY" ? copy.empty
            : panel.widget.state === "UNAVAILABLE" ? t.crmDashboards.widgetDataUnavailable : t.crmDashboards.widgetFailedGeneric;
          return <Card key={panel.key} role="region" aria-label={title} className={panel.key === "current-status"
            ? "min-w-0 space-y-4 p-4 xl:col-span-2" : "min-w-0 space-y-4 p-4"}>
            <h3 className="flex items-start gap-2 text-lg font-semibold"><Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />{title}</h3>
            {data ? <LifecycleEvidence data={data} title={title} /> : <p role="note" className="text-sm text-muted-foreground">{message}</p>}
          </Card>;
        })}
      </div>)}
  </section>;
}
