import { describe, expect, it } from "vitest";
import {
  buildPreferenceCommand,
  isCanonicalUuidV7,
  readPreference,
  readPreferences,
  readNotificationPage,
  readRuntimeConfig,
  requireNotificationUuid,
  safeNotificationActionUrl,
} from "./contracts";

const ID = "019f0000-0000-7000-8000-000000000001";

describe("admin notification contracts", () => {
  it("builds only the current in-app preference command", () => {
    expect(buildPreferenceCommand({
      notificationType: " tenant.user.invited ",
      inAppEnabled: true,
    })).toEqual({
      command: {
        notificationType: "tenant.user.invited",
        inAppEnabled: true,
      },
      errors: {},
    });

    expect(buildPreferenceCommand({
      notificationType: "",
      inAppEnabled: true,
    })).toEqual({
      command: null,
      errors: { notificationType: "required" },
    });
  });

  it("rejects notification types longer than Core's limit", () => {
    expect(buildPreferenceCommand({ notificationType: "a".repeat(129), inAppEnabled: false }))
      .toEqual({ command: null, errors: { notificationType: "tooLong" } });
  });

  it("reads Core's minimal runtime config without provider or channel configuration", () => {
    const config = {
      enabled: true,
      inAppEnabled: true,
      realtimeEnabled: false,
      previewLimit: 5,
      pollIntervalMs: 60_000,
    };
    expect(readRuntimeConfig(config)).toEqual(config);
    expect(() => readRuntimeConfig({ ...config, pollIntervalMs: 4_999 })).toThrow();
    expect(() => readRuntimeConfig({ ...config, previewLimit: 21 })).toThrow();
    expect(() => readRuntimeConfig({ ...config, inAppEnabled: "true" })).toThrow();
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

  it("reads in-app preferences and rejects missing required response fields", () => {
    const preference = {
      notificationType: "tenant.user.invited",
      inAppEnabled: false,
      updatedAt: "2026-08-12T10:00:00.000Z",
    };
    expect(readPreference(preference)).toEqual(preference);
    expect(readPreferences([preference])).toEqual([preference]);
    expect(() => readPreference({ ...preference, inAppEnabled: undefined })).toThrow();
    expect(() => readPreferences([preference, preference])).toThrow();
  });
});
