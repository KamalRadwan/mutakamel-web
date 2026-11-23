import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryClient, onlineManager } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { CrmHttp, bindCrmHttp, bindCrmHttpForTest, crmHttp, crmQueries } from './crm-http';
import { CrmHttpStub } from './testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from './testing/crm-settings-fixtures';

const base = '/api/tenant/crm/v1';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('CrmHttp', () => {
  let api: CrmHttp;
  let http: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(CrmHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('read returns the bare body', async () => {
    for (const body of [[{ id: 'one' }], { id: 'one' }]) {
      const pending = api.read('/tags', { ids: ['a', 'b'], active: false, empty: '' });
      const request = http.expectOne(`${base}/tags?ids=a&ids=b&active=false`);
      expect(request.request.withCredentials).toBe(true);
      request.flush(body);
      await expect(pending).resolves.toEqual(body);
    }
  });

  it('read never unwraps', async () => {
    const body = { success: true, data: [{ id: 'one' }] };
    const pending = api.read('/tags');
    http.expectOne(`${base}/tags`).flush(body);
    await expect(pending).resolves.toEqual(body);
  });

  it('errors become ApiError', async () => {
    const pending = api.read('/tags');
    const rejection = expect(pending).rejects.toMatchObject({
      status: 400, code: 'CRM_VALIDATION_FAILED', details: { name: ['Name is required'] }, correlationId: 'corr-crm',
    });
    http.expectOne(`${base}/tags`).flush({ success: false, statusCode: 400, errorCode: 'CRM_VALIDATION_FAILED',
      details: { name: ['Name is required'] }, correlationId: 'corr-crm' }, { status: 400, statusText: 'Bad Request' });
    await rejection;
    await expect(pending).rejects.toBeInstanceOf(ApiError);
  });

  it('network failure is NETWORK_ERROR', async () => {
    const pending = api.read('/tags');
    http.expectOne(`${base}/tags`).error(new ProgressEvent('error'));
    await expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('every write sends csrf and the key', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const key = newIdempotencyKey();
      const pending = api.write(method, '/tags', { name: 'One' }, { key });
      const request = http.expectOne(`${base}/tags`);
      expect(request.request.method).toBe(method);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(key).toMatch(uuidV7);
      request.flush(null, { status: 204, statusText: 'No Content' });
      await pending;
    }
  });

  it('missing csrf sends nothing', async () => {
    cookie = '';
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      await expect(api.write(method, '/tags', {}, { key: newIdempotencyKey() }))
        .rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    }
    await expect(api.writeMultipart('/acquisition-sources/one/icon', new FormData(), { key: newIdempotencyKey() }))
      .rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(() => true);
  });

  it('ifMatch is sent verbatim', async () => {
    const pending = api.write('PATCH', '/targets/one', {}, { key: newIdempotencyKey(), ifMatch: 'W/"revision:3"' });
    const request = http.expectOne(`${base}/targets/one`);
    expect(request.request.headers.get('If-Match')).toBe('W/"revision:3"');
    request.flush({ revision: 4 }, { headers: { ETag: '"4"', Location: '/targets/one' } });
    await expect(pending).resolves.toEqual({ status: 200, data: { revision: 4 }, etag: '"4"', location: '/targets/one' });
  });

  it('handles 201 empty, 202 and 204', async () => {
    for (const [status, body, data] of [[201, null, null], [202, { job: 'one' }, { job: 'one' }], [204, null, undefined]] as const) {
      const pending = api.write('POST', '/custom-fields/values', undefined, { key: newIdempotencyKey() });
      const request = http.expectOne(`${base}/custom-fields/values`);
      expect(request.request.body).toBeNull();
      request.flush(body, { status, statusText: 'Success' });
      await expect(pending).resolves.toEqual({ status, data, etag: null, location: null });
    }
  });

  it('never sends scope headers by default', async () => {
    for (const path of ['/targets/working-calendars/branch/2026', '/targets', '/targets/one/approve', '/outbound-emails', '/outbound-emails/one/retry']) {
      const read = api.read(path);
      const readRequest = http.expectOne(`${base}${path}`);
      expect(readRequest.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(readRequest.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      readRequest.flush([]);
      await read;
      const write = api.write('POST', path, {}, { key: newIdempotencyKey() });
      const writeRequest = http.expectOne(`${base}${path}`);
      expect(writeRequest.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(writeRequest.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      writeRequest.flush({});
      await write;
    }
  });

  it('sends scope only when explicitly supplied and forwards write queries', async () => {
    const pending = api.write('PUT', '/settings', {}, { key: newIdempotencyKey(), query: { revision: 2 },
      scope: { companyId: 'company', branchId: 'branch' } });
    const request = http.expectOne(`${base}/settings?revision=2`);
    expect(request.request.headers.get('x-mutakamel-company-id')).toBe('company');
    expect(request.request.headers.get('x-mutakamel-branch-id')).toBe('branch');
    request.flush({ revision: 3 });
    await pending;
  });

  it('multipart keeps the browser boundary', async () => {
    const form = new FormData();
    form.append('icon', new Blob(['icon'], { type: 'image/png' }), 'icon.png');
    const key = newIdempotencyKey();
    const pending = api.writeMultipart('/acquisition-sources/one/icon', form, { key });
    const request = http.expectOne(`${base}/acquisition-sources/one/icon`);
    expect(request.request.body).toBe(form);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    request.flush({ iconUrl: '/icon.png' });
    await pending;
  });

  it('readBlob returns a blob', async () => {
    const blob = new Blob(['bytes'], { type: 'image/png' });
    const pending = api.readBlob('/acquisition-sources/one/icon', { size: 'thumb' });
    const request = http.expectOne(`${base}/acquisition-sources/one/icon?size=thumb`);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.withCredentials).toBe(true);
    request.flush(blob);
    await expect(pending).resolves.toBe(blob);
  });

  it('unbound accessor throws', async () => {
    vi.resetModules();
    const freshModule = await import('./crm-http');
    expect(() => freshModule.crmHttp()).toThrowError('CrmHttp is not bound');
  });

  it('the disposer restores the default', () => {
    const original = crmHttp();
    const queries = crmQueries();
    const stub = new CrmHttpStub({ '/tags': [] });
    const dispose = bindCrmHttpForTest(stub);
    expect(crmHttp()).toBe(stub);
    dispose();
    expect(crmHttp()).toBe(original);
    expect(crmQueries()).toBe(queries);
  });

  it('an omitted test stub uses the fixtures and restores both bindings', async () => {
    const previousQueries = new QueryClient();
    const previousHttp = new CrmHttpStub();
    bindCrmHttp(previousHttp, previousQueries);
    const dispose = bindCrmHttpForTest();
    await expect(crmHttp().read('/tags')).resolves.toEqual(CRM_SETTINGS_FIXTURES['/tags']);
    expect(crmQueries()).not.toBe(previousQueries);
    dispose();
    expect(crmHttp()).toBe(previousHttp);
    expect(crmQueries()).toBe(previousQueries);
  });

  it('does not retry writes and preserves the caller key and body on an explicit retry', async () => {
    const key = newIdempotencyKey();
    const body = { name: 'One' };
    for (const status of [0, 503]) {
      const pending = api.write('POST', '/tags', body, { key });
      const request = http.expectOne(`${base}/tags`);
      expect(request.request.body).toEqual(body);
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({}, { status, statusText: 'Unavailable' });
      await expect(pending).rejects.toMatchObject({ status });
      http.expectNone(`${base}/tags`);
    }
    const changedKey = newIdempotencyKey();
    const pending = api.write('POST', '/tags', { name: 'Changed' }, { key: changedKey });
    const request = http.expectOne(`${base}/tags`);
    expect(changedKey).not.toBe(key);
    expect(changedKey).toMatch(uuidV7);
    expect(request.request.headers.get('x-idempotency-key')).toBe(changedKey);
    expect(request.request.body).toEqual({ name: 'Changed' });
    request.flush({});
    await pending;
  });

  it('keeps gateway error details and Retry-After', async () => {
    const pending = api.write('POST', '/tags', {}, { key: newIdempotencyKey() });
    http.expectOne(`${base}/tags`).flush({ code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'corr-rate' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '9' } });
    await expect(pending).rejects.toMatchObject({ code: 'GW.RATE.LIMIT_EXCEEDED',
      details: { retryAfterSeconds: ['9'] }, correlationId: 'corr-rate' });
  });
});

describe('test-setup', () => {
  const leakedStub = new CrmHttpStub({ '/tags': ['custom'] });

  it('records a write in spec A and leaves a custom binding for cleanup', async () => {
    const stub = crmHttp() as CrmHttpStub;
    await stub.write('POST', '/tags', { name: 'One' }, { key: newIdempotencyKey() });
    expect(stub.recordedWrites()).toHaveLength(1);
    crmQueries().setQueryData(['crm-settings', 'tags'], ['cached']);
    bindCrmHttpForTest(leakedStub);
    await leakedStub.write('POST', '/tags', { name: 'Custom' }, { key: newIdempotencyKey() });
  });

  it('recorded writes reset after each spec', async () => {
    const stub = crmHttp() as CrmHttpStub;
    expect(stub.recordedWrites()).toEqual([]);
    expect(leakedStub.recordedWrites()).toEqual([]);
    expect(crmQueries().getQueryCache().getAll()).toEqual([]);
    await expect(stub.read('/tags')).resolves.toEqual(CRM_SETTINGS_FIXTURES['/tags']);
  });

  it('default stub answers settings lists', async () => {
    for (const path of ['/tags', '/acquisition-sources', '/lead-stages', '/opportunity-stages', '/pipelines',
      '/pipelines/configuration', '/custom-fields', '/settings/reasons', '/static-data', '/settings',
      '/settings/modules', '/settings/duplicate-policy',
      '/targets/working-calendars/01934b10-0000-7000-8000-000000000101/2026']) {
      await expect(crmHttp().read(path)).resolves.toEqual(CRM_SETTINGS_FIXTURES[path]);
    }
    const tags = await crmHttp().read<{ name: string }[]>('/tags');
    tags[0].name = 'Mutated';
    await expect(crmHttp().read('/tags')).resolves.toEqual(CRM_SETTINGS_FIXTURES['/tags']);
    await expect(crmHttp().read('/not-a-fixture')).rejects.toThrow('No CRM GET fixture');
  });

  it('settings queries never retry and execute while offline', async () => {
    const client = crmQueries();
    expect(client.getDefaultOptions().queries).toEqual({ retry: false, gcTime: 0, networkMode: 'always' });
    const queryFn = vi.fn().mockRejectedValue(new ApiError(503, 'ENTITLEMENT_UNAVAILABLE'));
    onlineManager.setOnline(false);
    try {
      await expect(client.fetchQuery({ queryKey: ['crm-settings', 'error'], queryFn })).rejects.toMatchObject({ status: 503 });
      expect(queryFn).toHaveBeenCalledTimes(1);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('the stub snapshots writes and supports multipart and blob fixtures', async () => {
    const blob = new Blob(['image'], { type: 'image/png' });
    const stub = new CrmHttpStub({ '/icon': blob });
    const body = { name: 'Original' };
    const key = newIdempotencyKey();
    await stub.write('PATCH', '/tags/one', body, { key });
    body.name = 'Changed';
    expect(stub.recordedWrites()[0].body).toEqual({ name: 'Original' });
    const form = new FormData();
    form.append('name', 'Icon');
    await stub.writeMultipart('/icon', form, { key });
    expect((stub.recordedWrites()[1].body as FormData).get('name')).toBe('Icon');
    const copy = await stub.readBlob('/icon');
    expect(copy).toBeInstanceOf(Blob);
    expect(copy.size).toBe(blob.size);
    expect(copy.type).toBe(blob.type);
    await expect(stub.readBlob('/missing')).rejects.toThrow('No CRM Blob fixture');
    stub.reset();
    expect(stub.recordedWrites()).toEqual([]);
  });
});
