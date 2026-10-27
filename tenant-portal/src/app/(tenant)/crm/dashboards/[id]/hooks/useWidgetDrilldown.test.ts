// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { WidgetDefinition } from "../../widget-contract";
import { useWidgetDrilldown } from "./useWidgetDrilldown";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { post } }));

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
function page(id: string, nextCursor: string | null = null) {
  return { data: { widgetId: widget.id, records: [{ id }], pageInfo: { hasMore: !!nextCursor, nextCursor } } };
}

afterEach(() => { cleanup(); vi.resetAllMocks(); });

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

it.each(["replace", "close", "dashboard"])("ignores a pending response after %s", async (action) => {
  let finish!: (value: ReturnType<typeof page>) => void;
  post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  post.mockResolvedValueOnce(page("latest"));
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
