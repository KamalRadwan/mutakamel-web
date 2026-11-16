"use client";
import { useState } from "react";
import { swatchSurfacePalette } from "@/design-system";
import { displayWarnings, type WidgetResult } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";
import { record } from "../../dashboard-parse";
import type { DashboardCatalog } from "../../dashboard-catalog-contract";
import type { Language } from "@/i18n/useLanguage";
import { localizeWidgetResult } from "../../widget-labels";
import { currentWidgetDrillAdmission } from "../../widget-drill-admission";
import { widgetOption } from "../../widget-presentation";
import { isInverseMetricKey, scalarDelta, widgetAccentHue, widgetDataUnavailable, widgetRenderMode, widgetTableModel, type WidgetTableHeaders } from "../../widget-view";
export function useWidgetTilePresentation(widget: WidgetDefinition, rawResult: WidgetResult | undefined, labels: WidgetTableHeaders, locale?: { catalog?: DashboardCatalog | null; lang: Language; explicitCurrency?: string | null }) {
  const [tablePreference, setTablePreference] = useState<{ id: string; revision: number; open: boolean }>();
  const isTableOpen = tablePreference?.id === widget.id && tablePreference.revision === widget.revision
    ? tablePreference.open
    : widgetOption(widget.displaySpec, "showTable");
  const result = locale ? localizeWidgetResult(rawResult, locale.catalog, locale.lang, widget.querySpec, labels.datasets) : rawResult;
  const mode = result ? widgetRenderMode(widget.visualizationType, result) : "TABLE";
  const model = result ? widgetTableModel(result, labels) : { columns: [], rows: [] };
  const warnings = result ? displayWarnings(result.warnings) : [];
  const primaryMetricKey = widget.querySpec.series[0]?.metricKey ?? null;
  const palette = swatchSurfacePalette(widgetAccentHue(widget.visualizationType, primaryMetricKey));
  const inverse = Boolean(record(widget.displaySpec.options)?.inverseDelta) || isInverseMetricKey(primaryMetricKey);
  const admission = currentWidgetDrillAdmission(widget, locale?.catalog, locale?.explicitCurrency);
  const readable = result !== undefined && !widgetDataUnavailable(result) && result.errorCode === null && result.typedResult === null;
  const canDrilldown = readable && admission === "SUPPORTED";
  const drillNeedsCurrency = readable && admission === "CURRENCY_REQUIRED";
  const showTableToggle = result !== undefined && result.errorCode === null && model.rows.length > 0
    && (result.governedTarget !== undefined || (!widgetDataUnavailable(result) && mode !== "TABLE"));
  return { result, mode, model, warnings, primaryMetricKey, palette, canDrilldown, drillNeedsCurrency, showTableToggle, isTableOpen,
    delta: result ? scalarDelta(result, inverse) : null,
    toggleTable: () => setTablePreference({ id: widget.id, revision: widget.revision, open: !isTableOpen }) };
}
