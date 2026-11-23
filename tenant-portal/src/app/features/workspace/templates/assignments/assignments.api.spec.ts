import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import type { CreateTemplateAssignmentDto } from '../templates.model';
import { AssignmentsApi } from './assignments.api';

const path = '/api/tenant/core/v1/templates/assignments';
const body: CreateTemplateAssignmentDto = { versionId: 'version', adapterKey: 'TRADE_QUOTATION_PRINT_V1',
  documentType: 'QUOTATION', outputChannel: 'PRINT', locale: null, scope: { type: 'TENANT' },
  priority: 100, isDefault: true, effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const page = { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } };

describe('AssignmentsApi', () => {
  let api: AssignmentsApi;
  let http: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor', permissions: ['templates.read'], permissionScopes: {} });
  beforeEach(() => {
    cookie = 'mutakamel-http-tenant-csrf=csrf; __Host-mutakamel-tenant-csrf=csrf';
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => cookie);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me, selection: signal(null) } }] });
    api = TestBed.inject(AssignmentsApi); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('list sends the scope and the full tuple', async () => {
    const pending = api.listAssignments({ scopeType: 'BRANCH', companyId: 'company', branchId: 'branch',
      documentType: 'QUOTATION', outputChannel: 'PRINT', adapterKey: body.adapterKey, cursor: 'next', limit: 25 });
    const req = http.expectOne((r) => r.url === path);
    expect(Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]))).toEqual({
      scopeType: 'BRANCH', companyId: 'company', branchId: 'branch', documentType: 'QUOTATION',
      outputChannel: 'PRINT', adapterKey: body.adapterKey, cursor: 'next', limit: '25' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: page }); await expect(pending).resolves.toEqual(page);
  });
  it('create sends key and CSRF', async () => {
    const key = newIdempotencyKey(); const pending = api.createAssignment(body, key);
    const req = http.expectOne(path);
    expect(key).toMatch(uuid); expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf');
    expect(req.request.headers.has('If-Match')).toBe(false);
    expect(req.request.body).toEqual(body);
    const result = { assignment: { assignmentId: 'id' }, impact: { effectiveNow: true, affectedSelectors: [] } };
    req.flush({ success: true, data: result }, { status: 201, statusText: 'Created', headers: { ETag: '"1"', Location: `${path}/id` } });
    await expect(pending).resolves.toEqual(result);
  });
  it('patch and deactivate send If-Match', async () => {
    const key = newIdempotencyKey();
    let pending = api.patchAssignment('id', { priority: 9 }, '"7"', key);
    const patch = http.expectOne(`${path}/id`);
    expect(patch.request.method).toBe('PATCH'); expect(patch.request.headers.get('If-Match')).toBe('"7"');
    expect(patch.request.headers.get('x-csrf-token')).toBe('csrf'); expect(patch.request.headers.get('x-idempotency-key')).toMatch(uuid);
    patch.flush({ success: true, data: {} }); await pending;
    const deletion = api.deactivateAssignment('id', '"8"', key);
    const req = http.expectOne(`${path}/id`);
    expect(req.request.method).toBe('DELETE'); expect(req.request.headers.get('If-Match')).toBe('"8"');
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf'); expect(req.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(req.request.body).toBeNull(); req.flush(null, { status: 204, statusText: 'No Content' }); await deletion;
  });
  it('resolve sends no key', async () => {
    const pending = api.resolveAssignment({ documentType: body.documentType, outputChannel: body.outputChannel,
      adapterKey: body.adapterKey, locale: 'en-US', scope: body.scope });
    const req = http.expectOne(`${path}/resolve`);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf');
    expect(req.request.headers.has('x-idempotency-key')).toBe(false); expect(req.request.headers.has('If-Match')).toBe(false);
    req.flush({ success: true, data: { chosen: null } }); await pending;
  });
  it('every write rejects a missing CSRF cookie without a request', async () => {
    cookie = '';
    for (const call of [() => api.createAssignment(body), () => api.patchAssignment('id', { priority: 1 }, '"1"'),
      () => api.deactivateAssignment('id', '"1"'), () => api.resolveAssignment({ ...body, locale: 'en-US' })]) {
      await expect(call()).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
      http.expectNone((r) => r.url.startsWith(path));
    }
  });
  it('malformed success envelopes and cursor pages fail', async () => {
    for (const response of [page, { success: true }, { success: true, data: { items: [] } }]) {
      const pending = api.listAssignments({ scopeType: 'TENANT' });
      http.expectOne(`${path}?scopeType=TENANT`).flush(response);
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });
  it('get prefers the ETag header and falls back to the body', async () => {
    for (const headers of [{ ETag: '"9"' }, {}] as Record<string, string>[]) {
      const pending = api.getAssignment('id');
      http.expectOne(`${path}/id`).flush({ success: true, data: { assignmentId: 'id', etag: '"8"' } }, { headers });
      expect((await pending).etag).toBe('ETag' in headers ? '"9"' : '"8"');
    }
  });
  it('loads actual company and branch names through WorkspaceLookups', async () => {
    const pending = api.listScopeCompanies();
    const meta = { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
    http.expectOne((r) => r.url.endsWith('/organization/companies')).flush({ success: true, data: [{ id: 'company', name: 'Real company' }], meta });
    http.expectOne((r) => r.url.endsWith('/organization/branches')).flush({ success: true, data: [{ id: 'branch', companyId: 'company', name: 'Real branch' }], meta });
    await expect(pending).resolves.toEqual([{ id: 'company', nameEn: 'Real company', nameAr: 'Real company', branches: [{ id: 'branch', nameEn: 'Real branch', nameAr: 'Real branch' }] }]);
  });

});
