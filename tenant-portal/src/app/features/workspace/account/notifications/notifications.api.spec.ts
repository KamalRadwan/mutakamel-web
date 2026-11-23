import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { NotificationPreferencesApi, notificationsErrorMessage } from './notifications.api';

const BASE = '/api/tenant/core/v1/notifications/preferences';
const body = { notificationType: 'core.activity.assigned', inAppEnabled: false } as const;
const saved = { ...body, updatedAt: '2026-11-23T10:00:00.000Z' };

describe('NotificationPreferencesApi real HTTP contract', () => {
  let api: NotificationPreferencesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(NotificationPreferencesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
  });

  it('reads the real catalogue, including an empty stored preference list', async () => {
    const done = api.listNotificationPreferences();
    const request = http.expectOne(BASE);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: [] });
    await expect(done).resolves.toEqual([]);
  });

  it('preserves the caller intent key and writes only supplied preference fields', async () => {
    const done = api.upsertNotificationPreference(body, 'intent-key');
    const request = http.expectOne(BASE);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('x-idempotency-key')).toBe('intent-key');
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf');
    request.flush({ success: true, data: saved });
    await expect(done).resolves.toEqual(saved);
  });

  it('preserves omitted inAppEnabled rather than inventing a value', async () => {
    const requestBody = { notificationType: body.notificationType };
    const done = api.upsertNotificationPreference(requestBody, 'intent-key');
    const request = http.expectOne(BASE);
    expect(request.request.body).toEqual(requestBody);
    request.flush({ success: true, data: saved });
    await expect(done).resolves.toEqual(saved);
  });

  it.each([null, {}, [{ ...saved, inAppEnabled: 'false' }], [{ ...saved, updatedAt: 'invalid' }]])(
    'rejects a malformed list instead of showing successful default preferences (%j)',
    async (data) => {
      const done = api.listNotificationPreferences();
      const rejected = expect(done).rejects.toMatchObject({ status: 502, code: 'GENERIC' });
      http.expectOne(BASE).flush({ success: true, data });
      await rejected;
    },
  );

  it.each([
    null,
    {},
    { ...saved, inAppEnabled: null },
    { ...saved, notificationType: 'record.deleted' },
  ])('rejects a malformed or mismatched save response (%j)', async (data) => {
    const done = api.upsertNotificationPreference(body, 'intent-key');
    const rejected = expect(done).rejects.toMatchObject({ status: 502, code: 'GENERIC' });
    http.expectOne(BASE).flush({ success: true, data });
    await rejected;
  });

  it.each([
    [401, 'GW.AUTH.UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOTIFICATION_USER_NOT_FOUND'],
    [409, 'GW.IDEM.IN_FLIGHT'],
    [422, 'NOTIFICATION_TYPE_UNKNOWN'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
  ])('preserves coded write failure %s without automatic retry', async (status, code) => {
    const done = api.upsertNotificationPreference(body, 'intent-key');
    const rejected = expect(done).rejects.toMatchObject({ status, code });
    http.expectOne(BASE).flush({ errorCode: code }, { status, statusText: 'Failed' });
    await rejected;
    http.expectNone(BASE);
  });

  it('preserves network failures rather than returning saved preferences', async () => {
    const done = api.upsertNotificationPreference(body, 'intent-key');
    const rejected = expect(done).rejects.toMatchObject({ status: 0 });
    http.expectOne(BASE).error(new ProgressEvent('error'));
    await rejected;
  });

  it('falls back to translated shared errors when scoped 401 copy is unavailable', () => {
    const t = (key: string) => (key === 'apiErrors.notSaved' ? 'Not saved. Try again.' : key);
    expect(
      notificationsErrorMessage(
        new ApiError(401, 'GW.AUTH.UNAUTHORIZED'),
        'wsAccNotif',
        t,
        'write',
      ),
    ).toBe('Not saved. Try again.');
  });

  it('uses notification-specific preference error copy', () => {
    const t = (key: string) =>
      key === 'wsAccNotif.errors.NOTIFICATION_TYPE_UNKNOWN' ? 'Unavailable type.' : key;
    expect(
      notificationsErrorMessage(
        new ApiError(422, 'NOTIFICATION_TYPE_UNKNOWN'),
        'wsAccNotif',
        t,
        'write',
      ),
    ).toBe('Unavailable type.');
  });
});
