// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CUSTOMER_PROFILE_SEARCH,
  customerProfileSearchWithField,
} from "../customer-profile-search-contract";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { id: "0192f3a0-0000-7000-8000-000000000099" },
  }),
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return {
    ...actual,
    axiosClient: { ...actual.axiosClient, post: mocks.post },
  };
});

const { CUSTOMER_PROFILE_BOARD_STATUSES, useCustomerProfileBoard } =
  await import("./useCustomerProfileBoard");

const BRANCH_ID = "0192f3a0-0000-7000-8000-000000000001";
const PROFILE_ID = "0192f3a0-0000-7000-8000-000000000002";
const PARTY_ID = "0192f3a0-0000-7000-8000-000000000003";

function firstPage() {
  return {
    statuses: CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => ({
      status,
      items:
        status === "PROSPECT"
          ? [
              {
                id: PROFILE_ID,
                branchId: BRANCH_ID,
                partyId: PARTY_ID,
                displayName: "Mona Hassan",
                profileType: "INDIVIDUAL",
                status,
                rating: 2,
                cardColor: "TEAL",
              },
            ]
          : [],
      total: status === "PROSPECT" ? 51 : 0,
      page: 1,
      limit: 50,
      totalPages: status === "PROSPECT" ? 2 : 0,
      hasNext: status === "PROSPECT",
      hasPrev: false,
    })),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.post.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useCustomerProfileBoard", () => {
  it("keeps loaded lanes visible when one status continuation fails", async () => {
    mocks.post.mockResolvedValueOnce({ data: firstPage() });
    const { result } = renderHook(() =>
      useCustomerProfileBoard({
        enabled: true,
        branchId: BRANCH_ID,
        search: DEFAULT_CUSTOMER_PROFILE_SEARCH,
        sort: { id: "createdAt", direction: "desc" },
        revision: 0,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.items.map(({ id }) => id)).toEqual([PROFILE_ID]);
    expect(result.current.error).toBeNull();

    mocks.post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => {
      await result.current.loadMoreStatus("PROSPECT");
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([PROFILE_ID]);
    expect(result.current.lanes.PROSPECT).toMatchObject({
      page: 1,
      total: 51,
      hasMore: true,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loadMoreError).toMatchObject({ status: 0 });
  });
});

function countPage(
  status: (typeof CUSTOMER_PROFILE_BOARD_STATUSES)[number],
  total: number,
) {
  const sample = firstPage().statuses[0].items[0];
  return {
    items: total ? [{ ...sample, status }] : [],
    total,
    page: 1,
    limit: 1,
    totalPages: total,
    hasNext: total > 1,
    hasPrev: false,
  };
}

describe("customer status funnel totals", () => {
  it("loads server totals without the board and replaces the selected status only", async () => {
    const totals = [51, 7, 0, 2];
    CUSTOMER_PROFILE_BOARD_STATUSES.forEach((status, index) => {
      mocks.post.mockResolvedValueOnce({ data: countPage(status, totals[index]) });
    });
    const { result } = renderHook(() =>
      useCustomerProfileBoard({
        enabled: false,
        totalsEnabled: true,
        branchId: BRANCH_ID,
        search: customerProfileSearchWithField(
          DEFAULT_CUSTOMER_PROFILE_SEARCH,
          "status",
          "ACTIVE_CUSTOMER",
        ),
        sort: { id: "createdAt", direction: "desc" },
        revision: 0,
      }),
    );
    expect(result.current.totals.size).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect([...result.current.totals.values()]).toEqual(totals);
    expect(result.current.items).toEqual([]);
    expect(mocks.post).toHaveBeenCalledTimes(4);
    CUSTOMER_PROFILE_BOARD_STATUSES.forEach((status, index) => {
      expect(mocks.post).toHaveBeenNthCalledWith(
        index + 1,
        "/api/tenant/crm/v1/customer-profiles/search",
        {
          branchId: BRANCH_ID,
          page: 1,
          limit: 1,
          sort: "createdAt:DESC",
          filterTree: {
            op: "AND",
            children: [
              {
                field: "ownerUserId",
                operator: "eq",
                value: "0192f3a0-0000-7000-8000-000000000099",
              },
              { field: "status", operator: "eq", value: status },
            ],
          },
        },
        expect.objectContaining({ skipAutoIdempotency: true }),
      );
    });
  });

  it("hides previous totals immediately on branch changes and after a failed read", async () => {
    CUSTOMER_PROFILE_BOARD_STATUSES.forEach((status) => {
      mocks.post.mockResolvedValueOnce({ data: countPage(status, 0) });
    });
    const { result, rerender } = renderHook(
      ({ branchId }) =>
        useCustomerProfileBoard({
          enabled: false,
          totalsEnabled: true,
          branchId,
          search: DEFAULT_CUSTOMER_PROFILE_SEARCH,
          sort: { id: "createdAt", direction: "desc" },
          revision: 0,
        }),
      { initialProps: { branchId: BRANCH_ID } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect([...result.current.totals.values()]).toEqual([0, 0, 0, 0]);
    mocks.post.mockRejectedValue(new TypeError("Failed to fetch"));
    rerender({ branchId: "0192f3a0-0000-7000-8000-000000000004" });
    expect(result.current.totals.size).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.totals.size).toBe(0);
    expect(result.current.error).not.toBeNull();
  });

  it("does not fetch or invent totals when both reads are disabled", async () => {
    const { result } = renderHook(() =>
      useCustomerProfileBoard({
        enabled: false,
        branchId: BRANCH_ID,
        search: DEFAULT_CUSTOMER_PROFILE_SEARCH,
        sort: { id: "createdAt", direction: "desc" },
        revision: 0,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(result.current.totals.size).toBe(0);
  });
});
