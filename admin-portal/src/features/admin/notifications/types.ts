import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export interface AdminNotification {
  id: string;
  sourceApp: string;
  notificationType: string;
  priority: string;
  title: string;
  body: string;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  channels: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  deliveredAt: string | null;
}

export interface AdminNotificationPage {
  items: AdminNotification[];
  unreadCount: number;
  nextCursor: string | null;
  hasNext: boolean;
}

export interface NotificationRuntimeConfig {
  enabled: boolean;
  inAppEnabled: boolean;
  realtimeEnabled: boolean;
  previewLimit: number;
  pollIntervalMs: number;
}

export interface NotificationPreference {
  notificationType: string;
  inAppEnabled: boolean;
  updatedAt: string;
}

export interface NotificationPreferenceCommand {
  notificationType: string;
  inAppEnabled: boolean;
}

export interface NotificationListQuery {
  limit: number;
  cursor?: string;
  unreadOnly: boolean;
}

export type NotificationItemAction =
  | "read"
  | "acknowledge"
  | "dismiss";

export type NotificationBulkAction = "read-all";

export type NotificationRequestState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "ERROR";

export type NotificationActionState =
  | "IDLE"
  | "PENDING"
  | "SUCCESS"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "VALIDATION"
  | "CONFLICT"
  | "STALE"
  | "ERROR";

export interface NotificationActionStatus {
  state: NotificationActionState;
  operation: string | null;
  messageKey: string | null;
  error: NormalizedApiError | null;
}
