"use client";

import { Funnel, Layers, Users } from "lucide-react";
import { Badge, BarChart, Card, DateTime, StatCard, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { TeamCohortReport } from "../team-cohort-report-contract";

type AvailableReport = Extract<TeamCohortReport, { totals: NonNullable<TeamCohortReport["totals"]> }>;

export function TeamCohortResults({ result, showExact }: { result: AvailableReport; showExact: boolean }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.teamCohort;
  const { rows, totals, overlapByTeamCount } = result;
  const number = (value: number) => formatNumber(value, lang);
  const percentage = (value: number | null) => value === null ? t.common.noData
    : formatNumber(value / 100, lang, { style: "percent", maximumFractionDigits: 2 });
  const formula = (values: number[], duplicate: number, total: number) => values.length > 1
    ? `\u2066${values.map(number).join(" + ")} − ${number(duplicate)} = ${number(total)}\u2069` : undefined;
  const branchCount = new Set(rows.flatMap((row) => row.team.branchIds)).size;
  const data = rows.map(({ team, created, converted }) => ({ label: team.label, created, converted }));

  return <>
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label={labels.uniqueCreated} value={totals.created} description={formula(rows.map((row) => row.created), totals.duplicateCreated, totals.created)} icon={Users} />
      <StatCard label={labels.uniqueConverted} value={totals.converted} description={formula(rows.map((row) => row.converted), totals.duplicateConverted, totals.converted)} icon={Funnel} />
      <StatCard label={labels.rate} value={percentage(totals.rate)} icon={Layers} description={formatTemplate(labels.rateDenominator,
        { converted: number(totals.converted), created: number(totals.created) })} />
    </div>
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="min-w-0 space-y-3 p-4 lg:col-span-2">
        <h3 className="text-base font-semibold">{labels.chart}</h3>
        {result.state === "EMPTY" ? <p role="status" className="text-sm text-muted-foreground">{labels.empty}</p>
          : <BarChart data={data} xKey="label" height={240} label={labels.chart} summary={t.crmDashboards.chartExactTable}
            valueAxes={{ LEFT: { integers: true } }} showValues series={[
              { key: "created", label: labels.created, role: "brand", fill: "var(--swatch-blue)" },
              { key: "converted", label: labels.converted, role: "positive", fill: "var(--swatch-purple)" },
            ]} />}
        <div className="flex flex-wrap gap-2">{rows.map((row) => <Badge key={row.team.id} tone="neutral">
          <bdi>{row.team.label}</bdi> · <bdi>{percentage(row.rate)}</bdi>
        </Badge>)}</div>
      </Card>
      <Card className="space-y-3 p-4">
        <h3 className="text-base font-semibold">{labels.basis}</h3>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-muted-foreground">{labels.creationPeriod}</dt><dd><bdi>{result.from} – {result.to}</bdi></dd></div>
          <div><dt className="text-muted-foreground">{labels.membership}</dt><dd>{labels.currentCoverage}</dd></div>
          <div><dt className="text-muted-foreground">{t.crmDashboards.cohortObservedAt}</dt><dd><DateTime value={result.asOf} timeZone={result.timeZone} /></dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">{labels.nonAdditive}</p>
      </Card>
    </div>
    {showExact && <Card className="min-w-0 overflow-hidden">
      <h3 className="px-4 py-3 text-base font-semibold">{labels.exact}</h3>
      <Table aria-label={labels.exact}><TableHeader><TableRow>
        <TableHead>{labels.team}</TableHead><TableHead>{labels.created}</TableHead><TableHead>{labels.converted}</TableHead>
        <TableHead>{labels.rate}</TableHead><TableHead>{labels.activeSellers}</TableHead><TableHead>{labels.perSeller}</TableHead>
      </TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.team.id}>
        <TableHead scope="row">{row.team.label}</TableHead><TableCell>{number(row.created)}</TableCell><TableCell>{number(row.converted)}</TableCell>
        <TableCell>{percentage(row.rate)}</TableCell><TableCell><Badge tone="neutral">{labels.unavailableShort}</Badge></TableCell>
        <TableCell>{labels.unavailableShort}</TableCell>
      </TableRow>)}<TableRow className="bg-muted">
        <TableHead scope="row">{labels.total}</TableHead><TableCell>{number(totals.created)}</TableCell><TableCell>{number(totals.converted)}</TableCell>
        <TableCell>{percentage(totals.rate)}</TableCell><TableCell>{labels.unavailableShort}</TableCell><TableCell>{labels.unavailableShort}</TableCell>
      </TableRow></TableBody></Table>
    </Card>}
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="space-y-2 p-4"><h3 className="text-sm font-semibold">{labels.scope}</h3>
        <p className="text-sm text-muted-foreground">{formatTemplate(labels.scopeCounts, { teams: number(rows.length), branches: number(branchCount) })}</p></Card>
      <Card className="space-y-2 p-4"><h3 className="text-sm font-semibold">{labels.overlap}</h3>
        <p className="text-sm text-muted-foreground">{formatTemplate(labels.overlapCounts,
          { created: number(totals.overlapCreated), converted: number(totals.overlapConverted) })}</p>
        <p className="text-xs text-muted-foreground">{formatTemplate(labels.removedCounts,
          { created: number(totals.duplicateCreated), converted: number(totals.duplicateConverted) })}</p>
        {rows.length === 3 && <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
          <li>{formatTemplate(labels.exactlyTwoTeams, { created: number(overlapByTeamCount.exactlyTwo.created),
            converted: number(overlapByTeamCount.exactlyTwo.converted) })}</li>
          <li>{formatTemplate(labels.exactlyThreeTeams, { created: number(overlapByTeamCount.exactlyThree.created),
            converted: number(overlapByTeamCount.exactlyThree.converted) })}</li>
        </ul>}
      </Card>
      <Card className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{labels.activeSellers}</h3>
        <Switch disabled checked={false} aria-label={labels.activeSellers} /></div>
        <p className="text-sm text-muted-foreground">{labels.normalizationUnavailable}</p></Card>
    </div>
  </>;
}
