import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { ApiError } from '../shared/settings-api';
import { beginTagEdit, createTag, deleteTag, deleteTagJob, detachLimitCount, listTags, updateTag } from './tags.api';
import { MAX_DETACH_LEADS } from './tags.model';

describe('detachLimitCount', () => {
  it('reads the decimal string array details.count', () => {
    expect(detachLimitCount(new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED', { count: ['101'] }))).toBe(101);
  });

  it('falls back to the detach limit when count is missing or not a string array', () => {
    expect(detachLimitCount(new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED', { count: 101 }))).toBe(MAX_DETACH_LEADS);
    expect(detachLimitCount(new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED'))).toBe(MAX_DETACH_LEADS);
    expect(detachLimitCount(new Error('net'))).toBe(MAX_DETACH_LEADS);
  });
});


const base = '/api/tenant/crm/v1/tags';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('tags API transport', () => {
  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    crmQueries().clear();
    dispose();
    vi.restoreAllMocks();
  });

  it('reads the bare array through the settings query key', async () => {
    const pending = listTags();
    http.expectOne(base).flush([]);
    await expect(pending).resolves.toEqual([]);
    expect(crmQueries().getQueryData(['crm-settings', 'tags'])).toEqual([]);
  });

  it('returns the bare 202 submit result for the shared tracker', async () => {
    const result = { jobId: 'job-id', status: 'QUEUED', total: 101,
      skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 2 };
    const pending = deleteTagJob('tag-id');
    const request = http.expectOne(`${base}/tag-id`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
    request.flush(result, { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(result);
  });

  it('returns undefined for a synchronous 204', async () => {
    const pending = deleteTagJob('tag-id');
    http.expectOne(`${base}/tag-id`).flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toBeUndefined();
  });

  for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    const path = method === 'POST' ? base : `${base}/tag-id`;
    const body = method === 'DELETE' ? undefined : { name: 'Alpha' };
    const send = (name = 'Alpha') => method === 'POST' ? createTag({ name })
      : method === 'PATCH' ? updateTag('tag-id', { name }) : deleteTag('tag-id');

    it(`${method} sends a UUID v7 header and invalidates only tags`, async () => {
      crmQueries().setQueryData(['crm-settings', 'tags'], []);
      crmQueries().setQueryData(['crm-settings', 'other'], []);
      const pending = send();
      const request = http.expectOne(path);
      expect(request.request.method).toBe(method);
      expect(request.request.body).toEqual(body ?? null);
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      request.flush(method === 'DELETE' ? null : { id: 'tag-id', ...body }, {
        status: method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200, statusText: 'Success',
      });
      await pending;
      expect(crmQueries().getQueryState(['crm-settings', 'tags'])?.isInvalidated).toBe(true);
      expect(crmQueries().getQueryState(['crm-settings', 'other'])?.isInvalidated).toBe(false);
    });

    for (const status of [0, 503, 409, 401]) {
      it(`${method} keeps the same key and body after ${status}`, async () => {
        const first = send();
        const failed = expect(first).rejects.toBeInstanceOf(ApiError);
        const request = http.expectOne(path);
        const key = request.request.headers.get('x-idempotency-key');
        if (status === 0) request.error(new ProgressEvent('error'));
        else request.flush({ code: status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'ERROR' }, { status, statusText: 'Failure' });
        await failed;
        http.expectNone(path);
        const retry = send();
        const next = http.expectOne(path);
        expect(next.request.headers.get('x-idempotency-key')).toBe(key);
        expect(next.request.body).toEqual(request.request.body);
        next.flush(null, { status: 204, statusText: 'No Content' });
        await retry;
      });
    }

    it(`${method} starts a new key after a definitive 4xx`, async () => {
      const first = send();
      const failed = expect(first).rejects.toMatchObject({ status: 422 });
      const request = http.expectOne(path);
      request.flush({ errorCode: 'CRM_TAG_LIMIT_EXCEEDED' }, { status: 422, statusText: 'Invalid' });
      await failed;
      const second = send();
      const next = http.expectOne(path);
      expect(next.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
      next.flush(null, { status: 204, statusText: 'No Content' });
      await second;
    });

    if (method !== 'DELETE') {
      it(`${method} uses a new key for a changed body or newly opened form`, async () => {
        const fail = async () => {
          const pending = send();
          const rejected = expect(pending).rejects.toMatchObject({ status: 503 });
          const request = http.expectOne(path);
          request.flush({}, { status: 503, statusText: 'Unavailable' });
          await rejected;
          return request.request.headers.get('x-idempotency-key');
        };
        const key = await fail();
        const changed = send('Beta');
        const request = http.expectOne(path);
        expect(request.request.headers.get('x-idempotency-key')).not.toBe(key);
        request.flush(null, { status: 204, statusText: 'No Content' });
        await changed;
        const previous = await fail();
        beginTagEdit(method === 'POST' ? null : 'tag-id');
        const reopened = send();
        const next = http.expectOne(path);
        expect(next.request.headers.get('x-idempotency-key')).not.toBe(previous);
        next.flush(null, { status: 204, statusText: 'No Content' });
        await reopened;
      });
    }
  }
});
