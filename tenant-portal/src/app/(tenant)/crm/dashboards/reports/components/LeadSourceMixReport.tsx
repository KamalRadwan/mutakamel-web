"use client";

import { Info, RefreshCw } from "lucide-react";
import { Button, Card, DateTime, ErrorState, PermissionGate, Skeleton, ToggleGroup, ToggleGroupItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { WidgetPreview } from "../../../widgets/components/WidgetPreview";
import { DashboardFilterBar } from "../../[id]/components/DashboardFilterBar";
import { SOURCE_MIX_VIEWS, useLeadSourceMixReport } from "../hooks/useLeadSourceMixReport";

export function LeadSourceMixReport() {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.sourceMix;
  const { selection, options, result, error, busy, apply, reload, reset, view, changeView,
    showMethod, methodId, toggleMethod } = useLeadSourceMixReport();
  const denied = error?.status === 403;

  return <section aria-labelledby="lead-source-mix-title" aria-busy={busy} className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 id="lead-source-mix-title" className="text-lg font-semibold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      {!denied && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xl" aria-expanded={showMethod} aria-controls={methodId}
          onClick={toggleMethod}><Info className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.explain}</Button>
        <Button variant="outline" size="xl" onClick={reload} disabled={busy}>
          <RefreshCw className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.runAgain}
        </Button>
      </div>}
    </div>
    {options && <DashboardFilterBar selection={selection} onChange={apply} disabled={busy}
      branchIds={[]} currencyCodes={[]} organization={options.organization} population={options.population}
      reportDefaultPeriod={t.crmDashboards.datePresets.LAST_MONTH} />}
    <div id={methodId} hidden={denied || !showMethod}><Card className="space-y-2 p-4 text-sm text-muted-foreground">
      <p>{copy.method}</p><p>{copy.folding}</p>
    </Card></div>
    {denied && <PermissionGate require={[]} denied>{null}</PermissionGate>}
    {error && !denied && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {error && !denied && <Button className="self-start" variant="outline" onClick={reset}>{t.crmDashboardReports.acquisition.resetFilters}</Button>}
    {busy && <div role="status"><span className="sr-only">{copy.loading}</span><Skeleton className="h-80" /></div>}
    {result && <>
      <p className="text-2xs text-muted-foreground">{t.crmDashboardReports.generatedAt} <DateTime value={result.generatedAt} /></p>
      {result.partialAccess && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
      <ToggleGroup type="single" value={view} aria-label={copy.view} onValueChange={changeView}
        className="flex-wrap self-start rounded-lg border border-border bg-card p-1">
        {SOURCE_MIX_VIEWS.map(value => <ToggleGroupItem key={value} value={value}>{copy.views[value]}</ToggleGroupItem>)}
      </ToggleGroup>
      <article data-report-panel="source-mix" className="min-w-0 rounded-lg border border-border bg-card p-4">
        <WidgetPreview result={result.panel.result} name={localizedName(result.panel, lang)} visualizationType={view}
          displaySpec={result.panel.displaySpec} querySpec={result.panel.querySpec} tablePlacement="balanced" />
      </article>
    </>}
  </section>;
}
