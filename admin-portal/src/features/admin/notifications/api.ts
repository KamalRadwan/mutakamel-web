import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import {
  readDeviceTokenReceipt,
  readNotificationPage,
  readPreference,
  readPreferences,
  readRuntimeConfig,
  readUnreadCount,
  readUpdatedCount,
  requireNotificationUuid,
} from "./contracts";
import type {
  AdminNotificationPage,
  DeviceTokenReceipt,
  NotificationBulkAction,
  NotificationItemAction,
  NotificationListQuery,
  NotificationPreference,
  NotificationPreferenceCommand,
  NotificationRuntimeConfig,
  RegisterDeviceTokenCommand,
} from "./types";

const BASE_URL = "/api/admin/core/v1/notifications";
const READ_OPTIONS = (signal?: AbortSignal) => ({ cache: "no-store" as const, signal });
const NATURALLY_IDEMPOTENT_WRITE = {
  cache: "no-store" as const,
  skipAutoIdempotency: true,
  replayAfterRefresh: true,
};

export async function listAdminNotifications(
  query: NotificationListQuery,
  signal?: AbortSignal,
): Promise<AdminNotificationPage> {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.unreadOnly) params.set("unreadOnly", "true");
  const response = await axiosClient.get<unknown>(
    `${BASE_URL}?${params.toString()}`,
    READ_OPTIONS(signal),
  );
  return readNotificationPage(unwrapCoreData(response.data));
}

export async function getAdminNotificationConfig(
  signal?: AbortSignal,
): Promise<NotificationRuntimeConfig> {
  const response = await axiosClient.get<unknown>(
    `${BASE_URL}/config`,
    READ_OPTIONS(signal),
  );
  return readRuntimeConfig(unwrapCoreData(response.data));
}

export async function getAdminNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreference[]> {
  const response = await axiosClient.get<unknown>(
    `${BASE_URL}/preferences`,
    READ_OPTIONS(signal),
  );
  return readPreferences(unwrapCoreData(response.data));
}

export async function getAdminNotificationUnreadCount(
  signal?: AbortSignal,
): Promise<number> {
  const response = await axiosClient.get<unknown>(
    `${BASE_URL}/unread-count`,
    READ_OPTIONS(signal),
  );
  return readUnreadCount(unwrapCoreData(response.data));
}

export async function upsertAdminNotificationPreference(
  command: NotificationPreferenceCommand,
): Promise<NotificationPreference> {
  const response = await axiosClient.put<unknown>(
    `${BASE_URL}/preferences`,
    command,
    NATURALLY_IDEMPOTENT_WRITE,
  );
  return readPreference(unwrapCoreData(response.data));
}

export async function registerAdminNotificationDeviceToken(
  command: RegisterDeviceTokenCommand,
): Promise<DeviceTokenReceipt> {
  const response = await axiosClient.post<unknown>(
    `${BASE_URL}/device-tokens`,
    command,
    NATURALLY_IDEMPOTENT_WRITE,
  );
  return readDeviceTokenReceipt(unwrapCoreData(response.data));
}

export async function revokeAdminNotificationDeviceToken(id: string): Promise<void> {
  await axiosClient.delete(
    `${BASE_URL}/device-tokens/${requireNotificationUuid(id)}`,
    NATURALLY_IDEMPOTENT_WRITE,
  );
}

export async function performAdminNotificationBulkAction(
  action: NotificationBulkAction,
): Promise<number> {
  const path = action === "read-all" ? "read-all" : "mark-all-read";
  const response = await axiosClient.post<unknown>(
    `${BASE_URL}/${path}`,
    undefined,
    NATURALLY_IDEMPOTENT_WRITE,
  );
  return readUpdatedCount(unwrapCoreData(response.data));
}

export async function performAdminNotificationItemAction(
  id: string,
  action: NotificationItemAction,
): Promise<void> {
  const notificationId = requireNotificationUuid(id);
  if (action === "dismiss") {
    await axiosClient.delete(
      `${BASE_URL}/${notificationId}`,
      NATURALLY_IDEMPOTENT_WRITE,
    );
    return;
  }
  const path = action === "read"
    ? "read"
    : action === "acknowledge"
      ? "acknowledge"
      : action === "ack-compatibility"
        ? "ack"
        : "dismiss";
  await axiosClient.post(
    `${BASE_URL}/${notificationId}/${path}`,
    undefined,
    NATURALLY_IDEMPOTENT_WRITE,
  );
}
