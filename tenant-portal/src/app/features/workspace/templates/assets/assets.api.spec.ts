import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { AssetsApi } from './assets.api';
import type { UploadTemplateAssetRequest } from '../templates.model';

const base = '/api/tenant/core/v1/templates/assets';
const id = '01948100-0000-7000-8000-000000001001';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const page = { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } };
const upload: UploadTemplateAssetRequest = { metadata: { definitionId: null, assetType: 'IMAGE',
  deliveryClass: 'PRIVATE_ONLY', fileName: 'image.jpg', declaredMimeType: 'image/jpeg', expectedRawSha256: 'a'.repeat(64) },
  file: new File(['bytes'], 'image.jpg', { type: 'image/jpeg' }) };

describe('AssetsApi', () => {
  let api: AssetsApi;
  let http: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor' });
  const selection = signal(null);
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me, selection } }] });
    const doc = TestBed.inject(DOCUMENT);
    cookie = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(AssetsApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('definitionId only with the definition scope', async () => {
    for (const scope of ['ALL_AUTHORIZED', 'REUSABLE', 'DEFINITION'] as const) {
      const pending = api.listAssets({ scope, definitionId: id });
      const req = http.expectOne((r) => r.url === base);
      expect(req.request.params.get('definitionId')).toBe(scope === 'DEFINITION' ? id : null);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, data: page });
      expect(await pending).toEqual(page);
    }
  });

  it('upload sends exactly two parts with key and CSRF', async () => {
    const key = newIdempotencyKey();
    const pending = api.uploadAsset(upload, key);
    const req = http.expectOne(base);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(key).toMatch(uuid);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    const form = req.request.body as FormData;
    expect([...form.keys()]).toEqual(['metadata', 'file']);
    expect(JSON.parse(form.get('metadata') as string)).toEqual(upload.metadata);
    expect((form.get('file') as File).type).toBe('image/jpeg');
    const result = { asset: { assetId: key }, delivery: { kind: 'SAME_ORIGIN_AUTHENTICATED_READ' } };
    req.flush({ success: true, data: result }, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual(result);
  });

  it('retire sends the namespaced etag', async () => {
    const etag = `"asset:${id}:3"`;
    const pending = api.retireAsset(id, etag);
    const req = http.expectOne(`${base}/${id}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('If-Match')).toBe(etag);
    expect(req.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
  });

  it('rejects missing CSRF without sending either write', async () => {
    cookie = '';
    await expect(api.uploadAsset(upload)).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    await expect(api.retireAsset(id, `"asset:${id}:1"`)).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(() => true);
  });

  it('rejects malformed success envelopes and cursor bodies', async () => {
    for (const body of [{ data: page }, { success: true, data: { items: [] } }]) {
      const pending = api.listAssets();
      const result = expect(pending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR', status: 502 });
      http.expectOne(base).flush(body);
      await result;
    }
  });

  it('reads private content as a blob and parses errors centrally', async () => {
    const pending = api.getAssetContent(id);
    const req = http.expectOne(`${base}/${id}/content`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBe(true);
    const blob = new Blob(['png'], { type: 'image/png' });
    req.flush(blob);
    expect(await pending).toBe(blob);
    const failed = api.getAsset(id);
    const assertion = expect(failed).rejects.toBeInstanceOf(ApiError);
    http.expectOne(`${base}/${id}`).flush({ errorCode: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await assertion;
  });
});
