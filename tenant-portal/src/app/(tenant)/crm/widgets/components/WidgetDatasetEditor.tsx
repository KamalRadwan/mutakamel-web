"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Combobox, Field, Input } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useOrgNodeOptions } from "@/app/(tenant)/core/hooks/useCoreOptions";
import { DATE_PRESETS } from "../../dashboards/dashboard-run-contract";
import type { ComparisonDatasetBasis, ComparisonDatasetSelection } from "../../dashboards/widget-contract";
import type { useWidgetForm } from "../hooks/useWidgetForm";
import { WidgetSelect } from "./WidgetSelect";

export function WidgetDatasetEditor({ state, bases }: { state: ReturnType<typeof useWidgetForm>; bases: ComparisonDatasetBasis[] }) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const labels = t.crmWidgets.datasets;
  const { datasetBasis: basis, datasets = [] } = state.form;
  const canReadBranches = basis === "BRANCH" && (user?.permissions.includes("org.branch.read") ?? false);
  const branches = useOrgNodeOptions("branches", { enabled: canReadBranches });
  const options = branches.options.filter(({ value }) => user?.accessibleBranches.includes(value));
  const update = (index: number, dataset: ComparisonDatasetSelection) => state.update({ datasets: datasets.map((value, i) => i === index ? dataset : value) });

  return <div className="space-y-3">
    <WidgetSelect label={labels.basis} value={basis ?? ""} disabled={state.disabled} options={bases.map((value) => ({ value, label: labels.bases[value] }))}
      onChange={(value) => state.update({ datasetBasis: value as ComparisonDatasetBasis, datasets: value === "PERIOD"
        ? [{ datePreset: "LAST_MONTH" }, { datePreset: "CURRENT_MONTH" }] : [{}, {}] })} />
    <p className="text-xs text-muted-foreground">{basis === "BRANCH" ? labels.branchHint : labels.periodHint}</p>
    {datasets.map((dataset, index) => <fieldset key={index} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <legend className="px-1 text-sm font-medium">{index === 0 ? labels.baseline : labels.compared.replace("{number}", String(index))}</legend>
      {basis === "BRANCH" ? <Field showLabel label={t.crmDashboards.branch} required hint={!canReadBranches || branches.error ? t.crmWidgets.review.pickerUnavailable : undefined}>
        <Combobox value={dataset.branchId} selectedLabel={options.find(({ value }) => value === dataset.branchId)?.label ?? t.crmWidgets.review.selectedUnavailable}
          options={options.filter(({ value }) => !datasets.some((item, i) => i !== index && item.branchId === value))} onSearch={branches.search}
          onValueChange={(branchId) => update(index, branchId ? { branchId } : {})} disabled={state.disabled || !canReadBranches} loading={branches.isLoading}
          placeholder={labels.selectBranch} searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.crmWidgets.review.noOptions} />
      </Field> : <>
        <WidgetSelect label={t.crmDashboards.datePreset} value={dataset.datePreset ?? ""} disabled={state.disabled} placeholder={labels.selectPeriod}
          options={DATE_PRESETS.map((value) => ({ value, label: t.crmDashboards.datePresets[value] }))} onChange={(datePreset) => update(index, { datePreset })} />
        {dataset.datePreset === "CUSTOM" && <div className="grid gap-2 sm:grid-cols-2">
          {(["dateFrom", "dateTo"] as const).map((key) => <Field showLabel key={key} label={t.crmWidgets.review[key]} required>
            <Input type="date" value={dataset[key] ?? ""} disabled={state.disabled} onChange={(event) => update(index, { ...dataset, [key]: event.target.value })} />
          </Field>)}
        </div>}
      </>}
      {index > 0 && datasets.length > 2 && <Button variant="ghost" size="sm" disabled={state.disabled} onClick={() => state.update({ datasets: datasets.filter((_, i) => i !== index) })}>
        <Trash2 className="size-4" aria-hidden="true" />{labels.remove}
      </Button>}
    </fieldset>)}
    <Button variant="outline" size="sm" disabled={state.disabled || datasets.length >= 3} onClick={() => state.update({ datasets: [...datasets, {}] })}>
      <Plus className="size-4" aria-hidden="true" />{labels.add}
    </Button>
  </div>;
}
