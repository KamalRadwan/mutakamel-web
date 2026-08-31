import { describe, expect, it } from "vitest";
import {
  buildDrilldownRequest,
  buildRunRequest,
  currenciesInRun,
  displayWarnings,
  failedWidgetIds,
  parseDrilldownResponse,
  parseRunResponse,
  parseWidgetResult,
} from "./dashboard-run-contract";

const DASHBOARD_ID = "01900300-0000-7000-8000-000000000001";
const OK_WIDGET = "01900300-0000-7000-8000-0000000000a1";
const FAILED_WIDGET = "01900300-0000-7000-8000-0000000000a2";

const okResult = {
  widgetId: OK_WIDGET,
  shape: "CATEGORY",
  series: [
    {
      key: "crm.leads.by_source.count",
      label: "Leads by source",
      unit: "COUNT",
      axis: "LEFT",
      points: [
        { key: "web", label: "Web", value: 12, meta: { id: "web" } },
        { key: "call", label: "Call", value: 4, meta: { id: "call" } },
      ],
    },
  ],
  meta: {
    unit: "COUNT",
    generatedAt: "2026-08-31T09:00:00.000Z",
    warnings: [],
  },
};

// Exactly what `DashboardExecutionService.run` writes into `widgets[id]` after
// rolling the widget's statement back to its savepoint.
const failedResult = {
  widgetId: FAILED_WIDGET,
  shape: "SCALAR",
  series: [],
  error: { code: "CRM_WIDGET_METRIC_INVALID" },
  meta: { generatedAt: "2026-08-31T09:00:00.000Z", warnings: ["WIDGET_EXECUTION_FAILED"] },
};

const run = {
  dashboardId: DASHBOARD_ID,
  revision: 7,
  filters: { dateFrom: "2026-08-01T00:00:00.000Z", dateTo: "2026-08-31T23:59:59.999Z" },
  generatedAt: "2026-08-31T09:00:00.000Z",
  scope: [],
  widgets: { [OK_WIDGET]: okResult, [FAILED_WIDGET]: failedResult },
  unavailablePlacements: [{ id: "x" }],
};

describe("Dashboard run contract", () => {
  it("keeps a failed widget beside the ones that worked — the dashboard is not all-or-nothing", () => {
    const parsed = parseRunResponse(run);
    expect(Object.keys(parsed.widgets)).toHaveLength(2);
    expect(parsed.widgets[OK_WIDGET].errorCode).toBeNull();
    expect(parsed.widgets[OK_WIDGET].series[0].points).toHaveLength(2);
    expect(parsed.widgets[FAILED_WIDGET].errorCode).toBe("CRM_WIDGET_METRIC_INVALID");
    expect(failedWidgetIds(parsed)).toEqual([FAILED_WIDGET]);
    expect(parsed.unavailablePlacementCount).toBe(1);
  });

  it("has no `meta.unit` on the failure path, and does not invent one", () => {
    const parsed = parseWidgetResult(failedResult);
    expect(parsed.unit).toBeNull();
    expect(parsed.value).toBeNull();
    expect(parsed.series).toEqual([]);
  });

  it("marks a server-appended comparison series by its key suffix", () => {
    const parsed = parseWidgetResult({
      ...okResult,
      series: [
        ...okResult.series,
        {
          key: "crm.leads.by_source.count:PREVIOUS_PERIOD",
          label: "Leads by source (Previous period)",
          unit: "COUNT",
          axis: "LEFT",
          points: [],
        },
      ],
    });
    expect(parsed.series.map((series) => series.isComparison)).toEqual([false, true]);
  });

  it("reads the currency filter options out of the run's own CURRENCIES warning", () => {
    const parsed = parseRunResponse({
      ...run,
      widgets: {
        [OK_WIDGET]: {
          ...okResult,
          meta: {
            ...okResult.meta,
            warnings: ["CURRENCY_FILTER_REQUIRED", "CURRENCIES:EGP,USD"],
          },
        },
      },
    });
    expect(currenciesInRun(parsed)).toEqual(["EGP", "USD"]);
    // The machine-readable carrier never reaches the screen as copy.
    expect(displayWarnings(parsed.widgets[OK_WIDGET].warnings)).toEqual([
      "CURRENCY_FILTER_REQUIRED",
    ]);
  });

  it("omits the filters block entirely when nothing is selected", () => {
    expect(
      buildRunRequest({ datePreset: null, compare: null, branchId: null, currencyCode: null }),
    ).toEqual({});
    expect(
      buildRunRequest({
        datePreset: "CURRENT_MONTH",
        compare: "PREVIOUS_PERIOD",
        branchId: null,
        currencyCode: "EGP",
      }),
    ).toEqual({
      filters: { datePreset: "CURRENT_MONTH", compare: "PREVIOUS_PERIOD", currencyCode: "EGP" },
    });
  });

  it("sends the expected widget revision so a stale drill-down is refused, not answered", () => {
    const body = buildDrilldownRequest({
      pointKey: "web",
      seriesKey: null,
      cursor: null,
      expectedWidgetRevision: 3,
      selection: { datePreset: null, compare: null, branchId: null, currencyCode: null },
    });
    expect(body).toEqual({ pointKey: "web", limit: 25, expectedWidgetRevision: 3 });
    expect(() =>
      buildDrilldownRequest({
        pointKey: "   ",
        seriesKey: null,
        cursor: null,
        expectedWidgetRevision: 1,
        selection: { datePreset: null, compare: null, branchId: null, currencyCode: null },
      }),
    ).toThrow("CRM_DRILLDOWN_SELECTION_INVALID");
  });

  it("reads a cursor-paged drill-down and keeps the cursor byte-for-byte", () => {
    const page = parseDrilldownResponse({
      dashboardId: DASHBOARD_ID,
      widgetId: OK_WIDGET,
      placementId: "p",
      widgetRevision: 3,
      selection: { pointKey: "web" },
      records: [{ id: "lead-1", title: "Acme", amount: 1200.5, currencyCode: "EGP" }],
      pageInfo: { limit: 25, hasMore: true, nextCursor: "Q3Vyc29yLTE" },
    });
    expect(page.records[0].fields.title).toBe("Acme");
    expect(page.records[0].fields.amount).toBe(1200.5);
    expect(page.nextCursor).toBe("Q3Vyc29yLTE");
    expect(page.hasMore).toBe(true);
  });
});
