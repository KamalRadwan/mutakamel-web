import { describe, expect, it } from "vitest";
import {
  buildDeviceTokenCommand,
  buildPreferenceCommand,
  isCanonicalUuidV7,
  readDeviceTokenReceipt,
  readNotificationPage,
  readRuntimeConfig,
  requireNotificationUuid,
  safeNotificationActionUrl,
} from "./contracts";

const ID = "019f0000-0000-7000-8000-000000000001";

describe("admin notification contracts", () => {
  it("builds the exact full preference snapshot and validates JSON objects", () => {
    expect(buildPreferenceCommand({
      notificationType: " tenant.user.invited ",
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: true,
      quietHoursText: '{"from":"22:00"}',
    })).toEqual({
      command: {
        notificationType: "tenant.user.invited",
        inAppEnabled: true,
        pushEnabled: false,
        emailEnabled: true,
        quietHours: { from: "22:00" },
      },
      errors: {},
    });

    expect(buildPreferenceCommand({
      notificationType: "",
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: true,
      quietHoursText: "[]",
    })).toEqual({
      command: null,
      errors: { notificationType: "required", quietHours: "objectRequired" },
    });
  });

  it("preserves the provider token exactly while trimming bounded metadata", () => {
    expect(buildDeviceTokenCommand({
      provider: "web-push",
      token: "  opaque-provider-token  ",
      deviceId: " browser-1 ",
      platform: " web ",
      enabled: true,
    })).toEqual({
      command: {
        provider: "web-push",
        token: "  opaque-provider-token  ",
        deviceId: "browser-1",
        platform: "web",
        enabled: true,
      },
      errors: {},
    });
  });

  it("enforces canonical UUIDv7 ids and rejects unsafe destinations", () => {
    expect(isCanonicalUuidV7(ID)).toBe(true);
    expect(requireNotificationUuid(ID.toUpperCase())).toBe(ID);
    expect(() => requireNotificationUuid("00000000-0000-4000-8000-000000000000"))
      .toThrow("UUID_V7_REQUIRED");
    expect(safeNotificationActionUrl("/tenants/one")).toBe("/tenants/one");
    expect(safeNotificationActionUrl("https://evil.example.test")).toBeNull();
    expect(safeNotificationActionUrl("//evil.example.test")).toBeNull();
    expect(safeNotificationActionUrl("/safe\\..\\unsafe")).toBeNull();
  });

  it("fails closed on response drift and cursor invariant violations", () => {
    expect(() => readNotificationPage({
      items: [],
      unreadCount: 0,
      nextCursor: null,
      hasNext: true,
    })).toThrow("NOTIFICATION_CONTRACT_INVALID");
    expect(() => readRuntimeConfig({ enabled: true })).toThrow("NOTIFICATION_CONTRACT_INVALID");
  });

  it("accepts empty optional device metadata emitted by the exact DTO", () => {
    expect(readDeviceTokenReceipt({
      id: ID,
      provider: "web-push",
      tokenHash: "b".repeat(64),
      deviceId: "",
      platform: "",
      enabled: true,
      lastSeenAt: "2026-08-12T10:00:00.000Z",
      revokedAt: null,
    })).toMatchObject({ deviceId: "", platform: "" });
  });
});
