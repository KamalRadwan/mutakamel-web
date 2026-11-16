// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { WidgetDefinition } from "../../widget-contract";
import { useWidgetDrilldown } from "./useWidgetDrilldown";
import { TenantApiClientError } from "@/lib/api/axiosClient";

const { post, auth } = vi.hoisted(() => ({ post: vi.fn(), auth: { generation: 1, scope: "actor-a" } }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null, realtimeAuthGeneration: auth.generation }) }));
vi.mock("@/hooks/useAuthScopeKey", () => ({ useAuthScopeKey: () => auth.scope }));

const widget: WidgetDefinition = {
  id: "01900300-0000-7000-8000-000000000001",
  ownerUserId: "01900300-0000-7000-8000-000000000002", ownerName: null,
  name: "Leads", visualizationType: "METRIC_CARD",
  querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
  displaySpec: {}, schemaVersion: 1, revision: 1,
  createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
  accessLevel: "OWNER", isShared: false,
};
const selection = { datePreset: null, compare: null, branchId: null, currencyCode: "EGP" };
const DASHBOARD_ID = "01900300-0000-7000-8000-000000000003";
const NEXT_DASHBOARD_ID = "01900300-0000-7000-8000-000000000004";
function page(id: string, nextCursor: string | null = null, pointKey = "point") {
  return { data: { dashboardId: DASHBOARD_ID, placementId: "placement", selection: { pointKey }, widgetId: widget.id, widgetRevision: 1, records: [{ id }], pageInfo: { hasMore: !!nextCursor, nextCursor } } };
}

afterEach(() => { cleanup(); vi.resetAllMocks(); auth.generation = 1; auth.scope = "actor-a"; });

it("keeps the opening filter snapshot when loading another cursor page", async () => {
  post.mockResolvedValueOnce(page("first", "opaque-cursor"));
  post.mockResolvedValueOnce(page("second"));
  const { result } = renderHook(() => useWidgetDrilldown(DASHBOARD_ID));
  await act(async () => {});
  const filters = { ...selection };
  act(() => result.current.open(widget, "point", "Point", filters));
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  filters.currencyCode = "USD";
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.records).toHaveLength(2));
  expect(post.mock.calls[1][1]).toMatchObject({ cursor: "opaque-cursor", filters: { currencyCode: "EGP" } });
});

it("hides loaded rows immediately when authority changes and blocks the old handler", async () => {
  post.mockResolvedValueOnce(page("private", "opaque-cursor"));
  const { result, rerender } = renderHook(() => useWidgetDrilldown(DASHBOARD_ID));
  act(() => result.current.open(widget, "point", "Point", selection));
  await waitFor(() => expect(result.current.records).toHaveLength(1));
  const oldMore = result.current.loadMore;
  auth.scope = "actor-b";
  rerender();
  expect(result.current.records).toEqual([]);
  expect(result.current.target).toBeNull();
  act(() => oldMore());
  expect(post).toHaveBeenCalledTimes(1);
  auth.scope = "actor-a";
  rerender();
  expect(result.current.records).toEqual([]);
  expect(result.current.target).toBeNull();
});

it("fences same-tick load-more and rejects a different widget receipt", async () => {
  post.mockResolvedValueOnce(page("private", "opaque-cursor"));
  let finish!: (value: ReturnType<typeof page>) => void;
  post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useWidgetDrilldown(DASHBOARD_ID));
  act(() => result.current.open(widget, "point", "Point", selection));
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  act(() => { result.current.loadMore(); result.current.loadMore(); });
  expect(post).toHaveBeenCalledTimes(2);
  const wrong = page("wrong");
  wrong.data.widgetId = NEXT_DASHBOARD_ID;
  await act(async () => finish(wrong));
  expect(result.current.records.map((row) => row.id)).toEqual(["private"]);
  expect(result.current.error?.message).toContain("RESPONSE_INVALID");
});

it.each(["replace", "close", "dashboard"])("ignores a pending response after %s", async (action) => {
  let finish!: (value: ReturnType<typeof page>) => void;
  post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  post.mockResolvedValueOnce(page("latest", null, "new"));
  const { result, rerender } = renderHook(({ id }) => useWidgetDrilldown(id), {
    initialProps: { id: DASHBOARD_ID },
  });
  await act(async () => {});
  act(() => result.current.open(widget, "old", "Old", selection));
  if (action === "replace") {
    act(() => result.current.open(widget, "new", "New", selection));
    await waitFor(() => expect(result.current.records[0]?.id).toBe("latest"));
  } else if (action === "close") {
    act(() => result.current.close());
  } else {
    rerender({ id: NEXT_DASHBOARD_ID });
    await waitFor(() => expect(result.current.target).toBeNull());
  }
  await act(async () => { finish(page("stale")); });
  expect(result.current.records.map((record) => record.id)).toEqual(action === "replace" ? ["latest"] : []);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
});

it.each([[403, "CRM_DASHBOARD_DRILLDOWN_SOURCE_ACCESS_DENIED"], [404, "CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND"], [409, "CRM_WIDGET_REVISION_CONFLICT"]])(
  "clears previously visible records after terminal drill-down outcome %s", async (status, code) => {
    post.mockResolvedValueOnce(page("private", "opaque-cursor"));
    post.mockRejectedValueOnce(new TenantApiClientError("Denied", { status: Number(status), statusText: "Denied", headers: new Headers(), data: { code } }));
    const { result } = renderHook(() => useWidgetDrilldown(DASHBOARD_ID));
    act(() => result.current.open(widget, "point", "Point", selection));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.requiresRefresh).toBe(true));
    expect(result.current.records).toEqual([]);
    act(() => { result.current.loadMore(); result.current.retry(); });
    expect(post).toHaveBeenCalledTimes(2);
  },
);
