"use client";

import { useId } from "react";
import { Info, ListFilter } from "lucide-react";
import { Badge, Button, Field, FormModal, Input, Label, MultiSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { COMPARE_MODES, DATE_PRESETS, type DashboardFilterSelection, type DashboardOrganizationScope, type DashboardPopulationScope } from "../../dashboard-run-contract";
import { useDashboardFilters } from "../hooks/useDashboardFilters";

interface FilterOption { value: string; label: string }

interface DashboardFilterBarProps {
  selection: DashboardFilterSelection;
  onChange: (selection: DashboardFilterSelection) => void;
  branchIds: readonly string[];
  organization?: DashboardOrganizationScope;
  population?: DashboardPopulationScope;
  currencyCodes: readonly string[];
  disabled: boolean;
  reportDefaultPeriod?: string;
  dashboardSwitcher?: {
    value: string;
    options: readonly FilterOption[];
    onChange: (nextValue: string) => void;
  };
}

const DEFAULT_OPTION = "__dashboard_default__";

function FilterSelect({ label, value, onChange, options, fallbackLabel, disabled }: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
  fallbackLabel?: string;
  disabled: boolean;
}) {
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value ?? DEFAULT_OPTION} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {fallbackLabel && <SelectItem value={DEFAULT_OPTION}>{fallbackLabel}</SelectItem>}
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

const selectionValue = (value: string) => value === DEFAULT_OPTION ? null : value;

