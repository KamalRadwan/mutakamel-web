import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { TemplatesHttp } from './templates-http';

describe('TemplatesHttp', () => {
  let api: TemplatesHttp;
  let http: HttpTestingController;
  const path = '/api/tenant/core/v1/templates';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    api = TestBed.inject(TemplatesHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('returns the cursor page', async () => {
    const page = { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } };
    const pending = api.cursorPage(path, { cursor: 'next', limit: 25 });
    const request = http.expectOne(`${path}?cursor=next&limit=25`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: page });
    await expect(pending).resolves.toEqual(page);
  });

  it('rejects a malformed cursor page', async () => {
    for (const page of [null, {}, { items: [] }, { items: {}, pageInfo: {} },
      { items: [], pageInfo: { limit: 25, hasNextPage: false } },
      { items: [], pageInfo: { limit: 0, hasNextPage: false, nextCursor: null } },
      { items: [], pageInfo: { limit: 25, hasNextPage: 'false', nextCursor: null } }]) {
      const pending = api.cursorPage(path);
      http.expectOne(path).flush({ success: true, data: page });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('keyed writes forward key and If-Match', async () => {
    const key = newIdempotencyKey();
    const pending = api.write('PATCH', path, { name: 'Updated' }, { key, ifMatch: '"7"' });
    const request = http.expectOne(path);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('If-Match')).toBe('"7"');
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    request.flush({ success: true, data: {} }, { headers: { ETag: '"8"', Location: '/next' } });
    await expect(pending).resolves.toMatchObject({ status: 200, etag: '"8"', location: '/next' });
  });
});
