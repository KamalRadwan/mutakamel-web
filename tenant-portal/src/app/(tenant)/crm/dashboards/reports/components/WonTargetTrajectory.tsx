"use client";

import { useId, useState } from "react";
import { ChartNoAxesCombined, Database } from "lucide-react";
import { Button, Card, ErrorState, PermissionGate, Skeleton, Table,
  TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import { WonTargetTrajectoryChart } from "../../components/WonTargetTrajectoryChart";
import { useCohortReport } from "../hooks/useBranchCohortReport";
import { parseWonTargetReport, wonTargetQuery, type WonTargetFilters, type WonTargetReport } from "../won-target-report-contract";
import { ReportSelect } from "./CohortReportFilters";

const NONE = "none";

export function WonTargetTrajectory({ report, filters }: { report: WonTargetReport; filters: WonTargetFilters }) {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const [targetId, setTargetId] = useState(NONE);
  const selected = report.rows.find(row => row.id === targetId);
  const items = report.rows.map(row => {
    const subject = report.subjectType === "BRANCH" ? [] : [row.subjectName ?? labels.subjectUnavailable];
    return { id: row.id, name: [row.branch.companyName, row.branch.name, ...subject, row.currencyCode].join(" · ") };
  });

  return <Card className="min-w-0 space-y-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ChartNoAxesCombined className="size-4" aria-hidden="true" />{labels.trajectory.title}
        </h3>
        <p className="text-sm text-muted-foreground">{labels.trajectory.description}</p>
      </div>
      <ReportSelect label={labels.trajectory.target} value={selected?.id ?? NONE}
        items={[{ id: NONE, name: labels.trajectory.select }, ...items]} onChange={setTargetId} />
    </div>
    {selected && <TrajectoryResult key={selected.id} filters={filters} report={report} targetId={selected.id} />}
  </Card>;
}

function TrajectoryResult({ filters, report, targetId }: { filters: WonTargetFilters; report: WonTargetReport; targetId: string }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const [showData, setShowData] = useState(false);
  const tableId = useId();
  const [query] = useState<WonTargetFilters>(() => ({ ...filters, periodStart: report.period.start,
    subjectType: report.subjectType, trajectoryTargetId: targetId }));
  const { result, error, isLoading, reload } = useCohortReport(query, wonTargetQuery(query), parseWonTargetReport);
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (error?.status === 403) return <PermissionGate require={[]} denied>{null}</PermissionGate>;
  if (error) return <ErrorState title={t.crmDashboardReports.loadFailed}
    description={error.code === "CRM_TARGET_SOURCE_NOT_READY" ? labels.sourceUnavailable : t.crmDashboards.actionFailed}
    onRetry={reload} retryLabel={t.common.retry} />;

  const row = result?.rows.find(item => item.id === result.trajectory?.targetId);
  if (!result?.trajectory || !row) return <p role="status" className="text-sm text-muted-foreground">{labels.trajectory.unavailable}</p>;
  const { points } = result.trajectory;
  if (!points.length) return <p role="status" className="text-sm text-muted-foreground">{labels.states[row.state]}</p>;

  const hasPlan = row.workingPace.state === "READY";
  const money = (value: string | null) => value === null ? t.common.noData : formatDecimalString(value, lang,
    { style: "currency", currency: row.currencyCode, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 3 });
  return <>
    <WonTargetTrajectoryChart points={points} pace={row.workingPace} currencyCode={row.currencyCode} target={row.targetValue}
      asOf={result.asOf} timeZone={result.period.timeZone} label={labels.trajectory.title} />
    <Button type="button" variant="outline" aria-expanded={showData} aria-controls={tableId} onClick={() => setShowData(value => !value)}>
      <Database aria-hidden="true" />{labels.trajectory.exact}
    </Button>
    <div id={tableId} hidden={!showData}>{showData && <Table aria-label={labels.trajectory.exact}>
      <TableHeader><TableRow>
        <TableHead>{labels.trajectory.date}</TableHead><TableHead>{labels.trajectory.dailyWon}</TableHead>
        <TableHead>{labels.trajectory.observed}</TableHead>
        {hasPlan && <><TableHead>{labels.trajectory.plan}</TableHead><TableHead>{labels.trajectory.workday}</TableHead></>}
      </TableRow></TableHeader>
      <TableBody>{points.map(point => <TableRow key={point.date}>
        <TableHead scope="row"><bdi>{point.date}</bdi></TableHead>
        <TableCell><bdi>{money(point.wonValue)}</bdi></TableCell><TableCell><bdi>{money(point.observedCumulative)}</bdi></TableCell>
        {hasPlan && <><TableCell><bdi>{money(point.plannedCumulative)}</bdi></TableCell>
          <TableCell>{point.isPlannedWorkday ? labels.trajectory.workday : t.common.noData}</TableCell></>}
      </TableRow>)}</TableBody>
    </Table>}</div>
  </>;
}
