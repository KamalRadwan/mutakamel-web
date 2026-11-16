import { describe, expect, it } from "vitest";
import { parseWidgetResult } from "./dashboard-run-contract";
import { buildWidgetCartesianModel } from "./widget-cartesian-model";
import { formatWidgetValue } from "./widget-presentation";
const labels = { previous: "Previous", value: "Value", units: { COUNT: "Count", MONEY: "Amount", PERCENT: "Percentage", DURATION: "Duration", SCORE: "Score" } };
const format = (value: number, unit: Parameters<typeof formatWidgetValue>[1], currency: string | null) => formatWidgetValue(value, unit, currency, "en", {});
const result = (series: unknown[]) => parseWidgetResult({ widgetId: "preview", state: "READY", shape: "TIME_SERIES", series,
  meta: { unit: "COUNT", generatedAt: "2026-11-05T00:00:00Z", warnings: [] } });

describe("canonical current and matched-period chart data", () => {
  it("plots the server-paired previous value at its current counterpart without converting a gap to zero", () => {
    const source = result([{ key: "leads", label: "Leads", unit: "COUNT", points: [
      { key: "2026-10-01", label: "Oct 1", value: null, previousValue: 42, previousKey: "2026-09-01" },
      { key: "2026-10-02", label: "Oct 2", value: 0, previousValue: null, previousKey: null },
    ] }]);
    const before = structuredClone(source);
    const model = buildWidgetCartesianModel(source, "LINE", labels, {}, undefined, format);
    expect(model.data).toEqual([{ label: "Oct 1", leads: null, "leads:matched": 42 }, { label: "Oct 2", leads: 0, "leads:matched": null }]);
    expect(model.series.map((entry) => entry.kind)).toEqual(["line", "line"]);
    expect(model.series[1].strokeDasharray).toBeTruthy();
    expect(model.pointKeys).toEqual(["2026-10-01", "2026-10-02"]);
    expect(source).toEqual(before);
  });

  it.each(["COMBO", "LINE_AREA"] as const)("keeps %s geometry and independent count/money axis formatters", (type) => {
    const source = result([{ key: "count", label: "Count", unit: "COUNT", axis: "LEFT", points: [{ key: "a", value: 12 }] },
      { key: "money", label: "Amount", unit: "MONEY", currency: "EGP", axis: "RIGHT", points: [{ key: "a", value: 50000 }] }]);
    const model = buildWidgetCartesianModel(source, type, labels, {}, undefined, format);
    expect(model.series.map((entry) => entry.kind)).toEqual([type === "COMBO" ? "bar" : "area", "line"]);
    expect(model.axisLabels).toEqual({ LEFT: "Count", RIGHT: "EGP" });
    expect(model.series[0].valueFormatter?.(12)).toBe("12");
    expect(model.series[1].valueFormatter?.(50000)).toContain("50,000");
    expect(model.series[1].valueFormatter?.(50000)).toContain("EGP");
  });

  it("keeps current and previous normalized groups independent and leaves a zero denominator missing", () => {
    const source = result(["one", "two"].map((key, index) => ({ key, label: key, unit: "COUNT", points: [
      { key: "a", value: index ? 80 : 20, previousValue: index ? 50 : 50 }, { key: "b", value: 0, previousValue: null },
    ] })));
    const model = buildWidgetCartesianModel(source, "STACKED_BAR_100", labels, {}, undefined, format);
    expect(model.data[0]).toMatchObject({ one: 20, two: 80, "one:matched": 50, "two:matched": 50 });
    expect(model.data[1]).toMatchObject({ one: null, two: null, "one:matched": null, "two:matched": null });
    expect(source.series[0].points[1].value).toBe(0);
    expect(model.axisLabels.LEFT).toBe("Percentage");
  });
  it("does not turn valid large finite shares into zero through an overflowing intermediate total", () => {
    const source = result(["a", "b"].map((key) => ({ key, unit: "MONEY", currency: "EGP", points: [{ key: "x", value: 1e308 }] })));
    expect(buildWidgetCartesianModel(source, "STACKED_BAR_100", labels, {}, undefined, format).data[0]).toMatchObject({ a: 50, b: 50 });
  });
});
