"use client";

import { Info, RefreshCw } from "lucide-react";
import { Button, Card, DateTime, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { WidgetPreview } from "../../../widgets/components/WidgetPreview";
import { DashboardFilterBar } from "../../[id]/components/DashboardFilterBar";
import { INQUIRY_QUALITY_REPORT_PATH, parseInquiryQualityReport } from "../inquiry-quality-report-contract";
import { useLeadCatalogueReport } from "../hooks/useLeadAcquisitionReport";

export function InquiryQualityReport() {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.inquiryQuality;
  const { selection, options, result, error, busy, apply, reload, reset, methodId, showMethod, toggleMethod } =
    useLeadCatalogueReport(INQUIRY_QUALITY_REPORT_PATH, parseInquiryQualityReport);
  const denied = error?.status === 403;
  return <section aria-labelledby="inquiry-quality-title" aria-busy={busy} className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 id="inquiry-quality-title" className="text-lg font-semibold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      {!denied && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xl" aria-expanded={showMethod} aria-controls={methodId} onClick={toggleMethod}>
          <Info className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.explain}
        </Button>
        <Button variant="outline" size="xl" onClick={reload} disabled={busy}>
          <RefreshCw className="size-4" aria-hidden="true" />{t.crmDashboardReports.acquisition.runAgain}
        </Button>
      </div>}
    </div>
    {options && <DashboardFilterBar selection={selection} onChange={apply} disabled={busy}
      branchIds={[]} currencyCodes={[]} organization={options.organization} population={options.population}
      reportDefaultPeriod={t.crmDashboards.datePresets.LAST_MONTH} />}
    <div id={methodId} hidden={denied || !showMethod}>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground"><p>{copy.method}</p><p>{copy.tie}</p></Card>
    </div>
    {denied && <PermissionGate require={[]} denied>{null}</PermissionGate>}
    {error && !denied && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {error && !denied && <Button className="self-start" variant="outline" onClick={reset}>{t.crmDashboardReports.acquisition.resetFilters}</Button>}
    {busy && <div role="status"><span className="sr-only">{copy.loading}</span><Skeleton className="h-80" /></div>}
    {result && <>
      <p className="text-2xs text-muted-foreground">{t.crmDashboardReports.generatedAt} <DateTime value={result.generatedAt} /></p>
      {result.partialAccess && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {result.panels.map(panel => <article key={panel.key} data-report-panel={panel.key}
          className={panel.key === "inquiry-classification" ? "min-w-0 rounded-lg border border-border bg-card p-4 lg:col-span-2 [&_h3]:text-base"
            : "min-w-0 rounded-lg border border-border bg-card p-4 [&_h3]:text-base"}>
          <WidgetPreview result={panel.result} name={localizedName(panel, lang)} visualizationType={panel.visualizationType}
            displaySpec={panel.displaySpec} querySpec={panel.querySpec}
            tablePlacement={panel.key === "inquiry-classification" ? "side" : "collapsible"} />
        </article>)}
      </div>
    </>}
  </section>;
}
