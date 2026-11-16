"use client";
import { Combobox, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { DATE_PRESETS, COMPARE_MODES } from "../../dashboards/dashboard-run-contract";
import { LEAD_SOURCE_GROWTH_METRIC } from "../../dashboards/widget-source-growth";
import type { useWidgetForm } from "../hooks/useWidgetForm";
import { useWidgetFilterOptions } from "../hooks/useWidgetFilterOptions";
import { WidgetSelect } from "./WidgetSelect";
import { invalidWidgetFilter } from "../widget-form-validation";

export function WidgetFilterEditor({ state }: { state: ReturnType<typeof useWidgetForm> }) {
  const { t } = useI18n();
  const labels = t.crmWidgets.review;
  const options = useWidgetFilterOptions();
  const { filters } = state.form;
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">{labels.filtersHint}</p>
    <div className="grid gap-3 sm:grid-cols-2"><WidgetSelect label={t.crmDashboards.datePreset} value={String(filters.datePreset ?? "__inherit__")} disabled={state.disabled}
      options={[{ value: "__inherit__", label: labels.inherit }, ...DATE_PRESETS.map((value) => ({ value, label: t.crmDashboards.datePresets[value] }))]}
      onChange={(value) => state.updateFilter("datePreset", value === "__inherit__" ? undefined : value)} />
      {state.standaloneMetric?.key !== LEAD_SOURCE_GROWTH_METRIC && <WidgetSelect label={t.crmDashboards.compare} value={String(filters.compare ?? "__inherit__")} disabled={state.disabled}
        options={[{ value: "__inherit__", label: labels.inherit }, ...COMPARE_MODES.map((value) => ({ value, label: t.crmDashboards.compareModes[value] }))]}
        onChange={(value) => state.updateFilter("compare", value === "__inherit__" ? undefined : value)} />}</div>
    {filters.datePreset === "CUSTOM" && <div className="grid gap-3 sm:grid-cols-2">{(["dateFrom", "dateTo"] as const).map((key) => <Field showLabel key={key} label={labels[key]} required error={state.touched && (!filters[key] || invalidWidgetFilter(key, filters[key], filters)) ? t.crmWidgets.formErrors.FILTER_INVALID : undefined}>
      <Input type="date" value={String(filters[key] ?? "").slice(0, 10)} disabled={state.disabled} onChange={(event) => state.updateFilter(key, event.target.value)} /></Field>)}</div>}
    <div className="grid gap-3 sm:grid-cols-2"><Field showLabel label={t.crmDashboards.branch} hint={options.branchUnavailable ? labels.pickerUnavailable : undefined}>
      <Combobox textSize="compact" value={typeof filters.branchId === "string" ? filters.branchId : undefined} selectedLabel={options.branches.labelFor(String(filters.branchId)) ?? labels.selectedUnavailable}
        options={options.branches.options} onSearch={options.branches.search} onValueChange={(value) => state.updateFilter("branchId", value)}
        disabled={state.disabled || options.branchUnavailable} loading={options.branches.isLoading} placeholder={labels.inherit} searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={labels.noOptions}
        clearLabel={labels.inherit} errorContent={options.branches.error ? <p className="text-xs text-negative-700">{labels.pickerUnavailable}</p> : undefined} /></Field>
      <Field showLabel label={labels.ownerFilter} hint={options.ownerUnavailable ? labels.pickerUnavailable : undefined}>
        <Combobox value={typeof filters.ownerUserId === "string" ? filters.ownerUserId : undefined} selectedLabel={options.owners.labelFor(String(filters.ownerUserId)) ?? labels.selectedUnavailable}
          options={options.owners.options} onSearch={options.owners.search} onValueChange={(value) => state.updateFilter("ownerUserId", value)}
          disabled={state.disabled || options.ownerUnavailable} loading={options.owners.isLoading} placeholder={labels.inherit} searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={labels.noOptions}
          clearLabel={labels.inherit} errorContent={options.owners.error ? <p className="text-xs text-negative-700">{labels.pickerUnavailable}</p> : undefined} /></Field>
      <WidgetSelect label={labels.pipelineFilter} value={String(filters.pipelineId ?? "__inherit__")} disabled={state.disabled || options.pipelinesUnavailable}
        hint={options.pipelinesError || options.pipelinesUnavailable ? labels.pickerUnavailable : undefined}
        options={[{ value: "__inherit__", label: labels.inherit }, ...options.pipelines, ...(filters.pipelineId && !options.pipelines.some((p) => p.value === filters.pipelineId) ? [{ value: String(filters.pipelineId), label: labels.selectedUnavailable }] : [])]}
        onChange={(value) => state.updateFilter("pipelineId", value === "__inherit__" ? undefined : value)} />
      <Field showLabel label={t.crmDashboards.currency} hint={labels.currencyHint} error={state.touched && invalidWidgetFilter("currencyCode", filters.currencyCode, filters) ? t.crmWidgets.formErrors.FILTER_INVALID : undefined}><Input dir="ltr" value={String(filters.currencyCode ?? "")} maxLength={3} disabled={state.disabled} onChange={(event) => state.updateFilter("currencyCode", event.target.value)} /></Field>
      {(["staleDays", "closingWindowDays", "limit"] as const).map((key) => <Field showLabel key={key} label={labels[key]} hint={key === "limit" ? labels.limitHint : labels.daysHint} error={state.touched && invalidWidgetFilter(key, filters[key], filters) ? t.crmWidgets.formErrors.FILTER_INVALID : undefined}>
        <Input inputMode="numeric" value={String(filters[key] ?? "")} disabled={state.disabled} onChange={(event) => state.updateFilter(key, event.target.value)} /></Field>)}</div>
  </div>;
}
