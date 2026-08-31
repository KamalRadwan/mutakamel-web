import { describe, expect, it } from "vitest";
import { parseWidgetResult, type WidgetResult } from "./dashboard-run-contract";
import {
  formatMetricValue,
  primarySeries,
  seriesRole,
  widgetRenderMode,
  widgetTableModel,
} from "./widget-view";

const HEADERS = { label: "Category", value: "Value" };

function result(overrides: Record<string, unknown>): WidgetResult {
  return parseWidgetResult({
    widgetId: "01900300-0000-7000-8000-0000000000a1",
    shape: "CATEGORY",
    series: [],
    meta: { unit: "COUNT", generatedAt: "2026-08-31T09:00:00.000Z", warnings: [] },
    ...overrides,
  });
}

const series = (key: string, label: string, points: Array<[string, number]>, unit = "COUNT") => ({
  key,
  label,
  unit,
  axis: "LEFT",
  points: points.map(([pointKey, value]) => ({ key: pointKey, label: pointKey, value, meta: {} })),
});

describe("Widget render mode", () => {
  it("renders a scalar visualization as a value only when the metric produced one", () => {
    expect(
      widgetRenderMode("METRIC_CARD", result({ shape: "SCALAR", value: 42, series: [] })),
    ).toBe("SCALAR");
    expect(widgetRenderMode("METRIC_CARD", result({ shape: "SCALAR" }))).toBe("TABLE");
  });

  it("charts a single series and tables a multi-series one whose roles would collide", () => {
    const oneSeries = result({ series: [series("crm.leads.by_source.count", "Leads", [["a", 1]])] });
    expect(widgetRenderMode("BAR", oneSeries)).toBe("BAR");
    expect(widgetRenderMode("DONUT", oneSeries)).toBe("DONUT");
    expect(widgetRenderMode("LINE", oneSeries)).toBe("LINE");
    expect(widgetRenderMode("AREA", oneSeries)).toBe("AREA");

    // Won vs lost: two DISTINCT outcome roles, so the chart can encode them.
    const wonLost = result({
      series: [
        series("crm.opportunities.won.count.trend", "Won", [["w1", 3]]),
        series("crm.opportunities.lost.count.trend", "Lost", [["w1", 1]]),
      ],
    });
    expect(widgetRenderMode("COLUMN", wonLost)).toBe("BAR");

    // Two series that both resolve to `brand` would be drawn in one colour and
    // read as one line — tokens.md forbids inventing an identity palette, so
    // the table carries them instead.
    const sameRole = result({
      series: [
        series("crm.opportunities.created.count.trend", "Count", [["w1", 3]]),
        series("crm.opportunities.created.estimated_value.trend", "Value", [["w1", 1]], "MONEY"),
      ],
    });
    expect(widgetRenderMode("LINE_AREA", sameRole)).toBe("TABLE");
  });

  it("tables every visualization the design system cannot draw, rather than approximating", () => {
    const rows = result({ series: [series("crm.action_center.records", "Records", [["a", 1]])] });
    for (const visualization of ["TREEMAP", "GANTT", "FLOWCHART", "HEATMAP", "SCATTER"] as const) {
      expect(widgetRenderMode(visualization, rows)).toBe("TABLE");
    }
  });

  it("tables a typed P2 result, which carries no series at all", () => {
    const typed = result({
      shape: "BINNED_DISTRIBUTION",
      series: [],
      result: {
        shape: "BINNED_DISTRIBUTION",
        unit: "MONEY",
        currencyCode: "EGP",
        totalCount: 9,
        bins: [{ key: "b1", label: "0 - 100", order: 1, kind: "STANDARD", count: 9 }],
      },
    });
    expect(widgetRenderMode("HISTOGRAM", typed)).toBe("TABLE");
    const model = widgetTableModel(typed, HEADERS);
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].cells[0]).toEqual({ kind: "text", text: "0 - 100" });
  });

  it("always builds a table, including for the widgets it also charts", () => {
    const charted = result({
      currency: "EGP",
      series: [series("crm.opportunities.won.estimated_value.by_owner", "Won", [["u1", 500]], "MONEY")],
      meta: { unit: "MONEY", currency: "EGP", generatedAt: "2026-08-31T09:00:00.000Z", warnings: [] },
    });
    const model = widgetTableModel(charted, HEADERS);
    expect(model.columns.map((column) => column.label)).toEqual(["Category", "Won"]);
    expect(model.rows[0].cells[1]).toEqual({ kind: "money", value: 500, currency: "EGP" });
  });

  it("tabulates a comparison series that the chart deliberately leaves out", () => {
    const compared = result({
      series: [
        series("crm.leads.created.trend", "Leads", [["d1", 4]]),
        series("crm.leads.created.trend:PREVIOUS_PERIOD", "Leads (Previous period)", [["d1", 2]]),
      ],
    });
    expect(primarySeries(compared)).toHaveLength(1);
    expect(widgetTableModel(compared, HEADERS).columns).toHaveLength(3);
  });
});

