"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useOrgNodeOptions } from "@/app/(tenant)/core/hooks/useCoreOptions";
import { COMPARE_MODES, DATE_PRESETS, customDateRangeError, type DashboardFilterSelection, type DashboardOrganizationScope,
  type DashboardPopulationScope } from "../../dashboard-run-contract";

function selectedBranchSet(selection: DashboardFilterSelection, organization: DashboardOrganizationScope | undefined) {
  const companies = new Set(selection.companyIds ?? (selection.companyId ? [selection.companyId] : []));
  const branches = new Set(selection.branchIds ?? (selection.branchId ? [selection.branchId] : []));
  return new Set(organization?.branches.filter(branch => (!companies.size || companies.has(branch.companyId))
    && (!branches.size || branches.has(branch.id))).map(branch => branch.id));
}

function populationOptions(population: DashboardPopulationScope | undefined, branches: ReadonlySet<string>) {
  const inScope = (options: DashboardPopulationScope["teams"] | undefined) => (options ?? [])
    .filter(option => option.branchIds.some(id => branches.has(id)))
    .map(option => ({ value: option.id, label: option.name }));
  return { teamOptions: inScope(population?.teams), ownerOptions: inScope(population?.owners) };
}

export function useDashboardFilters(selection: DashboardFilterSelection, branchIds: readonly string[], currencyCodes: readonly string[],
  disabled: boolean, onChange: (selection: DashboardFilterSelection) => void, organization?: DashboardOrganizationScope,
  population?: DashboardPopulationScope) {
  const branches = useOrgNodeOptions("branches", { enabled: !organization });
  const selectionKey = JSON.stringify([selection.companyId, selection.companyIds, selection.branchId, selection.branchIds, selection.datePreset, selection.dateFrom, selection.dateTo,
    selection.compare, selection.currencyCode, selection.teamIds, selection.ownerUserIds, branchIds]);
  const [editor, setEditor] = useState<{ key: string; selection: DashboardFilterSelection; attempted: boolean; organization?: DashboardOrganizationScope } | null>(null);
  const current = editor?.key === selectionKey && editor.organization === organization ? editor : null;
  if (editor && !current) setEditor(null);
  const draft = current?.selection ?? selection;
  const selectedCompanies = draft.companyIds ?? (draft.companyId ? [draft.companyId] : []);
  const selectedBranches = draft.branchIds ?? (draft.branchId ? [draft.branchId] : []);
  const branchOptions = useMemo(() => {
    if (organization) {
      const companyIds = draft.companyIds ?? (draft.companyId ? [draft.companyId] : []);
      return organization.branches.filter(branch => !companyIds.length || companyIds.includes(branch.companyId))
        .map(branch => ({ value: branch.id, label: companyIds.length === 1 ? branch.name : `${branch.name} · ${branch.companyName}` }));
    }
    const allowed = new Set(branchIds);
    return branches.options.filter((option) => allowed.has(option.value));
  }, [branchIds, branches.options, draft.companyId, draft.companyIds, organization]);
  const companyOptions = organization?.companies.map(company => ({ value: company.id, label: company.name })) ?? [];
  const appliedBranches = selectedBranchSet(selection, organization);
  const draftBranches = selectedBranchSet(draft, organization);
  const populationNeedsRefresh = [...draftBranches].some(id => !appliedBranches.has(id));
  const { teamOptions, ownerOptions } = populationOptions(population, draftBranches);
  const update = (next: DashboardFilterSelection) => {
    if (current && !disabled) setEditor({ ...current, selection: next });
  };
  const updateOrganization = (next: DashboardFilterSelection) => {
    const available = populationOptions(population, selectedBranchSet(next, organization));
    const teams = next.teamIds?.filter(id => available.teamOptions.some(option => option.value === id)) ?? [];
    const owners = next.ownerUserIds?.filter(id => available.ownerOptions.some(option => option.value === id)) ?? [];
    const { teamIds: _teams, ownerUserIds: _owners, ...base } = next;
    update({ ...base, ...(teams.length ? { teamIds: teams } : {}), ...(owners.length ? { ownerUserIds: owners } : {}) });
  };
  const rangeError = draft.datePreset === "CUSTOM" ? customDateRangeError(draft.dateFrom ?? "", draft.dateTo ?? "") : null;
  const close = () => setEditor(null);

  return {
    open: !!current, draft, close,
    show: () => { if (!disabled) setEditor({ key: selectionKey, selection, attempted: false, organization }); },
    branchOptions, companyOptions, selectedCompanies, selectedBranches, branchError: organization ? null : branches.error, retryBranches: branches.retry,
    teamOptions, ownerOptions, populationNeedsRefresh,
    rangeError: current?.attempted ? rangeError : null,
    apply: () => {
      if (!current || disabled) return;
      if (rangeError) { setEditor({ ...current, attempted: true }); return; }
      if (selectedCompanies.some(id => !companyOptions.some(company => company.value === id))) return;
      if (selectedBranches.some(id => !(organization ? branchOptions.some(branch => branch.value === id) : branchIds.includes(id)))) return;
      if (draft.currencyCode && draft.currencyCode !== selection.currencyCode && !currencyCodes.includes(draft.currencyCode)) return;
      close();
      onChange(draft);
    },
    changePreset: (next: string | null) => {
      const datePreset = DATE_PRESETS.find((value) => value === next) ?? null;
      const updated = { ...draft, datePreset };
      if (datePreset !== "CUSTOM") { delete updated.dateFrom; delete updated.dateTo; }
      update(updated);
    },
    changeFrom: (event: ChangeEvent<HTMLInputElement>) => update({ ...draft, dateFrom: event.target.value }),
    changeTo: (event: ChangeEvent<HTMLInputElement>) => update({ ...draft, dateTo: event.target.value }),
    changeCompanies: (next: string[]) => {
      if (next.some(id => !companyOptions.some(company => company.value === id))) return;
      const compatible = selectedBranches.filter(id => organization?.branches.some(branch => branch.id === id
        && (!next.length || next.includes(branch.companyId))));
      const { companyIds: _companies, branchIds: _branches, ...base } = draft;
      updateOrganization({ ...base, companyId: next.length === 1 ? next[0] : null, branchId: compatible.length === 1 ? compatible[0] : null,
        ...(next.length > 1 ? { companyIds: next } : {}), ...(compatible.length > 1 ? { branchIds: compatible } : {}) });
    },
    changeBranches: (next: string[]) => {
      if (next.some(id => !branchOptions.some(branch => branch.value === id))) return;
      const { branchIds: _branches, ...base } = draft;
      updateOrganization({ ...base, branchId: next.length === 1 ? next[0] : null, ...(next.length > 1 ? { branchIds: next } : {}) });
    },
    changeTeams: (next: string[]) => {
      if (next.every(id => draft.teamIds?.includes(id) || teamOptions.some(option => option.value === id))) {
        update({ ...draft, teamIds: next.length ? next : undefined });
      }
    },
    changeOwners: (next: string[]) => {
      if (next.every(id => draft.ownerUserIds?.includes(id) || ownerOptions.some(option => option.value === id))) {
        update({ ...draft, ownerUserIds: next.length ? next : undefined });
      }
    },
    changeCompare: (next: string | null) => update({ ...draft, compare: COMPARE_MODES.find((value) => value === next) ?? null }),
    changeCurrency: (next: string | null) => { if (!next || currencyCodes.includes(next)) update({ ...draft, currencyCode: next }); },
  };
}
