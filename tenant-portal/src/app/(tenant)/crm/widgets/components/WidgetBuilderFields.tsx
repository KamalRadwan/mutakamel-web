"use client";

import { DegradedBanner, ErrorState, Field, hasPermission, Input, Skeleton } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { LEAD_SOURCE_GROWTH_METRIC } from "../../dashboards/widget-source-growth";
import type { WidgetBuilderStep } from "../hooks/useWidgetBuilderSteps";
import type { useWidgetForm } from "../hooks/useWidgetForm";
import { buildableVisualizations, buildQuerySpec, commonDimensions, datasetComparisonFor, grainsFor, supportsGovernedTarget, type WidgetFormState } from "../widget-form";
import { WidgetDisplayEditor } from "./WidgetDisplayEditor";
import { WidgetFilterEditor } from "./WidgetFilterEditor";
import { WidgetPreview } from "./WidgetPreview";
import { WidgetSelect } from "./WidgetSelect";
import { WidgetSeriesEditor } from "./WidgetSeriesEditor";
import { WidgetDatasetEditor } from "./WidgetDatasetEditor";
import { WidgetGovernedTargetEditor } from "./WidgetGovernedTargetEditor";

interface Props {
  step: WidgetBuilderStep;
  state: ReturnType<typeof useWidgetForm>;
  catalog: DashboardCatalog | null;
  canPreview: boolean;
}

export function WidgetBuilderFields({ step, state, catalog, canPreview }: Props) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const { form } = state;
  const datasetCapability = datasetComparisonFor(form, catalog);
  const labels = t.crmWidgets.review;
  switch (step) {
    case "details":
      return <Field showLabel label={t.crmWidgets.name} required hint={labels.nameLimit}
        error={state.touched && state.error === "NAME_REQUIRED" ? t.crmWidgets.formErrors.NAME_REQUIRED : undefined}>
        <Input value={form.name} maxLength={120} disabled={state.disabled} onChange={(event) => state.update({ name: event.target.value })} />
      </Field>;
    case "metrics":
      return <>
        <WidgetSelect label={t.crmWidgets.visualization} value={form.visualizationType} disabled={state.disabled || !catalog}
          options={buildableVisualizations(catalog).map(({ key }) => ({ value: key, label: t.crmDashboards.visualizations[key] }))}
          placeholder={t.crmWidgets.selectVisualization} hint={t.crmWidgets.visualizationHint}
          onChange={(value) => state.update({ visualizationType: value as WidgetFormState["visualizationType"] })} />
        <WidgetSeriesEditor state={state} catalog={catalog} />
      </>;
    case "scope":
      return <>
        <div className="grid gap-4 sm:grid-cols-2">
          <WidgetSelect label={t.crmWidgets.dimension} value={form.dimensionKey} disabled={state.disabled}
            options={commonDimensions(form, catalog).map((value) => ({ value, label: t.crmWidgets.dimensions[value] ?? t.common.unknownCode }))}
            onChange={(dimensionKey) => state.update({ dimensionKey })} />
          {form.dimensionKey === "time" && <WidgetSelect label={t.crmWidgets.grain} value={form.grain} disabled={state.disabled || !!state.standaloneMetric?.requiredGrain}
            options={grainsFor(catalog, "time").map((value) => ({ value, label: t.crmWidgets.grains[value as keyof typeof t.crmWidgets.grains] }))}
            onChange={(grain) => state.update({ grain: grain as WidgetFormState["grain"] })} />}
        </div>
        <WidgetFilterEditor state={state} />
      </>;
    case "comparison":
      if (state.standaloneMetric?.key === LEAD_SOURCE_GROWTH_METRIC) {
        return <p className="text-sm text-muted-foreground">{t.crmDashboards.sourceGrowth.comparison}</p>;
      }
      return <>
        <WidgetSelect label={t.crmWidgets.comparison} value={form.comparison} disabled={state.disabled}
          options={Object.entries(t.crmWidgets.comparisonValues).filter(([value]) => {
            if (state.standaloneMetric?.requiredComparison) return value === state.standaloneMetric.requiredComparison;
            if (value === "DATASETS") return !!datasetCapability?.bases.length;
            if (value === "GOVERNED_TARGET") return form.comparison === value || (supportsGovernedTarget(form, catalog)
              && (user?.isTenantOwner || hasPermission(user?.permissions ?? [], "crm.targets.read", true)));
            return !state.standaloneMetric || value === "INHERIT" || state.standaloneMetric.comparisonTypes?.includes(value);
          }).map(([value, label]) => ({ value, label }))}
          onChange={(value) => state.update({ comparison: value as WidgetFormState["comparison"], ...(value === "DATASETS" && !form.datasets
            ? { datasetBasis: "PERIOD", datasets: [{ datePreset: "LAST_MONTH" }, { datePreset: "CURRENT_MONTH" }] } : {}) })} />
        {form.comparison === "DATASETS" && datasetCapability && <WidgetDatasetEditor state={state} bases={datasetCapability.bases} />}
        {(form.comparison === "GOVERNED_TARGET" || state.standaloneMetric?.requiredComparison === "GOVERNED_TARGET")
          && <WidgetGovernedTargetEditor state={state} />}
        {form.comparison === "TARGET" && <Field showLabel label={t.crmWidgets.target} required hint={t.crmWidgets.targetHint}
          error={state.touched && state.error === "TARGET_INVALID" ? t.crmWidgets.formErrors.TARGET_INVALID : undefined}>
          <Input inputMode="decimal" value={form.target} disabled={state.disabled} onChange={(event) => state.update({ target: event.target.value })} />
        </Field>}
      </>;
    case "display":
      return <WidgetDisplayEditor state={state} catalog={catalog} />;
    case "review":
      return <>
        {!canPreview && <DegradedBanner message={labels.previewDenied} />}
        {state.preview.busy && <div role="status" aria-label={t.crmWidgets.builder.previewLoading} className="space-y-3">
          <Skeleton className="h-5 w-48" /><Skeleton className="h-40 w-full" />
        </div>}
        {state.preview.error && <ErrorState title={t.crmWidgets.previewFailed}
          description={t.crmDashboards.errors[state.preview.error.code ?? ""] ?? t.crmDashboards.actionFailed}
          onRetry={state.runPreview} retryLabel={t.common.retry} />}
        {state.preview.result && <WidgetPreview result={state.preview.result} catalog={catalog}
          visualizationType={form.visualizationType || undefined} displaySpec={form.displaySpec} querySpec={buildQuerySpec(form)} name={form.name} />}
        {!state.preview.result && !state.preview.error && !state.preview.busy && canPreview && <p className="text-sm text-muted-foreground">{labels.previewIdle}</p>}
      </>;
  }
}
