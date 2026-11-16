"use client";

import { useId, useState } from "react";
import { Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { TeamCohortReport } from "../team-cohort-report-contract";

const NONE = "none";
const BRANCH_LIMIT = 20;

export function TeamCohortSelection({ options, selected, onApply }: {
  options: TeamCohortReport["teamOptions"]; selected: string[]; onApply: (ids: string[]) => void;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.teamCohort;
  const id = useId();
  const [draft, setDraft] = useState(() => [selected[0] ?? NONE, selected[1] ?? NONE, selected[2] ?? NONE]);
  const requested = draft.filter((value) => value !== NONE);
  return <Card className="space-y-3 p-4">
    <h3 className="text-base font-semibold">{labels.compare}</h3>
    <p className="text-sm text-muted-foreground">{labels.selectTeams}</p>
    <div className="grid gap-3 sm:grid-cols-3">
      {draft.map((value, index) => {
        const field = `${id}-${index}`;
        return <div key={field} className="min-w-0 space-y-1">
          <Label htmlFor={field}>{formatTemplate(labels.teamNumber, { number: formatNumber(index + 1, lang) })}</Label>
          <Select value={value} onValueChange={(next) => setDraft((current) => current.map((entry, i) => i === index ? next : entry))}>
            <SelectTrigger id={field}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{labels.chooseTeam}</SelectItem>
              {options.map((team) => <SelectItem key={team.id} value={team.id} disabled={team.id !== value && draft.includes(team.id)}>{team.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>;
      })}
    </div>
    <Button type="button" variant="outline" disabled={requested.length === 0} onClick={() => onApply(requested)}>{t.crmDashboards.filters.apply}</Button>
  </Card>;
}

export function TeamCohortBranchSelection({ options, selected, onApply }: {
  options: TeamCohortReport["branches"]; selected: string[]; onApply: (ids: string[]) => void;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.teamCohort;
  const id = useId();
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visible = options.filter((branch) => `${branch.name} ${branch.companyName}`.toLocaleLowerCase().includes(query));
  return <Card className="space-y-3 p-4">
    <h3 className="text-base font-semibold">{labels.selectBranches}</h3>
    <p className="text-sm text-muted-foreground">{formatTemplate(labels.branchLimit, { count: formatNumber(draft.length, lang) })}</p>
    <div className="space-y-1"><Label htmlFor={id}>{labels.searchBranches}</Label>
      <Input id={id} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="grid max-h-52 gap-2 overflow-auto sm:grid-cols-2">{visible.map((branch) => {
      const checked = draft.includes(branch.id);
      const field = `${id}-${branch.id}`;
      return <div key={branch.id} className="flex items-center gap-2">
        <Checkbox id={field} checked={checked} disabled={!checked && draft.length >= BRANCH_LIMIT}
          onCheckedChange={(value) => setDraft((current) => {
            if (value !== true) return current.filter((entry) => entry !== branch.id);
            return current.includes(branch.id) || current.length >= BRANCH_LIMIT ? current : [...current, branch.id];
          })} />
        <Label htmlFor={field}>{branch.name} · {branch.companyName}</Label>
      </div>;
    })}</div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => onApply(draft)}>{t.crmDashboards.filters.apply}</Button>
      <Button type="button" variant="outline" onClick={() => onApply([])}>{t.crmDashboards.allBranches}</Button>
    </div>
  </Card>;
}
