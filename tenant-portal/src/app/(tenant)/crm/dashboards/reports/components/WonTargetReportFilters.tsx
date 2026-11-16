"use client";

import { useState } from "react";
import { Button, Card, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alignedTargetPeriod, TARGET_GRAINS, TARGET_SUBJECTS, WON_TARGET_DEFAULT_FILTERS,
  type WonTargetFilters, type WonTargetReport } from "../won-target-report-contract";
import { ReportSelect } from "./CohortReportFilters";

const ALL = "all";

export function WonTargetReportFilters({ filters, options, result, onApply }: {
  filters: WonTargetFilters;
  options?: Pick<WonTargetReport, "companies" | "branches">;
  result?: WonTargetReport;
  onApply: (filters: WonTargetFilters) => void;
}) {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.wonTarget;
  const [draft, setDraft] = useState(filters);
  const valid = !draft.periodStart || alignedTargetPeriod(draft.periodStart, draft.periodGrain);
  const branches = options?.branches.filter(branch => !draft.companyId || branch.companyId === draft.companyId) ?? [];
  const sameReport = result && result.subjectType !== "BRANCH" && draft.subjectType === filters.subjectType
    && draft.periodGrain === filters.periodGrain && draft.periodStart === filters.periodStart
    && draft.companyId === filters.companyId && draft.branchId === filters.branchId;
  const subjects = sameReport ? [...new Map(result.rows.map(row => [row.subjectId, {
    id: row.subjectId, name: row.subjectName ?? labels.subjectUnavailable,
  }])).values()] : [];

  return <Card className="space-y-4 p-4">
    <div>
      <h2 className="text-lg font-semibold text-foreground">{labels.title}</h2>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
    </div>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (valid) onApply({ ...draft }); }}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportSelect label={labels.grain} value={draft.periodGrain}
          items={TARGET_GRAINS.map(id => ({ id, name: labels.grains[id] }))}
          onChange={id => setDraft({ ...draft, periodGrain: id as WonTargetFilters["periodGrain"], periodStart: "", subjectId: null })} />
        <Field label={labels.periodStart} showLabel error={valid ? undefined : labels.invalidPeriod}>
          <Input type="date" min="2000-01-01" max="2100-12-01" value={draft.periodStart}
            onChange={event => setDraft({ ...draft, periodStart: event.target.value, subjectId: null })} />
        </Field>
        <ReportSelect label={t.crmDashboardReports.branchCohort.company} value={draft.companyId ?? ALL}
          items={[{ id: ALL, name: t.crmDashboardReports.branchCohort.allCompanies }, ...(options?.companies ?? [])]}
          onChange={id => setDraft({ ...draft, companyId: id === ALL ? null : id, branchId: null, subjectId: null })} />
        <ReportSelect label={t.crmDashboards.branch} value={draft.branchId ?? ALL}
          items={[{ id: ALL, name: t.crmDashboards.allBranches }, ...branches.map(branch => ({ id: branch.id, name: `${branch.name} · ${branch.companyName}` }))]}
          onChange={id => setDraft({ ...draft, branchId: id === ALL ? null : id, subjectId: null })} />
        <ReportSelect label={labels.subjectType} value={draft.subjectType ?? ALL}
          items={[{ id: ALL, name: labels.subjectAuto }, ...TARGET_SUBJECTS.map(id => ({ id, name: labels.subjects[id] }))]}
          onChange={id => setDraft({ ...draft, subjectType: id === ALL ? null : id as WonTargetFilters["subjectType"], subjectId: null })} />
        {subjects.length > 0 && result && <ReportSelect label={labels.subject} value={draft.subjectId ?? ALL}
          items={[{ id: ALL, name: labels.allSubjects }, ...subjects]}
          onChange={id => setDraft({ ...draft, subjectType: id === ALL ? draft.subjectType : result.subjectType, subjectId: id === ALL ? null : id })} />}
      </div>
      <p className="text-xs text-muted-foreground">{labels.periodHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid}>{t.crmDashboards.filters.apply}</Button>
        <Button type="button" variant="outline" onClick={() => {
          setDraft(WON_TARGET_DEFAULT_FILTERS);
          onApply(WON_TARGET_DEFAULT_FILTERS);
        }}>{t.crmDashboardReports.branchCohort.reset}</Button>
      </div>
    </form>
  </Card>;
}
