// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock } = vi.hoisted(() => ({
  apiMock: {
    getConfig: vi.fn(),
    getPreferences: vi.fn(),
    getUnread: vi.fn(),
    list: vi.fn(),
    bulk: vi.fn(),
    item: vi.fn(),
    preference: vi.fn(),
  },
  authMock: {
    user: {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: ["admin.notifications.read", "admin.notifications.manage"],
    } as {
      id: string;
      isSuperAdmin: boolean;
      permissions: string[];
    } | null,
    isLoading: false,
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("./api", () => ({
  getAdminNotificationConfig: apiMock.getConfig,
  getAdminNotificationPreferences: apiMock.getPreferences,
  getAdminNotificationUnreadCount: apiMock.getUnread,
  listAdminNotifications: apiMock.list,
  performAdminNotificationBulkAction: apiMock.bulk,
  performAdminNotificationItemAction: apiMock.item,
  upsertAdminNotificationPreference: apiMock.preference,
}));

import { useAdminNotifications } from "./useAdminNotifications";

const ID = "019f0000-0000-7000-8000-000000000001";

describe("useAdminNotifications", () => {
  beforeEach(() => {
    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: ["admin.notifications.read", "admin.notifications.manage"],
    };
    authMock.isLoading = false;
    for (const fn of Object.values(apiMock)) fn.mockReset();
    apiMock.list.mockResolvedValue(pageFixture());
    apiMock.getConfig.mockResolvedValue(runtimeFixture());
    apiMock.getPreferences.mockResolvedValue([]);
    apiMock.getUnread.mockResolvedValue(1);
    apiMock.bulk.mockResolvedValue(1);
    apiMock.item.mockResolvedValue(undefined);
    apiMock.preference.mockResolvedValue(preferenceFixture());
  });

  it("preflights read permission and loads the four canonical read resources", async () => {
    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => expect(result.current.requestState).toBe("READY"));
    expect(apiMock.list).toHaveBeenCalledWith(
      { limit: 20, unreadOnly: false },
      expect.any(AbortSignal),
    );
    expect(apiMock.getConfig).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(apiMock.getPreferences).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(apiMock.getUnread).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result.current.unreadCount).toBe(1);
  });

  it("never calls Core and exposes a forbidden state without read permission", async () => {
    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: [],
    };

    const { result } = renderHook(() => useAdminNotifications());
    await waitFor(() => expect(result.current.requestState).toBe("FORBIDDEN"));

    expect(apiMock.list).not.toHaveBeenCalled();
    expect(apiMock.getConfig).not.toHaveBeenCalled();
    expect(result.current.page).toBeNull();
  });

  it("preflights manage permission before any mutation", async () => {
    authMock.user = {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: ["admin.notifications.read"],
    };
    const { result } = renderHook(() => useAdminNotifications());
    await waitFor(() => expect(result.current.requestState).toBe("READY"));

    await act(async () => {
      await result.current.performItemAction(ID, "acknowledge");
    });

    expect(apiMock.item).not.toHaveBeenCalled();
    expect(result.current.actionStatus.state).toBe("FORBIDDEN");
  });

  it("passes notification actions through and saves an in-app preference", async () => {
    const { result } = renderHook(() => useAdminNotifications());
    await waitFor(() => expect(result.current.requestState).toBe("READY"));

    await act(async () => {
      await result.current.performBulkAction("read-all");
      await result.current.performItemAction(ID, "dismiss");
      await result.current.savePreference({
        notificationType: "tenant.user.invited",
        inAppEnabled: true,
      });
    });

    expect(apiMock.bulk).toHaveBeenCalledWith("read-all");
    expect(apiMock.item).toHaveBeenCalledWith(ID, "dismiss");
    expect(apiMock.preference).toHaveBeenCalledWith({
      notificationType: "tenant.user.invited",
      inAppEnabled: true,
    });
    expect(result.current.actionStatus).toMatchObject({
      state: "SUCCESS", messageKey: "preferenceSaved",
    });
  });

  it("maps unavailable loads and preserves the correlation id", async () => {
    apiMock.list.mockRejectedValue({
      response: {
        status: 503,
        data: {
          type: "https://errors.example.test/notifications",
          title: "Unavailable",
          status: 503,
          code: "NOTIFICATIONS_UNAVAILABLE",
          correlationId: "019f0000-0000-7000-8000-000000000099",
        },
      },
    });
    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => expect(result.current.requestState).toBe("UNAVAILABLE"));
    expect(result.current.loadError).toMatchObject({
      errorCode: "NOTIFICATIONS_UNAVAILABLE",
      correlationId: "019f0000-0000-7000-8000-000000000099",
    });
  });

  /**
   * UI-005. `loadMore` guarded only on the account, while `unreadOnly` stayed
   * captured in its closure. Flipping the filter mid-request reloaded page one
   * under the new filter and then appended the old filter's page onto it, so
   * the list showed read rows under an unread-only header.
   */
  it("does not append a page fetched under the previous filter", async () => {
    // Spread rather than mutate: pageFixture infers nextCursor as null, so
    // assigning a cursor onto it is a type error.
    const first = { ...pageFixture(), nextCursor: "cursor-1", hasNext: true };

    let resolveStale: ((value: unknown) => void) | undefined;
    apiMock.list
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve;
          }),
      )
      .mockResolvedValue({ ...pageFixture(), items: [] });

    const { result } = renderHook(() => useAdminNotifications());
    await waitFor(() => expect(result.current.requestState).toBe("READY"));

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.loadMore();
    });

    // The operator switches to unread-only while that page is still in flight.
    act(() => result.current.setUnreadOnly(true));
    await waitFor(() =>
      expect(apiMock.list).toHaveBeenCalledWith(
        { limit: 20, unreadOnly: true },
        expect.any(AbortSignal),
      ),
    );

    const staleItem = { ...pageFixture().items[0], id: "stale-id" };
    await act(async () => {
      resolveStale?.({ ...pageFixture(), items: [staleItem], nextCursor: null });
      await pending;
    });

    expect(
      (result.current.page?.items ?? []).some((item) => item.id === "stale-id"),
    ).toBe(false);
  });
});

function pageFixture() {
  return {
    items: [{
      id: ID,
      sourceApp: "core-app",
      notificationType: "tenant.user.invited",
      priority: "P2_NORMAL",
      title: "Invitation sent",
      body: "The invitation was sent.",
      actionUrl: null,
      entityType: null,
      entityId: null,
      channels: ["IN_APP"],
      metadata: {},
      createdAt: "2026-08-12T10:00:00.000Z",
      readAt: null,
      acknowledgedAt: null,
      deliveredAt: null,
    }],
    unreadCount: 1,
    nextCursor: null,
    hasNext: false,
  };
}

function runtimeFixture() {
  return {
    enabled: true,
    inAppEnabled: true,
    realtimeEnabled: false,
    previewLimit: 10,
    pollIntervalMs: 30_000,
  };
}

function preferenceFixture() {
  return {
    notificationType: "tenant.user.invited",
    inAppEnabled: true,
    updatedAt: "2026-08-12T10:00:00.000Z",
  };
}
