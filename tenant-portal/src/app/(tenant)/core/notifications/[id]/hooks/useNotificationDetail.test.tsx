// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
const toast = vi.hoisted(() => ({ outcomeFromApi: vi.fn(), errorFromApi: vi.fn() }));
vi.mock("../../../core-api", () => ({ coreGet: api.get, corePost: api.post, coreDelete: api.delete }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { useNotificationDetail } = await import("./useNotificationDetail");
const id = "019efef0-0000-7000-8000-000000000001";
const otherId = "019efef0-0000-7000-8000-000000000002";
const notification = {
  id, recipientId: "019efef0-0000-7000-8000-000000000009",
  sourceApp: "crm", notificationType: "crm.task.assigned", priority: "P2_NORMAL",
  title: "Old notification", body: "Still available", actionUrl: null,
  entityType: null, entityId: null, channels: ["IN_APP"], metadata: {},
  createdAt: "2025-01-01T00:00:00.000Z", readAt: null,
  acknowledgedAt: null, deliveredAt: null, recipientStateVersion: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockReset().mockResolvedValue({ data: notification });
  api.post.mockReset().mockResolvedValue({ data: null });
});
afterEach(cleanup);

describe("notification detail lookup", () => {
  it("opens an old notification on a cold load with exactly one ID lookup", async () => {
    const { result } = renderHook(() => useNotificationDetail(id));
    await waitFor(() => expect(result.current.status).toBe("found"));
    expect(result.current.notification).toEqual(notification);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith(`/api/tenant/core/v1/notifications/${id}`, {
      signal: expect.any(AbortSignal), maxResponseBytes: 1_048_576,
    });
  });

  it.each([404, 403, 500])("handles authoritative HTTP %s without searching pages", async (status) => {
    api.get.mockRejectedValue(new TenantApiClientError("lookup failed", {
      status, statusText: "Error", headers: new Headers(), data: { code: "NOTIFICATION_NOT_FOUND" },
    }));
    const { result } = renderHook(() => useNotificationDetail(id));
    await waitFor(() => expect(result.current.status).toBe(status === 404 ? "notFound" : "failed"));
    expect(result.current.notification).toBeNull();
    expect(result.current.error?.status ?? null).toBe(status === 404 ? null : status);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it.each([new Error("offline"), { data: { ...notification, id: otherId } }, { data: {} }])(
    "keeps network and invalid-response errors retryable",
    async (response) => {
      if (response instanceof Error) api.get.mockRejectedValue(response);
      else api.get.mockResolvedValue(response);
      const { result } = renderHook(() => useNotificationDetail(id));
      await waitFor(() => expect(result.current.status).toBe("failed"));
      expect(result.current.notification).toBeNull();
      expect(result.current.error).not.toBeNull();
    },
  );

  it.each(["markRead", "acknowledge"] as const)("reloads recipient state after %s without realtime delivery", async (action) => {
    const { result } = renderHook(() => useNotificationDetail(id));
    await waitFor(() => expect(result.current.status).toBe("found"));
    const readAt = "2026-10-17T12:00:00.000Z";
    const acknowledgedAt = action === "acknowledge" ? readAt : null;
    api.get.mockResolvedValue({ data: { ...notification, readAt, acknowledgedAt, recipientStateVersion: 1 } });
    await act(async () => result.current[action]());
    const path = action === "markRead" ? "read" : "acknowledge";
    expect(api.post).toHaveBeenCalledWith(`/api/tenant/core/v1/notifications/${id}/${path}`, undefined, expect.any(Object));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(result.current.notification?.readAt).toBe(readAt);
    expect(result.current.notification?.acknowledgedAt).toBe(acknowledgedAt);
    expect(result.current.isPending).toBe(false);
  });

  it("fences an older lookup when a successful command invalidates the detail", async () => {
    const { result } = renderHook(() => useNotificationDetail(id));
    await waitFor(() => expect(result.current.status).toBe("found"));
    let finishOld!: (value: { data: typeof notification }) => void;
    api.get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    let invalidating!: Promise<void>;
    act(() => { invalidating = tenantNotificationRuntime.invalidateQueries(); });
    const signal = api.get.mock.calls[1][1].signal as AbortSignal;
    const readAt = "2026-10-17T12:00:00.000Z";
    api.get.mockResolvedValue({ data: { ...notification, readAt, recipientStateVersion: 1 } });
    await act(async () => result.current.markRead());
    expect(signal.aborted).toBe(true);
    await act(async () => { finishOld({ data: notification }); await invalidating; });
    expect(result.current.notification?.readAt).toBe(readAt);
    expect(result.current.status).toBe("found");
  });

  it("revalidates an open detail when another projection invalidates it", async () => {
    const { result, unmount } = renderHook(() => useNotificationDetail(id));
    await waitFor(() => expect(result.current.status).toBe("found"));
    api.get.mockRejectedValue(new TenantApiClientError("dismissed", {
      status: 404, statusText: "Not Found", headers: new Headers(), data: {},
    }));
    await act(async () => { await tenantNotificationRuntime.invalidateQueries(); });
    expect(result.current.status).toBe("notFound");
    expect(result.current.notification).toBeNull();
    unmount();
    await tenantNotificationRuntime.invalidateQueries();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("ignores a late lookup for a previous route ID", async () => {
    let finishOld!: (value: { data: typeof notification }) => void;
    api.get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const { result, rerender } = renderHook(({ target }) => useNotificationDetail(target), { initialProps: { target: id } });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    api.get.mockResolvedValue({ data: { ...notification, id: otherId } });
    rerender({ target: otherId });
    await waitFor(() => expect(result.current.notification?.id).toBe(otherId));
    await act(async () => finishOld({ data: notification }));
    expect(result.current.notification?.id).toBe(otherId);
  });
});
