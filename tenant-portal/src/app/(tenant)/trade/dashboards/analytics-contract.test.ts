import { describe, expect, it } from "vitest";
import {
  DASHBOARDS_PATH,
  DASHBOARD_ACCESS_LEVELS,
  DASHBOARD_LIST_LIMIT,
  DASHBOARD_SHAREABLE_ACCESS_LEVELS,
  DASHBOARD_VISUALIZATION_TYPES,
  dashboardFromTemplatePath,
  dashboardPath,
  dashboardSharePath,
  dashboardsListPath,
  isAnalyticsBodyReplay,
  isDashboardPermissionRefusal,
  isDashboardVisualizationType,
  parseDashboardListPage,
  parseDashboardScalar,
  parseWidgetExecutionResult,
  shareTargetsPath,
  unwrapAnalyticsWrite,
  widgetPath,
} from "./analytics-contract";
import {
  buildBulkSharesRequest,
  buildLayoutRequest,
  buildRunRequest,
  buildSetFavoriteRequest,
  buildWidgetPreviewRequest,
  preferenceContext,
} from "./analytics-requests";

const companyId = "01902001-3000-7000-8000-000000000001";
const dashboardId = "01902001-3000-7000-8000-000000000002";
const widgetId = "01902001-3000-7000-8000-000000000003";
const shareId = "01902001-3000-7000-8000-000000000004";
const placementId = "01902001-3000-7000-8000-000000000005";

describe("Trade analytics — the scalar union", () => {
  it("types a COUNT metric as a number and everything else as a decimal string", () => {
    // scalarResult(): metric.unit === COUNT ? safeCount(value) : decimal(value)
    expect(parseDashboardScalar(42, "COUNT")).toEqual({ kind: "count", value: 42 });
    expect(parseDashboardScalar("1250.75", "MONEY")).toEqual({
      kind: "decimal",
      value: "1250.75",
    });
    expect(parseDashboardScalar("12.3456", "PERCENT")).toEqual({
      kind: "decimal",
      value: "12.3456",
    });
  });

  it("rejects the wrong half of the union rather than coercing it", () => {
    // A validator that typed `scalar` as one or the other would silently
    // destroy the other family; both directions must fail loudly.
    expect(parseDashboardScalar("42", "COUNT")).toBeNull();
    expect(parseDashboardScalar(1250.75, "MONEY")).toBeNull();
    // safeCount only ever produces a non-negative safe integer.
    expect(parseDashboardScalar(-1, "COUNT")).toBeNull();
  });

  it("reads a money partition without ever turning it into a number", () => {
    const result = parseWidgetExecutionResult({
      widgetId,
      status: "READY",
      shape: "SCALAR",
      completeness: "COMPLETE",
      partitions: [
        {
          companyId,
          currencyCode: "SAR",
          scalar: "9007199254740993.50",
          series: [{ key: "trade.sales.total", unit: "MONEY", points: [] }],
        },
      ],
    });
    // The value is past Number.MAX_SAFE_INTEGER: only an exact string survives.
    expect(result.partitions[0].scalar).toEqual({
      kind: "decimal",
      value: "9007199254740993.50",
    });
  });

  it("reads a series point with the same union as its series unit", () => {
    const result = parseWidgetExecutionResult({
      widgetId,
      status: "READY",
      shape: "TIME_SERIES",
      completeness: "COMPLETE",
      partitions: [
        {
          companyId,
          series: [
            {
              key: "trade.orders.count",
              unit: "COUNT",
              points: [
                { key: "2026-08", value: 12 },
                { key: "2026-09", value: "13" },
              ],
            },
          ],
        },
      ],
    });
    const points = result.partitions[0].series[0].points;
    expect(points[0].value).toEqual({ kind: "count", value: 12 });
    // A string under a COUNT unit is not a count and is not silently accepted.
    expect(points[1].value).toBeNull();
  });

  it("keeps a FAILED tile's error code, which arrives inside a 200 response", () => {
    const result = parseWidgetExecutionResult({
      widgetId,
      status: "FAILED",
      shape: "SCALAR",
      completeness: "UNKNOWN",
      partitions: [],
      errorCode: "TRADE.DASHBOARD.EXECUTION_FAILED",
    });
    expect(result.status).toBe("FAILED");
    expect(result.errorCode).toBe("TRADE.DASHBOARD.EXECUTION_FAILED");
  });
});

describe("Trade analytics — revision concurrency and the unwrapped write", () => {
  it("reads the record out of a write response that was not unwrapped", () => {
    // Services answer { created, replayed, dashboard }, which fails the
    // interceptor's value+replayed test and passes through verbatim.
    const body = { created: true, replayed: false, dashboard: { id: dashboardId } };
    expect(unwrapAnalyticsWrite(body, "dashboard")).toEqual({ id: dashboardId });
    expect(isAnalyticsBodyReplay(body)).toBe(false);
    expect(isAnalyticsBodyReplay({ ...body, replayed: true })).toBe(true);
  });

  it("carries the revision as the bulk-share concurrency token", () => {
    // shares/bulk-upsert has no If-Match at all: resourceRevision in the body
    // is the whole of its concurrency control.
    expect(
      buildBulkSharesRequest(7, [
        { subjectId: companyId, subjectType: "USER", accessLevel: "VIEW" },
      ]),
    ).toEqual({
      resourceRevision: 7,
      changes: [{ subjectId: companyId, subjectType: "USER", accessLevel: "VIEW" }],
    });
    expect(() => buildBulkSharesRequest(0, [])).toThrow("ANALYTICS_FORM_SHARE");
  });

  it("cannot grant OWNER, which ShareChangeDto does not accept", () => {
    expect(DASHBOARD_ACCESS_LEVELS).toContain("OWNER");
    expect(DASHBOARD_SHAREABLE_ACCESS_LEVELS).not.toContain("OWNER");
  });
});

