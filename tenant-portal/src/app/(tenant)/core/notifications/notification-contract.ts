import { z } from "zod";
import type { CorePath } from "@/lib/api/envelope";

// This module validates the REST **inbox** projection with zod, matching the
// runtime in src/lib/notifications/ that owns the realtime projection. Two
// boundaries, two validators, on purpose: the runtime's schema is `strict`
// because its ordering and fingerprinting invariants depend on the exact
// shape, while an inbox screen must not go blank the day the server adds a
// field.

export const NOTIFICATIONS_PATH = "/api/tenant/core/v1/notifications";
export const NOTIFICATIONS_CONFIG_PATH: CorePath =
  "/api/tenant/core/v1/notifications/config";
export const NOTIFICATIONS_UNREAD_COUNT_PATH: CorePath =
  "/api/tenant/core/v1/notifications/unread-count";
export const NOTIFICATION_PREFERENCES_PATH: CorePath =
  "/api/tenant/core/v1/notifications/preferences";
export const DEVICE_TOKENS_PATH: CorePath =
  "/api/tenant/core/v1/notifications/device-tokens";

/** `NotificationQueryDto` — `limit` is 1–50 and defaults to 20. */
const NOTIFICATION_PAGE_SIZE = 25;
const NOTIFICATION_MAX_PAGE_SIZE = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const BACKSLASH_CODE_POINT = 92;
const DELETE_CODE_POINT = 127;
const LAST_CONTROL_CODE_POINT = 31;

/**
 * Four routes are aliases. These are the ones this screen uses, and it never
 * mixes in the other half of a pair:
 *
 *   POST /:id/acknowledge   (not /:id/ack — legacy)
 *   DELETE /:id             (not POST /:id/dismiss)
 *   POST /read-all          via the runtime's markAllTenantNotificationsRead,
 *                           which already owns that path; the dropdown and the
 *                           inbox must not disagree about which one they call.
 */
export function notificationReadPath(id: string): CorePath {
  return `${notificationPath(id)}/read` as CorePath;
}

export function notificationAcknowledgePath(id: string): CorePath {
  return `${notificationPath(id)}/acknowledge` as CorePath;
}

export function notificationPath(id: string): CorePath {
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid notification id.");
  return `${NOTIFICATIONS_PATH}/${encodeURIComponent(id)}` as CorePath;
}

export function deviceTokenPath(id: string): CorePath {
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid device-token id.");
  return `${DEVICE_TOKENS_PATH}/${encodeURIComponent(id)}` as CorePath;
}

/**
 * The cursor is opaque: it goes back exactly as it arrived, is never parsed,
 * and is never logged as if it meant something.
 */
export function notificationsListPath(
  cursor: string | null,
  unreadOnly: boolean,
): CorePath {
  const query = new URLSearchParams({ limit: String(NOTIFICATION_PAGE_SIZE) });
  if (cursor !== null) query.set("cursor", cursor);
  if (unreadOnly) query.set("unreadOnly", "true");
  return `${NOTIFICATIONS_PATH}?${query.toString()}` as CorePath;
}

/**
 * The same admission rule the realtime runtime applies to `action.route`
 * (`isSafeNotificationRoute` in src/lib/notifications/). An `actionUrl` becomes
 * an `href`, so a protocol-relative, control-bearing or traversal-bearing value
 * is refused at the boundary rather than rendered as a link.
 */
function isSafeNotificationRoute(value: string): boolean {
  const path = value.split(/[?#]/u, 1)[0] ?? "";
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    value.normalize("NFC") === value &&
    !hasUnsafeCharacter(value) &&
    !path.includes("//") &&
    !/%(?:00|2e|2f|5c)/iu.test(path) &&
    !path.split("/").some((part) => part === "." || part === "..")
  );
}

function hasUnsafeCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      code <= LAST_CONTROL_CODE_POINT ||
      code === DELETE_CODE_POINT ||
      code === BACKSLASH_CODE_POINT
    );
  });
}

