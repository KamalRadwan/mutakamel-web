import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { fakeListPreferences, fakeUpsertPreference } from './notifications.fake';
import type { NotificationPreference, NotificationPreferenceBody } from './notifications.model';

// Real browser base: /api/tenant/core/v1 (envelope { data }). Self-service: no permission key.

export function listNotificationPreferences(): Promise<NotificationPreference[]> {
  // GET /api/tenant/core/v1/notifications/preferences (stored rows only; missing type = default on)
  return fakeListPreferences();
}

export function upsertNotificationPreference(
  body: NotificationPreferenceBody,
  _idempotencyKey: string = newIdempotencyKey(),
): Promise<NotificationPreference> {
  // PUT /api/tenant/core/v1/notifications/preferences (one type per call; header x-idempotency-key UUIDv7,
  // required by the gateway: WRITE_SENSITIVE route) — 400 CORE_VALIDATION_FAILED, 422 NOTIFICATION_TYPE_UNKNOWN
  return fakeUpsertPreference(body);
}
