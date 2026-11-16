"use client";

import { useId, useState } from "react";
import { Database, GitCompare, Info } from "lucide-react";
import { Button, Card, DateTime, DegradedBanner, ErrorState, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { BRANCH_COHORT_DEFAULT_FILTERS } from "../branch-cohort-report-contract";
import { useCohortReport } from "../hooks/useBranchCohortReport";
import { parseWonCycleReport, wonCycleQuery, type WonCycleFilters } from "../won-cycle-report-contract";
import { CohortReportFilters } from "./CohortReportFilters";
import { WonCycleComparison } from "./WonCycleComparison";
import { WonCycleResults } from "./WonCycleResults";

export function WonCycleReport() {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonCycle;
  const [filters, setFilters] = useState<WonCycleFilters>({ ...BRANCH_COHORT_DEFAULT_FILTERS, afterMinutes: null });
  const [cursors, setCursors] = useState<Array<number | null>>([]);
  const [showExact, setShowExact] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const methodId = useId();
  const comparisonId = useId();
  const { result, error, options, isLoading, reload } = useCohortReport(filters, wonCycleQuery(filters), parseWonCycleReport);
  const next = result?.nextAfterMinutes;

  return <section className="space-y-4" aria-label={labels.title} aria-busy={isLoading}>
    <CohortReportFilters title={labels.title} description={labels.description} options={options}
      onApply={(selection) => { setCursors([]); setFilters({ ...selection, afterMinutes: null }); reload(); }} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" aria-pressed={showExact} onClick={() => setShowExact(!showExact)}>
        <Database aria-hidden="true" />{labels.viewData}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showCompare} aria-controls={comparisonId} onClick={() => setShowCompare(!showCompare)}>
        <GitCompare aria-hidden="true" />{labels.compare}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showMethod} aria-controls={methodId} onClick={() => setShowMethod(!showMethod)}>
        <Info aria-hidden="true" />{labels.explain}
      </Button>
    </div>
    <div id={methodId} hidden={!showMethod}>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground"><p>{labels.method}</p><p>{labels.frequencyBasis}</p></Card>
    </div>
    {isLoading && <Skeleton className="h-80 w-full" />}
    {error && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={error.code === "CRM_SCOPED_PERMISSION_DENIED" ? labels.scopeDenied
        : t.crmDashboards.widgetErrors[error.code ?? ""] ?? t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {result && <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <bdi>{result.from} – {result.to}</bdi>
        <span>{t.crmDashboards.cohortObservedAt} <DateTime value={result.asOf} timeZone={result.timeZone} /></span>
      </div>
      {result.partialAccess && <DegradedBanner message={labels.partialScope} />}
      {result.warnings.includes("INVALID_WON_CYCLE_INTERVALS") && <DegradedBanner message={t.crmDashboards.widgetWarnings.INVALID_WON_CYCLE_INTERVALS} />}
      {result.distribution ? <WonCycleResults report={result} showExact={showExact} /> : <p role="status" className="text-sm text-muted-foreground">{labels.unavailable}</p>}
    </>}
    <div id={comparisonId} hidden={!showCompare}>
      {showCompare && result?.distribution && <WonCycleComparison groups={result.distribution.groups} />}
    </div>
    {(cursors.length > 0 || next != null) && <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-muted-foreground">{formatTemplate(labels.page, { page: formatNumber(cursors.length + 1, lang) })}</p>
      <Button type="button" variant="outline" disabled={cursors.length === 0 || isLoading} onClick={() => {
        setFilters({ ...filters, afterMinutes: cursors.at(-1) ?? null }); setCursors(cursors.slice(0, -1));
      }}>{labels.previousPage}</Button>
      <Button type="button" variant="outline" disabled={next == null || isLoading} onClick={() => {
        if (next == null) return;
        setCursors([...cursors, filters.afterMinutes]); setFilters({ ...filters, afterMinutes: next });
      }}>{labels.nextPage}</Button>
    </div>}
  </section>;
}
