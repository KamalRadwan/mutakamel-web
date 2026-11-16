import { expect, it } from "vitest";
import { WIDGET_RENDER_CAPABILITIES } from "./widget-render-capabilities";
import { widgetRenderMode } from "./widget-view";
import { parseWidgetResult } from "./dashboard-run-contract";
import type { CrmVisualization } from "./widget-contract";
const typed: Record<string, Record<string, unknown>> = {
  WATERFALL: { shape: "WATERFALL", unit: "COUNT", steps: [{ key: "s", label: "Opening", order: 0, kind: "START", value: 10, cumulativeValue: 10 }] },
  TREEMAP: { shape: "HIERARCHY", unit: "COUNT", nodes: [{ id: "root", label: "Pipeline", value: 10, depth: 0 }] },
  HISTOGRAM: { shape: "BINNED_DISTRIBUTION", unit: "MONEY", currencyCode: "EGP", totalCount: 10, bins: [{ key: "bin", label: "0–100", order: 0, kind: "STANDARD", lowerBound: 0, upperBound: 100, count: 10 }] },
  BOX_PLOT: { shape: "DURATION_DISTRIBUTION", unit: "DURATION", whiskerMethod: "MIN_MAX", totalCount: 1, excludedCount: 0,
    groups: [{ key: "branch", label: "Central", sampleCount: 1, excludedCount: 0, min: 0, q1: 0, median: 0, q3: 0, p90: 0, max: 0 }] },
  LEADERBOARD: { shape: "ROWS", rowKind: "RANKED", rows: [{ id: "owner", label: "Owner", rank: 1, primaryMeasure: { key: "m", label: "Count", value: 10, unit: "COUNT" }, secondaryMeasures: [] }] },
  SCORECARD: { shape: "ROWS", rowKind: "SCORECARD", rows: [{ id: "row", label: "Coverage", status: "UNKNOWN", measures: [{ key: "m", label: "Rate", value: 10, unit: "PERCENT" }] }] },
  ALERT_LIST: { shape: "ROWS", rowKind: "ALERT", rows: [{ id: "row", title: "Alert", severity: "INFO", reasonCode: "MISSING_AMOUNT", occurredAt: "2026-10-01T00:00:00Z", entityRef: { type: "OPPORTUNITY", id: "synthetic" } }] },
  ACTIVITY_FEED: { shape: "EVENT_STREAM", partialAccess: false, events: [{ id: "event", title: "Call", kind: "CALL", severity: "INFO", occurredAt: "2026-10-01T00:00:00Z", entityRef: { type: "ACTIVITY", id: "synthetic" } }] },
};
it("resolves all current persisted visualizations to their native family for a valid declared shape", () => {
  expect(Object.keys(WIDGET_RENDER_CAPABILITIES)).toHaveLength(36);
  for (const visualization of Object.keys(WIDGET_RENDER_CAPABILITIES) as CrmVisualization[]) {
    const shape = WIDGET_RENDER_CAPABILITIES[visualization][0];
    const count = visualization === "MULTI_KPI" || visualization === "COMBO" ? 2 : 1;
    const result = parseWidgetResult({ widgetId: "preview", shape, value: shape === "SCALAR" ? 10 : undefined, target: shape === "SCALAR" ? 20 : undefined,
      series: typed[visualization] ? [] : Array.from({ length: count }, (_, index) => ({ key: shape === "XY" ? "crm.opportunities.value_probability" : `metric${index}`, label: `Metric ${index}`, unit: "COUNT", points: [{ key: "2026-10-01", label: "Category", value: 10, secondaryValue: shape === "XY" ? 100 : undefined, size: shape === "XY" ? 12 : undefined, start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z", meta: shape === "GRAPH" ? { source: "a", target: "b", sourceLabel: "New", targetLabel: "Qualified" } : {} }] })),
      result: typed[visualization], meta: { warnings: [] } });
    if (visualization === "TABLE") expect(widgetRenderMode(visualization, result)).toBe("TABLE");
    else expect(widgetRenderMode(visualization, result), visualization).not.toBe("TABLE");
  }
});
it("facets one money measure by its actual currency, and never infers a shared-currency total", () => {
  const result = parseWidgetResult({ widgetId: "preview", shape: "CATEGORY", series: ["EGP", "SAR"].map((currency) => ({ key: `metric:${currency}`, unit: "MONEY", currency, points: [{ key: "stage", value: 10 }] })), meta: {} });
  expect(widgetRenderMode("DONUT", result)).toBe("DONUT"); expect(widgetRenderMode("FUNNEL", result)).toBe("FUNNEL");
  expect(result.series.map((series) => series.currency)).toEqual(["EGP", "SAR"]);
});
