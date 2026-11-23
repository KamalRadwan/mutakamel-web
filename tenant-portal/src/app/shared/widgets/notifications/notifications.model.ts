// Shapes follow core-app/src/common/notifications (notification.types.ts, dto/notification-query.dto.ts).

import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { matchesRegisteredRoute } from '../../../core/routing/registered-route';

/** `NotificationView`: one inbox item with the current recipient state. */
export interface NotificationView {
  id: string;
  recipientId: string;
  sourceApp: string;
  notificationType: string;
  /** Stored priority, for example `P1_HIGH` or `P2_NORMAL` (default). */
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
  recipientStateVersion: number;
}

/** `NotificationListResult`: cursor page plus the unread snapshot. */
export interface NotificationListResult {
  items: NotificationView[];
  unreadCount: number;
  unreadRevision: number;
  unreadChangedAt: string;
  nextCursor: string | null;
  hasNext: boolean;
}

/** `NotificationQueryDto`. */
export interface NotificationQuery {
  /** 1 to 50, default 20. */
  limit?: number;
  /** Opaque cursor, max 2048 characters. */
  cursor?: string;
  unreadOnly?: boolean;
}

export interface NotificationUnreadCount {
  unreadCount: number;
}

export interface NotificationReadAllResult {
  updated: number;
}

export const NOTIFICATION_LIMITS = {
  defaultLimit: 20,
  minLimit: 1,
  maxLimit: 50,
  cursor: 2048,
} as const;

/** `NOTIFICATION_PREFERENCE_TYPES`: the types producers send today. */
export const KNOWN_NOTIFICATION_TYPES = [
  'core.activity.assigned',
  'core.activity.cancelled',
  'core.activity.completed',
  'core.activity.reminder',
  'core.activity.updated',
  'crm.lead.assigned',
  'record.deleted',
  'record.owner_changed',
] as const;

export type KnownNotificationType = (typeof KNOWN_NOTIFICATION_TYPES)[number];

export type NotificationDayGroup = 'today' | 'yesterday' | 'earlier';

export interface NotificationLook {
  icon: string;
  tile: string;
  /** Translation key under `notifications.types` (dots become underscores; unknown types use `other`). */
  labelKey: string;
}

const LOOKS: Record<KnownNotificationType, { icon: string; tile: string }> = {
  'core.activity.assigned': { icon: 'tablerChecklist', tile: 'bg-icon-teal' },
  'core.activity.cancelled': { icon: 'tablerCircleX', tile: 'bg-icon-red' },
  'core.activity.completed': { icon: 'tablerCircleCheck', tile: 'bg-icon-green' },
  'core.activity.reminder': { icon: 'tablerClock', tile: 'bg-icon-orange' },
  'core.activity.updated': { icon: 'tablerPencil', tile: 'bg-icon-blue' },
  'crm.lead.assigned': { icon: 'tablerUserPlus', tile: 'bg-icon-violet' },
  'record.deleted': { icon: 'tablerTrash', tile: 'bg-icon-gray' },
  'record.owner_changed': { icon: 'tablerUserShare', tile: 'bg-icon-navy' },
};

const KNOWN_SET: ReadonlySet<string> = new Set(KNOWN_NOTIFICATION_TYPES);

export function isKnownNotificationType(value: string): value is KnownNotificationType {
  return KNOWN_SET.has(value);
}

/** Icon, tile tone and label key for any `notificationType`; unknown types get a neutral look. */
export function notificationLook(type: string): NotificationLook {
  if (isKnownNotificationType(type)) {
    return { ...LOOKS[type], labelKey: `notifications.types.${type.replace(/\./g, '_')}` };
  }
  return { icon: 'tablerInfoCircle', tile: 'bg-icon-gray', labelKey: 'notifications.types.other' };
}

/**
 * The backend sends `entityType` in several spellings (`Lead`, `lead`, `CustomerProfile`, `customer_profile`),
 * so it is compared without case or separators. Unknown types fall back to a generic "record".
 */
const ENTITY_TYPE_LABELS: ReadonlyMap<string, string> = new Map([
  ['lead', 'lead'],
  ['opportunity', 'opportunity'],
  ['customerprofile', 'customer'],
  ['customer', 'customer'],
  ['activity', 'activity'],
  ['party', 'party'],
  ['quotation', 'quotation'],
  ['invoice', 'invoice'],
]);

/** Key under `wsNotif.entityTypes` for a notification's `entityType`. */
export function entityTypeLabel(type: string): string {
  return ENTITY_TYPE_LABELS.get(type.replace(/[^a-z0-9]/gi, '').toLowerCase()) ?? 'record';
}

/**
 * Only same-app paths that match a registered route (`routes` is the router config) are followed from
 * `actionUrl`; anything else, including a path that would land on Not Found, stays unlinked.
 */
export async function inAppActionPath(
  actionUrl: string | null,
  routes: Routes,
  injector?: Injector,
): Promise<string | null> {
  if (!actionUrl || !actionUrl.startsWith('/') || actionUrl.startsWith('//')) return null;
  return (await matchesRegisteredRoute(routes, actionUrl, injector)) ? actionUrl : null;
}
