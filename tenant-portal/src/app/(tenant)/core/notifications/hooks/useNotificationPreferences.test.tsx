// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATIONS_CONFIG_PATH,
  NOTIFICATION_PREFERENCES_PATH,
  type NotificationPreference,
} from "../notification-contract";
import { useNotificationPreferences } from "./useNotificationPreferences";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  permissions: ["notifications.preference.read", "notifications.preference.manage"],
  toast: { outcomeFromApi: vi.fn(), errorFromApi: vi.fn() },
}));

vi.mock("../../core-api", () => ({ coreGet: mocks.get, corePut: mocks.put }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: mocks.permissions } }),
}));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { coreNotifications: { preferenceSaveFailed: "Save failed" } } }),
}));

const catalogue = [
  { notificationType: "core.activity.assigned", inAppEnabled: true },
  { notificationType: "record.deleted", inAppEnabled: true },
];
const config = { enabled: true, inAppEnabled: true, preferenceCatalogue: catalogue };

let persisted: NotificationPreference[];

beforeEach(() => {
  vi.clearAllMocks();
  persisted = [];
  mocks.permissions = ["notifications.preference.read", "notifications.preference.manage"];
  mocks.get.mockImplementation(async (path: string) => ({
    data: path === NOTIFICATIONS_CONFIG_PATH ? config : persisted,
  }));
  mocks.put.mockImplementation(async (_path: string, request: {
    notificationType: string;
    inAppEnabled: boolean;
  }) => {
    const saved = { ...request, updatedAt: "2026-10-17T10:00:00.000Z" };
    persisted = [saved];
    return { data: saved };
  });
});

afterEach(cleanup);

describe("useNotificationPreferences", () => {
  it("creates the first override from a default row and preserves it after reload", async () => {
    const { result } = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.preferences).toEqual(catalogue);
    expect(mocks.get).toHaveBeenCalledTimes(2);

    await act(async () => { await result.current.toggle(result.current.preferences[0], false); });
    expect(mocks.put).toHaveBeenCalledWith(NOTIFICATION_PREFERENCES_PATH, {
      notificationType: "core.activity.assigned",
      inAppEnabled: false,
    }, { maxResponseBytes: 40_000 });
    expect(result.current.preferences[0].inAppEnabled).toBe(false);

    await act(async () => { await result.current.reload(); });
    expect(result.current.preferences).toEqual([
      { notificationType: "core.activity.assigned", inAppEnabled: false },
      catalogue[1],
    ]);
  });

  it("keeps missing types configurable and excludes unsupported persisted rows", async () => {
    persisted = [
      { ...catalogue[0], inAppEnabled: false, updatedAt: "2026-10-17T10:00:00.000Z" },
      { notificationType: "unsupported.type", inAppEnabled: true, updatedAt: "2026-10-17T10:00:00.000Z" },
    ];
    const { result } = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.preferences).toEqual([
      { notificationType: "core.activity.assigned", inAppEnabled: false },
      catalogue[1],
    ]);
    await act(async () => { await result.current.toggle(result.current.preferences[1], false); });
    expect(mocks.put).toHaveBeenCalledWith(NOTIFICATION_PREFERENCES_PATH,
      { notificationType: "record.deleted", inAppEnabled: false },
      { maxResponseBytes: 40_000 });
  });

  it("reports unavailable or invalid catalogues without inventing supported types", async () => {
    mocks.get.mockImplementation(async (path: string) => ({
      data: path === NOTIFICATIONS_CONFIG_PATH ? { enabled: true, inAppEnabled: true } : [],
    }));
    const { result } = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.preferences).toEqual([]);

    mocks.get.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).not.toBeNull();
    expect(result.current.preferences).toEqual([]);
  });

  it("allows read-only viewing without writing and skips loading without read access", async () => {
    mocks.permissions = ["notifications.preference.read"];
    const { result, unmount } = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.toggle(result.current.preferences[0], false); });
    expect(mocks.put).not.toHaveBeenCalled();
    unmount();

    mocks.get.mockClear();
    mocks.permissions = [];
    const denied = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(denied.result.current.isLoading).toBe(false));
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
