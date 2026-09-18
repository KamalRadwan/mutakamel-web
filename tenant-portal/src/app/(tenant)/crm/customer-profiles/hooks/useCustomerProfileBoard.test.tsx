// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CUSTOMER_PROFILE_SEARCH } from "../customer-profile-search-contract";

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
