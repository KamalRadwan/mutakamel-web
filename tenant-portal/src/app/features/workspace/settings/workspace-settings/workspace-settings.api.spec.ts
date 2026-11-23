import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { WorkspaceSettingsApi } from './workspace-settings.api';
import type { SessionPolicy, UpdateWorkspaceSettingsRequest } from './workspace-settings.model';

const path = '/api/tenant/core/v1/workspace-settings';
const settings = {
  id: 'settings',
  defaultLanguage: 'en',
  defaultCurrencyCode: 'EGP',
  timezone: 'Africa/Cairo',
  allowSupport: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
};
const lifetimes = {
  accessTokenTtlSeconds: 900,
  idleTimeoutSeconds: 259200,
  absoluteTimeoutSeconds: 2592000,
};
const policy: SessionPolicy = {
  override: null,
  effective: lifetimes,
  defaults: lifetimes,
  limits: {
    accessTokenTtlSeconds: { min: 60, max: 86400 },
    idleTimeoutSeconds: { min: 300, max: 2592000 },
    absoluteTimeoutSeconds: { min: 1800, max: 31536000 },
  },
};
const etag = `"${'a'.repeat(64)}"`;
const nextEtag = `"${'b'.repeat(64)}"`;
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('WorkspaceSettingsApi', () => {
  let api: WorkspaceSettingsApi;
  let http: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor-one' });
  beforeEach(() => {
    me.set({ id: 'actor-one' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { me } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    cookie = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(WorkspaceSettingsApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('unwraps the settings envelope', async () => {
    const pending = api.getSettings();
    const request = http.expectOne(path);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: settings });
    await expect(pending).resolves.toEqual(settings);
  });
  it('malformed settings body → COMMON.GENERIC.INTERNAL_ERROR', async () => {
    for (const body of [{}, { success: true, data: {} }, { success: true, data: null }]) {
      const pending = api.getSettings();
      http.expectOne(path).flush(body);
      await expect(pending).rejects.toMatchObject({
        status: 502,
        code: 'COMMON.GENERIC.INTERNAL_ERROR',
      });
    }
  });
  it('PUT body has no defaultCurrencyCode', async () => {
    const body: UpdateWorkspaceSettingsRequest = { timezone: 'Asia/Riyadh', allowSupport: false };
    const pending = api.updateSettings(body, newIdempotencyKey());
    const request = http.expectOne(path);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    expect(request.request.body).not.toHaveProperty('defaultCurrencyCode');
    request.flush({ success: true, data: { ...settings, ...body } });
    await pending;
  });
  it('settings PUT key reuse on retry', async () => {
    const key = newIdempotencyKey();
    const body = { allowSupport: false };
    for (const attempt of [0, 1]) {
      const pending = api.updateSettings(body, key);
      const request = http.expectOne(path);
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.body).toEqual(body);
      if (attempt === 0) {
        request.error(new ProgressEvent('offline'));
        await expect(pending).rejects.toMatchObject({ status: 0 });
      } else {
        request.flush({ success: true, data: settings });
        await pending;
      }
    }
  });
  it('settings PUT without CSRF sends nothing', async () => {
    cookie = '';
    await expect(
      api.updateSettings({ allowSupport: false }, newIdempotencyKey()),
    ).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });
  it('session policy read returns data and ETag', async () => {
    const pending = api.getSessionPolicy();
    http
      .expectOne(`${path}/session-policy`)
      .flush({ success: true, data: policy }, { headers: { ETag: etag } });
    await expect(pending).resolves.toEqual({ data: policy, etag });
  });
  it('session PUT sends the whole override and If-Match', async () => {
    const body = { override: { ...lifetimes, accessTokenTtlSeconds: 1200 } };
    const pending = api.updateSessionPolicy(body, newIdempotencyKey(), etag);
    const request = http.expectOne(`${path}/session-policy`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('If-Match')).toBe(etag);
    request.flush(
      { success: true, data: { ...policy, ...body, effective: body.override } },
      { headers: { ETag: nextEtag } },
    );
    await expect(pending).resolves.toMatchObject({ etag: nextEtag });
  });
  it('session PUT key reuse on retry', async () => {
    const key = newIdempotencyKey();
    const body = { override: lifetimes };
    for (const attempt of [0, 1]) {
      const pending = api.updateSessionPolicy(body, key, etag);
      const request = http.expectOne(`${path}/session-policy`);
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.get('If-Match')).toBe(etag);
      expect(request.request.body).toEqual(body);
      if (!attempt) {
        request.flush({ errorCode: 'GW.IDEM.IN_FLIGHT' }, { status: 409, statusText: 'Conflict' });
        await expect(pending).rejects.toMatchObject({ status: 409 });
      } else {
        request.flush({ success: true, data: policy }, { headers: { ETag: nextEtag } });
        await pending;
      }
    }
  });
  it('set-default sends no body and accepts 201', async () => {
    const key = newIdempotencyKey();
    const pending = api.setDefaultCurrency('usd', key);
    const request = http.expectOne('/api/tenant/core/v1/currencies/usd/set-default');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    request.flush(
      { success: true, data: { id: 'usd', code: 'USD', isDefault: true } },
      { status: 201, statusText: 'Created' },
    );
    await expect(pending).resolves.toBeUndefined();
  });
  it('reads do not retry on their own (retry false)', async () => {
    for (const status of [401, 503]) {
      const pending = api.getSettings();
      http
        .expectOne(path)
        .flush(
          { errorCode: status === 401 ? 'UNAUTHORIZED' : 'TENANT_NOT_READY' },
          { status, statusText: 'Failure' },
        );
      await expect(pending).rejects.toMatchObject({ status });
      http.expectNone(path);
    }
  });
  it('reads active currencies with the contracted page query', async () => {
    const pending = api.listActiveCurrencies();
    const request = http.expectOne(
      '/api/tenant/core/v1/currencies?status=ACTIVE&limit=100&sortBy=code&sortDir=ASC',
    );
    request.flush({
      success: true,
      data: [{ id: 'egp', code: 'EGP' }],
      meta: {
        page: 1,
        limit: 100,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    await expect(pending).resolves.toEqual([{ id: 'egp', code: 'EGP' }]);
  });
  it('separates in-flight reads by actor and invalidates settings after a write', async () => {
    const first = api.getSettings();
    me.set({ id: 'actor-two' });
    const second = api.getSettings();
    const reads = http.match(path);
    expect(reads).toHaveLength(2);
    reads[0].flush({ success: true, data: settings });
    reads[1].flush({ success: true, data: { ...settings, timezone: 'UTC' } });
    await expect(first).resolves.toMatchObject({ timezone: 'Africa/Cairo' });
    await expect(second).resolves.toMatchObject({ timezone: 'UTC' });
    const write = api.updateSettings({ timezone: 'Asia/Riyadh' }, newIdempotencyKey());
    http.expectOne(path).flush({ success: true, data: { ...settings, timezone: 'Asia/Riyadh' } });
    await write;
    const refreshed = api.getSettings();
    http.expectOne(path).flush({ success: true, data: { ...settings, timezone: 'Asia/Riyadh' } });
    await expect(refreshed).resolves.toMatchObject({ timezone: 'Asia/Riyadh' });
  });
  it('lists time zones from Intl with a UTC option', async () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue(['Africa/Cairo']);
    await expect(api.listTimezones()).resolves.toMatchObject([
      { value: 'UTC' },
      { value: 'Africa/Cairo' },
    ]);
  });
});
