"use client";

import { useId, useState } from "react";
import { Card, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { DurationDistributionGroup } from "../../widget-duration-distribution";
import { formatWidgetValue } from "../../widget-presentation";

const NONE = "none";

export function WonCycleComparison({ groups }: { groups: readonly DurationDistributionGroup[] }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonCycle;
  const id = useId();
  const candidates = groups.filter((group) => group.sampleCount > 0);
  const [selections, setSelections] = useState(() => [candidates[0]?.key ?? NONE, candidates[1]?.key ?? NONE, NONE]);
  const selected = selections.flatMap((key) => candidates.find((group) => group.key === key) ?? []);
  const base = selected[0];
  const days = (value: number | null) => formatWidgetValue(value, "DURATION", null, lang, { numberFormat: "duration-days" });
  return <Card className="space-y-3 p-4">
    <h3 className="text-base font-semibold">{labels.compare}</h3>
    <p className="text-sm text-muted-foreground">{labels.compareDescription}</p>
    {candidates.length < 2 ? <p role="status" className="text-sm text-muted-foreground">{labels.compareUnavailable}</p> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        {selections.map((value, index) => {
          const field = `${id}-${index}`;
          const label = index === 0 ? labels.baseline : formatTemplate(labels.compareBranch, { number: formatNumber(index + 1, lang) });
          return <div className="min-w-0 space-y-1" key={field}>
            <Label htmlFor={field}>{label}</Label>
            <Select value={value} onValueChange={(next) => setSelections((current) => current.map((entry, i) => i === index ? next : entry))}>
              <SelectTrigger id={field}><SelectValue /></SelectTrigger>
              <SelectContent>
                {index === 2 && <SelectItem value={NONE}>{labels.chooseBranch}</SelectItem>}
                {candidates.map((group) => <SelectItem key={group.key} value={group.key}
                  disabled={group.key !== value && selections.includes(group.key)}>{group.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>;
        })}
      </div>
      {selected.length >= 2 && <Table aria-label={labels.compare}><TableHeader><TableRow>
        <TableHead>{t.crmDashboards.branch}</TableHead><TableHead>{t.crmDashboards.typedTable.sampleCount}</TableHead>
        <TableHead>{labels.median}</TableHead><TableHead>{labels.p90}</TableHead><TableHead>{labels.medianDifference}</TableHead>
      </TableRow></TableHeader><TableBody>{selected.map((group) => {
        const difference = group.median === null || base?.median == null ? null : group.median - base.median;
        return <TableRow key={group.key}>
          <TableHead scope="row">{group.label}</TableHead><TableCell>{formatNumber(group.sampleCount, lang)}</TableCell>
          <TableCell>{days(group.median)}</TableCell><TableCell>{days(group.p90)}</TableCell>
          <TableCell>{group.key === base?.key ? labels.baseline : <bdi>{difference !== null && difference > 0 ? "+" : ""}{days(difference)}</bdi>}</TableCell>
        </TableRow>;
      })}</TableBody></Table>}
    </>}
  </Card>;
}