describe("Series roles", () => {
  it("derives an outcome role from the metric key, and brand for everything else", () => {
    expect(seriesRole("crm.opportunities.won.count.trend")).toBe("positive");
    expect(seriesRole("crm.opportunities.lost.count.trend")).toBe("negative");
    expect(seriesRole("crm.outbound_emails.failed.count")).toBe("negative");
    expect(seriesRole("crm.opportunities.stale.count")).toBe("caution");
    expect(seriesRole("crm.leads.untouched.count")).toBe("caution");
    expect(seriesRole("crm.opportunities.missing_owner.count")).toBe("caution");
    expect(seriesRole("crm.leads.by_source.count")).toBe("brand");
  });
});

describe("Metric formatting", () => {
  it("does not multiply a percent that is already 0–100 on the wire", () => {
    expect(formatMetricValue(25.5, "PERCENT", null, "en")).toContain("25.5");
    expect(formatMetricValue(25.5, "PERCENT", null, "en")).not.toContain("2,550");
  });

  it("formats money through the same Intl path Money uses", () => {
    expect(formatMetricValue(1200.5, "MONEY", "EGP", "en")).toContain("1,200.5");
    expect(formatMetricValue(1200.5, "MONEY", null, "en")).toBe("1,200.5");
  });

  it("renders a duration in minutes, not as a bare number", () => {
    expect(formatMetricValue(90, "DURATION", null, "en")).toContain("90");
  });
});

describe("Histogram bins count records, not money", () => {
  // Audit R5. A HISTOGRAM over a MONEY metric buckets opportunities *by*
  // amount: the boundaries are money, the bin's `count` is how many rows fell
  // in the bucket. `numeric()` decided on the metric's unit alone, so nine
  // opportunities rendered as a currency amount.
  const moneyHistogram = () =>
    result({
      shape: "BINNED_DISTRIBUTION",
      series: [],
      currency: "EGP",
      meta: { unit: "MONEY", currency: "EGP", generatedAt: "2026-08-31T09:00:00.000Z", warnings: [] },
      result: {
        shape: "BINNED_DISTRIBUTION",
        unit: "MONEY",
        currencyCode: "EGP",
        totalCount: 21,
        bins: [
          { key: "b1", label: "EGP 0 – EGP 100", order: 1, kind: "STANDARD", count: 9 },
          { key: "b2", label: "EGP 100 – EGP 200", order: 2, kind: "STANDARD", count: 12 },
        ],
      },
    });

  it("formats a bin count as a number even when the metric's unit is MONEY", () => {
    const model = widgetTableModel(moneyHistogram(), HEADERS);
    expect(model.rows[0].cells[1]).toEqual({ kind: "number", value: 9 });
    expect(model.rows[1].cells[1]).toEqual({ kind: "number", value: 12 });
  });

  it("leaves the bin's own money boundaries alone — they arrive inside the label", () => {
    const model = widgetTableModel(moneyHistogram(), HEADERS);
    expect(model.rows[0].cells[0]).toEqual({ kind: "text", text: "EGP 0 – EGP 100" });
  });

  it("still formats a WATERFALL step as money, because a step is a value", () => {
    const waterfall = result({
      shape: "WATERFALL",
      series: [],
      currency: "EGP",
      meta: { unit: "MONEY", currency: "EGP", generatedAt: "2026-08-31T09:00:00.000Z", warnings: [] },
      result: {
        shape: "WATERFALL",
        steps: [{ key: "s1", label: "Opening", order: 1, kind: "START", value: 500 }],
      },
    });
    expect(widgetTableModel(waterfall, HEADERS).rows[0].cells[1]).toEqual({
      kind: "money",
      value: 500,
      currency: "EGP",
    });
  });
});
