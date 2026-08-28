import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getMock, postMock, putMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    delete: deleteMock,
    get: getMock,
    post: postMock,
    put: putMock,
  },
}));

import {
  getAdminNotificationConfig,
  getAdminNotificationPreferences,
  getAdminNotificationUnreadCount,
  listAdminNotifications,
  performAdminNotificationBulkAction,
  performAdminNotificationItemAction,
  registerAdminNotificationDeviceToken,
  revokeAdminNotificationDeviceToken,
  upsertAdminNotificationPreference,
} from "./api";

const BASE = "/api/admin/core/v1/notifications";
const ID = "019f0000-0000-7000-8000-000000000001";
const WRITE_OPTIONS = {
  cache: "no-store",
  replayAfterRefresh: true,
  skipAutoIdempotency: true,
};
const envelope = (data: unknown) => ({ data: { success: true, data } });

describe("admin notifications API", () => {
  beforeEach(() => {
    deleteMock.mockReset().mockResolvedValue({ data: undefined });
    getMock.mockReset();
    postMock.mockReset().mockImplementation((url: string) => Promise.resolve(
      envelope(/\/(?:read-all|mark-all-read)$/.test(url) ? { updated: 3 } : undefined),
    ));
    putMock.mockReset().mockResolvedValue(envelope(preferenceFixture()));
  });

  it("uses all four exact read routes and only supported list query fields", async () => {
    const controller = new AbortController();
    getMock.mockImplementation((url: string) => {
      if (url.endsWith("/config")) return Promise.resolve(envelope(runtimeFixture()));
      if (url.endsWith("/preferences")) return Promise.resolve(envelope([preferenceFixture()]));
      if (url.endsWith("/unread-count")) return Promise.resolve(envelope({ unreadCount: 2 }));
      return Promise.resolve(envelope(pageFixture()));
    });

    await expect(listAdminNotifications(
      { limit: 20, cursor: "opaque-cursor", unreadOnly: true },
      controller.signal,
    )).resolves.toEqual(pageFixture());
    await expect(getAdminNotificationConfig(controller.signal)).resolves.toEqual(runtimeFixture());
    await expect(getAdminNotificationPreferences(controller.signal)).resolves.toEqual([preferenceFixture()]);
    await expect(getAdminNotificationUnreadCount(controller.signal)).resolves.toBe(2);

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${BASE}?limit=20&cursor=opaque-cursor&unreadOnly=true`,
      { cache: "no-store", signal: controller.signal },
    );
    expect(getMock).toHaveBeenNthCalledWith(2, `${BASE}/config`, {
      cache: "no-store",
      signal: controller.signal,
    });
    expect(getMock).toHaveBeenNthCalledWith(3, `${BASE}/preferences`, {
      cache: "no-store",
      signal: controller.signal,
    });
    expect(getMock).toHaveBeenNthCalledWith(4, `${BASE}/unread-count`, {
      cache: "no-store",
      signal: controller.signal,
    });
  });

  it("makes every write and compatibility-alias route a direct naturally-idempotent call", async () => {
    postMock.mockImplementation((url: string) => {
      if (url.endsWith("/device-tokens")) return Promise.resolve(envelope(deviceReceiptFixture()));
      if (/\/(?:read-all|mark-all-read)$/.test(url)) {
        return Promise.resolve(envelope({ updated: 3 }));
      }
      return Promise.resolve(envelope(undefined));
    });

    await expect(upsertAdminNotificationPreference({
      notificationType: "tenant.user.invited",
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: true,
      quietHours: {},
    })).resolves.toEqual(preferenceFixture());
    await expect(registerAdminNotificationDeviceToken({
      provider: "web-push",
      token: "provider-token",
      deviceId: "browser-1",
      platform: "web",
      enabled: true,
    })).resolves.toEqual(deviceReceiptFixture());
    await revokeAdminNotificationDeviceToken(ID);
    await expect(performAdminNotificationBulkAction("read-all")).resolves.toBe(3);
    await expect(
      performAdminNotificationBulkAction("mark-all-read-compatibility"),
    ).resolves.toBe(3);
    await performAdminNotificationItemAction(ID, "read");
    await performAdminNotificationItemAction(ID, "acknowledge");
    await performAdminNotificationItemAction(ID, "ack-compatibility");
    await performAdminNotificationItemAction(ID, "dismiss");
    await performAdminNotificationItemAction(ID, "dismiss-post-compatibility");

    expect(putMock).toHaveBeenCalledWith(
      `${BASE}/preferences`,
      {
        notificationType: "tenant.user.invited",
        inAppEnabled: true,
        pushEnabled: false,
        emailEnabled: true,
        quietHours: {},
      },
      WRITE_OPTIONS,
    );
    expect(postMock).toHaveBeenCalledWith(
      `${BASE}/device-tokens`,
      {
        provider: "web-push",
        token: "provider-token",
        deviceId: "browser-1",
        platform: "web",
        enabled: true,
      },
      WRITE_OPTIONS,
    );
    expect(deleteMock).toHaveBeenCalledWith(`${BASE}/device-tokens/${ID}`, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/read-all`, undefined, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/mark-all-read`, undefined, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ID}/read`, undefined, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ID}/acknowledge`, undefined, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ID}/ack`, undefined, WRITE_OPTIONS);
    expect(deleteMock).toHaveBeenCalledWith(`${BASE}/${ID}`, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ID}/dismiss`, undefined, WRITE_OPTIONS);
  });

  it("rejects a non-UUIDv7 route id before transport", async () => {
    await expect(
      performAdminNotificationItemAction(
        "00000000-0000-4000-8000-000000000000",
        "read",
      ),
    ).rejects.toThrow("UUID_V7_REQUIRED");
    expect(postMock).not.toHaveBeenCalled();
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
      body: "The tenant invitation was sent.",
      actionUrl: "/tenants/019f0000-0000-7000-8000-000000000002",
      entityType: "tenant",
      entityId: "019f0000-0000-7000-8000-000000000002",
      channels: ["IN_APP"],
      metadata: {},
      createdAt: "2026-08-12T10:00:00.000Z",
      readAt: null,
      acknowledgedAt: null,
      deliveredAt: "2026-08-12T10:00:01.000Z",
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
    pushEnabled: false,
    emailEnabled: true,
    provider: "none" as const,
    previewLimit: 10,
    pollIntervalMs: 30_000,
    firebase: {
      apiKey: "",
      appId: "",
      authDomain: "",
      projectId: "",
      messagingSenderId: "",
      storageBucket: "",
      measurementId: "",
      webPushVapidPublicKey: "",
      messagingServiceWorkerPath: "/firebase-messaging-sw.js",
      messagingServiceWorkerScope: "/",
    },
  };
}

function preferenceFixture() {
  return {
    notificationType: "tenant.user.invited",
    inAppEnabled: true,
    pushEnabled: false,
    emailEnabled: true,
    quietHours: {},
    updatedAt: "2026-08-12T10:00:00.000Z",
  };
}

function deviceReceiptFixture() {
  return {
    id: "019f0000-0000-7000-8000-000000000003",
    provider: "web-push",
    tokenHash: "a".repeat(64),
    deviceId: "browser-1",
    platform: "web",
    enabled: true,
    lastSeenAt: "2026-08-12T10:00:00.000Z",
    revokedAt: null,
  };
}
