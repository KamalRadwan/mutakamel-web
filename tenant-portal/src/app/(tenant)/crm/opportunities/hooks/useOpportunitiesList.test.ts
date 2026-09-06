// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseOpportunitiesListResponse, useOpportunitiesList } from "./useOpportunitiesList";
import {
  opportunitySearchWithBasicText,
  opportunitySearchWithGroups,
  opportunitySearchWithMode,
} from "../opportunity-search-contract";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post } };
});
// `useRealtimeResync` is the list hook's only design-system import, and it only
// attaches window listeners. Stubbing it keeps this test off the barrel.
vi.mock("@/design-system", () => ({ useRealtimeResync: () => undefined }));

const branchId = "01900100-0000-7000-8000-000000000099";
const PIPELINE = "01900100-0000-7000-8000-000000000100";

const item = {
  id: "01900100-0000-7000-8000-000000000110",
  branchId,
  customerProfileId: "01900100-0000-7000-8000-000000000112",
  pipelineId: PIPELINE,
  stageId: "01900100-0000-7000-8000-000000000101",
  stageFlag: "QUALIFICATION",
  status: "IN_PROGRESS",
  title: "Annual renewal",
  importance: 2,
  ownerUserId: "01900100-0000-7000-8000-000000000120",
  expectedCloseDate: "2026-09-01",
  createdAt: "2026-08-25T10:00:00.000Z",
};

const EMPTY_PAGE = { data: { items: [], page: 1, limit: 25, total: 0 } };

