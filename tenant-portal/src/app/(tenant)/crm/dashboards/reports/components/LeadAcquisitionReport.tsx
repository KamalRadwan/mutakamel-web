"use client";

import { Info, RefreshCw } from "lucide-react";
import { Button, Card, DateTime, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { WidgetPreview } from "../../../widgets/components/WidgetPreview";
import { DashboardFilterBar } from "../../[id]/components/DashboardFilterBar";
import { useLeadAcquisitionReport } from "../hooks/useLeadAcquisitionReport";

export function LeadAcquisitionReport() {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.acquisition;
  const { selection, options, result, error, busy, apply, reload, reset, methodId, showMethod, toggleMethod } = useLeadAcquisitionReport();
  const denied = error?.status === 403;
  const filtered = Boolean(selection.branchId || selection.branchIds || selection.companyId
    || selection.companyIds || selection.teamIds || selection.ownerUserIds || selection.datePreset);

  return <section aria-labelledby="lead-acquisition-title" aria-busy={busy} className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 id="lead-acquisition-title" className="text-lg font-semibold">{copy.tab}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      {!denied && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xl" aria-expanded={showMethod} aria-controls={methodId}
          onClick={toggleMethod}>
          <Info className="size-4" aria-hidden="true" />{copy.explain}
        </Button>
        <Button variant="outline" size="xl" onClick={reload} disabled={busy}>
          <RefreshCw className="size-4" aria-hidden="true" />{copy.runAgain}
        </Button>
      </div>}
    </div>
    {options && <DashboardFilterBar selection={selection} onChange={apply} disabled={busy}
      branchIds={[]} currencyCodes={[]} organization={options.organization} population={options.population}
      reportDefaultPeriod={copy.defaultPeriods} />}
    <div id={methodId} hidden={denied || !showMethod}>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground">
        <p>{copy.monthlyMethod}</p>
        <p>{copy.arrivalMethod}</p>
        <p>{copy.growthMethod}</p>
      </Card>
    </div>
    {denied && <PermissionGate require={[]} denied>{null}</PermissionGate>}
    {error && !denied && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {error && filtered && <Button className="self-start" variant="outline" onClick={reset}>{copy.resetFilters}</Button>}
    {busy && <div role="status" className="grid gap-3 lg:grid-cols-2">
      <span className="sr-only">{copy.loading}</span>
      <Skeleton className="h-64 lg:col-span-2" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>}
    {result && <>
      <p className="text-2xs text-muted-foreground">{t.crmDashboardReports.generatedAt} <DateTime value={result.generatedAt} /></p>
      {result.partialAccess && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {result.panels.map(panel => <article key={panel.key} data-report-panel={panel.key}
          className={panel.key === "monthly-intake" ? "min-w-0 rounded-lg border border-border bg-card p-4 lg:col-span-2" : "min-w-0 rounded-lg border border-border bg-card p-4"}>
          <WidgetPreview name={localizedName(panel, lang)} visualizationType={panel.visualizationType}
            displaySpec={panel.displaySpec} querySpec={panel.querySpec} result={panel.result}
            tablePlacement={panel.key === "monthly-intake" ? "side" : panel.key === "arrival-heatmap" ? "collapsible" : undefined} />
        </article>)}
      </div>
    </>}
  </section>;
}
