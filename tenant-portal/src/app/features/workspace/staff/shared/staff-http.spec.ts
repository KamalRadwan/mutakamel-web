import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { StaffHttp } from './staff-http';

const path = '/api/tenant/core/v1/organization/companies';
const meta = { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('StaffHttp', () => {
  let api: StaffHttp;
  let http: HttpTestingController;
  let cookie: string;
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: router },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(StaffHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('unwraps the Core envelope', async () => {
    for (const envelope of [{ success: true, data: { id: 'one' } }, { success: true, data: [], meta }]) {
      const pending = api.read(path, { page: 1, empty: '', nil: null, missing: undefined, enabled: false, zero: 0 });
      const req = http.expectOne((r) => r.url === path && r.method === 'GET');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.params.keys().sort()).toEqual(['enabled', 'page', 'zero']);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('enabled')).toBe('false');
      expect(req.request.params.get('zero')).toBe('0');
      req.flush(envelope);
      const { success, ...expected } = envelope;
      await expect(pending).resolves.toEqual(expected);
    }
  });

  it('rejects a malformed success body', async () => {
    for (const body of [null, {}, { success: false, data: [] }, { success: true }]) {
      for (const method of ['read', 'write'] as const) {
        const pending = method === 'read' ? api.read(path) : api.write('PATCH', path, {});
        http.expectOne(path).flush(body, { status: 200, statusText: 'OK' });
        await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
      }
    }
  });

  it('maps a lost connection', async () => {
    for (const method of ['read', 'write'] as const) {
      const pending = method === 'read' ? api.read(path) : api.write('POST', path, {});
      const req = http.expectOne(path);
      req.error(new ProgressEvent('error'));
      await expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    }
  });

  it('parses service and gateway errors', async () => {
    for (const method of ['read', 'write'] as const) {
      for (const gateway of [false, true]) {
        const details = { field: ['invalid'] };
        const code = gateway ? 'GW.AUTH.FORBIDDEN' : 'CORE_VALIDATION_FAILED';
        const pending = method === 'read' ? api.read(path) : api.write('PATCH', path, {});
        http.expectOne(path).flush(gateway
          ? { type: 'about:blank', title: 'Forbidden', status: 403, code, errors: details, correlationId: 'trace' }
          : { success: false, errorCode: code, details, correlationId: 'trace' },
        { status: gateway ? 403 : 400, statusText: 'Rejected' });
        await expect(pending).rejects.toBeInstanceOf(ApiError);
        await expect(pending).rejects.toMatchObject({ code, details, correlationId: 'trace' });
      }
    }
  });

  it('refuses a write without CSRF', async () => {
    cookie = '';
    await expect(api.write('POST', path, {})).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(() => true);
  });

  it('sends CSRF and key headers', async () => {
    for (const key of [newIdempotencyKey(), undefined]) {
      const pending = api.write('PUT', path, { name: 'Company' }, { key });
      const req = http.expectOne(path);
      expect(req.request.method).toBe('PUT');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(req.request.headers.get('x-idempotency-key')).toBe(key ?? null);
      if (key) expect(key).toMatch(uuidV7);
      req.flush({ success: true, data: {} });
      await pending;
    }
  });

  it('accepts any 2xx', async () => {
    for (const status of [200, 201, 202, 204]) {
      const pending = api.write('DELETE', path);
      http.expectOne(path).flush(status === 204 ? null : { success: true, data: 'saved' }, { status, statusText: 'OK' });
      await expect(pending).resolves.toBe(status === 204 ? undefined : 'saved');
    }
  });

  it('a confirmed cascade is a new request with a new key', async () => {
    const details = { userIds: ['u'], userNames: ['User'], addonKeys: ['phone'], addonNames: ['Phone'] };
    const key = newIdempotencyKey();
    const pending = api.write('DELETE', path, undefined, { key });
    const first = http.expectOne(path);
    expect(first.request.headers.get('x-idempotency-key')).toBe(key);
    expect(first.request.params.has('confirmAddonCascade')).toBe(false);
    first.flush({ success: false, errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details }, { status: 409, statusText: 'Conflict' });
    await expect(pending).rejects.toMatchObject({ code: 'SEAT_ADDON_CASCADE_REQUIRED', details });
    const newKey = newIdempotencyKey();
    expect(newKey).not.toBe(key);
    const confirmed = api.write<void>('DELETE', path, undefined, { key: newKey, confirmAddonCascade: true });
    const second = http.expectOne(`${path}?confirmAddonCascade=true`);
    expect(second.request.headers.get('x-idempotency-key')).toBe(newKey);
    second.flush(null, { status: 204, statusText: 'No Content' });
    await expect(confirmed).resolves.toBeUndefined();
  });

  it('a 401 write is surfaced, never retried or navigated', async () => {
    const key = newIdempotencyKey();
    const body = { name: 'Same change' };
    for (let attempt = 0; attempt < 2; attempt++) {
      const pending = api.write('PATCH', path, body, { key });
      const requests = http.match(path);
      expect(requests).toHaveLength(1);
      expect(requests[0].request.body).toEqual(body);
      expect(requests[0].request.headers.get('x-idempotency-key')).toBe(key);
      requests[0].flush({ type: 'about:blank', title: 'Revoked', status: 401, code: 'GW.AUTH.SESSION_REVOKED' },
        { status: 401, statusText: 'Unauthorized' });
      await expect(pending).rejects.toMatchObject({ status: 401, code: 'GW.AUTH.SESSION_REVOKED' });
      http.expectNone(path);
    }
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'GW.IDEM.IN_FLIGHT'], [422, 'GW.IDEM.MISMATCH'], [400, 'GW.IDEM.MISSING'], [400, 'GW.IDEM.BAD_VALUE'],
  ])('passes the gateway idempotency codes through: %s %s', async (status, code) => {
    const pending = api.write('POST', path, {});
    http.expectOne(path).flush({ type: 'about:blank', title: 'Rejected', status, code }, { status, statusText: 'Rejected' });
    await expect(pending).rejects.toMatchObject({ status, code });
  });

  it('rethrows other errors unchanged', async () => {
    const error = new Error('client failure');
    const client = TestBed.inject(HttpClient);
    vi.spyOn(client, 'get').mockReturnValue(throwError(() => error));
    await expect(api.read(path)).rejects.toBe(error);
    vi.spyOn(client, 'request').mockReturnValue(throwError(() => error));
    await expect(api.write('POST', path)).rejects.toBe(error);
  });
});
