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
      envelope(url.endsWith("/read-all") ? { updated: 3 } : undefined),
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

  it("uses exactly one naturally-idempotent route per notification action", async () => {
    postMock.mockImplementation((url: string) => {
      if (url.endsWith("/read-all")) {
        return Promise.resolve(envelope({ updated: 3 }));
      }
      return Promise.resolve(envelope(undefined));
    });

    await expect(upsertAdminNotificationPreference({
      notificationType: "tenant.user.invited",
      inAppEnabled: true,
    })).resolves.toEqual(preferenceFixture());
    await expect(performAdminNotificationBulkAction("read-all")).resolves.toBe(3);
    await performAdminNotificationItemAction(ID, "read");
    await performAdminNotificationItemAction(ID, "acknowledge");
    await performAdminNotificationItemAction(ID, "dismiss");

    expect(putMock).toHaveBeenCalledWith(
      `${BASE}/preferences`,
      {
        notificationType: "tenant.user.invited",
        inAppEnabled: true,
      },
      WRITE_OPTIONS,
    );
    expect(postMock).toHaveBeenCalledWith(`${BASE}/read-all`, undefined, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ID}/read`, undefined, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ID}/acknowledge`, undefined, WRITE_OPTIONS);
    expect(deleteMock).toHaveBeenCalledWith(`${BASE}/${ID}`, WRITE_OPTIONS);
    expect(postMock).toHaveBeenCalledTimes(3);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("allowlists preference fields before sending a strict Core DTO", async () => {
    const command = {
      notificationType: "tenant.user.invited",
      inAppEnabled: false,
      pushEnabled: true,
      emailEnabled: true,
      quietHours: { from: "22:00" },
    };
    putMock.mockResolvedValue(envelope({ ...preferenceFixture(), inAppEnabled: false }));
    await expect(upsertAdminNotificationPreference(command)).resolves.toEqual({
      ...preferenceFixture(), inAppEnabled: false,
    });
    expect(putMock).toHaveBeenCalledWith(`${BASE}/preferences`, {
      notificationType: command.notificationType,
      inAppEnabled: false,
    }, WRITE_OPTIONS);
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
