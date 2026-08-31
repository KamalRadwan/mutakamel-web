import { describe, expect, it } from "vitest";
import {
  buildAddPlacementRequest,
  buildCreateDashboardRequest,
  buildLayoutRequest,
  buildNamedRequest,
  buildUpdateDashboardRequest,
  dashboardDrilldownPath,
  dashboardPlacementPath,
  dashboardRunPath,
  parseDashboardDetailResponse,
  parseDashboardRevisionResponse,
  parseDashboardsResponse,
  parseNavigationResponse,
} from "./dashboard-contract";
import {
  buildCreateWidgetRequest,
  buildUpdateWidgetRequest,
  parseWidgetDetailResponse,
  parseWidgetUpdateResponse,
} from "./widget-contract";

const DASHBOARD_ID = "01900300-0000-7000-8000-000000000001";
const WIDGET_ID = "01900300-0000-7000-8000-0000000000a1";
const PLACEMENT_ID = "01900300-0000-7000-8000-0000000000b1";
const OWNER_ID = "01900300-0000-7000-8000-0000000000c1";

const widget = {
  id: WIDGET_ID,
  ownerUserId: OWNER_ID,
  ownerName: "Sara Ali",
  name: "New leads",
  visualizationType: "METRIC_CARD",
  querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
  displaySpec: {},
  schemaVersion: 1,
  revision: 3,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-02T09:00:00.000Z",
  accessLevel: "OWNER",
};

const dashboard = {
  id: DASHBOARD_ID,
  ownerUserId: OWNER_ID,
  ownerName: "Sara Ali",
  name: "Sales overview",
  description: "Daily numbers",
  defaultFilters: { datePreset: "CURRENT_MONTH" },
  sourceTemplateKey: "CRM_DEFAULT",
  schemaVersion: 1,
  revision: 7,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-02T09:00:00.000Z",
  accessLevel: "OWNER",
  isShared: false,
  isDefault: true,
  isFavorite: false,
  lastOpenedAt: "2026-08-03T09:00:00.000Z",
  placements: [
    {
      id: PLACEMENT_ID,
      dashboardId: DASHBOARD_ID,
      widgetId: WIDGET_ID,
      x: 0,
      y: 0,
      width: 3,
      height: 2,
      sortOrder: 0,
      widget,
    },
  ],
  unavailablePlacements: [
    {
      id: "01900300-0000-7000-8000-0000000000b2",
      x: 3,
      y: 0,
      width: 3,
      height: 2,
      sortOrder: 1,
      reason: "WIDGET_PERMISSION_REQUIRED",
    },
  ],
};

