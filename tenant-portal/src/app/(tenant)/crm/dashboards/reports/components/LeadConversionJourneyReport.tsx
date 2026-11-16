"use client";

import { useId, useState } from "react";
import { BarChart3, Clock3, Database, Info, Percent, RefreshCw, Trophy, Users } from "lucide-react";
import { BarChart, Button, Card, DateTime, DegradedBanner, ErrorState, Skeleton, StatCard, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow, swatchSurfacePalette } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { formatWidgetValue } from "../../widget-presentation";
import { BRANCH_COHORT_DEFAULT_FILTERS, branchCohortQuery } from "../branch-cohort-report-contract";
import { CONVERSION_JOURNEY_REPORT_PATH, parseConversionJourneyReport, type ConversionJourneyReport } from "../conversion-journey-report-contract";
import { useCohortReport } from "../hooks/useBranchCohortReport";
import { CohortReportFilters } from "./CohortReportFilters";

export function LeadConversionJourneyReport() {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.conversionJourney;
  const [filters, setFilters] = useState(BRANCH_COHORT_DEFAULT_FILTERS);
  const [showExact, setShowExact] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const methodId = useId();
  const exactId = useId();
  const { result, error, options, isLoading, reload } = useCohortReport(filters,
    branchCohortQuery(filters, CONVERSION_JOURNEY_REPORT_PATH), parseConversionJourneyReport);

  return <section className="space-y-4" aria-label={labels.title} aria-busy={isLoading}>
    <CohortReportFilters title={labels.title} description={labels.description} options={options}
      onApply={(next) => { setFilters(next); reload(); }} />
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={reload} disabled={isLoading}>
        <RefreshCw aria-hidden="true" />{labels.refresh}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showMethod} aria-controls={methodId} onClick={() => setShowMethod(!showMethod)}>
        <Info aria-hidden="true" />{labels.calculation}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showExact} aria-controls={exactId} onClick={() => setShowExact(!showExact)}>
        <Database aria-hidden="true" />{labels.exactValues}
      </Button>
    </div>
    <div id={methodId} hidden={!showMethod}>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground"><p>{labels.durationMethod}</p><p>{labels.cohortMethod}</p></Card>
    </div>
    {isLoading && <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div>}
    {error && <ErrorState title={t.crmDashboardReports.loadFailed}
      description={error.code === "CRM_SCOPED_PERMISSION_DENIED" ? t.crmDashboardReports.branchCohort.scopeDenied
        : t.crmDashboards.widgetErrors[error.code ?? ""] ?? t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
      onRetry={reload} retryLabel={t.common.retry} />}
    {result && <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <bdi>{result.from} – {result.to}</bdi>
        <span>{t.crmDashboards.cohortObservedAt} <DateTime value={result.asOf} timeZone={result.timeZone} /></span>
      </div>
      {result.partialAccess && <DegradedBanner message={t.crmDashboardReports.branchCohort.partialScope} />}
      <div className="grid gap-4 xl:grid-cols-2">
        <DurationPanel panel={result.duration} />
        <CurrentWinPanel panel={result.cohort} />
      </div>
    </>}
    <div id={exactId} hidden={!showExact}>
      {result?.duration.data && <DurationTable data={result.duration.data} />}
    </div>
  </section>;
}

type DurationData = NonNullable<ConversionJourneyReport["duration"]["data"]>;
const dayFormat = { numberFormat: "duration-days" };

function useDurationRows(data?: DurationData | null) {
  const { lang } = useI18n();
  const duration = (value: number | null) => formatWidgetValue(value, "DURATION", null, lang, dayFormat);
  const rows = data?.bins.map(({ key, lowerBound, upperBound, count }) => ({ key, count,
    label: upperBound === undefined ? `≥ ${duration(lowerBound)}` : `${duration(lowerBound)} – < ${duration(upperBound)}`,
  })) ?? [];
  return { duration, rows };
}

function DurationPanel({ panel }: { panel: ConversionJourneyReport["duration"] }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.conversionJourney;
  const { data } = panel;
  const { duration, rows } = useDurationRows(data);
  return <Card className="min-w-0 space-y-4 p-4">
    <div className="flex items-start gap-3"><BarChart3 className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div><h3 className="text-base font-semibold">{labels.durationTitle}</h3><p className="text-sm text-muted-foreground">{labels.eventBasis}</p></div>
    </div>
    {!data ? <p role="status" className="text-sm text-muted-foreground">{labels.durationUnavailable}</p> : <>
      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label={labels.median} value={data.median === null ? t.common.noData : duration(data.median)} icon={Clock3} />
        <StatCard label={labels.p90} value={data.p90 === null ? t.common.noData : duration(data.p90)} icon={Clock3} />
        <StatCard label={labels.eventCount} value={data.validCount + data.excludedCount} icon={Database} />
      </div>
      {panel.state === "READY" ? <BarChart data={rows} xKey="label" label={labels.durationTitle} summary={t.crmDashboards.chartExactTable}
        height={260} valueAxes={{ LEFT: { integers: true } }} showValues showLegend={false}
        series={[{ key: "count", label: labels.eventCount, role: "brand" }]} />
        : <p role="status" className="text-sm text-muted-foreground">{labels.durationEmpty}</p>}
      <p className="text-sm text-muted-foreground">{formatTemplate(labels.sample, {
        valid: formatNumber(data.validCount, lang), excluded: formatNumber(data.excludedCount, lang),
      })}</p>
    </>}
  </Card>;
}

