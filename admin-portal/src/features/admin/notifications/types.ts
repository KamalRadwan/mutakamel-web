import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

type NotificationProvider = "none" | "firebase";
export type DeviceTokenProvider = "fcm" | "apns" | "web-push";

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
  pushEnabled: boolean;
  emailEnabled: boolean;
  provider: NotificationProvider;
  previewLimit: number;
  pollIntervalMs: number;
  firebase: {
    apiKey: string;
    appId: string;
    authDomain: string;
    projectId: string;
    messagingSenderId: string;
    storageBucket: string;
    measurementId: string;
    webPushVapidPublicKey: string;
    messagingServiceWorkerPath: string;
    messagingServiceWorkerScope: string;
  };
}

export interface NotificationPreference {
  notificationType: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHours: Record<string, unknown>;
  updatedAt: string;
}

export interface NotificationPreferenceCommand {
  notificationType: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHours: Record<string, unknown>;
}

export interface RegisterDeviceTokenCommand {
  provider: DeviceTokenProvider;
  token: string;
  deviceId?: string;
  platform?: string;
  enabled: boolean;
}

export interface DeviceTokenReceipt {
  id: string;
  provider: string;
  tokenHash: string;
  deviceId: string | null;
  platform: string | null;
  enabled: boolean;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface NotificationListQuery {
  limit: number;
  cursor?: string;
  unreadOnly: boolean;
}

export type NotificationItemAction =
  | "read"
  | "acknowledge"
  | "ack-compatibility"
  | "dismiss"
  | "dismiss-post-compatibility";

export type NotificationBulkAction = "read-all" | "mark-all-read-compatibility";

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
