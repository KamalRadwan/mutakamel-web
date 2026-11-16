"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChartNoAxesColumn, List } from "lucide-react";
import { Badge, BarChart, Button, Card, DateTime, Field, Input, MultiSelect,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatCivilDateRange } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { civilDateRange } from "../../dashboard-parse";
import type { LeadIntakeAllocation } from "../lead-intake-allocation-contract";

const OWNER_FILLS = ["var(--swatch-blue)", "var(--swatch-purple)", "var(--swatch-teal)", "var(--color-brand-500)", "var(--swatch-slate)"];

function OwnerSelection({ options, selected, onCompare }: {
  options: NonNullable<LeadIntakeAllocation["intake"]>["ownerOptions"];
  selected: string[];
  onCompare: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.intakeAllocation;
  const [draft, setDraft] = useState(selected);
  const changed = draft.length !== selected.length || draft.some((id, index) => id !== selected[index]);
  return <div className="flex flex-wrap items-end gap-2">
    <Field showLabel label={labels.compareReps} className="min-w-48 flex-1">
      <MultiSelect values={draft} options={options.map(rep => ({ value: rep.ownerId, label: rep.name ?? labels.unknownOwner,
        disabled: draft.length >= 3 && !draft.includes(rep.ownerId) }))}
        onValuesChange={next => { if (next.length <= 3) setDraft(next); }} placeholder={labels.compareReps}
        searchPlaceholder={t.common.search} emptyLabel={t.common.noData} maxVisible={3}
        clearAllLabel={t.crmDashboards.filters.clearScope} removeLabel={t.crmDashboards.filters.removeScope}
        moreLabel="+{count}" overflowLabel={t.crmDashboards.filters.moreScopes} />
    </Field>
    <Button type="button" variant="outline" disabled={!draft.length || !changed} onClick={() => onCompare(draft)}>
      {t.crmDashboards.filters.apply}
    </Button>
  </div>;
}

export function IntakeAllocationCharts({ result, onCompare }: { result: LeadIntakeAllocation; onCompare: (ids: string[]) => void }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.intakeAllocation;
  const { intake, range } = result;
  const number = (value: number) => formatNumber(value, lang);
  const dateRange = formatCivilDateRange(range.from, range.to, lang);
  const notice = intake ? labels.empty : labels.unavailable;
  const rows = intake ? [
    ...intake.comparison.map(row => ({ key: row.ownerId, label: row.name ?? labels.unknownOwner, value: row.created })),
    { key: "other", label: labels.otherOwners, value: intake.other },
    { key: "unassigned", label: labels.unassigned, value: intake.unassigned },
  ] : [];
  const series = rows.map((row, index) => ({ key: row.key, label: row.label, role: "brand" as const,
    fill: row.key === "unassigned" ? OWNER_FILLS[4] : row.key === "other" ? OWNER_FILLS[3] : OWNER_FILLS[index] }));
  return <>
    <Card role="region" aria-label={labels.distribution} className="min-w-0 space-y-3 p-4 xl:col-span-2">
      <div><h3 className="flex items-center gap-2 text-lg font-semibold">
        <ChartNoAxesColumn className="size-5 shrink-0 text-primary" aria-hidden="true" />{labels.distribution}</h3>
        <p className="text-sm text-muted-foreground"><bdi>{dateRange}</bdi></p></div>
      {intake && <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(0,3fr)_minmax(10rem,1fr)]">
        <div className="grid content-center gap-2 rounded-lg border border-border bg-muted p-4 text-center">
          <dl className="grid gap-1">
            <dt className="text-sm font-semibold">{labels.totalIntake}</dt>
            <dd className="text-4xl font-semibold tabular-nums lg:text-5xl"><bdi>{number(intake.total)}</bdi></dd>
          </dl>
          {intake.total > 0 && intake.unassigned === 0 &&
            <p className="text-sm text-muted-foreground">{labels.allVisibleAssigned}</p>}
        </div>
        {intake.total > 0 && <div className="min-w-0">
          <BarChart data={rows.map(row => ({ label: row.label, [row.key]: row.value }))}
            xKey="label" height={220} label={labels.distribution} summary={t.crmDashboards.chartExactTable}
            stacked showValues showLegend={false} valueAxes={{ LEFT: { integers: true } }} series={series} />
        </div>}
        <dl className="grid content-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
          {rows.map((row, index) => <div key={row.key} className="flex items-start justify-between gap-2">
            <dt className="flex min-w-0 items-start gap-2">
              <span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: series[index].fill }} />
              <bdi className="break-words">{row.label}</bdi>
            </dt>
            <dd className="font-semibold tabular-nums">{number(row.value)}</dd>
          </div>)}
        </dl>
      </div>}
      {!intake?.total && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </Card>
    <Card role="region" aria-label={labels.comparison} className="min-w-0 space-y-3 p-4">
      <div><h3 className="flex items-center gap-2 text-lg font-semibold">
        <ChartNoAxesColumn className="size-5 shrink-0 text-primary" aria-hidden="true" />{labels.comparison}</h3>
        <p className="text-sm text-muted-foreground"><bdi>{dateRange}</bdi> · {t.crmDashboards.cohortObservedAt}{" "}
          <DateTime value={result.asOf} timeZone={range.timeZone} /></p></div>
      {intake?.comparison.length ? <>
        {intake.ownerOptions.length > 1 && <OwnerSelection key={intake.comparison.map(rep => rep.ownerId).join(",")}
          options={intake.ownerOptions} selected={intake.comparison.map(rep => rep.ownerId)} onCompare={onCompare} />}
        <div className="grid min-w-0 items-start gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,1fr)]">
          <div className="min-w-0"><BarChart data={intake.comparison.map(row => ({
            label: row.name ?? labels.unknownOwner, created: row.created, converted: row.converted, remaining: row.remaining,
          }))} xKey="label" height={205} label={labels.comparison} summary={t.crmDashboards.chartExactTable} showValues
          valueAxes={{ LEFT: { integers: true } }} series={[
            { key: "created", label: labels.created, role: "brand", fill: "var(--swatch-blue)" },
            { key: "converted", label: labels.converted, role: "brand", fill: "var(--swatch-purple)" },
            { key: "remaining", label: labels.remaining, role: "brand", fill: "var(--swatch-teal)" },
          ]} /></div>
          <Table aria-label={labels.comparison} className="table-fixed text-xs sm:text-sm [&_td]:px-1.5 [&_th]:px-1.5 [&_th[scope=row]]:break-words [&_th[scope=row]]:normal-case max-sm:[&_th]:break-words max-sm:[&_th]:normal-case max-sm:[&_th]:tracking-normal max-[383px]:[&_td]:px-0.5 max-[383px]:[&_th]:px-0.5">
            <colgroup>
              <col className="max-[383px]:w-[20%]" />
              <col className="max-[383px]:w-[20%]" />
              <col className="max-[383px]:w-[30%]" />
              <col className="max-[383px]:w-[30%]" />
            </colgroup>
            <TableHeader><TableRow><TableHead>{labels.rep}</TableHead><TableHead>{labels.created}</TableHead>
              <TableHead>{labels.converted}</TableHead><TableHead>{labels.remaining}</TableHead></TableRow></TableHeader>
            <TableBody>
              {intake.comparison.map(row => <TableRow key={row.ownerId}>
                <TableHead scope="row"><bdi>{row.name ?? labels.unknownOwner}</bdi></TableHead>
                <TableCell>{number(row.created)}</TableCell><TableCell>{number(row.converted)}</TableCell><TableCell>{number(row.remaining)}</TableCell>
              </TableRow>)}
              <TableRow className="bg-muted [&_td]:font-semibold"><TableHead scope="row">
                <span className="hidden min-[384px]:inline">{labels.selectedTotal}</span>
                <span className="min-[384px]:hidden">{labels.compactTotal}</span>
              </TableHead>
                <TableCell>{number(intake.comparisonTotals.created)}</TableCell><TableCell>{number(intake.comparisonTotals.converted)}</TableCell>
                <TableCell>{number(intake.comparisonTotals.remaining)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        {(intake.comparisonTotals.invalidIntervals > 0 || intake.comparisonTotals.missingConversionDates > 0) &&
          <p role="note" className="text-sm text-muted-foreground">{formatTemplate(labels.dateEvidence, {
            invalid: number(intake.comparisonTotals.invalidIntervals), missing: number(intake.comparisonTotals.missingConversionDates),
          })}</p>}
      </> : <p role="status" className="text-sm text-muted-foreground">{intake ? labels.noReps : notice}</p>}
    </Card>
  </>;
}

export function UnassignedIntakeQueue({ result, hasPrevious, onPrevious, onNext, onPeriod }: {
  result: LeadIntakeAllocation; hasPrevious: boolean; onPrevious: () => void; onNext: (cursor: string) => void;
  onPeriod: (period: { dateFrom: string; dateTo: string }) => void;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.intakeAllocation;
  const { queue, scope } = result;
  const number = (value: number) => formatNumber(value, lang);
  const rows = queue.rows.map(row => ({
    ...row,
    branch: scope.branchById.get(row.branchId)?.name,
    source: (lang === "ar" ? row.sourceNameAr : row.sourceNameEn) ?? t.common.noData,
  }));
  return <Card role="region" aria-label={labels.queue} className="min-w-0 space-y-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="flex items-center gap-2 text-lg font-semibold">
        <List className="size-5 shrink-0 text-primary" aria-hidden="true" />{labels.queue}</h3>
        <p className="text-sm text-muted-foreground"><bdi>{formatCivilDateRange(queue.range.from, queue.range.to, lang)}</bdi></p></div>
      {queue.total !== null && <Badge tone="neutral">{formatTemplate(labels.queueTotal, { count: number(queue.total) })}</Badge>}
    </div>
    {queue.partialAccess && <p role="note" className="text-sm text-muted-foreground">{labels.queuePartial}</p>}
    {queue.state !== "UNAVAILABLE" && <QueuePeriod key={queue.range.from + queue.range.to}
      range={queue.range} onPeriod={onPeriod} />}
    {rows.length ? <>
      <ul role="list" aria-label={labels.queue} className="space-y-2 min-[384px]:hidden">
        {rows.map(row => <li key={row.id} className="min-w-0 space-y-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <QueueLeadLink id={row.id} title={row.title ?? labels.unnamedLead} />
            <Badge tone="positive" className="shrink-0">{labels.open}</Badge>
          </div>
          <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.crmDashboards.branch}</dt>
              <dd className="break-words"><bdi>{row.branch}</bdi></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.source}</dt>
              <dd className="break-words"><bdi>{row.source}</bdi></dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">{labels.createdDate}</dt>
              <dd><DateTime value={row.createdAt} timeZone={queue.range.timeZone} precision="date" /></dd></div>
          </dl>
        </li>)}
      </ul>
      <div className="hidden min-[384px]:block">
        <Table aria-label={labels.queue} className="max-sm:table-fixed max-sm:text-xs max-sm:[&_th]:break-words max-sm:[&_th]:px-1 max-sm:[&_th]:normal-case max-sm:[&_th]:tracking-normal max-sm:[&_td]:px-1">
          <TableHeader><TableRow><TableHead className="max-sm:w-[32%]">{labels.lead}</TableHead>
            <TableHead className="max-sm:w-[15%]">{t.crmDashboards.branch}</TableHead>
            <TableHead className="max-sm:w-[15%]">{labels.source}</TableHead>
            <TableHead className="max-sm:w-[21%]">{labels.createdDate}</TableHead>
            <TableHead className="max-sm:w-[17%]">{labels.status}</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(row => <TableRow key={row.id}>
            <TableHead scope="row" className="normal-case"><QueueLeadLink id={row.id} title={row.title ?? labels.unnamedLead} /></TableHead>
            <TableCell className="break-words"><bdi>{row.branch}</bdi></TableCell>
            <TableCell className="break-words"><bdi>{row.source}</bdi></TableCell>
            <TableCell><DateTime value={row.createdAt} timeZone={queue.range.timeZone} precision="date" /></TableCell>
            <TableCell><Badge tone="positive" className="max-sm:px-1">{labels.open}</Badge></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
    </> : <p role="status" className="text-sm text-muted-foreground">
      {queue.state === "UNAVAILABLE" ? labels.queueUnavailable : labels.queueEmpty}
    </p>}
    {(hasPrevious || queue.rows.length > 0) && <div className="flex flex-wrap items-center justify-between gap-2">
      <Button size="xl" variant="outline" disabled={!hasPrevious} onClick={onPrevious}>{labels.previous}</Button>
      <span className="text-sm text-muted-foreground">{formatTemplate(labels.pageCount, { count: number(queue.rows.length) })}</span>
      <Button size="xl" variant="outline" disabled={!queue.nextCursor}
        onClick={() => { if (queue.nextCursor) onNext(queue.nextCursor); }}>{labels.next}</Button>
    </div>}
  </Card>;
}

function QueueLeadLink({ id, title }: { id: string; title: string }) {
  return <Link href={`/crm/leads/${id}`} className="min-w-0 break-words text-primary underline-offset-4 hover:underline">
    <bdi>{title}</bdi>
  </Link>;
}

function QueuePeriod({ range, onPeriod }: {
  range: LeadIntakeAllocation["queue"]["range"]; onPeriod: (period: { dateFrom: string; dateTo: string }) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  return <details className="text-sm">
    <summary className="cursor-pointer py-2 text-primary">{t.crmDashboardReports.intakeAllocation.changeQueuePeriod}</summary>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault();
      if (civilDateRange({ from, to })) onPeriod({ dateFrom: from, dateTo: to });
    }} aria-labelledby={id}>
      <span id={id} className="sr-only">{t.crmDashboardReports.intakeAllocation.changeQueuePeriod}</span>
      <Field showLabel label={t.crmDashboards.dateFrom}><Input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field>
      <Field showLabel label={t.crmDashboards.dateTo}><Input type="date" value={to} onChange={event => setTo(event.target.value)} /></Field>
      <Button type="submit" variant="outline" disabled={!civilDateRange({ from, to })}>{t.crmDashboards.filters.apply}</Button>
    </form>
  </details>;
}
