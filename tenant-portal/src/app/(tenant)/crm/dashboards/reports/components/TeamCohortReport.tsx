"use client";

import { useId, useState } from "react";
import { Database, GitCompare, Info, Layers } from "lucide-react";
import { Button, Card, DegradedBanner, ErrorState, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { BRANCH_COHORT_DEFAULT_FILTERS } from "../branch-cohort-report-contract";
import { useCohortReport } from "../hooks/useBranchCohortReport";
import { parseTeamCohortReport, teamCohortQuery, type TeamCohortFilters } from "../team-cohort-report-contract";
import { CohortReportFilters } from "./CohortReportFilters";
import { TeamCohortResults } from "./TeamCohortResults";
import { TeamCohortBranchSelection, TeamCohortSelection } from "./TeamCohortSelection";

export function TeamCohortReport() {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.teamCohort;
  const [filters, setFilters] = useState<TeamCohortFilters>({ ...BRANCH_COHORT_DEFAULT_FILTERS, teamIds: [], branchIds: [] });
  const [showExact, setShowExact] = useState(true);
  const [showMethod, setShowMethod] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const methodId = useId();
  const compareId = useId();
  const branchesId = useId();
  const { result, error, options, isLoading, reload } = useCohortReport(filters, teamCohortQuery(filters), parseTeamCohortReport);
  const branchOptions = options?.branches.filter((branch) => !filters.companyId || branch.companyId === filters.companyId) ?? [];

  return <section className="space-y-4" aria-label={labels.title} aria-busy={isLoading}>
    <CohortReportFilters title={labels.title} description={labels.description} options={options}
      allBranchesLabel={filters.branchIds.length ? labels.customBranches : undefined}
      onApply={(selection) => { setFilters({ ...selection, branchIds: [], teamIds: [] }); setShowBranches(false); reload(); }} />
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" aria-pressed={showExact} onClick={() => setShowExact(!showExact)}>
        <Database aria-hidden="true" />{labels.viewData}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showCompare} aria-controls={compareId} onClick={() => setShowCompare(!showCompare)}>
        <GitCompare aria-hidden="true" />{labels.compare}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showMethod} aria-controls={methodId} onClick={() => setShowMethod(!showMethod)}>
        <Info aria-hidden="true" />{labels.explain}
      </Button>
      {branchOptions.length > 1 && !filters.branchId && <Button type="button" variant="outline" aria-expanded={showBranches}
        aria-controls={branchesId} onClick={() => setShowBranches(!showBranches)}><Layers aria-hidden="true" />{labels.selectBranches}</Button>}
    </div>
    <div id={methodId} hidden={!showMethod}>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground"><p>{labels.method}</p><p>{labels.nonAdditive}</p></Card>
    </div>
    <div id={branchesId} hidden={!showBranches}>
      {showBranches && !filters.branchId && <TeamCohortBranchSelection key={filters.branchIds.join(",")} options={branchOptions} selected={filters.branchIds}
        onApply={(branchIds) => { setFilters({ ...filters, branchIds, teamIds: [] }); setShowBranches(false); reload(); }} />}
    </div>
    <div id={compareId} hidden={!showCompare}>
      {showCompare && result?.teamOptions.length ? <TeamCohortSelection key={result.selectedTeamIds.join(",")} options={result.teamOptions}
        selected={result.selectedTeamIds} onApply={(teamIds) => { setFilters({ ...filters, teamIds }); reload(); }} /> : null}
    </div>
    {isLoading && <Skeleton className="h-80 w-full" />}
    {error && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={error.code === "CRM_SCOPED_PERMISSION_DENIED" ? labels.scopeDenied
        : t.crmDashboards.widgetErrors[error.code ?? ""] ?? t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {result && <>
      {result.partialAccess && <DegradedBanner message={t.crmDashboardReports.branchCohort.partialScope} />}
      {result.warnings.includes("INVALID_COHORT_CONVERSIONS") && <DegradedBanner message={t.crmDashboards.widgetWarnings.INVALID_COHORT_CONVERSIONS} />}
      {result.totals ? <TeamCohortResults result={result} showExact={showExact} /> : <p role="status" className="text-sm text-muted-foreground">{labels.unavailable}</p>}
    </>}
  </section>;
}
