// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";
import { notificationsListPath, type InboxNotification } from "../notification-contract";
import { useNotificationInbox } from "./useNotificationInbox";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  toast: { errorFromApi: vi.fn() },
}));

vi.mock("../../core-api", () => ({ coreGet: mocks.get, corePost: vi.fn(), coreDelete: vi.fn() }));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { coreNotifications: { loadFailed: "Load failed" } }, lang: "en" }),
}));

function notification(index: number, unread = true): InboxNotification {
  return {
    id: `01900000-0000-7000-8000-${String(index).padStart(12, "0")}`,
    recipientId: "01900000-0000-7000-8000-000000000099",
    sourceApp: "core", notificationType: "record.deleted", priority: "P2_NORMAL",
    title: `Notification ${index}`, body: "Body", actionUrl: null,
    entityType: null, entityId: null, channels: ["inApp"], metadata: {},
    createdAt: "2026-10-17T10:00:00.000Z",
    readAt: unread ? null : "2026-10-17T11:00:00.000Z",
    acknowledgedAt: null, deliveredAt: null, recipientStateVersion: 0,
  };
}

function page(items: InboxNotification[], nextCursor: string | null, unreadCount = 3) {
  return { data: { items, nextCursor, hasNext: nextCursor !== null, unreadCount } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

describe("notification inbox pagination ownership", () => {
  it("revalidates the loaded history and count on creation, read and dismissal invalidations", async () => {
    mocks.get.mockResolvedValueOnce(page([notification(1)], "next"))
      .mockResolvedValueOnce(page([notification(2)], "older"));
    const { result } = renderHook(() => useNotificationInbox());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    await act(async () => { await result.current.loadMore(); });
    const updated = notification(1, false);
    mocks.get.mockResolvedValueOnce(page([notification(3), updated], "new-next", 2))
      .mockResolvedValueOnce(page([notification(2)], "new-older", 2));
    await act(async () => { await tenantNotificationRuntime.invalidateQueries(); });
    expect(result.current.items).toEqual([notification(3), updated, notification(2)]);
    expect(result.current.unreadCount).toBe(2);
    expect(mocks.get.mock.calls[3][0]).toBe(notificationsListPath("new-next", false));
    mocks.get.mockResolvedValueOnce(page([notification(3)], "after-dismiss", 1))
      .mockResolvedValueOnce(page([notification(2)], null, 1));
    await act(async () => { await tenantNotificationRuntime.invalidateQueries(); });
    expect(result.current.items).toEqual([notification(3), notification(2)]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.hasMore).toBe(false);
  });

  it("revalidates unread membership and rejects an older in-flight page after an invalidation", async () => {
    const oldPage = deferred<ReturnType<typeof page>>();
    mocks.get.mockResolvedValueOnce(page([], null))
      .mockResolvedValueOnce(page([notification(1)], "unread-next", 2))
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce(page([notification(2)], null, 1));
    const { result, unmount } = renderHook(() => useNotificationInbox());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    act(() => { result.current.setUnreadOnly(true); });
    await waitFor(() => expect(result.current.items).toEqual([notification(1)]));
    let loading!: Promise<void>;
    act(() => { loading = result.current.loadMore(); });
    await act(async () => { await tenantNotificationRuntime.invalidateQueries(); });
    expect(mocks.get.mock.calls[2][1].signal.aborted).toBe(true);
    expect(mocks.get.mock.calls[3][0]).toBe(notificationsListPath(null, true));
    await act(async () => { oldPage.resolve(page([notification(3)], "stale", 99)); await loading; });
    expect(result.current.items).toEqual([notification(2)]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.hasMore).toBe(false);
    unmount();
    await tenantNotificationRuntime.invalidateQueries();
    expect(mocks.get).toHaveBeenCalledTimes(4);
  });

  it.each(["success", "failure"])("discards an old all-notifications page after switching to unread (%s)", async (outcome) => {
    const oldPage = deferred<ReturnType<typeof page>>();
    mocks.get.mockResolvedValueOnce(page([notification(1, false)], "all-next"))
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce(page([notification(2)], "unread-next", 2))
      .mockResolvedValueOnce(page([notification(3)], null, 2));
    const { result } = renderHook(() => useNotificationInbox());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    let loading!: Promise<void>;
    act(() => { loading = result.current.loadMore(); });
    const signal = mocks.get.mock.calls[1][1].signal as AbortSignal;
    act(() => { result.current.setUnreadOnly(true); });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.items).toEqual([notification(2)]));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      if (outcome === "success") oldPage.resolve(page([notification(4, false)], "wrong-cursor", 99));
      else oldPage.reject(new Error("Old request failed"));
      await loading;
    });
    expect(result.current.items).toEqual([notification(2)]);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.isLoadingMore).toBe(false);
    expect(mocks.toast.errorFromApi).not.toHaveBeenCalled();
    await act(async () => { await result.current.loadMore(); });
    expect(mocks.get.mock.calls[3][0]).toBe(notificationsListPath("unread-next", true));
    expect(result.current.items).toEqual([notification(2), notification(3)]);
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps only the latest first-page response when refreshes overlap", async () => {
    const initial = deferred<ReturnType<typeof page>>();
    const refresh = deferred<ReturnType<typeof page>>();
    mocks.get.mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise);
    const { result } = renderHook(() => useNotificationInbox());
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    let reloading!: Promise<void>;
    act(() => { reloading = result.current.reload(); });
    expect(mocks.get.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { initial.resolve(page([notification(1)], "stale")); });
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.items).toEqual([]);
    await act(async () => {
      refresh.resolve(page([notification(2)], "fresh", 1));
      await reloading;
    });
    expect(result.current.items).toEqual([notification(2)]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("requests a cursor once, deduplicates rows and aborts pagination on unmount", async () => {
    const more = deferred<ReturnType<typeof page>>();
    const last = deferred<ReturnType<typeof page>>();
    mocks.get.mockResolvedValueOnce(page([notification(1)], "next"))
      .mockReturnValueOnce(more.promise).mockReturnValueOnce(last.promise);
    const { result, unmount } = renderHook(() => useNotificationInbox());
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.loadMore();
      void result.current.loadMore();
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await act(async () => {
      more.resolve(page([notification(1), notification(2)], "last"));
      await loading;
    });
    expect(result.current.items).toEqual([notification(1), notification(2)]);
    act(() => { loading = result.current.loadMore(); });
    const signal = mocks.get.mock.calls[2][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { last.reject(new Error("Unmounted")); await loading; });
    expect(mocks.toast.errorFromApi).not.toHaveBeenCalled();
  });
});
