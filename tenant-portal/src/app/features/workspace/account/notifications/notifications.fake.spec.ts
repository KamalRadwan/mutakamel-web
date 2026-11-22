import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { listNotificationPreferences, upsertNotificationPreference } from './notifications.api';
import { resetNotificationsFake, setFakeNotificationsFailNext } from './notifications.fake';
import { NOTIFICATION_TYPES, type NotificationType, effectivePreferences } from './notifications.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('notification preferences fake (backend contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetNotificationsFake();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('matches the backend preference catalogue', () => {
    expect([...NOTIFICATION_TYPES].sort()).toEqual([
      'core.activity.assigned',
      'core.activity.cancelled',
      'core.activity.completed',
      'core.activity.reminder',
      'core.activity.updated',
      'crm.lead.assigned',
      'record.deleted',
      'record.owner_changed',
    ]);
  });

  it('lists only stored rows ordered by notificationType', async () => {
    const rows = await settle(listNotificationPreferences());
    expect(rows.map((r) => r.notificationType)).toEqual(['core.activity.updated', 'record.deleted']);
    expect(Object.keys(rows[0]).sort()).toEqual(['inAppEnabled', 'notificationType', 'updatedAt']);
    expect(effectivePreferences(rows)['crm.lead.assigned']).toBe(true);
  });

  it('upserts one type and keeps updatedAt when the value is unchanged', async () => {
    const saved = await settle(upsertNotificationPreference({ notificationType: 'crm.lead.assigned', inAppEnabled: false }));
    expect(saved.inAppEnabled).toBe(false);
    const again = await settle(upsertNotificationPreference({ notificationType: 'crm.lead.assigned', inAppEnabled: false }));
    expect(again.updatedAt).toBe(saved.updatedAt);
  });

  it('defaults a new row to on when inAppEnabled is omitted', async () => {
    const saved = await settle(upsertNotificationPreference({ notificationType: 'record.owner_changed' }));
    expect(saved.inAppEnabled).toBe(true);
  });

  it('rejects an unknown type with 422 NOTIFICATION_TYPE_UNKNOWN', async () => {
    const error = await failure(
      upsertNotificationPreference({ notificationType: 'crm.unknown' as NotificationType, inAppEnabled: true }),
    );
    expect([error.status, error.code]).toEqual([422, 'NOTIFICATION_TYPE_UNKNOWN']);
  });

  it('rejects an empty type with 400 CORE_VALIDATION_FAILED and string-array details', async () => {
    const error = await failure(upsertNotificationPreference({ notificationType: '' as NotificationType }));
    expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(error.details).toEqual({ notificationType: ['is_not_empty'] });
  });

  it('can simulate a server error', async () => {
    setFakeNotificationsFailNext(true);
    const error = await failure(listNotificationPreferences());
    expect(error.status).toBe(500);
  });
});