const nullableIsoDate = z.iso.datetime({ offset: true }).nullable();
const metadataValue = z.union([z.string().max(512), z.number(), z.boolean(), z.null()]);

const notificationSchema = z.object({
  id: z.uuid(),
  recipientId: z.uuid(),
  sourceApp: z.string().min(1).max(128),
  notificationType: z.string().min(1).max(128),
  priority: z.string().min(1).max(64),
  title: z.string().min(1).max(720),
  body: z.string().min(1).max(16_384),
  actionUrl: z
    .string()
    .max(1_024)
    .refine(isSafeNotificationRoute, "Notification action is not same-origin safe.")
    .nullable(),
  entityType: z.string().max(128).nullable(),
  entityId: z.uuid().nullable(),
  channels: z.array(z.string().min(1).max(64)).max(16),
  metadata: z.record(z.string().max(64), metadataValue),
  createdAt: z.iso.datetime({ offset: true }),
  readAt: nullableIsoDate,
  acknowledgedAt: nullableIsoDate,
  deliveredAt: nullableIsoDate,
  recipientStateVersion: z.number().int().min(0),
});

const notificationPageSchema = z.object({
  items: z.array(notificationSchema).max(NOTIFICATION_MAX_PAGE_SIZE),
  unreadCount: z.number().int().min(0),
  nextCursor: z.string().min(1).max(2_048).nullable(),
  hasNext: z.boolean(),
});

const unreadCountSchema = z.object({ unreadCount: z.number().int().min(0) });

const preferenceSchema = z.object({
  notificationType: z.string().min(1).max(128),
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

const deviceTokenSchema = z.object({
  id: z.uuid(),
  provider: z.string().min(1).max(32),
  tokenHash: z.string().min(1).max(256),
  deviceId: z.string().max(128).nullable(),
  platform: z.string().max(32).nullable(),
  enabled: z.boolean(),
  lastSeenAt: z.iso.datetime({ offset: true }),
  revokedAt: nullableIsoDate,
});

/** `NotificationRuntimeConfig` — only the channel switches this screen reads. */
const runtimeConfigSchema = z.object({
  enabled: z.boolean(),
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

export type NotificationPage = z.infer<typeof notificationPageSchema>;
export type NotificationPreference = z.infer<typeof preferenceSchema>;
export type DeviceToken = z.infer<typeof deviceTokenSchema>;
export type NotificationChannelConfig = z.infer<typeof runtimeConfigSchema>;
export type InboxNotification = z.infer<typeof notificationSchema>;

export type NotificationChannel = "inApp" | "push" | "email";

/** `RegisterDeviceTokenDto` — `@IsIn(['fcm','apns','web-push'])`. */
export const DEVICE_TOKEN_PROVIDERS = ["fcm", "apns", "web-push"] as const;
export type DeviceTokenProvider = (typeof DEVICE_TOKEN_PROVIDERS)[number];

export interface RegisterDeviceTokenRequest {
  provider: DeviceTokenProvider;
  token: string;
  deviceId?: string;
  platform?: string;
  enabled?: boolean;
}

/** `UpsertNotificationPreferenceDto` — omitted channels keep their value. */
export interface UpsertPreferenceRequest {
  notificationType: string;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

export function parseNotificationPage(payload: unknown): NotificationPage {
  return notificationPageSchema.parse(payload);
}

export function parseUnreadCount(payload: unknown): number {
  return unreadCountSchema.parse(payload).unreadCount;
}

export function parseNotificationPreferences(payload: unknown): NotificationPreference[] {
  return z.array(preferenceSchema).max(500).parse(payload);
}

export function parseNotificationPreference(payload: unknown): NotificationPreference {
  return preferenceSchema.parse(payload);
}

export function parseDeviceToken(payload: unknown): DeviceToken {
  return deviceTokenSchema.parse(payload);
}

export function parseChannelConfig(payload: unknown): NotificationChannelConfig {
  return runtimeConfigSchema.parse(payload);
}

/** The only priority the backend is proven to emit; anything else renders raw. */
export const KNOWN_NOTIFICATION_PRIORITY = "P2_NORMAL";
