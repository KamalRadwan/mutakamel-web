import { z } from 'zod';
import type { RealtimeFailure } from './realtime-client.model';

// Core notifications.service.ts / notification.types.ts. Other runtime settings are not consumed here.
export const notificationFeedConfigSchema = z.object({
  enabled: z.boolean(),
  inAppEnabled: z.boolean(),
  realtimeEnabled: z.boolean(),
  pollIntervalMs: z.number().finite(),
});
export type NotificationsFeedConfig = z.infer<typeof notificationFeedConfigSchema>;

export const notificationFeedSnapshotSchema = z.object({
  items: z.array(z.unknown()).max(1),
  unreadCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  unreadRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  unreadChangedAt: z.iso.datetime(),
  nextCursor: z.string().max(2048).nullable(),
  hasNext: z.boolean(),
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
