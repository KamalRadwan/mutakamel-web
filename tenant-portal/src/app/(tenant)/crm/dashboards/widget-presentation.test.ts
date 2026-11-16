import { describe, expect, it } from "vitest";
import { formatWidgetValue, supportsWidgetPresentation, unsupportedWidgetPresentation, widgetSeriesColor } from "./widget-presentation";
import { presentationVisualization, EMPTY_WIDGET_FORM } from "../widgets/widget-form";
import { parseCatalogResponse } from "./dashboard-catalog-contract";

describe("widget presentation without changing source data", () => {
  it("applies compact/full formatting while preserving money and percent units", () => {
    expect(formatWidgetValue(12500, "COUNT", null, "en", { numberFormat: "compact" })).toBe("12.5K");
    expect(formatWidgetValue(12500, "COUNT", null, "en", { numberFormat: "full" })).toBe("12,500");
    expect(formatWidgetValue(12500, "MONEY", "USD", "en", { numberFormat: "compact" })).toBe("$12.5K");
    expect(formatWidgetValue(25, "PERCENT", null, "en", { numberFormat: "full" })).toBe("25%");
  });
  it("does not round a valid small target into an invented zero", () => {
    expect(formatWidgetValue(0.000001, "COUNT", null, "en", {})).toBe("0.000001");
    expect(formatWidgetValue(0.000001, "PERCENT", null, "en", {})).toBe("0.000001%");
  });
  it("converts duration minutes for labels and uses explicit Arabic locale", () => {
    expect(formatWidgetValue(150, "DURATION", null, "en", { numberFormat: "duration-hours" })).toBe("2.5 hr");
    expect(formatWidgetValue(2880, "DURATION", null, "en", { numberFormat: "duration-auto" })).toBe("2 days");
    expect(formatWidgetValue(12500, "COUNT", null, "ar", { numberFormat: "full" })).toContain("12,500");
  });
  it("resolves per-metric color ahead of primary color, including currency-split result keys", () => {
    const query = { series: [{ metricKey: "crm.value", color: "#123456" }] };
    expect(widgetSeriesColor("crm.value:USD", query, { color: "#abcdef" })).toBe("#123456");
    expect(widgetSeriesColor("crm.count", query, { color: "#abcdef" })).toBe("#abcdef");
    expect(widgetSeriesColor("crm.count", undefined, { color: "invalid" })).toBeUndefined();
  });
  it("keeps unsupported saved options explicit and does not offer markers on columns", () => {
    expect(supportsWidgetPresentation("LINE", "showPoints")).toBe(true);
    expect(supportsWidgetPresentation("COLUMN", "showPoints")).toBe(false);
    expect(unsupportedWidgetPresentation("TABLE", { legendPosition: "top", options: { showValues: true } }, { series: [{ metricKey: "x", color: "#123456" }] })).toEqual(["legendPosition", "showValues", "seriesColor"]);
  });
  it("enables supported dual-axis presentation and keeps incompatible geometry at a table boundary", () => {
    const catalog = parseCatalogResponse({ grid: {}, visualizations: [], dimensions: [], templates: [], metrics: [
      { key: "count", unit: "COUNT", shape: "CATEGORY", dimensions: ["owner"] },
      { key: "money", unit: "MONEY", shape: "CATEGORY", dimensions: ["owner"] },
    ] });
    const first = { metricKey: "count", axis: "" as const, label: "", color: "" };
    const form = { ...EMPTY_WIDGET_FORM, visualizationType: "LINE" as const, series: [first] };
    expect(presentationVisualization(form, catalog)).toBe("LINE");
    expect(presentationVisualization({ ...form, series: [first, { ...first, metricKey: "money" }] }, catalog)).toBe("LINE");
    expect(presentationVisualization({ ...form, series: [{ ...first, axis: "RIGHT" }] }, catalog)).toBe("LINE");
    expect(presentationVisualization({ ...form, visualizationType: "DONUT", series: [first, { ...first, metricKey: "money" }] }, catalog)).toBe("TABLE");
  });
});
