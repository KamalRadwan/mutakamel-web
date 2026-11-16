"use client";

import { useState } from "react";
import { BarChart, Card, DateTime, DegradedBanner, ErrorState, Skeleton, StatCard, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { BRANCH_COHORT_DEFAULT_FILTERS, type BranchCohortReport } from "../branch-cohort-report-contract";
import { useBranchCohortReport } from "../hooks/useBranchCohortReport";
import { CohortReportFilters } from "./CohortReportFilters";

const CHART_LIMIT = 12;

export function LeadBranchCohortReport() {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.branchCohort;
  const [filters, setFilters] = useState(BRANCH_COHORT_DEFAULT_FILTERS);
  const { result, error, options, isLoading, reload } = useBranchCohortReport(filters);

  return <section className="space-y-4" aria-label={labels.title} aria-busy={isLoading}>
    <CohortReportFilters title={labels.title} description={labels.description} options={options}
      onApply={(next) => { setFilters(next); reload(); }} />
    {isLoading && <Skeleton className="h-64 w-full" />}
    {error && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={error.code === "CRM_SCOPED_PERMISSION_DENIED" ? labels.scopeDenied
        : t.crmDashboards.widgetErrors[error.code ?? ""] ?? t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {result && <BranchCohortResults result={result} />}
  </section>;
}

function BranchCohortResults({ result }: { result: BranchCohortReport }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.branchCohort;
  const number = (value: number) => formatNumber(value, lang);
  const percentage = (value: number | null) => value === null ? t.common.noData
    : formatNumber(value / 100, lang, { style: "percent", maximumFractionDigits: 2 });
  const { totals } = result;
  if (!totals) return <p role="status" className="text-sm text-muted-foreground">{t.crmDashboardReports.unavailable}</p>;
  const charts = result.rows.slice(0, CHART_LIMIT).map(({ branch, eligible, converted, remaining, rate }) => ({
    label: `${branch.name} · ${branch.companyName}`, eligible, converted, remaining, rate,
  }));
  const chartHeight = Math.max(240, charts.length * 46 + 48);
  return <>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span>{labels.creationWindow} <bdi>{result.from} – {result.to}</bdi></span>
      <span>{t.crmDashboards.cohortObservedAt} <DateTime value={result.asOf} timeZone={result.timeZone} /></span>
    </div>
    {result.partialAccess && <DegradedBanner message={labels.partialScope} />}
    {result.warnings.includes("INVALID_COHORT_CONVERSIONS") && <DegradedBanner
      message={t.crmDashboards.widgetWarnings.INVALID_COHORT_CONVERSIONS} />}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={labels.eligible} value={number(totals.eligible)} />
      <StatCard label={labels.converted} value={number(totals.converted)} />
      <StatCard label={labels.remaining} value={number(totals.remaining)} />
      <StatCard label={t.crmDashboards.cohortOverallRate} value={percentage(totals.rate)} />
    </div>
    {result.state === "EMPTY" ? <p role="status" className="text-sm text-muted-foreground">{labels.empty}</p> : <>
      {result.rows.length > charts.length && <p className="text-sm text-muted-foreground">
        {formatTemplate(labels.chartLimit, { shown: number(charts.length), total: number(result.rows.length) })}
      </p>}
      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="min-w-0 space-y-3 p-4">
          <h3 className="text-base font-semibold">{labels.countsChart}</h3>
          <BarChart horizontal data={charts} xKey="label" height={chartHeight} label={labels.countsChart}
            summary={t.crmDashboards.chartExactTable} showValues={charts.length <= 6} valueAxes={{ LEFT: { integers: true } }} series={[
              { key: "eligible", label: labels.eligible, role: "brand" }, { key: "converted", label: labels.converted, role: "positive" },
              { key: "remaining", label: labels.remaining, role: "caution" },
            ]} />
        </Card>
        <Card className="min-w-0 space-y-3 p-4">
          <h3 className="text-base font-semibold">{labels.ratesChart}</h3>
          <BarChart horizontal data={charts} xKey="label" height={chartHeight} label={labels.ratesChart}
            summary={t.crmDashboards.chartExactTable} showValues={charts.length <= 6} showLegend={false} valueFormatter={percentage}
            valueAxes={{ LEFT: { domain: [0, 100] } }} series={[{ key: "rate", label: labels.rate, role: "brand" }]} />
        </Card>
      </div>
      <Card className="min-w-0 overflow-hidden">
        <h3 className="px-4 py-3 text-base font-semibold">{labels.exactTable}</h3>
        <Table aria-label={labels.exactTable}>
          <TableHeader><TableRow>
            <TableHead>{t.crmDashboards.branch}</TableHead><TableHead>{labels.company}</TableHead>
            <TableHead>{labels.eligible}</TableHead><TableHead>{labels.converted}</TableHead>
            <TableHead>{labels.remaining}</TableHead><TableHead>{labels.rate}</TableHead>
          </TableRow></TableHeader>
          <TableBody>{result.rows.map((row) => <TableRow key={row.branch.id}>
            <TableCell>{row.branch.name}</TableCell><TableCell>{row.branch.companyName}</TableCell>
            <TableCell>{number(row.eligible)}</TableCell><TableCell>{number(row.converted)}</TableCell>
            <TableCell>{number(row.remaining)}</TableCell><TableCell>{percentage(row.rate)}</TableCell>
          </TableRow>)}
          <TableRow className="bg-muted">
            <TableHead scope="row" colSpan={2}>{labels.total}</TableHead><TableCell>{number(totals.eligible)}</TableCell>
            <TableCell>{number(totals.converted)}</TableCell><TableCell>{number(totals.remaining)}</TableCell>
            <TableCell>{percentage(totals.rate)}</TableCell>
          </TableRow></TableBody>
        </Table>
      </Card>
    </>}
  </>;
}
