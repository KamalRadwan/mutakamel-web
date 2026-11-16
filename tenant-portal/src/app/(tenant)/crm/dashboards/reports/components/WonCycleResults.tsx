"use client";

import { CalendarClock, ChartColumn, Layers, Trophy } from "lucide-react";
import { BarChart, Card, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type CartesianSeries } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { BoxPlotChartView } from "../../[id]/components/WidgetBoxPlotChart";
import { DURATION_STATISTICS } from "../../widget-duration-distribution";
import { formatWidgetValue } from "../../widget-presentation";
import { COLORFUL_SWATCH_FILLS } from "../../widget-view";
import type { WonCycleReport } from "../won-cycle-report-contract";

const SERIES_LIMIT = 8;
const DAYS_FORMAT = { numberFormat: "duration-days" };
type AvailableReport = Extract<WonCycleReport, { distribution: NonNullable<WonCycleReport["distribution"]> }>;

export function WonCycleResults({ report, showExact }: { report: AvailableReport; showExact: boolean }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonCycle;
  const { totals, distribution, values } = report;
  const groups = distribution.groups.filter((group) => group.sampleCount > 0);
  const visible = groups.slice(0, SERIES_LIMIT);
  const included = new Set(visible.map(({ key }) => key));
  const withOther = groups.length > visible.length;
  const observed = values.map(({ minutes, counts }) => ({ minutes, counts: new Map(counts.map(({ branchId, count }) => [branchId, count])) }));
  const number = (value: number) => formatNumber(value, lang);
  const days = (value: number | null) => value === null ? t.common.noData : formatWidgetValue(value, "DURATION", null, lang, DAYS_FORMAT);
  const exact = (value: number | null) => value === null ? t.common.noData : formatNumber(value, lang,
    { style: "unit", unit: "minute", unitDisplay: "short", maximumFractionDigits: 20 });
  const chart = observed.map(({ minutes, counts }) => ({
    label: formatNumber(minutes / 1440, lang, { maximumFractionDigits: 12 }),
    ...Object.fromEntries(visible.map(({ key }) => [key, counts.get(key) ?? 0])),
    other: [...counts].reduce((sum, [key, count]) => sum + (included.has(key) ? 0 : count), 0),
  }));
  const series: CartesianSeries[] = visible.map(({ key, label }, index) => ({ key, label, role: "brand", fill: COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length] }));
  if (withOther) series.push({ key: "other", label: labels.otherBranches, role: "brand", fill: "var(--swatch-slate)" });

  return <>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={labels.events} value={totals.sampleCount + totals.excludedCount} icon={Trophy} />
      <StatCard label={labels.median} value={days(totals.median)} icon={CalendarClock} />
      <StatCard label={labels.p90} value={days(totals.p90)} icon={ChartColumn} />
      <StatCard label={labels.branches} value={groups.length} icon={Layers} />
    </div>
    {report.state === "EMPTY" ? <p role="status" className="text-sm text-muted-foreground">{labels.empty}</p> :
      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="min-w-0 space-y-3 p-4">
          <h3 className="text-base font-semibold">{labels.frequency}</h3>
          <p className="text-sm text-muted-foreground">{labels.frequencyBasis}</p>
          {chart.length ? <BarChart data={chart} xKey="label" series={series} stacked showLegend showValues={chart.length <= 8 && series.length <= 4}
            label={labels.frequency} summary={t.crmDashboards.chartExactTable} height={260} valueAxes={{ LEFT: { integers: true } }} />
            : <p role="status" className="text-sm text-muted-foreground">{labels.emptyPage}</p>}
        </Card>
        <Card className="min-w-0 space-y-3 p-4">
          <h3 className="text-base font-semibold">{labels.quartiles}</h3>
          <BoxPlotChartView data={distribution} label={labels.quartiles} displaySpec={DAYS_FORMAT} />
        </Card>
      </div>}
    {showExact && distribution.groups.length > 0 && <Card className="min-w-0 overflow-hidden">
      <h3 className="px-4 py-3 text-base font-semibold">{labels.exact}</h3>
      <Table aria-label={labels.exact}><TableHeader><TableRow>
        <TableHead>{t.crmDashboards.branch}</TableHead><TableHead>{t.crmDashboards.typedTable.sampleCount}</TableHead>
        <TableHead>{t.crmDashboards.typedTable.excludedCount}</TableHead>
        {DURATION_STATISTICS.map((key) => <TableHead key={key}>{t.crmDashboards.typedTable[key]}</TableHead>)}
        {observed.map(({ minutes }) => <TableHead key={minutes}><bdi>{exact(minutes)}</bdi></TableHead>)}
      </TableRow></TableHeader><TableBody>
        {[...distribution.groups, { ...totals, key: "pooled", label: t.crmDashboardReports.branchCohort.total }].map((group) => <TableRow key={group.key}>
          <TableHead scope="row">{group.label}</TableHead><TableCell>{number(group.sampleCount)}</TableCell><TableCell>{number(group.excludedCount)}</TableCell>
          {DURATION_STATISTICS.map((key) => <TableCell key={key}><bdi>{exact(group[key])}</bdi></TableCell>)}
          {observed.map(({ minutes, counts }) => <TableCell key={minutes}>{number(group.key === "pooled"
            ? [...counts.values()].reduce((sum, value) => sum + value, 0) : counts.get(group.key) ?? 0)}</TableCell>)}
        </TableRow>)}
      </TableBody></Table>
    </Card>}
  </>;
}
