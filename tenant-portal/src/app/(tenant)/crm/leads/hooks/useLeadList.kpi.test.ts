// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeadList } from "./useLeadList";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post } };
});

const BRANCH = "01900100-0000-7000-8000-000000000001";
const ACTOR = "01900100-0000-7000-8000-000000000002";
const SEARCH_PATH = "/api/tenant/crm/v1/leads/search";
const onLoadStart = vi.fn();
const options = { branchId: BRANCH, actorId: ACTOR, activeView: "card", onLoadStart } as const;

function pageResponse(page: number, total: number) {
  const totalPages = Math.ceil(total / 50);
  return { data: {
    items: [], total, page, limit: 50, totalPages,
    hasNext: page < totalPages, hasPrev: page > 1 && totalPages > 0,
  } };
}

async function flushRead() {
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
}

beforeEach(() => {
  vi.useFakeTimers();
  get.mockResolvedValue(pageResponse(1, 0));
  post.mockImplementation((_path: string, body: { page: number }) => Promise.resolve(pageResponse(body.page, 101)));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

describe("Lead KPI server filtering", () => {
  it.each(["card", "list"] as const)("posts the overdue filter in %s view and clears it on Total", async (activeView) => {
    const { result } = renderHook(() => useLeadList({ ...options, activeView }));
    await flushRead();
    get.mockResolvedValue(pageResponse(2, 101));
    act(() => result.current.changePage(2));
    await flushRead();
    act(() => result.current.changeSearch({ ...result.current.search, kpiPreset: "OVERDUE_ACTIVITY" }));
    await flushRead();
    expect(post).toHaveBeenLastCalledWith(SEARCH_PATH, expect.objectContaining({
      branchId: BRANCH, page: 1, hasOverdueActivity: true,
      filterTree: { field: "ownerUserId", operator: "eq", value: ACTOR },
    }), expect.anything());
    act(() => result.current.changePage(2));
    await flushRead();
    expect(post).toHaveBeenLastCalledWith(SEARCH_PATH, expect.objectContaining({
      page: 2, hasOverdueActivity: true,
    }), expect.anything());
    get.mockResolvedValue(pageResponse(1, 101));
    act(() => result.current.changeSearch({ ...result.current.search, kpiPreset: "ALL" }));
    await flushRead();
    expect(get).toHaveBeenLastCalledWith(expect.stringContaining(`page=1&limit=50&sortBy=createdAt&sortDir=DESC&ownerUserId=${ACTOR}`), expect.anything());
  });

  it.each([
    ["HOT_3_STAR", { field: "rating", operator: "eq", value: 3 }],
    ["NEW_STAGE", { field: "stageFlag", operator: "eq", value: "NEW" }],
    ["QUALIFIED", { field: "stageFlag", operator: "eq", value: "QUALIFIED" }],
  ] as const)("posts %s before pagination and preserves My Leads across pages", async (preset, predicate) => {
    const { result } = renderHook(() => useLeadList(options));
    await flushRead();
    act(() => result.current.changeSearch({ ...result.current.search, kpiPreset: preset }));
    await flushRead();
    const expectedTree = {
      op: "AND", children: [{ field: "ownerUserId", operator: "eq", value: ACTOR }, predicate],
    };
    expect(post).toHaveBeenLastCalledWith(SEARCH_PATH, expect.objectContaining({
      branchId: BRANCH, page: 1, filterTree: expectedTree,
    }), expect.objectContaining({ skipAutoIdempotency: true, replayAfterRefresh: true }));
    expect(result.current.pageInfo).toMatchObject({ total: 101, totalPages: 3, hasNext: true });

    act(() => result.current.changePage(2));
    await flushRead();
    expect(post).toHaveBeenLastCalledWith(SEARCH_PATH, expect.objectContaining({ page: 2, filterTree: expectedTree }), expect.anything());
    expect(result.current.pageInfo).toMatchObject({ page: 2, total: 101 });

    act(() => result.current.changeSearch({ ...result.current.search, kpiPreset: "ALL" }));
    await flushRead();
    expect(get).toHaveBeenLastCalledWith(expect.stringContaining(`page=1&limit=50&sortBy=createdAt&sortDir=DESC&ownerUserId=${ACTOR}`), expect.anything());
  });

  it("applies a pill to the submitted Advanced query without submitting draft edits", async () => {
    const { result } = renderHook(() => useLeadList(options));
    await flushRead();
    act(() => result.current.changeSearch({ ...result.current.search, mode: "advanced" }));
    await flushRead();
    act(() => result.current.changeSearch({ ...result.current.search, groups: [{ conditions: [
      { field: "status", operator: "eq", value: "OPEN", valueTo: "" },
    ] }] }));
    act(() => result.current.submitSearch());
    await flushRead();
    act(() => result.current.changeSearch({ ...result.current.search, groups: [{ conditions: [
      { field: "status", operator: "eq", value: "ON_HOLD", valueTo: "" },
    ] }] }));
    const callsBeforePill = post.mock.calls.length;
    await flushRead();
    expect(post).toHaveBeenCalledTimes(callsBeforePill);
    act(() => result.current.changeSearch({ ...result.current.search, kpiPreset: "HOT_3_STAR" }));
    await flushRead();
    expect(post).toHaveBeenLastCalledWith(SEARCH_PATH, expect.objectContaining({
      page: 1, filterTree: { op: "AND", children: [
        { field: "status", operator: "eq", value: "OPEN" },
        { field: "rating", operator: "eq", value: 3 },
      ] },
    }), expect.anything());
    expect(result.current.search.groups[0]?.conditions[0]?.value).toBe("ON_HOLD");

    act(() => result.current.resetSearch());
    await flushRead();
    expect(result.current.appliedSearch.kpiPreset).toBeUndefined();
    expect(result.current.search.mode).toBe("basic");
  });
});
