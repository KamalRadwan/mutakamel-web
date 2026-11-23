import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { BrandingApi } from './branding.api';
import { EMPTY_BRANDING } from './branding.model';

const path = '/api/tenant/core/v1/branding';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('BrandingApi', () => {
  let api: BrandingApi;
  let http: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor' });

  beforeEach(() => {
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
    api = TestBed.inject(BrandingApi);
    http = TestBed.inject(HttpTestingController);
    me.set({ id: 'actor' });
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('get unwraps data', async () => {
    const pending = api.getBranding();
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      success: true,
      data: { ...EMPTY_BRANDING, id: 'brand', appName: 'Delta', primaryColor: 'FF0000' },
    });
    await expect(pending).resolves.toMatchObject({
      id: 'brand',
      appName: 'Delta',
      primaryColor: '#ff0000',
    });
  });

  it('empty branding becomes defaults', async () => {
    const pending = api.getBranding();
    http.expectOne(path).flush({ success: true, data: {} });
    await expect(pending).resolves.toEqual(EMPTY_BRANDING);
  });

  it('malformed body → COMMON.GENERIC.INTERNAL_ERROR', async () => {
    for (const body of [
      {},
      { success: false, data: {} },
      { success: true, data: null },
      { success: true, data: [] },
      { success: true, data: { appName: 42 } },
      { success: true, data: { hasLogo: 'true' } },
    ]) {
      const pending = api.getBranding();
      http.expectOne(path).flush(body);
      await expect(pending).rejects.toMatchObject({
        status: 502,
        code: 'COMMON.GENERIC.INTERNAL_ERROR',
      });
    }
  });

  it('PUT key reuse on retry', async () => {
    const key = newIdempotencyKey();
    const body = { appName: 'Delta' };
    const pending = api.updateBranding(body, key);
    const first = http.expectOne(path);
    expect(first.request.method).toBe('PUT');
    expect(first.request.body).toEqual(body);
    expect(first.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
    expect(first.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(first.request.withCredentials).toBe(true);
    first.flush({ code: 'GW.UPSTREAM.UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toMatchObject({ code: 'GW.UPSTREAM.UNAVAILABLE' });
    const retry = api.updateBranding(body, key);
    const second = http.expectOne(path);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    second.flush({ success: true, data: { ...EMPTY_BRANDING, ...body } });
    await expect(retry).resolves.toMatchObject(body);
  });

  it('PUT without CSRF sends nothing', async () => {
    cookie = '';
    await expect(
      api.updateBranding({ appName: 'Delta' }, newIdempotencyKey()),
    ).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('emptied field sends null', async () => {
    const body = { appName: null, tabTitle: null, primaryColor: null, secondaryColor: null };
    const pending = api.updateBranding(body, newIdempotencyKey());
    const request = http.expectOne(path);
    expect(request.request.body).toEqual(body);
    request.flush({ success: true, data: EMPTY_BRANDING });
    await pending;
  });

  it('logo upload sends multipart with a key', async () => {
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const key = newIdempotencyKey();
    const pending = api.uploadBrandingLogo(file, key);
    const request = http.expectOne(`${path}/logo`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('file')).toMatchObject({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({
      success: true,
      data: { ...EMPTY_BRANDING, hasLogo: true, logoUrl: '/logo?v=2' },
    });
    await expect(pending).resolves.toMatchObject({ hasLogo: true, logoUrl: '/logo?v=2' });
  });

  it('icon upload uses its own route', async () => {
    const file = new File(['icon'], 'icon.webp', { type: 'image/webp' });
    const pending = api.uploadBrandingIcon(file, newIdempotencyKey());
    const request = http.expectOne(`${path}/icon`);
    expect(request.request.body.get('file')).toMatchObject({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    request.flush({ success: true, data: EMPTY_BRANDING });
    await pending;
  });

  for (const kind of ['logo', 'icon'] as const) {
    it(`remove ${kind} sends DELETE with a key`, async () => {
      const key = newIdempotencyKey();
      const pending = kind === 'logo' ? api.removeBrandingLogo(key) : api.removeBrandingIcon(key);
      const request = http.expectOne(`${path}/${kind}`);
      expect(request.request.method).toBe('DELETE');
      expect(request.request.body).toBeNull();
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(key).toMatch(uuidV7);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await expect(pending).resolves.toBeUndefined();
    });
  }

  it('429 preserves Retry-After for the core mapper', async () => {
    const pending = api.updateBranding({ appName: 'Delta' }, newIdempotencyKey());
    http
      .expectOne(path)
      .flush(
        { code: 'GW.RATE.LIMIT_EXCEEDED' },
        { status: 429, statusText: 'Rate limited', headers: { 'Retry-After': '17' } },
      );
    await expect(pending).rejects.toMatchObject({ details: { retryAfterSeconds: ['17'] } });
  });

  it('reads again after a write and isolates the user query key', async () => {
    const first = api.getBranding();
    http.expectOne(path).flush({ success: true, data: {} });
    await first;
    const write = api.updateBranding({ appName: 'Delta' }, newIdempotencyKey());
    http.expectOne(path).flush({ success: true, data: { appName: 'Delta' } });
    await write;
    const next = api.getBranding();
    http.expectOne(path).flush({ success: true, data: { appName: 'Delta' } });
    expect((await next).appName).toBe('Delta');
    const previousUser = api.getBranding();
    me.set({ id: 'other' });
    const otherUser = api.getBranding();
    const requests = http.match(path);
    expect(requests).toHaveLength(2);
    requests[0].flush({ success: true, data: { appName: 'Delta' } });
    requests[1].flush({ success: true, data: {} });
    await previousUser;
    expect((await otherUser).appName).toBeNull();
  });
});