describe("CRM dashboards API contract", () => {
  it("parses the raw CRM payload — these responses carry no Core `data` envelope", () => {
    const [summary] = parseDashboardsResponse([dashboard]);
    expect(summary.id).toBe(DASHBOARD_ID);
    expect(summary.accessLevel).toBe("OWNER");
    expect(summary.isDefault).toBe(true);
    expect(() => parseDashboardsResponse({ success: true, data: [dashboard] })).toThrow();
  });

  it("keeps unavailable placements distinct from visible ones", () => {
    const detail = parseDashboardDetailResponse(dashboard);
    expect(detail.placements).toHaveLength(1);
    expect(detail.placements[0].widget.name).toBe("New leads");
    expect(detail.unavailablePlacements[0].reason).toBe("WIDGET_PERMISSION_REQUIRED");
    // No `duplication` block outside POST /:id/duplicate.
    expect(detail.duplication).toBeNull();
  });

  it("reads the duplication warning block, which only POST /:id/duplicate returns", () => {
    const detail = parseDashboardDetailResponse({
      ...dashboard,
      duplication: { omittedUnavailableWidgetCount: 2, warnings: ["UNAVAILABLE_WIDGETS_OMITTED"] },
    });
    expect(detail.duplication?.omittedUnavailableWidgetCount).toBe(2);
    expect(detail.duplication?.warnings).toEqual(["UNAVAILABLE_WIDGETS_OMITTED"]);
  });

  it("parses the navigation projection, which is narrower than the list", () => {
    const navigation = parseNavigationResponse({
      items: [
        {
          id: DASHBOARD_ID,
          name: "Sales overview",
          isDefault: true,
          isFavorite: false,
          isShared: false,
          accessLevel: "OWNER",
          ownerUserId: OWNER_ID,
          ownerName: "Sara Ali",
          revision: 7,
          updatedAt: "2026-08-02T09:00:00.000Z",
        },
      ],
      activeDashboardId: DASHBOARD_ID,
    });
    expect(navigation.activeDashboardId).toBe(DASHBOARD_ID);
    expect(navigation.items[0].name).toBe("Sales overview");
  });

  it("reads DELETE /:id/placements/:placementId as a 200 with the new revision", () => {
    expect(parseDashboardRevisionResponse({ dashboardRevision: 9 })).toBe(9);
    expect(() => parseDashboardRevisionResponse({})).toThrow();
  });

  it("omits an empty description and an absent template rather than sending null", () => {
    expect(
      buildCreateDashboardRequest({ name: " Sales ", description: "  ", templateKey: null }),
    ).toEqual({ name: "Sales" });
    expect(
      buildCreateDashboardRequest({ name: "Sales", description: "x", templateKey: "CRM_DEFAULT" }),
    ).toEqual({ name: "Sales", description: "x", templateKey: "CRM_DEFAULT" });
    expect(buildNamedRequest("   ")).toEqual({});
  });

  it("always sends `revision` on an update — there is no If-Match anywhere in crm-app", () => {
    expect(
      buildUpdateDashboardRequest({ revision: 7, name: "Sales", description: "" }),
    ).toEqual({ revision: 7, name: "Sales", description: "" });
  });

  it("sends the complete placement set on a layout write", () => {
    const body = buildLayoutRequest(7, [
      { id: PLACEMENT_ID, x: 0, y: 0, width: 3, height: 2 },
    ]) as { revision: number; placements: Array<Record<string, unknown>> };
    expect(body.revision).toBe(7);
    expect(body.placements[0]).toEqual({
      placementId: PLACEMENT_ID,
      x: 0,
      y: 0,
      width: 3,
      height: 2,
    });
  });

  it("refuses a placement body with a non-UUIDv7 widget id", () => {
    expect(buildAddPlacementRequest(WIDGET_ID)).toEqual({ widgetId: WIDGET_ID });
    expect(() => buildAddPlacementRequest("not-a-uuid")).toThrow("CRM_WIDGET_NOT_FOUND");
  });

  it("builds canonical Gateway paths and refuses a non-UUID segment", () => {
    expect(dashboardRunPath(DASHBOARD_ID)).toBe(
      `/api/tenant/crm/v1/dashboards/${DASHBOARD_ID}/run`,
    );
    expect(dashboardDrilldownPath(DASHBOARD_ID, WIDGET_ID)).toBe(
      `/api/tenant/crm/v1/dashboards/${DASHBOARD_ID}/widgets/${WIDGET_ID}/drilldown`,
    );
    expect(dashboardPlacementPath(DASHBOARD_ID, PLACEMENT_ID)).toBe(
      `/api/tenant/crm/v1/dashboards/${DASHBOARD_ID}/placements/${PLACEMENT_ID}`,
    );
    expect(() => dashboardRunPath("../widgets")).toThrow();
  });
});

describe("CRM widgets API contract", () => {
  it("reads usage, and keeps `activeShareCount` null when the server omits it", () => {
    const detail = parseWidgetDetailResponse({
      ...widget,
      usage: {
        placementCount: 4,
        dashboardCount: 2,
        hiddenPlacementCount: 1,
        placements: [
          {
            placementId: PLACEMENT_ID,
            dashboardId: DASHBOARD_ID,
            dashboardName: "Sales overview",
            dashboardRevision: 7,
            x: 0,
            y: 0,
            width: 3,
            height: 2,
          },
        ],
      },
    });
    expect(detail.usage?.placementCount).toBe(4);
    expect(detail.usage?.hiddenPlacementCount).toBe(1);
    expect(detail.usage?.activeShareCount).toBeNull();
  });

  it("reads the layout adjustments a widget update reports", () => {
    const result = parseWidgetUpdateResponse({
      ...widget,
      dashboardRevisions: { [DASHBOARD_ID]: 8 },
      layoutAdjustments: [
        { placementId: PLACEMENT_ID, dashboardId: DASHBOARD_ID, x: 0, y: 6, width: 6, height: 6 },
      ],
    });
    expect(result.dashboardRevisions[DASHBOARD_ID]).toBe(8);
    expect(result.layoutAdjustments[0].y).toBe(6);
  });

  it("omits an empty displaySpec and always sends the widget revision on update", () => {
    expect(
      buildCreateWidgetRequest({
        name: "New leads",
        visualizationType: "METRIC_CARD",
        querySpec: { series: [{ metricKey: "crm.leads.created.count" }] },
      }),
    ).toEqual({
      name: "New leads",
      visualizationType: "METRIC_CARD",
      querySpec: { series: [{ metricKey: "crm.leads.created.count" }] },
    });
    expect(buildUpdateWidgetRequest({ revision: 3, name: "Renamed" })).toEqual({
      revision: 3,
      name: "Renamed",
    });
  });
});
