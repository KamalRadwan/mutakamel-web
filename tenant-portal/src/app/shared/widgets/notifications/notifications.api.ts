import {
  fakeAcknowledgeNotification,
  fakeDismissNotification,
  fakeGetNotification,
  fakeGetNotificationConfig,
  fakeGetUnreadCount,
  fakeListNotifications,
  fakeMarkAllNotificationsRead,
  fakeMarkNotificationRead,
} from './notifications.fake';
import type {
  NotificationListResult,
  NotificationQuery,
  NotificationReadAllResult,
  NotificationRuntimeConfig,
  NotificationUnreadCount,
  NotificationView,
} from './notifications.model';

// Backend: core-app/src/tenant/notifications/notifications.controller.ts (TenantNotificationsController).
// Browser base: /api/tenant/core/v1 (envelope { data }). Self-service routes need no permission key;
// `config` needs `notifications.notification.read`.
// Errors ({ code, message }, no details): 404 NOTIFICATION_NOT_FOUND, 404 NOTIFICATION_USER_NOT_FOUND,
// 400 NOTIFICATION_CURSOR_INVALID, 400 CORE_VALIDATION_FAILED (bad limit or non-UUID id).
// Writes send x-idempotency-key (UUID v7): one key per user action, the same key on a retry of it.

/** GET /api/tenant/core/v1/notifications/config */
export function getNotificationConfig(): Promise<NotificationRuntimeConfig> {
  return fakeGetNotificationConfig();
}

/** GET /api/tenant/core/v1/notifications?limit=1..50(20)&cursor=<opaque>&unreadOnly=true — newest first. */
export function listNotifications(query: NotificationQuery = {}): Promise<NotificationListResult> {
  return fakeListNotifications(query);
}

/** GET /api/tenant/core/v1/notifications/unread-count → { unreadCount } */
export function getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
  return fakeGetUnreadCount();
}

/** GET /api/tenant/core/v1/notifications/:id — dismissed or other recipients' items are 404. */
export function getNotification(id: string): Promise<NotificationView> {
  return fakeGetNotification(id);
}

/** POST /api/tenant/core/v1/notifications/read-all → { updated } (header x-idempotency-key) */
export function markAllNotificationsRead(idempotencyKey: string): Promise<NotificationReadAllResult> {
  return fakeMarkAllNotificationsRead(idempotencyKey);
}

/** POST /api/tenant/core/v1/notifications/:id/read → 204 (header x-idempotency-key) */
export function markNotificationRead(id: string, idempotencyKey: string): Promise<void> {
  return fakeMarkNotificationRead(id, idempotencyKey);
}

/** POST /api/tenant/core/v1/notifications/:id/acknowledge → 204 (also marks read; header x-idempotency-key) */
export function acknowledgeNotification(id: string, idempotencyKey: string): Promise<void> {
  return fakeAcknowledgeNotification(id, idempotencyKey);
}

/** DELETE /api/tenant/core/v1/notifications/:id → 204 (dismiss for this user only; header x-idempotency-key) */
export function dismissNotification(id: string, idempotencyKey: string): Promise<void> {
  return fakeDismissNotification(id, idempotencyKey);
}
