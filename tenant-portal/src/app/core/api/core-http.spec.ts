import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, isRetryableWriteError } from './api-errors';
import { CoreHttp } from './core-http';
import { newIdempotencyKey } from './idempotency';

const path = '/api/tenant/core/v1/templates';
const meta = { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('CoreHttp', () => {
  let api: CoreHttp;
  let http: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(CoreHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('read unwraps the Core envelope', async () => {
    for (const data of [{ id: 'one' }, null, false, 0, '']) {
      const pending = api.read(path);
      const request = http.expectOne(path);
      expect(request.request.method).toBe('GET');
      expect(request.request.withCredentials).toBe(true);
      request.flush({ success: true, data });
      await expect(pending).resolves.toEqual(data);
    }
  });

  it('read rejects a malformed envelope', async () => {
    for (const body of [null, {}, { data: [] }, { success: false, data: [] }, { success: true }]) {
      const pending = api.read(path);
      http.expectOne(path).flush(body);
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('read accepts bare bodies only when requested', async () => {
    for (const body of [[], { id: 'one' }, { success: true, data: 'kept' }, null]) {
      const pending = api.read(path, { page: 2 }, { bare: true });
      http.expectOne(`${path}?page=2`).flush(body);
      await expect(pending).resolves.toEqual(body);
    }
  });

  it('write accepts bare success bodies without changing the envelope default', async () => {
    for (const status of [200, 201, 202, 204]) {
      const body = status === 201 || status === 204 ? null : { accepted: true };
      const pending = api.write('POST', path, {}, { bare: true });
      http.expectOne(path).flush(body, { status, statusText: 'Success' });
      await expect(pending).resolves.toMatchObject({ status, data: status === 204 ? undefined : body });
    }
    const pending = api.write('POST', path, {});
    http.expectOne(path).flush({ id: 'bare' });
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it('noBody omits the body without omitting write headers', async () => {
    const key = newIdempotencyKey();
    const pending = api.write('PUT', path, { ignored: true }, { noBody: true, bare: true, key });
    const request = http.expectOne(path);
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
  });

  it('read builds the query string', async () => {
    const pending = api.read(path, { missing: undefined, nil: null, empty: '', ids: ['a', 'b', 2], zero: 0, enabled: false });
    const request = http.expectOne((req) => req.url === path);
    expect(request.request.params.keys()).toEqual(['ids', 'zero', 'enabled']);
    expect(request.request.params.getAll('ids')).toEqual(['a', 'b', '2']);
    expect(request.request.params.get('zero')).toBe('0');
    expect(request.request.params.get('enabled')).toBe('false');
    request.flush({ success: true, data: [] });
    await pending;
  });

  it('readPage returns data and meta', async () => {
    const pending = api.readPage<{ id: string }>(path, { page: 1 });
    const request = http.expectOne(`${path}?page=1`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: [{ id: 'one' }], meta, correlationId: 'corr' });
    await expect(pending).resolves.toEqual({ data: [{ id: 'one' }], meta });
  });

  it('readPage rejects a page without meta', async () => {
    for (const invalid of [undefined, null, {}, { ...meta, page: '1' }, { ...meta, total: null }, { ...meta, hasNext: 1 }]) {
      const pending = api.readPage(path);
      http.expectOne(path).flush({ success: true, data: [], meta: invalid });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
    const pending = api.readPage(path);
    http.expectOne(path).flush({ success: true, data: {}, meta });
    await expect(pending).rejects.toMatchObject({ status: 502 });
  });

  it('read returns cursor pages as sent', async () => {
    for (const data of [
      { items: [{ id: 'one' }], nextCursor: 'next' },
      { items: [], pageInfo: { limit: 10, hasNextPage: false, nextCursor: null } },
    ]) {
      const pending = api.read(path);
      http.expectOne(path).flush({ success: true, data });
      await expect(pending).resolves.toEqual(data);
    }
  });

  it('readWithEtag prefers the ETag header', async () => {
    const data = { id: 'one', etag: '"body"' };
    const pending = api.readWithEtag(path, { version: 3 });
    const request = http.expectOne(`${path}?version=3`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data }, { headers: { ETag: '"3"' } });
    await expect(pending).resolves.toEqual({ data, etag: '"3"' });
  });

  it('readWithEtag falls back to the body etag', async () => {
    const data = { id: 'one', etag: '"body"' };
    const pending = api.readWithEtag(path);
    http.expectOne(path).flush({ success: true, data });
    await expect(pending).resolves.toEqual({ data, etag: '"body"' });
  });

  it('readWithEtag returns null without an etag', async () => {
    for (const data of [{ id: 'one' }, { etag: 3 }, null]) {
      const pending = api.readWithEtag(path);
      http.expectOne(path).flush({ success: true, data });
      await expect(pending).resolves.toEqual({ data, etag: null });
    }
  });

  it('readBlob returns the bytes', async () => {
    const blob = new Blob(['image bytes'], { type: 'image/png' });
    const pending = api.readBlob(path, { size: 'thumb' });
    const request = http.expectOne(`${path}?size=thumb`);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.withCredentials).toBe(true);
    request.flush(blob);
    await expect(pending).resolves.toBe(blob);
  });

  it('readBlob parses a JSON error body', async () => {
    const pending = api.readBlob(path);
    http.expectOne(path).flush(new Blob([JSON.stringify({ errorCode: 'CORE.ASSET.NOT_FOUND', correlationId: 'corr-blob' })],
      { type: 'application/json' }), { status: 404, statusText: 'Not Found' });
    await expect(pending).rejects.toMatchObject({ status: 404, code: 'CORE.ASSET.NOT_FOUND', correlationId: 'corr-blob' });
  });

  it('write accepts 200 201 202 204', async () => {
    for (const status of [200, 201, 202, 204]) {
      const pending = api.write('POST', path, { name: 'One' });
      http.expectOne(path).flush(status === 204 ? null : { success: true, data: { id: 'one' } }, {
        status, statusText: 'Success', headers: status === 204 ? {} : { ETag: '"1"', Location: `${path}/one` },
      });
      await expect(pending).resolves.toEqual({ status, data: status === 204 ? undefined : { id: 'one' },
        etag: status === 204 ? null : '"1"', location: status === 204 ? null : `${path}/one` });
    }
  });

  it('write forwards the idempotency key only when given', async () => {
    for (const key of [newIdempotencyKey(), undefined]) {
      if (key) expect(key).toMatch(uuidV7);
      const pending = api.write('POST', path, {}, { key });
      const request = http.expectOne(path);
      expect(request.request.headers.get('x-idempotency-key')).toBe(key ?? null);
      expect(request.request.headers.has('If-Match')).toBe(false);
      request.flush({ success: true, data: 'saved' });
      await pending;
    }
  });

  it('write forwards If-Match verbatim', async () => {
    for (const ifMatch of ['"3"', '"asset:asset-id:2"', `"draft-schema:${'a'.repeat(64)}:4"`]) {
      const pending = api.write('PUT', path, {}, { ifMatch });
      const request = http.expectOne(path);
      expect(request.request.headers.get('If-Match')).toBe(ifMatch);
      request.flush({ success: true, data: 'saved' });
      await pending;
    }
  });

  it('write sends query parameters', async () => {
    const pending = api.write('DELETE', path, undefined, { query: { revision: 3, ids: [1, 2], empty: '' } });
    const request = http.expectOne(`${path}?revision=3&ids=1&ids=2`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
  });

  it('write sends the CSRF token', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const pending = api.write(method, path, {});
      const request = http.expectOne(path);
      expect(request.request.method).toBe(method);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.withCredentials).toBe(true);
      request.flush(null, { status: 204, statusText: 'No Content' });
      await pending;
    }
  });

  it('write without a CSRF cookie sends nothing', async () => {
    cookie = '';
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      await expect(api.write(method, path)).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    }
    await expect(api.writeMultipart(path, new FormData(), { key: newIdempotencyKey() }))
      .rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('write maps a service error', async () => {
    const pending = api.write('PATCH', path, {});
    http.expectOne(path).flush({ errorCode: 'CORE.TEMPLATE.VERSION_CONFLICT', details: { version: ['4'] }, correlationId: 'corr-409' },
      { status: 409, statusText: 'Conflict' });
    await expect(pending).rejects.toMatchObject({ status: 409, code: 'CORE.TEMPLATE.VERSION_CONFLICT',
      details: { version: ['4'] }, correlationId: 'corr-409' });
  });

  it('write maps a gateway error', async () => {
    const pending = api.write('POST', path, {});
    http.expectOne(path).flush({ code: 'GW.IDEM.IN_FLIGHT', errors: { key: ['pending'] }, correlationId: 'corr-gw' },
      { status: 409, statusText: 'Conflict' });
    await expect(pending).rejects.toMatchObject({ status: 409, code: 'GW.IDEM.IN_FLIGHT',
      details: { key: ['pending'] }, correlationId: 'corr-gw' });
  });

  it('maps Retry-After into details', async () => {
    const pending = api.write('POST', path, {});
    http.expectOne(path).flush({ code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'corr-rate' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '17' } });
    await expect(pending).rejects.toMatchObject({ status: 429, code: 'GW.RATE.LIMIT_EXCEEDED',
      details: { retryAfterSeconds: ['17'] }, correlationId: 'corr-rate' });
  });

  it('maps a lost connection', async () => {
    const pending = api.write('POST', path, {});
    http.expectOne(path).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('writeMultipart sends the form with key and CSRF', async () => {
    const form = new FormData();
    form.append('file', new Blob(['content']), 'asset.txt');
    const key = newIdempotencyKey();
    expect(key).toMatch(uuidV7);
    const pending = api.writeMultipart(path, form, { key });
    const request = http.expectOne(path);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(form);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: { id: 'asset' } }, { status: 201, statusText: 'Created', headers: { Location: '/assets/asset' } });
    await expect(pending).resolves.toEqual({ status: 201, data: { id: 'asset' }, etag: null, location: '/assets/asset' });
  });

  it('preserves caller keys and bodies on retryable failures and accepts a new action', async () => {
    for (const [status, code] of [[0, 'NETWORK_ERROR'], [503, 'SERVER_ERROR'], [409, 'GW.IDEM.IN_FLIGHT'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'], [409, 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT']] as const) {
      const key = newIdempotencyKey();
      const body = { name: 'Original' };
      expect(key).toMatch(uuidV7);
      const pending = api.write('POST', path, body, { key });
      const first = http.expectOne(path);
      expect(first.request.body).toEqual(body);
      expect(first.request.headers.get('x-idempotency-key')).toBe(key);
      if (status === 0) first.error(new ProgressEvent('error'));
      else first.flush({ code }, { status, statusText: 'Failed' });
      const error = await pending.catch((failure: unknown) => failure);
      expect(isRetryableWriteError(error)).toBe(true);
      http.expectNone(path);
      const retry = api.write('POST', path, body, { key });
      const second = http.expectOne(path);
      expect(second.request.headers.get('x-idempotency-key')).toBe(key);
      expect(second.request.body).toEqual(body);
      second.flush({ success: true, data: 'saved' });
      await retry;
      const newKey = newIdempotencyKey();
      expect(newKey).toMatch(uuidV7);
      expect(newKey).not.toBe(key);
      const changed = api.write('POST', path, { name: 'Changed' }, { key: newKey });
      const third = http.expectOne(path);
      expect(third.request.headers.get('x-idempotency-key')).toBe(newKey);
      expect(third.request.body).toEqual({ name: 'Changed' });
      third.flush({ success: true, data: 'saved' });
      await changed;
    }
  });

  it('surfaces a 401 write without replaying or changing caller data', async () => {
    const body = { name: 'Unsaved' };
    const key = newIdempotencyKey();
    const pending = api.write('PATCH', path, body, { key });
    http.expectOne(path).flush({ code: 'GW.AUTH.SESSION_REVOKED' }, { status: 401, statusText: 'Unauthorized' });
    await expect(pending).rejects.toMatchObject({ status: 401, code: 'GW.AUTH.SESSION_REVOKED' });
    expect(body).toEqual({ name: 'Unsaved' });
    http.expectNone(path);
  });

  it('parses text errors and falls back for non-JSON blob errors', async () => {
    const pending = api.read(path);
    http.expectOne(path).flush(JSON.stringify({ code: 'CORE.TEXT_ERROR' }), { status: 400, statusText: 'Bad Request' });
    await expect(pending).rejects.toMatchObject({ code: 'CORE.TEXT_ERROR' });
    const blobPending = api.readBlob(path);
    http.expectOne(path).flush(new Blob(['not JSON']), { status: 500, statusText: 'Server Error' });
    await expect(blobPending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it('rejects malformed write envelopes', async () => {
    const pending = api.write('POST', path, {});
    http.expectOne(path).flush({ success: true }, { status: 202, statusText: 'Accepted' });
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it('rethrows client errors unchanged', async () => {
    const failure = new Error('client failure');
    const client = TestBed.inject(HttpClient);
    vi.spyOn(client, 'get').mockReturnValue(throwError(() => failure));
    await expect(api.read(path)).rejects.toBe(failure);
    await expect(api.readBlob(path)).rejects.toBe(failure);
    vi.spyOn(client, 'request').mockReturnValue(throwError(() => failure));
    await expect(api.write('POST', path)).rejects.toBe(failure);
    expect(failure).not.toBeInstanceOf(ApiError);
  });
});