/** The hook fetches from a queued microtask inside an effect. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  get.mockReset();
  post.mockReset();
  vi.useRealTimers();
});

describe("Opportunities list API contract", () => {
  it("reads the flat CRM page shape", () => {
    // crm-app's paginatedReadModels returns these fields at the TOP level.
    // This test used to wrap them in `meta` — Core's shape, not CRM's — so it
    // passed while the parser threw on every real response.
    const parsed = parseOpportunitiesListResponse(
      { items: [item], page: 1, limit: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      branchId,
    );

    expect(parsed.items).toEqual([item]);
    expect(parsed.pageInfo).toEqual({ page: 1, limit: 25, total: 1 });
  });

  it("rejects a Core-shaped {items, meta} payload", () => {
    // The regression guard. If this ever parses again, the parser has drifted
    // back onto Core's envelope and every CRM list is one refactor from
    // throwing on real data.
    expect(() =>
      parseOpportunitiesListResponse(
        { items: [item], meta: { page: 1, limit: 25, total: 1 } },
        branchId,
      ),
    ).toThrow("Invalid opportunities response.");
  });

  it("rejects an item from a different branch", () => {
    expect(() =>
      parseOpportunitiesListResponse(
        { items: [{ ...item, branchId: "01900100-0000-7000-8000-000000000098" }], page: 1, limit: 25, total: 1 },
        branchId,
      ),
    ).toThrow("Invalid opportunities response.");
  });

  it("rejects a null ownerUserId that isn't actually null", () => {
    expect(() =>
      parseOpportunitiesListResponse(
        { items: [{ ...item, ownerUserId: "not-a-uuid" }], page: 1, limit: 25, total: 1 },
        branchId,
      ),
    ).toThrow("Invalid opportunities response.");
  });

  it("accepts a null owner and rejects the old {data} envelope", () => {
    expect(
      parseOpportunitiesListResponse(
        { items: [{ ...item, ownerUserId: null }], page: 1, limit: 25, total: 1 },
        branchId,
      ).items[0].ownerUserId,
    ).toBeNull();
    expect(() =>
      parseOpportunitiesListResponse({ success: true, data: { items: [item] } }, branchId),
    ).toThrow("Invalid opportunities response.");
  });
});

describe("Opportunities list — the two endpoints", () => {
  it("asks the list route in basic mode and never the search route", async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    renderHook(() => useOpportunitiesList(branchId, PIPELINE, null));
    await settle();

    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  // Arriving in advanced applies once, so basic's term stops answering the
  // moment its box leaves the screen — a table still narrowed by a filter
  // nobody can see is worse than an unfiltered one.
  it("switches to the search route on the mode switch, with an empty body", async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    post.mockResolvedValue(EMPTY_PAGE);
    const { result } = renderHook(() => useOpportunitiesList(branchId, PIPELINE, null));
    await settle();

    act(() => {
      result.current.changeSearch(opportunitySearchWithMode(result.current.search, "advanced"));
    });
    await settle();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      "/api/tenant/crm/v1/opportunities/search",
      { branchId, sort: "createdAt:DESC", page: 1, limit: 25 },
      expect.objectContaining({
        cache: "no-store",
        maxResponseBytes: 1024 * 1024,
        // A POST that READS: nothing to make idempotent, and safe to replay.
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
      }),
    );
  });

  // The whole reason the draft and the applied state are separate. A filter
  // tree is built one control at a time and every intermediate state is a
  // different query — usually an expensive one nobody asked for.
  it("fires NOTHING while advanced conditions are being edited", async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    post.mockResolvedValue(EMPTY_PAGE);
    const { result } = renderHook(() => useOpportunitiesList(branchId, PIPELINE, null));
    await settle();
    act(() => {
      result.current.changeSearch(opportunitySearchWithMode(result.current.search, "advanced"));
    });
    await settle();

    post.mockClear();
    get.mockClear();
    for (const value of ["I", "IN", "IN_PROGRESS"]) {
      act(() => {
        result.current.changeSearch(
          opportunitySearchWithGroups(result.current.search, [
            { conditions: [{ field: "status", operator: "eq", value, valueTo: "" }] },
          ]),
        );
      });
      await settle();
    }

    expect(post).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    // The draft still moved — it is the card's own state.
    expect(result.current.search.groups[0]?.conditions[0]?.value).toBe("IN_PROGRESS");
  });

  it("sends the compiled tree only once Search is pressed", async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    post.mockResolvedValue(EMPTY_PAGE);
    const { result } = renderHook(() => useOpportunitiesList(branchId, PIPELINE, null));
    await settle();
    act(() => {
      result.current.changeSearch(opportunitySearchWithMode(result.current.search, "advanced"));
    });
    await settle();
    act(() => {
      result.current.changeSearch(
        opportunitySearchWithGroups(result.current.search, [
          {
            conditions: [
              { field: "status", operator: "eq", value: "IN_PROGRESS", valueTo: "" },
              { field: "stageFlag", operator: "eq", value: "PROPOSAL", valueTo: "" },
            ],
          },
          {
            conditions: [
              { field: "createdAt", operator: "gte", value: "2026-01-01", valueTo: "" },
            ],
          },
        ]),
      );
    });
    await settle();

    post.mockClear();
    act(() => {
      result.current.submitSearch();
    });
    await settle();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[1]).toEqual({
      branchId,
      filterTree: {
        op: "OR",
        children: [
          {
            op: "AND",
            children: [
              { field: "status", operator: "eq", value: "IN_PROGRESS" },
              { field: "stageFlag", operator: "eq", value: "PROPOSAL" },
            ],
          },
          { field: "createdAt", operator: "gte", value: "2026-01-01" },
        ],
      },
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });

  // The pipeline and the stage are query parameters of the LIST route only.
  // The search body has no key for either, so moving the workspace's picker
  // for the board's sake must not re-run a query it cannot narrow.
  it("ignores a pipeline change while advanced mode is applied", async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    post.mockResolvedValue(EMPTY_PAGE);
    const { result, rerender } = renderHook(
      ({ pipelineId }: { pipelineId: string | null }) =>
        useOpportunitiesList(branchId, pipelineId, null),
      { initialProps: { pipelineId: PIPELINE as string | null } },
    );
    await settle();
    act(() => {
      result.current.changeSearch(opportunitySearchWithMode(result.current.search, "advanced"));
    });
    await settle();

    post.mockClear();
    rerender({ pipelineId: "01900100-0000-7000-8000-000000000200" });
    await settle();

    expect(post).not.toHaveBeenCalled();
  });

  it("coalesces basic keystrokes into one list request", async () => {
    // Only the two timer functions the debounce uses: `queueMicrotask` must
    // stay real, because every other fetch path in the hook rides on it.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    get.mockResolvedValue(EMPTY_PAGE);
    const { result } = renderHook(() => useOpportunitiesList(branchId, PIPELINE, null));
    await settle();

    get.mockClear();
    for (const value of ["ren", "renew", "renewal"]) {
      act(() => {
        result.current.changeSearch(
          opportunitySearchWithBasicText(result.current.search, value),
        );
      });
    }
    expect(get).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/opportunities?branchId=${branchId}&page=1&limit=25&sortBy=createdAt&sortDir=DESC&pipelineId=${PIPELINE}&search=renewal`,
      expect.anything(),
    );
  });
});
