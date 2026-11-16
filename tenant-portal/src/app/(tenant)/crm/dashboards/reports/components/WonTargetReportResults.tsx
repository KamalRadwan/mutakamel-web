"use client";

import { useState } from "react";
import { CalendarDays, CircleHelp, Target } from "lucide-react";
import { Badge, Card, DateTime, DegradedBanner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  TargetGaugeChart, ToggleGroup, ToggleGroupItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { targetMilliunits, type WonTargetReport } from "../won-target-report-contract";

export function WonTargetReportResults({ result, showExact, showCompare }: {
  result: WonTargetReport; showExact: boolean; showCompare: boolean;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const [selected, setSelected] = useState(() => result.currencies.slice(0, 3).map(row => row.currencyCode));
  const compareRows = result.currencies.filter(row => selected.includes(row.currencyCode));
  const money = (value: string, currency: string) => formatDecimalString(value, lang, {
    style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 3,
  });
  const percentage = (value: string) => formatDecimalString(value, lang, { style: "unit", unit: "percent", unitDisplay: "narrow", maximumFractionDigits: 2 });
  const asPlot = (value: string) => Number(targetMilliunits(value)) / 1000;
  const historyMissing = result.rows.some(row => row.state === "HISTORY_INCOMPLETE");
  const showBranchPace = result.pace === "BRANCH_CALENDAR";
  const workdays = (count: number | null) => count === null ? t.common.noData : formatNumber(count, lang);
  const requiredPace = (row: WonTargetReport["rows"][number]) => row.workingPace.requiredPerWorkday === null
    ? t.common.noData : money(row.workingPace.requiredPerWorkday, row.currencyCode);

  return <>
    {result.partialAccess && <DegradedBanner message={t.crmDashboardReports.branchCohort.partialScope} />}
    {historyMissing && <DegradedBanner message={labels.historyNotice} />}
    <Card className="flex flex-wrap gap-5 p-4 text-sm">
      <div><span className="block text-muted-foreground">{labels.period}</span>
        <bdi>{result.period.start} – {result.period.endExclusive}</bdi> · {labels.periodStates[result.period.state]}</div>
      <div><span className="block text-muted-foreground">{labels.observed}</span><DateTime value={result.asOf} timeZone={result.period.timeZone} /></div>
      {result.coverageStartedAt && <div><span className="block text-muted-foreground">{labels.coverage}</span>
        <DateTime value={result.coverageStartedAt} timeZone={result.period.timeZone} /></div>}
      <div><span className="block text-muted-foreground">{labels.subjectType}</span>{labels.subjects[result.subjectType]}</div>
    </Card>
    {result.state === "EMPTY" ? <Card className="p-4 text-sm text-muted-foreground"><p role="status">{labels.empty}</p></Card> : <>
      {compareRows.length > 0 && <div className={compareRows.length === 3 ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
        {compareRows.map(row => <Card key={row.currencyCode} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2"><Badge tone="neutral">{row.currencyCode}</Badge>
            {row.attainmentPercent !== null && <span className="text-lg font-semibold"><bdi>{percentage(row.attainmentPercent)}</bdi></span>}
          </div>
          <div><p className="text-sm text-muted-foreground">{labels.actual}</p>
            <p className="text-xl font-semibold"><bdi>{row.actualValue === null ? t.common.noData : money(row.actualValue, row.currencyCode)}</bdi></p></div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>{labels.target} <bdi>{money(row.targetValue, row.currencyCode)}</bdi></span>
            {row.remainingValue !== null && <span>{labels.remaining} <bdi>{money(row.remainingValue, row.currencyCode)}</bdi></span>}
          </div>
        </Card>)}
      </div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 space-y-3 p-4 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-base font-semibold"><Target className="size-4" aria-hidden="true" />{labels.comparison}</h3>
          {showCompare && result.currencies.length > 1 && <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{labels.currencyLimit}</p>
            <ToggleGroup type="multiple" value={selected} aria-label={labels.compare} className="flex-wrap"
              onValueChange={ids => { if (ids.length && ids.length <= 3) setSelected(ids); }}>
              {result.currencies.map(row => <ToggleGroupItem key={row.currencyCode} value={row.currencyCode}
                disabled={selected.length >= 3 && !selected.includes(row.currencyCode)}>{row.currencyCode}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>}
          {result.subjectType === "TEAM" && <p role="status" className="text-sm text-muted-foreground">{labels.teamSeparate}</p>}
          {compareRows.map(row => <section key={row.currencyCode} aria-label={row.currencyCode} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="neutral">{row.currencyCode}</Badge>
              <span className="text-sm"><span className="text-muted-foreground">{labels.target} </span><bdi>{money(row.targetValue, row.currencyCode)}</bdi></span>
              {row.attainmentPercent !== null && <Badge tone="neutral"><bdi>{percentage(row.attainmentPercent)}</bdi></Badge>}
            </div>
            {row.actualValue === null ? <p className="text-sm text-muted-foreground">{labels.actualUnavailable}</p>
              : <TargetGaugeChart variant="bullet" label={`${labels.comparison} ${row.currencyCode}`} summary={labels.method}
                value={asPlot(row.actualValue)} target={asPlot(row.targetValue)} valueLabel={money(row.actualValue, row.currencyCode)}
                targetLabel={`${labels.target} ${money(row.targetValue, row.currencyCode)}`}
                formatAxis={value => formatNumber(value, lang, { notation: "compact", style: "currency", currency: row.currencyCode,
                  currencyDisplay: "code", maximumFractionDigits: 2 })} />}
          </section>)}
        </Card>
        <Card className="space-y-3 p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold"><CalendarDays className="size-4" aria-hidden="true" />{labels.paceTitle}</h3>
          <Badge tone="neutral">{labels.paceStates[result.pace]}</Badge>
          <p className="text-sm text-muted-foreground">{labels.paceDescriptions[result.pace]}</p>
          {showBranchPace ? <div className="space-y-2">
            {result.rows.slice(0, 3).map(row => <section key={row.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium"><bdi>{row.branch.name}</bdi>{result.subjectType !== "BRANCH" && <> · <bdi>{row.subjectName ?? labels.subjectUnavailable}</bdi></>}</h4>
                <Badge tone="neutral">{row.currencyCode}</Badge>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2"><dt>{labels.workdays}</dt><dd>{workdays(row.workingPace.remainingWorkdays)}</dd></div>
                <div className="flex justify-between gap-2"><dt>{labels.dailyPace}</dt><dd className="font-semibold tabular-nums"><bdi>{requiredPace(row)}</bdi></dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">{row.workingPace.state === "READY"
                ? <>{labels.calendarRevision} {formatNumber(row.workingPace.calendarRevision!, lang)}</>
                : labels.workingPaceStates[row.workingPace.state]}</p>
            </section>)}
            {result.rows.length > 3 && <p className="text-xs text-muted-foreground">{labels.morePaceRows}</p>}
          </div> : <dl className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between gap-2"><dt>{labels.workdays}</dt><dd>{workdays(result.pace === "PERIOD_CLOSED" ? 0 : null)}</dd></div>
            <div className="flex justify-between gap-2"><dt>{labels.dailyPace}</dt><dd>{t.common.noData}</dd></div>
          </dl>}
        </Card>
      </div>
      {showExact && <Card className="min-w-0 overflow-hidden">
        <h3 className="px-4 py-3 text-base font-semibold">{labels.exact}</h3>
        <Table aria-label={labels.exact}><TableHeader><TableRow>
          <TableHead>{t.crmDashboards.branch}</TableHead><TableHead>{labels.subject}</TableHead><TableHead>{labels.revision}</TableHead>
          <TableHead>{labels.actual}</TableHead><TableHead>{labels.target}</TableHead><TableHead>{labels.attainment}</TableHead>
          <TableHead>{labels.remaining}</TableHead><TableHead>{labels.status}</TableHead>
          {showBranchPace && <><TableHead>{labels.workdays}</TableHead><TableHead>{labels.dailyPace}</TableHead><TableHead>{labels.calendarRevision}</TableHead></>}
        </TableRow></TableHeader><TableBody>{result.rows.map(row => <TableRow key={row.id}>
          <TableHead scope="row"><bdi>{row.branch.name}</bdi><span className="block text-xs text-muted-foreground"><bdi>{row.branch.companyName}</bdi></span></TableHead>
          <TableCell><bdi>{row.subjectName ?? labels.subjectUnavailable}</bdi></TableCell><TableCell>{formatNumber(row.revision, lang)}</TableCell>
          <TableCell><bdi>{row.actualValue === null ? t.common.noData : money(row.actualValue, row.currencyCode)}</bdi></TableCell>
          <TableCell><bdi>{money(row.targetValue, row.currencyCode)}</bdi></TableCell>
          <TableCell><bdi>{row.attainmentPercent === null ? t.common.noData : percentage(row.attainmentPercent)}</bdi></TableCell>
          <TableCell><bdi>{row.remainingValue === null ? t.common.noData : money(row.remainingValue, row.currencyCode)}</bdi></TableCell>
          <TableCell><Badge tone="neutral">{labels.states[row.state]}</Badge>
            {row.excludedCount !== null && row.excludedCount > 0 && <p className="text-xs text-muted-foreground">
              {formatTemplate(labels.excluded, { count: formatNumber(row.excludedCount, lang) })}</p>}</TableCell>
          {showBranchPace && <><TableCell>{workdays(row.workingPace.remainingWorkdays)}</TableCell>
            <TableCell><bdi>{requiredPace(row)}</bdi>{row.workingPace.state !== "READY" &&
              <p className="text-xs text-muted-foreground">{labels.workingPaceStates[row.workingPace.state]}</p>}</TableCell>
            <TableCell>{row.workingPace.calendarRevision === null ? t.common.noData : formatNumber(row.workingPace.calendarRevision, lang)}</TableCell></>}
        </TableRow>)}</TableBody></Table>
      </Card>}
    </>}
    <p className="flex items-start gap-2 text-sm text-muted-foreground"><CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{labels.basisNote}</p>
  </>;
}
