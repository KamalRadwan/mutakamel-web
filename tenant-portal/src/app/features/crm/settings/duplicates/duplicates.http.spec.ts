import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmHttp, bindCrmHttpForTest } from '../../shared/crm-http';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { getPolicy, putBranch, putCompany, putDefaults } from './duplicates.api';
import { PolicyTree } from './duplicates.model';

const base = '/api/tenant/crm/v1/settings/duplicate-policy';
const id = '01950000-0000-7000-8000-000000000501';
const tree = CRM_SETTINGS_FIXTURES['/settings/duplicate-policy'] as PolicyTree;
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('duplicate policy HTTP', () => {
  let http: HttpTestingController;
  let dispose: () => void;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=dup-csrf`);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); dispose(); vi.restoreAllMocks(); });

  it('GET reads a bare tree from the tenant CRM endpoint', async () => {
    const pending = getPolicy();
    await Promise.resolve();
    const request = http.expectOne(base);
    expect(request.request.method).toBe('GET');
    request.flush(tree);
    await expect(pending).resolves.toEqual(tree);
  });

  it.each([
    ['defaults', () => putDefaults({ checkEmail: false }, 1)],
    [`companies/${id}`, () => putCompany(id, { allowAcrossUsers: null }, 1)],
    [`branches/${id}`, () => putBranch(id, { allowAcrossUsers: null }, 1)],
  ] as const)('PUT %s sends UUID v7 and CSRF headers without scope or If-Match', async (suffix, send) => {
    const pending = send();
    const request = http.expectOne(`${base}/${suffix}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
    expect(request.request.headers.get('x-csrf-token')).toBe('dup-csrf');
    expect(request.request.headers.has('If-Match')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    request.flush({ ...(tree as object), resets: [] });
    await pending;
  });

  it.each([0, 503])('explicit retry after status %s sends identical headers and body', async (status) => {
    const pending = putDefaults({ checkEmail: false }, 1);
    const rejected = expect(pending).rejects.toMatchObject({ status });
    const first = http.expectOne(`${base}/defaults`);
    const key = first.request.headers.get('x-idempotency-key');
    if (status === 0) first.error(new ProgressEvent('error'));
    else first.flush({ errorCode: 'CRM_SETTINGS_MISSING' }, { status, statusText: 'Unavailable' });
    await rejected;
    const retry = putDefaults({ checkEmail: false }, 1);
    const second = http.expectOne(`${base}/defaults`);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    expect(second.request.body).toEqual(first.request.body);
    second.flush({ ...(tree as object), resets: [] });
    await retry;
  });
});
