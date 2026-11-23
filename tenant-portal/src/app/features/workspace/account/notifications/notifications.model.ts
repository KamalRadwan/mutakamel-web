import { z } from 'zod';

export const notificationPreferenceSchema = z.object({
  notificationType: z.string().min(1).max(128),
  inAppEnabled: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const notificationPreferencesSchema = z.array(notificationPreferenceSchema);

export const NOTIFICATION_TYPES = [
  'core.activity.assigned',
  'core.activity.updated',
  'core.activity.completed',
  'core.activity.cancelled',
  'core.activity.reminder',
  'crm.lead.assigned',
  'record.owner_changed',
  'record.deleted',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export interface NotificationPreferenceBody {
  notificationType: NotificationType;
  /** Optional in the DTO: omitted keeps the stored value (a new row is on). */
  inAppEnabled?: boolean;
}

export const NOTIFICATION_DEFAULT_IN_APP = true;

export type NotificationGroupKey = 'activities' | 'crm' | 'records';

export const NOTIFICATION_GROUPS: readonly {
  key: NotificationGroupKey;
  icon: string;
  tile: string;
  types: readonly NotificationType[];
}[] = [
  {
    key: 'activities',
    icon: 'tablerChecklist',
    tile: 'bg-icon-teal',
    types: [
      'core.activity.assigned',
      'core.activity.reminder',
      'core.activity.updated',
      'core.activity.completed',
      'core.activity.cancelled',
    ],
  },
  {
    key: 'crm',
    icon: 'tablerUserPlus',
    tile: 'bg-icon-green',
    types: ['crm.lead.assigned'],
  },
  {
    key: 'records',
    icon: 'tablerFileDescription',
    tile: 'bg-icon-navy',
    types: ['record.owner_changed', 'record.deleted'],
  },
];

const NOTIFICATION_TYPE_SET: ReadonlySet<string> = new Set(NOTIFICATION_TYPES);

export function isNotificationType(value: string): value is NotificationType {
  return NOTIFICATION_TYPE_SET.has(value);
}

export function notificationTypeI18nKey(type: NotificationType): string {
  return type.replace(/\./g, '_');
}

/** Merge stored rows over the catalogue: a missing type is on. */
export function effectivePreferences(
  rows: readonly NotificationPreference[],
): Record<NotificationType, boolean> {
  const result = {} as Record<NotificationType, boolean>;
  for (const type of NOTIFICATION_TYPES) {
    result[type] = NOTIFICATION_DEFAULT_IN_APP;
  }
  for (const row of rows) {
    if (isNotificationType(row.notificationType)) {
      result[row.notificationType] = row.inAppEnabled;
    }
  }
  return result;
}
