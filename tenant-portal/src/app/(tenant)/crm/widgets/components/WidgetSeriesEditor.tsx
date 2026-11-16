"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { findVisualization, presentationVisualization } from "../widget-form";
import type { useWidgetForm } from "../hooks/useWidgetForm";
import { WidgetSelect } from "./WidgetSelect";
import { supportsWidgetPresentation } from "../../dashboards/widget-presentation";
import { invalidWidgetColor } from "../widget-form-validation";
import { WidgetMetricPicker } from "./WidgetMetricPicker";

export function WidgetSeriesEditor({ state, catalog }: { state: ReturnType<typeof useWidgetForm>; catalog: DashboardCatalog | null }) {
  const { t } = useI18n();
  const labels = t.crmWidgets.review;
  const capability = findVisualization(catalog, state.form.visualizationType);
  const ownsSeries = !!state.standaloneMetric && (capability?.minSeries ?? 1) > 1;
  return <div className="flex flex-col gap-3">
    {state.form.series.map((series, index) => <section key={index} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{labels.series} {index + 1}</h3>
        <Button variant="ghost" size="sm" disabled={state.disabled || state.form.series.length <= state.minSeries} aria-label={`${labels.removeSeries} ${index + 1}`} onClick={() => state.removeSeries(index)}><Trash2 className="size-4" aria-hidden="true" /></Button></div>
      <WidgetMetricPicker form={state.form} index={index} catalog={catalog} disabled={state.disabled || !capability}
        onChoose={(metricKey) => state.updateSeries(index, { metricKey })}
        error={state.touched && !series.metricKey ? t.crmWidgets.formErrors.METRIC_REQUIRED : undefined} />
      {!ownsSeries && <><div className="grid gap-3 sm:grid-cols-2"><Field showLabel label={labels.seriesLabel} hint={labels.labelLimit} error={state.touched && series.label !== "" && !series.label.trim() ? t.crmWidgets.formErrors.SERIES_STYLE_INVALID : undefined}><Input value={series.label} maxLength={80} disabled={state.disabled} onChange={(event) => state.updateSeries(index, { label: event.target.value })} /></Field>
        <Field showLabel label={labels.color} hint={supportsWidgetPresentation(presentationVisualization(state.form, catalog), "seriesColor") ? labels.hexHint : labels.presentationUnsupported} error={state.touched && invalidWidgetColor(series.color) ? t.crmWidgets.formErrors.SERIES_STYLE_INVALID : undefined}><Input value={series.color} dir="ltr" disabled={state.disabled || !supportsWidgetPresentation(presentationVisualization(state.form, catalog), "seriesColor")} maxLength={7} onChange={(event) => state.updateSeries(index, { color: event.target.value })} /></Field></div>
      <WidgetSelect label={labels.axis} value={series.axis || "__auto__"} disabled={state.disabled} error={state.touched && state.error === "AXIS_REQUIRED" && !series.axis ? t.crmWidgets.formErrors.AXIS_REQUIRED : undefined} options={[{ value: "__auto__", label: labels.automatic }, { value: "LEFT", label: labels.axisLeft }, { value: "RIGHT", label: labels.axisRight }]}
        onChange={(axis) => state.updateSeries(index, { axis: axis === "__auto__" ? "" : axis as "LEFT" | "RIGHT" })} /></>}
    </section>)}
    <Button variant="outline" className="self-start" disabled={state.disabled || !!state.standaloneMetric || !capability || state.form.series.length >= Math.min(4, capability.maxSeries)} onClick={state.addSeries}><Plus className="size-4" aria-hidden="true" />{labels.addSeries}</Button>
    <p className="text-xs text-muted-foreground">{state.standaloneMetric ? labels.standaloneMetric : labels.seriesHint}</p>
  </div>;
}
