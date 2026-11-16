// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseDashboardDetailResponse } from "../../dashboard-contract";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { DashboardCatalog } from "../../dashboard-catalog-contract";
import { useDashboardLayout } from "./useDashboardLayout";
const { post, put, auth } = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), auth: { generation: 0 } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ realtimeAuthGeneration: auth.generation, user: { id: "01900300-0000-7000-8000-000000000001", isTenantOwner: true, permissions: [] } }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...(await original<typeof import("@/lib/api/axiosClient")>()), axiosClient: { post, put } }));
const ID = "01900300-0000-7000-8000-000000000001", WIDGET = "01900300-0000-7000-8000-000000000002", PLACEMENT = "01900300-0000-7000-8000-000000000003";
const widget = { id: WIDGET, ownerUserId: ID, name: "Leads", visualizationType: "METRIC_CARD", querySpec: { series: [{ metricKey: "crm.leads.created.count" }] }, displaySpec: {}, schemaVersion: 1, revision: 1, accessLevel: "OWNER", createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z" };
const detail = () => parseDashboardDetailResponse({ id: ID, ownerUserId: ID, name: "Sales", revision: 1, accessLevel: "OWNER", updatedAt: "2026-11-03T10:00:00Z", placements: [], unavailablePlacements: [] });
beforeEach(() => { auth.generation++; });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("keeps the adjusted coordinates and original revision when the server layout changes", async () => {
  const placement = { id: PLACEMENT, dashboardId: ID, widgetId: WIDGET, x: 0, y: 0, width: 3, height: 2, sortOrder: 0, widget };
  const current = parseDashboardDetailResponse({ ...detail(), placements: [placement] });
  const catalog: DashboardCatalog = { gridColumns: 12, maxWidgets: 20, metrics: [], dimensions: [], templates: [],
    visualizations: [{ key: "METRIC_CARD", shapes: ["SCALAR"], minSeries: 1, maxSeries: 1, requiresTarget: false,
      supportsPeriodComparison: false, minW: 3, maxW: 6, minH: 2, maxH: 4 }],
  };
  put.mockRejectedValue(new TenantApiClientError("stale layout", { status: 409, statusText: "Conflict", headers: new Headers(), data: { code: "CRM_DASHBOARD_REVISION_CONFLICT" } }));
  const refresh = vi.fn();
  const { result, rerender } = renderHook(({ server }) => useDashboardLayout(ID, server, refresh, catalog), { initialProps: { server: current } });
  act(() => result.current.setIsEditing(true));
  act(() => result.current.adjust(PLACEMENT, { property: "x", step: 1 }));
  expect(result.current.isDirty).toBe(true);
  rerender({ server: { ...current, revision: 2 } });
  await act(async () => expect(await result.current.save()).toMatchObject({ ok: false, conflict: true }));
  expect(put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ revision: 1,
    placements: [expect.objectContaining({ placementId: PLACEMENT, x: 1, y: 0, width: 3, height: 2 })],
  }), expect.any(Object));
  expect(refresh).not.toHaveBeenCalled();
});
it("locks add synchronously and validates exact placement plus widget and increased revision", async () => {
  let done!: (response: unknown) => void; post.mockReturnValue(new Promise((resolve) => { done = resolve; }));
  const refresh = vi.fn().mockResolvedValue(true); const current = detail();
  const { result } = renderHook(() => useDashboardLayout(ID, current, refresh));
  let first!: ReturnType<typeof result.current.addWidget>;
  act(() => { first = result.current.addWidget(WIDGET); void result.current.addWidget(WIDGET); });
  expect(post).toHaveBeenCalledTimes(1);
  await act(async () => { done({ data: { id: PLACEMENT, dashboardId: ID, widgetId: WIDGET, x: 0, y: 0, width: 3, height: 2, dashboardRevision: 2, widget } }); expect(await first).toMatchObject({ ok: true }); });
  expect(refresh).toHaveBeenCalledTimes(1);
});
it("ignores an old-route completion without refreshing or reporting permission failure", async () => {
  let done!: (response: unknown) => void; post.mockReturnValue(new Promise((resolve) => { done = resolve; }));
  const current = detail(); const refresh = vi.fn();
  const { result, rerender } = renderHook(({ id }) => useDashboardLayout(id, current, refresh), { initialProps: { id: ID } });
  let pending!: ReturnType<typeof result.current.addWidget>;
  act(() => { pending = result.current.addWidget(WIDGET); });
  rerender({ id: WIDGET });
  await act(async () => { done({ data: { id: PLACEMENT, dashboardId: ID, widgetId: WIDGET, x: 0, y: 0, width: 3, height: 2, dashboardRevision: 2, widget } });
    expect(await pending).toMatchObject({ ok: false, ignored: true, error: null }); });
  expect(refresh).not.toHaveBeenCalled();
});
it("does not accept a wrong-dashboard placement receipt or bypass uncertainty by remounting", async () => {
  post.mockResolvedValue({ data: { id: PLACEMENT, dashboardId: WIDGET, widgetId: WIDGET, x: 0, y: 0, width: 3, height: 2, dashboardRevision: 2, widget } });
  const current = detail(); const refresh = vi.fn();
  const first = renderHook(() => useDashboardLayout(ID, current, refresh));
  await act(async () => { expect((await first.result.current.addWidget(WIDGET)).ok).toBe(false); }); first.unmount();
  const second = renderHook(() => useDashboardLayout(ID, current, refresh));
  await act(async () => { expect((await second.result.current.addWidget(WIDGET)).ok).toBe(false); });
  expect(post).toHaveBeenCalledTimes(1);
});