describe("Trade analytics — paths and request bodies", () => {
  it("sends limit and offset, never page", () => {
    // DashboardListQueryDto whitelists limit and offset; `page` is a 400.
    expect(dashboardsListPath(50)).toBe(
      `${DASHBOARDS_PATH}?limit=${DASHBOARD_LIST_LIMIT}&offset=50`,
    );
    expect(dashboardsListPath(0)).not.toContain("page=");
  });

  it("reads the pagination object, which carries no total", () => {
    const page = parseDashboardListPage({
      items: [],
      pagination: { limit: 50, offset: 0, nextOffset: 50 },
    });
    expect(page.nextOffset).toBe(50);
    expect(page).not.toHaveProperty("total");
    const last = parseDashboardListPage({
      items: [],
      pagination: { limit: 50, offset: 50, nextOffset: null },
    });
    expect(last.nextOffset).toBeNull();
  });

  it("builds every analytics path as a canonical Gateway path", () => {
    expect(dashboardPath(dashboardId)).toBe(`${DASHBOARDS_PATH}/${dashboardId}`);
    expect(dashboardSharePath(dashboardId, shareId)).toBe(
      `${DASHBOARDS_PATH}/${dashboardId}/shares/${shareId}`,
    );
    expect(dashboardFromTemplatePath("TRADE EXECUTIVE")).toBe(
      `${DASHBOARDS_PATH}/from-template/TRADE%20EXECUTIVE`,
    );
    expect(widgetPath(widgetId)).toBe(`/api/tenant/trade/v1/widgets/${widgetId}`);
    expect(shareTargetsPath("/api/tenant/trade/v1/widgets/share-targets", " ann ")).toBe(
      "/api/tenant/trade/v1/widgets/share-targets?limit=50&search=ann",
    );
    expect(() => dashboardPath("nope")).toThrow("Invalid Trade analytics response.");
  });

  it("sends a requestId on a run and on a preview, because both require one", () => {
    // RunDashboardDto.requestId and PreviewWidgetDto.requestId are both
    // required UUID v7s; the preview also needs the complete definition.
    expect(buildRunRequest().requestId).toMatch(/^[0-9a-f-]{36}$/u);
    const preview = buildWidgetPreviewRequest(
      "Orders",
      "METRIC_CARD",
      [{ metricKey: "trade.orders.count", label: "" }],
      "",
    );
    expect(preview.requestId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(preview.querySpec.series).toEqual([{ metricKey: "trade.orders.count" }]);
    expect(preview.visualizationType).toBe("METRIC_CARD");
  });

  it("sends a preference context on set-default and set-favorite", () => {
    expect(preferenceContext(null)).toEqual({ kind: "CONSOLIDATED" });
    expect(preferenceContext(companyId)).toEqual({ kind: "COMPANY", companyId });
    expect(buildSetFavoriteRequest(companyId, true)).toEqual({
      context: { kind: "COMPANY", companyId },
      favorite: true,
    });
  });

  it("sends all five coordinates on every layout placement", () => {
    expect(
      buildLayoutRequest([
        {
          id: placementId,
          widgetId,
          x: 0,
          y: 1,
          width: 6,
          height: 4,
          sortOrder: 2,
          widget: { id: widgetId, name: "w", visualizationType: "LINE", revision: 1 },
        },
      ]),
    ).toEqual({
      placements: [{ placementId, x: 0, y: 1, width: 6, height: 4, sortOrder: 2 }],
    });
  });

  it("offers all twenty visualization types", () => {
    // Offering fewer silently drops metrics whose only compatible
    // visualization is missing.
    expect(DASHBOARD_VISUALIZATION_TYPES).toHaveLength(20);
    expect(isDashboardVisualizationType("DETAILED_SPEEDOMETER")).toBe(true);
    expect(isDashboardVisualizationType("SPARKLINE")).toBe(false);
  });

  it("treats the two 422 authorization codes as permission refusals", () => {
    // S7's 403-to-PermissionGate rule never fires for these.
    expect(
      isDashboardPermissionRefusal({ status: 422, code: "TRADE.DASHBOARD.SCOPE_DENIED" }),
    ).toBe(true);
    expect(
      isDashboardPermissionRefusal({
        status: 422,
        code: "TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED",
      }),
    ).toBe(true);
    expect(
      isDashboardPermissionRefusal({ status: 422, code: "TRADE.DASHBOARD.FILTER_INVALID" }),
    ).toBe(false);
  });
});
