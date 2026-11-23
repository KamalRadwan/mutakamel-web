import {
  array,
  boolean,
  type infer as Infer,
  iso,
  number,
  object,
  string,
  unknown,
} from 'zod';
import type { RealtimeFailure } from './realtime-client.model';

// Core notifications.service.ts / notification.types.ts. Other runtime settings are not consumed here.
export const notificationFeedConfigSchema = object({
  enabled: boolean(),
  inAppEnabled: boolean(),
  realtimeEnabled: boolean(),
  pollIntervalMs: number().finite(),
});
export type NotificationsFeedConfig = Infer<typeof notificationFeedConfigSchema>;

export const notificationFeedSnapshotSchema = object({
  items: array(unknown()).max(1),
  unreadCount: number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  unreadRevision: number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  unreadChangedAt: iso.datetime(),
  nextCursor: string().max(2048).nullable(),
  hasNext: boolean(),
});

export interface NotificationsFeedState {
  status: 'idle' | 'loading' | 'live' | 'polling' | 'stale' | 'failed' | 'disabled';
  stale: boolean;
  failure: RealtimeFailure | null;
  at: number;
}

export interface NotificationsUnreadState {
  unreadCount: number;
  unreadRevision: number | null;
  at: number;
}

export type NotificationsFeedEvent =
  | {
      kind: 'created';
      notificationId: string;
      notice?: { eventId: string; title: string; body: string };
    }
  | {
      kind: 'updated';
      notificationId: string;
      change: 'READ' | 'ACKNOWLEDGED' | 'DISMISSED';
      readAt: string | null;
      acknowledgedAt: string | null;
      recipientStateVersion: number;
    }
  | { kind: 'sync' };
