"use client";
import { useState } from "react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { EMPTY_SERIES, EMPTY_WIDGET_FORM, findMetric, findVisualization, metricsFor, commonDimensions, supportsGovernedTarget, validateWidgetForm, widgetInput, type WidgetFormState, type WidgetSeriesDraft } from "../widget-form";
import { useWidgetPreview } from "./useWidgetPreview";

interface Options {
  initial?: WidgetFormState; catalog: DashboardCatalog | null; canPreview: boolean;
  pending: boolean; blocked: boolean; onSaveDraft: (form: WidgetFormState) => void;
}
export function useWidgetForm(options: Options) {
  const [form, setForm] = useState<WidgetFormState>(() => options.initial ?? structuredClone(EMPTY_WIDGET_FORM));
  const [touched, setTouched] = useState(false);
  const error = validateWidgetForm(form, options.catalog);
  const dirty = JSON.stringify(form) !== JSON.stringify(options.initial ?? EMPTY_WIDGET_FORM);
  const guard = useUnsavedChangesGuard(dirty || options.pending);
  const signature = JSON.stringify(form);
  const preview = useWidgetPreview(signature, options.canPreview && !error);
  const disabled = options.pending || options.blocked;
  const standaloneMetric = form.series.map((series) => findMetric(options.catalog, series.metricKey)).find((metric) => metric?.standalone);
  const minSeries = standaloneMetric ? 1 : findVisualization(options.catalog, form.visualizationType)?.minSeries ?? 1;
  const update = (patch: Partial<WidgetFormState>) => {
    if (disabled) return;
    setTouched(true);
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.visualizationType !== undefined) {
        const visualization = findVisualization(options.catalog, patch.visualizationType);
        const admitted = new Set(metricsFor(options.catalog, visualization).map((metric) => metric.key));
        next.series = current.series.map((series) => admitted.has(series.metricKey) ? series : { ...series, metricKey: "" });
        if (visualization?.requiresTarget && current.comparison !== "GOVERNED_TARGET") next.comparison = "TARGET";
        const retainedStandalone = next.series.some(series => findMetric(options.catalog, series.metricKey)?.standalone);
        while (next.series.length < (retainedStandalone ? 1 : visualization?.minSeries ?? 1)) {
          next.series = [...next.series, { ...EMPTY_SERIES }];
        }
      }
      if (patch.series?.some(series => findMetric(options.catalog, series.metricKey)?.standalone)) {
        next.series = next.series.filter(series => series.metricKey || series.label || series.color || series.axis);
      }
      const metric = next.series.length === 1 ? findMetric(options.catalog, next.series[0].metricKey) : undefined;
      if (patch.visualizationType !== undefined || patch.series !== undefined) {
        const dimensions = commonDimensions(next, options.catalog);
        if (!dimensions.includes(next.dimensionKey)) next.dimensionKey = dimensions[0] ?? "";
        if (next.comparison === "GOVERNED_TARGET" && !supportsGovernedTarget(next, options.catalog)) {
          next.comparison = findVisualization(options.catalog, next.visualizationType)?.requiresTarget ? "TARGET" : "INHERIT";
        }
        if (metric?.standalone && !metric.requiredComparison && !metric.comparisonTypes?.includes(next.comparison)) next.comparison = "NONE";
      }
      if (metric?.requiredComparison) next.comparison = metric.requiredComparison;
      if (metric?.requiredGrain) next.grain = metric.requiredGrain;
      return next;
    });
  };
  const updateSeries = (index: number, patch: Partial<WidgetSeriesDraft>) => update({ series: form.series.map((series, n) => n === index ? { ...series, ...patch } : series) });
  const updateFilter = (key: string, value: unknown) => {
    const filters = { ...form.filters };
    if (value === "" || value === undefined) delete filters[key]; else filters[key] = value;
    if (key === "datePreset" && value !== "CUSTOM") { delete filters.dateFrom; delete filters.dateTo; }
    update({ filters });
  };
  const updateDisplay = (key: string, value: unknown) => {
    const displaySpec = { ...form.displaySpec };
    if (value === "" || value === undefined) delete displaySpec[key]; else displaySpec[key] = value;
    update({ displaySpec });
  };
  return { form, dirty, disabled, standaloneMetric, minSeries, touched, error, guard, preview, update, updateSeries, updateFilter, updateDisplay,
    addSeries: () => { if (!standaloneMetric && form.series.length < Math.min(4, findVisualization(options.catalog, form.visualizationType)?.maxSeries ?? 4)) update({ series: [...form.series, { ...EMPTY_SERIES }] }); },
    removeSeries: (index: number) => { if (form.series.length > minSeries) update({ series: form.series.filter((_, n) => n !== index) }); },
    saveDraft: () => { if (!disabled && options.catalog) options.onSaveDraft(form); },
    runPreview: () => { setTouched(true); if (!disabled && !validateWidgetForm(form, options.catalog)) void preview.run(widgetInput(form)); },
  };
}
