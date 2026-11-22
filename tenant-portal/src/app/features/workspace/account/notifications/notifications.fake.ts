import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay } from '../../../../core/fake/fake-utils';
import {
  isNotificationType,
  type NotificationPreference,
  type NotificationPreferenceBody,
  type NotificationType,
} from './notifications.model';

export let FAKE_NOTIFICATIONS_FAIL_NEXT = false;

export function setFakeNotificationsFailNext(fail: boolean): void {
  FAKE_NOTIFICATIONS_FAIL_NEXT = fail;
}

const SEED_UPDATED_AT = '2026-11-20T09:00:00.000Z';

function createSeedStore(): Map<NotificationType, NotificationPreference> {
  return new Map<NotificationType, NotificationPreference>([
    [
      'core.activity.updated',
      {
        notificationType: 'core.activity.updated',
        inAppEnabled: false,
        updatedAt: SEED_UPDATED_AT,
      },
    ],
    [
      'record.deleted',
      {
        notificationType: 'record.deleted',
        inAppEnabled: false,
        updatedAt: SEED_UPDATED_AT,
      },
    ],
  ]);
}

let store: Map<NotificationType, NotificationPreference> = createSeedStore();

export function resetNotificationsFake(): void {
  store = createSeedStore();
  FAKE_NOTIFICATIONS_FAIL_NEXT = false;
}

async function enterCall(): Promise<void> {
  await fakeDelay();
  if (FAKE_NOTIFICATIONS_FAIL_NEXT) {
    FAKE_NOTIFICATIONS_FAIL_NEXT = false;
    throw new ApiError(500, 'INTERNAL_ERROR');
  }
}

export async function fakeListPreferences(): Promise<NotificationPreference[]> {
  await enterCall();
  return Array.from(store.values())
    .sort((a, b) => a.notificationType.localeCompare(b.notificationType))
    .map((row) => ({ ...row }));
}

export async function fakeUpsertPreference(
  body: NotificationPreferenceBody,
): Promise<NotificationPreference> {
  await enterCall();
  const type: string = body.notificationType;
  if (!type || type.length > 128) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { notificationType: [type ? 'max_length' : 'is_not_empty'] });
  }
  if (!isNotificationType(type)) {
    throw new ApiError(422, 'NOTIFICATION_TYPE_UNKNOWN');
  }
  const existing = store.get(type);
  // Backend upsert: a new row defaults to on; an unchanged value keeps the stored row and its updatedAt.
  const inAppEnabled = body.inAppEnabled ?? existing?.inAppEnabled ?? true;
  if (existing && existing.inAppEnabled === inAppEnabled) {
    return { ...existing };
  }
  const saved: NotificationPreference = {
    notificationType: type,
    inAppEnabled,
    updatedAt: new Date().toISOString(),
  };
  store.set(type, saved);
  return { ...saved };
}