function DurationTable({ data }: { data: DurationData }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.conversionJourney;
  const { rows } = useDurationRows(data);
  return <Card className="min-w-0 overflow-hidden">
    <h3 className="px-4 py-3 text-base font-semibold">{labels.durationExact}</h3>
    <Table aria-label={labels.durationExact}><TableHeader><TableRow>
      <TableHead>{labels.elapsedBand}</TableHead><TableHead>{labels.eventCount}</TableHead>
    </TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.key}>
      <TableHead scope="row"><bdi>{row.label}</bdi></TableHead><TableCell>{formatNumber(row.count, lang)}</TableCell>
    </TableRow>)}</TableBody></Table>
  </Card>;
}

function CurrentWinPanel({ panel }: { panel: ConversionJourneyReport["cohort"] }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.conversionJourney;
  const { data } = panel;
  const stages = data ? [
    { name: labels.created, value: data.created, hue: "blue", width: "w-full" },
    { name: labels.converted, value: data.converted, hue: "purple", width: "w-11/12" },
    { name: labels.won, value: data.won, hue: "teal", width: "w-10/12" },
  ] as const : [];
  const percentage = (value: number | null) => value === null ? t.common.noData : formatWidgetValue(value, "PERCENT", null, lang, {});
  return <Card className="min-w-0 space-y-4 p-4">
    <div className="flex items-start gap-3"><Trophy className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div><h3 className="text-base font-semibold">{labels.cohortTitle}</h3><p className="text-sm text-muted-foreground">{labels.creationBasis}</p></div>
    </div>
    {!data ? <p role="status" className="text-sm text-muted-foreground">{labels.cohortUnavailable}</p> : <>
      {panel.partialAccess && <DegradedBanner message={labels.partialCohort} />}
      {data.invalidIntervals > 0 && <DegradedBanner message={t.crmDashboards.widgetWarnings.INVALID_COHORT_CONVERSIONS} />}
      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label={labels.converted} value={data.converted} icon={Users} />
        <StatCard label={labels.won} value={data.won} icon={Trophy} />
        <StatCard label={labels.reach} value={percentage(data.rate)} icon={Percent} />
      </div>
      {panel.state === "EMPTY" ? <p role="status" className="text-sm text-muted-foreground">{labels.cohortEmpty}</p> : <>
        <div className="grid items-start gap-3 md:grid-cols-2">
          <ol aria-label={labels.funnel} className="flex flex-col items-center gap-1">
            {stages.map((stage) => <li key={stage.name}
              className={`${stage.width} ${swatchSurfacePalette(stage.hue).iconBoxActive} rounded-sm px-5 py-2 text-center`}
              style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 8% 100%)" }}>
              <p className="text-lg font-semibold tabular-nums">{formatNumber(stage.value, lang)}</p><p className="text-xs">{stage.name}</p>
            </li>)}
          </ol>
          <Table aria-label={labels.cohortExact}><TableHeader><TableRow>
            <TableHead>{labels.cohortExact}</TableHead><TableHead>{t.crmDashboardReports.branchCohort.total}</TableHead><TableHead>{labels.share}</TableHead>
          </TableRow></TableHeader><TableBody><TableRow>
            <TableHead scope="row">{labels.won}</TableHead><TableCell>{formatNumber(data.won, lang)}</TableCell><TableCell>{percentage(data.rate)}</TableCell>
          </TableRow><TableRow>
            <TableHead scope="row">{labels.withoutWin}</TableHead><TableCell>{formatNumber(data.withoutReadableWin, lang)}</TableCell>
            <TableCell>{percentage(data.rate === null ? null : (10000 - Math.round(100 * data.rate)) / 100)}</TableCell>
          </TableRow></TableBody></Table>
        </div>
        <p className="text-sm text-muted-foreground">{formatTemplate(t.crmDashboards.cohortReadableWins, {
          won: formatNumber(data.won, lang), converted: formatNumber(data.converted, lang),
        })}</p>
      </>}
    </>}
  </Card>;
}
