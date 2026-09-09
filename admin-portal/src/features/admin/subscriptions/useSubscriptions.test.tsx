// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionPage } from "./types";

const { authMock, listMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: ["admin.subscriptions.read"],
    } as {
      id: string;
      isSuperAdmin: boolean;
      permissions: string[];
    } | null,
    isLoading: false,
  },
  listMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("./api", () => ({ subscriptionsApi: { list: listMock } }));

import { TENANT_ID, validSubscriptionsEnvelope } from "./test-fixtures";
import { readSubscriptionsPage } from "./readers";
import { useSubscriptions } from "./useSubscriptions";

const EMPTY_PAGE: SubscriptionPage = {
  items: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
  correlationId: "019f0000-0000-7000-8000-000000000006",
  timestamp: "2026-08-12T09:00:00.000Z",
};

const READY_PAGE: SubscriptionPage = readSubscriptionsPage(validSubscriptionsEnvelope());

describe("useSubscriptions", () => {
  beforeEach(() => {
    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: ["admin.subscriptions.read"],
    };
    authMock.isLoading = false;
    listMock.mockReset().mockResolvedValue(EMPTY_PAGE);
  });

  it("loads the bounded default query for an authorized operator", async () => {
    const { result } = renderHook(() => useSubscriptions());

    await waitFor(() => expect(result.current.requestState).toBe("EMPTY"));
    expect(listMock).toHaveBeenCalledWith(
      {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortDir: "DESC",
      },
      expect.any(AbortSignal),
    );
  });

  it("does not call Core and exposes no stale data without permission", async () => {
    listMock.mockResolvedValue(READY_PAGE);
    const { result, rerender } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.requestState).toBe("READY"));
    expect(result.current.data?.total).toBe(1);

    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: [],
    };
    rerender();

    expect(result.current.requestState).toBe("FORBIDDEN");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("does not expose one operator's response during an authorized user switch", async () => {
    listMock.mockResolvedValue(READY_PAGE);
    const { result, rerender } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.requestState).toBe("READY"));
    listMock.mockImplementation(() => new Promise(() => undefined));

    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000011",
      isSuperAdmin: false,
      permissions: ["admin.subscriptions.read"],
    };
    rerender();

    expect(result.current.requestState).toBe("LOADING");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("never requests when the initial permission preflight fails", () => {
    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: [],
    };
    const { result } = renderHook(() => useSubscriptions());

    expect(result.current.requestState).toBe("FORBIDDEN");
    expect(result.current.data).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("validates tenant UUIDv7 locally and applies exact Core filters", async () => {
    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.requestState).toBe("EMPTY"));
    listMock.mockClear();

    act(() => {
      result.current.setDraftField(
        "tenantId",
        "00000000-0000-4000-8000-000000000000",
      );
    });
    act(() => expect(result.current.applyFilters()).toBe(false));
    expect(result.current.tenantIdError).toBe("INVALID_TENANT_UUID_V7");
    expect(listMock).not.toHaveBeenCalled();

    act(() => {
      result.current.setDraftField("tenantId", TENANT_ID);
      result.current.setDraftField("status", "PAST_DUE");
      result.current.setDraftField("sortBy", "currentPeriodEnd");
      result.current.setDraftField("sortDir", "ASC");
    });
    act(() => expect(result.current.applyFilters()).toBe(true));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(
        {
          page: 1,
          limit: 20,
          tenantId: TENANT_ID,
          status: "PAST_DUE",
          sortBy: "currentPeriodEnd",
          sortDir: "ASC",
        },
        expect.any(AbortSignal),
      ),
    );
    expect(result.current.activeFilterCount).toBe(2);
  });

  it.each([
    [403, "FORBIDDEN", "SUBSCRIPTIONS_FORBIDDEN"],
    [503, "UNAVAILABLE", "UPSTREAM_UNAVAILABLE"],
  ] as const)(
    "maps HTTP %i to the %s state and preserves correlation",
    async (status, expectedState, code) => {
      listMock.mockRejectedValue({
        response: {
          status,
          data: {
            type: "https://errors.example.test/subscriptions",
            title: "Request failed",
            status,
            code,
            correlationId: "019f0000-0000-7000-8000-000000000099",
          },
        },
      });

      const { result } = renderHook(() => useSubscriptions());
      await waitFor(() =>
        expect(result.current.requestState).toBe(expectedState),
      );

      expect(result.current.error).toMatchObject({
        httpStatus: status,
        errorCode: code,
        correlationId: "019f0000-0000-7000-8000-000000000099",
      });
    },
  );
});