function OrganizationPicker({ label, placeholder, values, options, unknownLabel, disabled, onChange }: {
  label: string;
  placeholder: string;
  values: string[];
  options: FilterOption[];
  unknownLabel: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const copy = t.crmDashboards.filters;
  const available = new Set(options.map(option => option.value));
  const staleOptions = values.filter(value => !available.has(value)).map(value => ({ value, label: unknownLabel, disabled: true }));
  return <Field showLabel label={label}>
    <MultiSelect values={values} options={[...options, ...staleOptions]} onValuesChange={onChange} disabled={disabled}
      placeholder={placeholder} searchPlaceholder={t.common.search} emptyLabel={t.common.noData} clearAllLabel={copy.clearScope}
      moreLabel="+{count}" removeLabel={copy.removeScope} overflowLabel={copy.moreScopes} maxVisible={2} />
  </Field>;
}

export function DashboardFilterBar({ selection, onChange, branchIds, organization, population, currencyCodes, disabled, dashboardSwitcher, reportDefaultPeriod }: DashboardFilterBarProps) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboards;
  const companyLabels = t.crmDashboardReports.branchCohort;
  const filters = useDashboardFilters(selection, branchIds, currencyCodes, disabled, onChange, organization, population);
  const { draft } = filters;
  const branchRecord = organization?.branches.find(item => item.id === selection.branchId);
  const branch = branchRecord ? selection.companyId ? branchRecord.name : `${branchRecord.name} · ${branchRecord.companyName}`
    : filters.branchOptions.find(option => option.value === selection.branchId)?.label;
  const company = organization?.companies.find(item => item.id === selection.companyId);
  const companyLabel = selection.companyIds?.length
    ? formatTemplate(labels.filters.companiesSelected, { count: formatNumber(selection.companyIds.length, lang) })
    : selection.companyId ? company?.name ?? labels.filters.selectedCompany : null;
  const scopeLabel = selection.branchIds?.length
    ? formatTemplate(labels.filters.branchesSelected, { count: formatNumber(selection.branchIds.length, lang) })
    : selection.branchId ? branch ?? labels.filters.selectedBranch : labels.allBranches;
  const defaultPeriod = reportDefaultPeriod ?? labels.dashboardDefault;
  const periodLabel = selection.datePreset ? labels.datePresets[selection.datePreset] : defaultPeriod;
  const rangeError = filters.rangeError === "required" ? labels.customRangeRequired : labels.customRangeInvalid;
  const populationNotice = filters.populationNeedsRefresh ? labels.filters.refreshPopulation
    : population?.state === "SOURCE_NOT_READY" ? labels.filters.populationUnavailable
    : population?.state === "TOO_BROAD" ? labels.filters.populationTooBroad : null;

  return <>
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      {dashboardSwitcher && <div className="w-full min-w-0 sm:max-w-xs">
        <FilterSelect label={labels.switchDashboard} value={dashboardSwitcher.value} options={dashboardSwitcher.options}
          disabled={disabled} onChange={dashboardSwitcher.onChange} />
      </div>}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={labels.filters.applied}>
        {companyLabel && <Badge tone="neutral">{companyLabel}</Badge>}
        <Badge tone="neutral">{scopeLabel}</Badge>
        {!!selection.teamIds?.length && <Badge tone="neutral">{formatTemplate(labels.filters.teamsSelected, { count: formatNumber(selection.teamIds.length, lang) })}</Badge>}
        {!!selection.ownerUserIds?.length && <Badge tone="neutral">{formatTemplate(labels.filters.ownersSelected, { count: formatNumber(selection.ownerUserIds.length, lang) })}</Badge>}
        <Badge tone="neutral">{periodLabel}</Badge>
        {selection.compare && <Badge tone="neutral">{labels.compareModes[selection.compare]}</Badge>}
        {selection.currencyCode && <Badge tone="neutral">{selection.currencyCode}</Badge>}
      </div>
      <Button className="ms-auto" size="xl" variant="outline" disabled={disabled} onClick={filters.show}>
        <ListFilter className="size-4" aria-hidden="true" />{labels.filters.title}
      </Button>
    </div>
    <FormModal open={filters.open} onOpenChange={(open) => { if (!open) filters.close(); }}
      title={labels.filters.title} description={labels.filters.description} size="wide" isDirty={false}
      isSubmitting={false} submitDisabled={disabled} onSubmit={filters.apply}
      labels={{ submit: labels.filters.apply, cancel: t.common.cancel,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel, sections: labels.filters.title, sectionInvalid: t.crmWidgets.review.invalidSection }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {(filters.companyOptions.length > 0 || filters.selectedCompanies.length > 0) && <OrganizationPicker
          label={companyLabels.company} placeholder={companyLabels.allCompanies} values={filters.selectedCompanies}
          options={filters.companyOptions} unknownLabel={labels.filters.selectedCompany} disabled={disabled} onChange={filters.changeCompanies} />}
        {organization || draft.branchIds ? <OrganizationPicker label={labels.branch} placeholder={labels.allBranches}
          values={filters.selectedBranches} options={filters.branchOptions} unknownLabel={labels.filters.selectedBranch}
          disabled={disabled} onChange={filters.changeBranches} /> : <FilterSelect label={labels.branch} value={draft.branchId}
          disabled={disabled} fallbackLabel={labels.allBranches} options={filters.branchOptions}
          onChange={value => filters.changeBranches(value === DEFAULT_OPTION ? [] : [value])} />}
        {(population?.state === "READY" || !!draft.teamIds?.length) && <OrganizationPicker
          label={labels.filters.team} placeholder={labels.filters.anyTeam} values={draft.teamIds ?? []} options={filters.teamOptions}
          unknownLabel={labels.filters.team} disabled={disabled} onChange={filters.changeTeams} />}
        {(population?.state === "READY" || !!draft.ownerUserIds?.length) && <OrganizationPicker
          label={labels.filters.owner} placeholder={labels.filters.anyOwner} values={draft.ownerUserIds ?? []} options={filters.ownerOptions}
          unknownLabel={labels.filters.owner} disabled={disabled} onChange={filters.changeOwners} />}
        {population && populationNotice && <p role="status" className="col-span-full flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{populationNotice}
        </p>}
        <FilterSelect label={labels.datePreset} value={draft.datePreset} disabled={disabled} fallbackLabel={defaultPeriod}
          options={DATE_PRESETS.map((value) => ({ value, label: labels.datePresets[value] }))} onChange={(value) => filters.changePreset(selectionValue(value))} />
        {filters.branchError && <div className="col-span-full flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm text-caution-700 dark:text-caution-300">{labels.branchOptionsFailed}</p>
          <Button variant="outline" onClick={filters.retryBranches} disabled={disabled}>{t.common.retry}</Button>
        </div>}
        {draft.datePreset === "CUSTOM" && <>
          <Field showLabel label={labels.dateFrom} error={filters.rangeError ? rangeError : undefined}>
            <Input type="date" value={draft.dateFrom ?? ""} onChange={filters.changeFrom} disabled={disabled} />
          </Field>
          <Field showLabel label={labels.dateTo}>
            <Input type="date" value={draft.dateTo ?? ""} onChange={filters.changeTo} disabled={disabled} aria-invalid={!!filters.rangeError} />
          </Field>
        </>}
        {!reportDefaultPeriod && <FilterSelect label={labels.compare} value={draft.compare} disabled={disabled} fallbackLabel={labels.dashboardDefault}
          options={COMPARE_MODES.map((value) => ({ value, label: labels.compareModes[value] }))} onChange={(value) => filters.changeCompare(selectionValue(value))} />}
        {!reportDefaultPeriod && <FilterSelect label={labels.currency} value={draft.currencyCode} disabled={disabled} fallbackLabel={labels.allCurrencies}
          options={currencyCodes.map((value) => ({ value, label: value }))} onChange={(value) => filters.changeCurrency(selectionValue(value))} />}
      </div>
    </FormModal>
  </>;
}
