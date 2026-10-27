import type {
  AdminNotification,
  AdminNotificationPage,
  NotificationPreference,
  NotificationPreferenceCommand,
  NotificationRuntimeConfig,
} from "./types";

export const NOTIFICATION_LIST_LIMITS = [10, 20, 50] as const;
const NOTIFICATION_TYPE_MAX_LENGTH = 128;

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class NotificationContractError extends Error {
  constructor(message = "NOTIFICATION_CONTRACT_INVALID") {
    super(message);
    this.name = "NotificationContractError";
  }
}

export interface PreferenceDraft {
  notificationType: string;
  inAppEnabled: boolean;
}

export interface PreferenceValidationErrors {
  notificationType?: "required" | "tooLong";
}

export function isCanonicalUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}

export function readNotificationPage(value: unknown): AdminNotificationPage {
  const source = object(value);
  const items = array(source.items).map(readNotification);
  const unreadCount = nonNegativeInteger(source.unreadCount);
  const hasNext = boolean(source.hasNext);
  const nextCursor = nullableString(source.nextCursor, 16_384);
  if (hasNext && !nextCursor) fail();
  return { items, unreadCount, nextCursor, hasNext };
}

export function readUnreadCount(value: unknown): number {
  return nonNegativeInteger(object(value).unreadCount);
}

export function readUpdatedCount(value: unknown): number {
  return nonNegativeInteger(object(value).updated);
}

export function readRuntimeConfig(value: unknown): NotificationRuntimeConfig {
  const source = object(value);
  return {
    enabled: boolean(source.enabled),
    inAppEnabled: boolean(source.inAppEnabled),
    realtimeEnabled: boolean(source.realtimeEnabled),
    previewLimit: boundedInteger(source.previewLimit, 1, 20),
    pollIntervalMs: boundedInteger(source.pollIntervalMs, 5_000, 3_600_000),
  };
}

export function readPreferences(value: unknown): NotificationPreference[] {
  const preferences = array(value).map(readPreference);
  if (new Set(preferences.map((item) => item.notificationType)).size !== preferences.length) {
    fail();
  }
  return preferences;
}

export function readPreference(value: unknown): NotificationPreference {
  const source = object(value);
  return {
    notificationType: string(source.notificationType, 128),
    inAppEnabled: boolean(source.inAppEnabled),
    updatedAt: isoDate(source.updatedAt),
  };
}

export function buildPreferenceCommand(draft: PreferenceDraft): {
  command: NotificationPreferenceCommand | null;
  errors: PreferenceValidationErrors;
} {
  const errors: PreferenceValidationErrors = {};
  const notificationType = draft.notificationType.trim();
  if (!notificationType) errors.notificationType = "required";
  else if (notificationType.length > NOTIFICATION_TYPE_MAX_LENGTH) {
    errors.notificationType = "tooLong";
  }

  if (Object.keys(errors).length) return { command: null, errors };
  return {
    command: {
      notificationType,
      inAppEnabled: draft.inAppEnabled,
    },
    errors,
  };
}

export function requireNotificationUuid(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!isCanonicalUuidV7(normalized)) throw new NotificationContractError("UUID_V7_REQUIRED");
  return normalized;
}

export function safeNotificationActionUrl(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

function readNotification(value: unknown): AdminNotification {
  const source = object(value);
  return {
    id: uuid(source.id),
    sourceApp: string(source.sourceApp, 32),
    notificationType: string(source.notificationType, 128),
    priority: string(source.priority, 16),
    title: string(source.title, 180),
    body: string(source.body, 100_000, true),
    actionUrl: nullableString(source.actionUrl, 1_024),
    entityType: nullableString(source.entityType, 128),
    entityId: nullableUuid(source.entityId),
    channels: array(source.channels).map((item) => string(item, 64)),
    metadata: plainObject(source.metadata),
    createdAt: isoDate(source.createdAt),
    readAt: nullableIsoDate(source.readAt),
    acknowledgedAt: nullableIsoDate(source.acknowledgedAt),
    deliveredAt: nullableIsoDate(source.deliveredAt),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) fail();
  return value;
}

function plainObject(value: unknown): Record<string, unknown> {
  return { ...object(value) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail();
  return value;
}

function string(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.length)) fail();
  return value;
}

function nullableString(value: unknown, max: number): string | null {
  return value === null ? null : string(value, max, true);
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function boundedInteger(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail();
  return value as number;
}

function nonNegativeInteger(value: unknown): number {
  return boundedInteger(value, 0, Number.MAX_SAFE_INTEGER);
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !isCanonicalUuidV7(value)) fail();
  return value;
}

function nullableUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function isoDate(value: unknown): string {
  if (typeof value !== "string") fail();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail();
  return value;
}

function nullableIsoDate(value: unknown): string | null {
  return value === null ? null : isoDate(value);
}

function fail(): never {
  throw new NotificationContractError();
}
