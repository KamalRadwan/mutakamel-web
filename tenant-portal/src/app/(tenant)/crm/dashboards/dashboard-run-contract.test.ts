import { describe, expect, it } from "vitest";
import {
  buildDrilldownRequest,
  buildRunRequest,
  customDateRangeError,
  DATE_PRESETS,
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
  it("binds population selections to the run and drill and validates the options against selected branches", () => {
    const companyId = "018f0000-0000-7000-8000-000000000011";
    const branchId = "018f0000-0000-7000-8000-000000000012";
    const otherBranch = "018f0000-0000-7000-8000-000000000013";
    const teamId = "018f0000-0000-7000-8000-00000000001a";
    const ownerId = "018f0000-0000-7000-8000-00000000001b";
    const filters = { branchId, teamIds: [teamId], ownerUserIds: [ownerId] };
    const selection = { ...filters, teamIds: [teamId.toUpperCase()], datePreset: null, compare: null, currencyCode: null };
    const organizationScope = { companyId: null, branchId, partialAccess: false, companies: [{ id: companyId, name: "North" }],
      branches: [{ id: branchId, name: "West", companyId, companyName: "North" }, { id: otherBranch, name: "East", companyId, companyName: "North" }] };
    const scope = { state: "READY", teamIds: [teamId], ownerUserIds: [ownerId],
      teams: [{ id: teamId, name: "Sales", branchIds: [branchId] }], owners: [{ id: ownerId, name: "Mariam", branchIds: [branchId] }] };
    const response = { ...run, filters, organizationScope, populationScope: scope, scope: [{ branchId, scope: "team" }] };
    expect(buildRunRequest(selection, true)).toEqual({ filters, includePopulationOptions: true });
    expect(buildDrilldownRequest({ selection, pointKey: "web", cursor: null, seriesKey: null, expectedWidgetRevision: 7 })).toMatchObject({ filters });
    expect(parseRunResponse(response, selection).populationScope).toEqual({ state: "READY", teams: scope.teams, owners: scope.owners });
    expect(() => parseRunResponse({ ...response, populationScope: undefined }, selection)).toThrow();
    expect(() => parseRunResponse({ ...response, populationScope: { ...scope, teamIds: [] } }, selection)).toThrow();
    expect(() => parseRunResponse({ ...response, scope: [{ branchId: otherBranch, scope: "all" }] }, selection)).toThrow();
    expect(() => parseRunResponse({ ...response, populationScope: { ...scope, state: "SOURCE_NOT_READY" } }, selection)).toThrow();
    expect(() => parseRunResponse({ ...response, populationScope: { ...scope, owners: [{ ...scope.owners[0], branchIds: [otherBranch] }] } }, selection)).toThrow();
    expect(() => buildRunRequest({ ...selection, ownerUserIds: [ownerId, ownerId.toUpperCase()] })).toThrow();
  });

  it("validates canonical organization sets without accepting a broader result", () => {
    const north = "018f0000-0000-7000-8000-00000000000a";
    const south = "018f0000-0000-7000-8000-00000000000b";
    const west = "018f0000-0000-7000-8000-00000000000c";
    const coast = "018f0000-0000-7000-8000-00000000000d";
    const selection = { datePreset: null, compare: null, branchId: null, currencyCode: null,
      companyIds: [south, north.toUpperCase()], branchIds: [coast, west] };
    const sets = { companyIds: [north, south], branchIds: [west, coast] };
    const organizationScope = { companyId: null, branchId: null, ...sets, partialAccess: false,
      companies: [{ id: north, name: "North" }, { id: south, name: "South" }],
      branches: [{ id: west, name: "West", companyId: north, companyName: "North" },
        { id: coast, name: "Coast", companyId: south, companyName: "South" }] };
    const response = { ...run, filters: sets, organizationScope, scope: [{ branchId: west, scope: "own" }, { branchId: coast, scope: "team" }] };
    expect(buildRunRequest(selection)).toEqual({ filters: sets });
    expect(buildDrilldownRequest({ selection, pointKey: "web", cursor: null, seriesKey: null, expectedWidgetRevision: 7 }))
      .toMatchObject({ filters: sets });
    expect(parseRunResponse(response, selection).organizationScope?.branches).toEqual(organizationScope.branches);
    expect(() => parseRunResponse({ ...response, scope: [...response.scope, { branchId: west, scope: "all" }] }, selection)).toThrow();
    expect(() => parseRunResponse({ ...response, filters: { ...sets, companyIds: [north] } }, selection)).toThrow();
    expect(() => buildRunRequest({ ...selection, companyId: north })).toThrow();
    expect(() => buildRunRequest({ ...selection, companyIds: [north, north.toUpperCase()] })).toThrow();
  });
  it("binds company selection to the run and drill and rejects mismatched branch evidence", () => {
    const companyId = "018f0000-0000-7000-8000-000000000011";
    const branchId = "018f0000-0000-7000-8000-000000000012";
    const otherBranch = "018f0000-0000-7000-8000-000000000013";
    const selection = { datePreset: null, compare: null, branchId, currencyCode: null, companyId };
    const organizationScope = { companyId, branchId, partialAccess: false,
      companies: [{ id: companyId, name: "North" }], branches: [{ id: branchId, name: "West", companyId, companyName: "North" }] };
    const response = { ...run, filters: { companyId, branchId }, organizationScope, scope: [{ branchId, scope: "team" }] };
    expect(buildRunRequest(selection)).toEqual({ filters: { companyId, branchId } });
    expect(buildDrilldownRequest({ selection, pointKey: "web", cursor: null, seriesKey: null, expectedWidgetRevision: 7 }))
      .toMatchObject({ filters: { companyId, branchId } });
    expect(parseRunResponse(response, selection).organizationScope?.branches).toEqual(organizationScope.branches);
    expect(() => parseRunResponse({ ...response, scope: [{ branchId: otherBranch, scope: "all" }] }, selection)).toThrow();
    expect(() => parseRunResponse(run, selection)).toThrow();
    expect(() => parseRunResponse(response, { ...selection, companyId: null })).toThrow();
  });

  it("supports every current date preset and sends only valid custom date pairs", () => {
    expect(DATE_PRESETS).toHaveLength(13);
    const base = { datePreset: null, compare: null, branchId: null, currencyCode: null };
    expect(buildRunRequest({ ...base, datePreset: "CUSTOM", dateFrom: "2026-11-01", dateTo: "2026-11-03" }))
      .toEqual({ filters: { datePreset: "CUSTOM", dateFrom: "2026-11-01", dateTo: "2026-11-03" } });
    expect(buildRunRequest({ ...base, datePreset: "TODAY", dateFrom: "2026-11-01", dateTo: "2026-11-03" }))
      .toEqual({ filters: { datePreset: "TODAY" } });
    expect(buildRunRequest({ ...base, datePreset: "LAST_3_COMPLETE_MONTHS" }))
      .toEqual({ filters: { datePreset: "LAST_3_COMPLETE_MONTHS" } });
    expect(customDateRangeError("2026-02-30", "2026-03-01")).toBe("invalid");
    expect(customDateRangeError("2026-11-03", "2026-11-01")).toBe("invalid");
    expect(() => buildRunRequest({ ...base, datePreset: "CUSTOM" })).toThrow("DATE_RANGE_INVALID");
  });
  it("preserves retirement separately from an empty or failed result", () => {
    const parsed = parseWidgetResult({
      widgetId: OK_WIDGET,
      state: "RETIRED",
      shape: "SCALAR",
      value: null,
      series: [],
      rows: [],
      meta: { availability: "RETIRED", generatedAt: run.generatedAt, warnings: [] },
    });
    expect(parsed.state).toBe("RETIRED");
    expect(parsed.value).toBeNull();
    expect(parsed.errorCode).toBeNull();
  });
  it("keeps a failed widget beside the ones that worked — the dashboard is not all-or-nothing", () => {
    const parsed = parseRunResponse(run);
    expect(Object.keys(parsed.widgets)).toHaveLength(2);
    expect(parsed.widgets[OK_WIDGET].errorCode).toBeNull();
    expect(parsed.widgets[OK_WIDGET].series[0].points).toHaveLength(2);
    expect(parsed.widgets[FAILED_WIDGET].errorCode).toBe("CRM_WIDGET_METRIC_INVALID");
    expect(failedWidgetIds(parsed)).toEqual([FAILED_WIDGET]);
    expect(parsed.unavailablePlacementCount).toBe(1);
  });

  it("keeps source readiness separate from execution failures", () => {
    const parsed = parseRunResponse({ ...run, widgets: { ...run.widgets,
      [FAILED_WIDGET]: { ...failedResult, state: "UNAVAILABLE", error: { code: "CRM_TEAM_SCOPE_NOT_READY" } },
    } });
    expect(parsed.widgets[FAILED_WIDGET]).toMatchObject({ state: "UNAVAILABLE", errorCode: "CRM_TEAM_SCOPE_NOT_READY", value: null });
    expect(failedWidgetIds(parsed)).toEqual([]);
  });

  it("has no `meta.unit` on the failure path, and does not invent one", () => {
    const parsed = parseWidgetResult(failedResult);
    expect(parsed.unit).toBeNull();
    expect(parsed.value).toBeNull();
    expect(parsed.series).toEqual([]);
  });

  it("preserves current paired points, null gaps and matched period windows", () => {
    const parsed = parseWidgetResult({
      ...okResult,
      state: "READY",
      shape: "TIME_SERIES",
      series: [{ ...okResult.series[0], points: [
        { key: "2026-10-01", value: null, previousValue: 12, previousKey: "2026-09-01", previousStart: "2026-09-01T00:00:00Z", previousEnd: "2026-09-02T00:00:00Z" },
        { key: "2026-10-02", value: 0, previousValue: null, previousKey: null },
      ] }],
    });
    expect(parsed.series).toHaveLength(1);
    expect(parsed.series[0].points[0]).toMatchObject({ value: null, previousValue: 12, previousKey: "2026-09-01", previousStart: "2026-09-01T00:00:00Z", previousEnd: "2026-09-02T00:00:00Z" });
    expect(parsed.series[0].points[1]).toMatchObject({ value: 0, previousValue: null, previousKey: null });
  });

  it.each([undefined, "12", Number.NaN, Number.POSITIVE_INFINITY])("rejects an invalid point value instead of inventing zero (%s)", (value) => {
    expect(() => parseWidgetResult({ ...okResult, series: [{ ...okResult.series[0], points: [{ key: "invalid", value }] }] })).toThrow();
  });

  it.each(["READY", "EMPTY", "UNAVAILABLE", "RETIRED", "FAILED", "DEADLINE_EXCEEDED"])("preserves the current %s state", (state) => {
    expect(parseWidgetResult({ ...okResult, state }).state).toBe(state);
  });

  it("rejects an unknown state rather than rendering it as a successful value", () => {
    expect(() => parseWidgetResult({ ...okResult, state: "UNREGISTERED" })).toThrow();
  });

  it("retains canonical XY size and scalar comparison metadata", () => {
    const comparison = { type: "PREVIOUS_PERIOD", previousValue: 12, absoluteChange: 3, percentChange: 25,
      previousWindow: { from: "2026-09-01", to: "2026-09-30", fromInstant: "2026-09-01T00:00:00Z", toInstant: "2026-10-01T00:00:00Z" } };
    const parsed = parseWidgetResult({ ...okResult, comparison, details: { includedCount: 15 },
      series: [{ ...okResult.series[0], points: [{ key: "deal", value: 75, secondaryValue: 50000, size: 30 }] }] });
    expect(parsed.series[0].points[0]).toMatchObject({ value: 75, secondaryValue: 50000, size: 30 });
    expect(parsed.comparison).toEqual(comparison);
    expect(parsed.details).toEqual({ includedCount: 15 });
  });

  it("keeps source-proven partial coverage and ignored-filter metadata", () => {
    const parsed = parseWidgetResult({ ...okResult, meta: { ...okResult.meta, partialAccess: true, ignoredFilters: ["ownerUserId"], timeBasis: "SNAPSHOT" } });
    expect(parsed.partialAccess).toBe(true);
    expect(parsed.ignoredFilters).toEqual(["ownerUserId"]);
    expect(parsed.timeBasis).toBe("SNAPSHOT");
    expect(() => parseWidgetResult({ ...okResult, meta: { ...okResult.meta, ignoredFilters: "ownerUserId" } })).toThrow();
  });

  it("reads currency options from current series and currency metadata without summing values", () => {
    const parsed = parseRunResponse({
      ...run,
      widgets: {
        [OK_WIDGET]: {
          ...okResult,
          series: [{ ...okResult.series[0], currency: "EGP" }],
          meta: {
            ...okResult.meta,
            otherCurrencies: [{ currencyCode: "SAR", value: 20 }],
            breakdown: [{ currencyCode: "USD", value: 30 }],
            warnings: ["OTHER_CURRENCIES"],
          },
        },
      },
    });
    expect(currenciesInRun(parsed)).toEqual(["EGP", "SAR", "USD"]);
    expect(parsed.widgets[OK_WIDGET].otherCurrencies).toEqual([{ currencyCode: "SAR", value: 20 }]);
    expect(displayWarnings(parsed.widgets[OK_WIDGET].warnings)).toEqual(["OTHER_CURRENCIES"]);
    const obsolete = parseRunResponse({ ...run, widgets: { [OK_WIDGET]: { ...okResult, meta: { ...okResult.meta, warnings: ["CURRENCIES:JPY"] } } } });
    expect(currenciesInRun(obsolete)).toEqual([]);
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
