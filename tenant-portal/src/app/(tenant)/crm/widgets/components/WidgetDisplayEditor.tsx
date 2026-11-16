"use client";
import { Checkbox, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { LEGEND_POSITIONS, NUMBER_FORMATS, presentationVisualization } from "../widget-form";
import type { useWidgetForm } from "../hooks/useWidgetForm";
import { WidgetSelect } from "./WidgetSelect";
import { supportsWidgetPresentation, widgetOption } from "../../dashboards/widget-presentation";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { invalidWidgetColor } from "../widget-form-validation";
export function WidgetDisplayEditor({ state, catalog }: { state: ReturnType<typeof useWidgetForm>; catalog: DashboardCatalog | null }) {
  const { t } = useI18n();
  const labels = t.crmWidgets.review;
  const display = state.form.displaySpec;
  const options = display.options && typeof display.options === "object" ? display.options as Record<string, unknown> : {};
  const support = (control: Parameters<typeof supportsWidgetPresentation>[1]) => supportsWidgetPresentation(presentationVisualization(state.form, catalog), control);
  const duration = state.form.series.every((series) => catalog?.metrics.find((metric) => metric.key === series.metricKey)?.unit === "DURATION");
  return <div className="grid gap-3 sm:grid-cols-2">
    {(["title", "subtitle", "color", "targetColor"] as const).map((key) => <Field showLabel key={key} label={labels.display[key]} hint={key === "targetColor" && !support("targetColor") ? labels.presentationUnsupported : key.includes("olor") ? labels.hexHint : undefined} error={state.touched && key.includes("olor") && display[key] !== undefined && invalidWidgetColor(display[key]) ? t.crmWidgets.formErrors.DISPLAY_INVALID : undefined}>
      <Input value={String(display[key] ?? "")} dir={key.includes("olor") ? "ltr" : undefined} maxLength={key === "title" ? 120 : key === "subtitle" ? 300 : 7} disabled={state.disabled || (key === "targetColor" && !support("targetColor"))} onChange={(event) => state.updateDisplay(key, event.target.value)} /></Field>)}
    <WidgetSelect label={labels.display.numberFormat} value={String(display.numberFormat ?? "__default__")} disabled={state.disabled || !support("numberFormat")} hint={!support("numberFormat") ? labels.presentationUnsupported : labels.durationFormatHint}
      options={[{ value: "__default__", label: labels.automatic }, ...NUMBER_FORMATS.map((value) => ({ value, label: labels.numberFormats[value], disabled: value.startsWith("duration-") && !duration }))]}
      onChange={(value) => state.updateDisplay("numberFormat", value === "__default__" ? undefined : value)} />
    <WidgetSelect label={labels.display.legendPosition} value={String(display.legendPosition ?? "__default__")} disabled={state.disabled || !support("legendPosition")} hint={!support("legendPosition") ? labels.presentationUnsupported : undefined}
      options={[{ value: "__default__", label: labels.automatic }, ...LEGEND_POSITIONS.map((value) => ({ value, label: labels.legendPositions[value] }))]}
      onChange={(value) => state.updateDisplay("legendPosition", value === "__default__" ? undefined : value)} />
    {(["showDelta", "showPoints", "showValues", "showTable"] as const).map((key) => <label key={key} className="flex flex-col gap-1 text-sm"><span className="flex items-center gap-2"><Checkbox checked={widgetOption(display, key, key === "showDelta" && support(key))} disabled={state.disabled || !support(key)}
      onCheckedChange={(checked) => state.updateDisplay("options", { ...options, [key]: checked === true })} />{labels.display[key]}</span>{!support(key) && <span className="text-xs text-muted-foreground">{labels.presentationUnsupported}</span>}</label>)}
  </div>;
}
