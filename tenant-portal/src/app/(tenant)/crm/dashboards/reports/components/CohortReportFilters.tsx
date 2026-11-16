"use client";

import { useId, useState } from "react";
import { Button, Card, Field, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { DATE_PRESETS } from "../../dashboard-run-contract";
import { BRANCH_COHORT_DEFAULT_FILTERS, type BranchCohortFilters, type BranchCohortReport } from "../branch-cohort-report-contract";

const ALL = "all";

export function ReportSelect({ label, value, onChange, items }: {
  label: string; value: string; onChange: (value: string) => void; items: ReadonlyArray<{ id: string; name: string }>;
}) {
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function CohortReportFilters({ title, description, options, allBranchesLabel, onApply }: {
  title: string; description: string; options?: Pick<BranchCohortReport, "companies" | "branches">;
  allBranchesLabel?: string;
  onApply: (filters: BranchCohortFilters) => void;
}) {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.branchCohort;
  const [draft, setDraft] = useState(BRANCH_COHORT_DEFAULT_FILTERS);
  const custom = draft.datePreset === "CUSTOM";
  const invalidRange = custom && (!draft.dateFrom || !draft.dateTo || draft.dateFrom > draft.dateTo);
  const branches = options?.branches.filter((branch) => !draft.companyId || draft.companyId === branch.companyId) ?? [];
  return <Card className="space-y-4 p-4">
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (!invalidRange) onApply({ ...draft });
    }}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReportSelect label={t.crmDashboards.datePreset} value={draft.datePreset}
          items={DATE_PRESETS.map((id) => ({ id, name: t.crmDashboards.datePresets[id] }))}
          onChange={(datePreset) => setDraft({ ...draft, datePreset: datePreset as BranchCohortFilters["datePreset"] })} />
        <ReportSelect label={labels.company} value={draft.companyId ?? ALL}
          items={[{ id: ALL, name: labels.allCompanies }, ...(options?.companies ?? [])]}
          onChange={(id) => setDraft({ ...draft, companyId: id === ALL ? null : id, branchId: null })} />
        <ReportSelect label={t.crmDashboards.branch} value={draft.branchId ?? ALL}
          items={[{ id: ALL, name: allBranchesLabel ?? t.crmDashboards.allBranches }, ...branches.map((branch) => ({
            id: branch.id, name: `${branch.name} · ${branch.companyName}`,
          }))]} onChange={(id) => setDraft({ ...draft, branchId: id === ALL ? null : id })} />
        {custom && <>
          <Field label={t.crmDashboards.dateFrom} showLabel>
            <Input type="date" required value={draft.dateFrom} max={draft.dateTo || undefined}
              onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })} />
          </Field>
          <Field label={t.crmDashboards.dateTo} showLabel>
            <Input type="date" required value={draft.dateTo} min={draft.dateFrom || undefined}
              onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })} />
          </Field>
        </>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={invalidRange}>{t.crmDashboards.filters.apply}</Button>
        <Button type="button" variant="outline" onClick={() => {
          setDraft(BRANCH_COHORT_DEFAULT_FILTERS);
          onApply(BRANCH_COHORT_DEFAULT_FILTERS);
        }}>{labels.reset}</Button>
      </div>
    </form>
  </Card>;
}
