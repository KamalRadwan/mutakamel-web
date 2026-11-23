import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { correlationIdOf } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { AuthSession } from '../../../../core/auth/auth-session';
import { PhoneServersApi } from './phone-servers.api';

const base = '/api/tenant/webphone/v1';
const body = { name: 'Cairo', sipDomain: 'pbx.example.com', websocketUrl: 'wss://pbx.example.com/ws' };
const id = newIdempotencyKey();

describe('PhoneServersApi', () => {
  let api: PhoneServersApi;
  let http: HttpTestingController;
  let csrf: string;
  const me = signal({ id: 'user-1' });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthSession, useValue: { me } },
    ] });
    api = TestBed.inject(PhoneServersApi);
    http = TestBed.inject(HttpTestingController);
    csrf = 'csrf-token';
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockImplementation(() => csrf ? `mutakamel-http-tenant-csrf=${csrf}` : '');
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('webphone reads unwrap the Core envelope', async () => {
    for (const [path, read, data] of [
      ['/config', () => api.getPhoneConfig(), { tenantId: 'tenant-1', enabled: true }],
      ['/seats', () => api.getPhoneSeats(), { allowed: 10, occupied: 2, available: 8 }],
      ['/servers', () => api.listPhoneServers(), []],
    ] as const) {
      const pending = read();
      const req = http.expectOne(base + path);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      req.flush({ success: true, data, correlationId: 'read-id', timestamp: '' });
      expect(await pending).toEqual(data);
    }
  });

  it('create key reuse on retry', async () => {
    const key = newIdempotencyKey();
    let pending = api.createPhoneServer(body, key);
    const failure = expect(pending).rejects.toMatchObject({ status: 503 });
    const first = http.expectOne(base + '/servers');
    expect(first.request.method).toBe('POST');
    expect(first.request.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(first.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    first.flush({ code: 'GW.UPSTREAM.UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await failure;
    pending = api.createPhoneServer(body, key);
    const retry = http.expectOne(base + '/servers');
    expect(retry.request.body).toEqual(first.request.body);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    retry.flush({ success: true, data: { ...body, id } }, { status: 201, statusText: 'Created' });
    expect(await pending).toMatchObject({ id });
  });

  it('create without CSRF sends nothing', async () => {
    csrf = '';
    await expect(api.createPhoneServer(body, newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(base + '/servers');
  });

  it('reorder sends every id once', async () => {
    const ids = [newIdempotencyKey(), id, newIdempotencyKey()];
    const pending = api.reorderPhoneServers(ids, newIdempotencyKey());
    const req = http.expectOne(base + '/servers/order');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ids });
    expect(new Set(req.request.body.ids).size).toBe(ids.length);
    const data = ids.map((id, index) => ({ id, priority: index + 1 }));
    req.flush({ success: true, data });
    expect(await pending).toEqual(data);
  });

  it('delete returns void on 204', async () => {
    const pending = api.deletePhoneServer(id, newIdempotencyKey());
    const req = http.expectOne(`${base}/servers/${id}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBeUndefined();
  });

  it('stale ICE delete is success', async () => {
    const iceId = newIdempotencyKey();
    const pending = api.deleteIceServer(id, iceId, newIdempotencyKey());
    const req = http.expectOne(`${base}/servers/${id}/ice-servers/${iceId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBeUndefined();
  });

  it('webphone error body without errorCode', async () => {
    for (const correlationId of [undefined, 'request-1']) {
      const pending = api.updatePhoneServer(id, { enabled: true }, newIdempotencyKey());
      const caught = pending.catch((error: unknown) => error);
      http.expectOne(`${base}/servers/${id}`).flush({ code: 'WEBPHONE_SCOPE_MISMATCH', message: 'Denied', correlationId }, { status: 403, statusText: 'Forbidden' });
      const error = await caught;
      expect(error).toMatchObject({ code: 'WEBPHONE_SCOPE_MISMATCH', status: 403 });
      expect(correlationIdOf(error)).toBe(correlationId ?? null);
    }
  });

  it('ICE POST and PATCH use the contracted nested routes and envelopes', async () => {
    const ice = { kind: 'STUN' as const, urls: ['stun:pbx.example.com'], username: null, credential: null, sortOrder: 0 };
    let pending = api.createIceServer(id, ice, newIdempotencyKey());
    const req = http.expectOne(`${base}/servers/${id}/ice-servers`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(ice);
    req.flush({ success: true, data: { ...ice, id: 'ice-1' } }, { status: 201, statusText: 'Created' });
    expect(await pending).toMatchObject({ id: 'ice-1' });
    pending = api.updateIceServer(id, 'ice-1', { credential: null }, newIdempotencyKey());
    const patch = http.expectOne(`${base}/servers/${id}/ice-servers/ice-1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ credential: null });
    patch.flush({ success: true, data: { id: 'ice-1', credentialConfigured: false } });
    expect(await pending).toMatchObject({ credentialConfigured: false });
  });

  it('successful writes invalidate the phone query family', async () => {
    const queries = api['queries'];
    const invalidate = vi.spyOn(queries, 'invalidateQueries');
    const pending = api.updatePhoneServer(id, { enabled: true }, newIdempotencyKey());
    http.expectOne(`${base}/servers/${id}`).flush({ success: true, data: { id } });
    await pending;
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ws-phone'] });
  });
});
