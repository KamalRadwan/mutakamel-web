import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { AddonSeatsApi } from './addon-seats.api';

const path = '/api/tenant/core/v1/users/user%2Fid';
const meta = { page: 2, limit: 50, total: 51, totalPages: 2, hasNext: false, hasPrev: true };
const body = { addonSelectionId: 'selection', expectedAllowanceRevision: '12', expectedParentAssignmentRevision: '34' };
const revisions = { expectedAssignmentRevision: '56', expectedAllowanceRevision: '12' };
const receipt = { operationId: 'operation', operationRevision: '1', state: 'COMMITTED', operationKind: 'ASSIGN_ADDON',
  changed: true, resourceId: 'assignment', resourceRevision: '1', completedAt: '2026-11-23T12:00:00Z' };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('AddonSeatsApi', () => {
  let api: AddonSeatsApi;
  let http: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const document = TestBed.inject(DOCUMENT);
    const name = document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(AddonSeatsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('reads send only page and limit', async () => {
    for (const [load, suffix] of [
      [() => api.listAddonOptions('user/id', 2, 50), 'addon-assignment-options'],
      [() => api.listAddonAssignments('user/id', 2, 50), 'addon-assignments'],
    ] as const) {
      const pending = load();
      const request = http.expectOne((req) => req.url === `${path}/${suffix}`);
      expect(request.request.method).toBe('GET');
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.params.keys().sort()).toEqual(['limit', 'page']);
      expect(request.request.params.get('page')).toBe('2');
      expect(request.request.params.get('limit')).toBe('50');
      expect(request.request.headers.keys()).toEqual([]);
      request.flush({ success: true, data: [], meta });
      await expect(pending).resolves.toEqual({ data: [], meta });
    }
  });

  it('assign sends key CSRF and the exact body', async () => {
    const pending = api.assignAddon('user/id', { ...body, extra: 'discarded' } as typeof body);
    const request = http.expectOne(`${path}/addon-assignments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.getAll('x-idempotency-key')).toHaveLength(1);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.keys().sort()).toEqual(['x-csrf-token', 'x-idempotency-key']);
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.body).toEqual(body);
    request.flush({ success: true, data: receipt }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual(receipt);
  });

  it('remove sends the revisions as query', async () => {
    const key = newIdempotencyKey();
    const pending = api.removeAddon('user/id', 'assignment/id', { ...revisions, extra: 'discarded' } as typeof revisions, key);
    const request = http.expectOne((req) => req.url === `${path}/addon-assignments/assignment%2Fid`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    expect(request.request.params.keys().sort()).toEqual(Object.keys(revisions).sort());
    for (const [name, value] of Object.entries(revisions)) expect(request.request.params.get(name)).toBe(value);
    expect(request.request.headers.getAll('x-idempotency-key')).toEqual([key]);
    expect(key).toMatch(uuidV7);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.keys().sort()).toEqual(['x-csrf-token', 'x-idempotency-key']);
    expect(request.request.withCredentials).toBe(true);
    const removed = { ...receipt, operationKind: 'UNASSIGN_ADDON' };
    request.flush({ success: true, data: removed });
    await expect(pending).resolves.toEqual(removed);
  });

  it('missing CSRF sends neither write', async () => {
    cookie = '';
    await expect(api.assignAddon('user/id', body)).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    await expect(api.removeAddon('user/id', 'assignment', revisions)).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(() => true);
  });

  it('rejects malformed success envelopes for reads and writes', async () => {
    const read = api.listAddonOptions('user/id');
    http.expectOne((req) => req.url.endsWith('/addon-assignment-options')).flush({ data: [] });
    await expect(read).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    const write = api.assignAddon('user/id', body);
    http.expectOne(`${path}/addon-assignments`).flush({ success: true });
    await expect(write).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it('does not retry failed requests automatically', async () => {
    const pending = api.listAddonAssignments('user/id');
    http.expectOne((req) => req.url.endsWith('/addon-assignments'))
      .flush({ errorCode: 'ACCESS_POLICY_UNAVAILABLE', correlationId: 'ref-503' }, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toMatchObject({ status: 503, code: 'ACCESS_POLICY_UNAVAILABLE', correlationId: 'ref-503' });
    http.expectNone(() => true);
  });
});
