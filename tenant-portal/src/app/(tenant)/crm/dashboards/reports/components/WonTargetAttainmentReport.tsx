"use client";

import { useId, useState } from "react";
import { Database, GitCompare, Info } from "lucide-react";
import { Button, Card, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCohortReport } from "../hooks/useBranchCohortReport";
import { parseWonTargetReport, WON_TARGET_DEFAULT_FILTERS, wonTargetQuery } from "../won-target-report-contract";
import { WonTargetReportFilters } from "./WonTargetReportFilters";
import { WonTargetReportResults } from "./WonTargetReportResults";
import { WonTargetCalendarManager } from "./WonTargetCalendarManager";
import { WonTargetTrajectory } from "./WonTargetTrajectory";

export function WonTargetAttainmentReport() {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const [filters, setFilters] = useState(WON_TARGET_DEFAULT_FILTERS);
  const [showExact, setShowExact] = useState(true);
  const [showMethod, setShowMethod] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const methodId = useId();
  const path = wonTargetQuery(filters);
  const { result, options, error, isLoading, reload } = useCohortReport(filters, path, parseWonTargetReport);

  return <section className="space-y-4" aria-label={labels.title} aria-busy={isLoading}>
    <WonTargetReportFilters key={path} filters={filters} options={options} result={result} onApply={next => {
      setFilters(next);
      reload();
    }} />
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" aria-pressed={showExact} onClick={() => setShowExact(value => !value)}>
        <Database aria-hidden="true" />{labels.viewData}
      </Button>
      {result && result.currencies.length > 1 && <Button type="button" variant="outline" aria-pressed={showCompare} onClick={() => setShowCompare(value => !value)}>
        <GitCompare aria-hidden="true" />{labels.compare}
      </Button>}
      <Button type="button" variant="outline" aria-expanded={showMethod} aria-controls={methodId} onClick={() => setShowMethod(value => !value)}>
        <Info aria-hidden="true" />{labels.explain}
      </Button>
    </div>
    <div id={methodId} hidden={!showMethod}><Card className="p-4 text-sm text-muted-foreground">{labels.method}</Card></div>
    {options && <WonTargetCalendarManager branches={options.branches} initialYear={result?.period.start.slice(0, 4)} onPublished={reload} />}
    {isLoading && <Skeleton className="h-80 w-full" />}
    {error?.status === 403 ? <PermissionGate require={[]} denied>{null}</PermissionGate> : error ?
      <ErrorState title={t.crmDashboardReports.loadFailed} description={error.code === "CRM_TARGET_SOURCE_NOT_READY" ? labels.sourceUnavailable
        : error.code === "CRM_TARGET_PERIOD_INVALID" ? labels.invalidPeriod
          : t.crmDashboards.widgetErrors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} /> : null}
    {result && <>
      {result.rows.length > 0 && <WonTargetTrajectory filters={filters} report={result} />}
      <WonTargetReportResults result={result} showExact={showExact} showCompare={showCompare} />
    </>}
  </section>;
}
