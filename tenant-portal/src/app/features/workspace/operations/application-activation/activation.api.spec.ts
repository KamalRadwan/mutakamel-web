import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { ActivationApi } from './activation.api';

const base = '/api/tenant/core/v1/companies/co/application-activations';
const branchPath = '/api/tenant/core/v1/branches/br/application-activations/crm/addons/crm.homes';
const appBody = { expectedActivationRevision: '0', enabled: true, reason: 'Owner request' };
const addonBody = { ...appBody, definitionVersionId: 'definition' };
const branchBody = { expectedOverrideRevision: '0', mode: 'DISABLED' as const, reason: 'Owner request' };
const receipt = { state: 'COMMITTED', changed: true, resourceRevision: '1' };
const singleton = { scope: {}, target: {}, resource: { revision: '1' }, source: {} };
const meta = (page: number, hasNext: boolean) => ({ page, limit: 100, total: 2, totalPages: 2, hasNext, hasPrev: page > 1 });

describe('ActivationApi', () => {
  let api: ActivationApi;
  let http: HttpTestingController;
  beforeEach(() => {
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'actor' }), selection: signal(null) } },
    ] });
    api = TestBed.inject(ActivationApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); document.cookie = 'mutakamel-http-tenant-csrf=; max-age=0; path=/'; });

  it('lists every page of company activations', async () => {
    const pending = api.listAllCompanyActivations('co');
    const rows = [1, 2].map((id) => ({ scope: {}, target: { applicationKey: String(id) }, resource: {} }));
    for (let page = 1; page <= 2; page++) {
      const req = await vi.waitFor(() => http.expectOne((r) => r.url === base));
      expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
      expect(req.request.params.get('limit')).toBe('100');
      expect(req.request.params.get('page')).toBe(String(page));
      req.flush({ success: true, data: [rows[page - 1]], meta: meta(page, page < 2) });
    }
    await expect(pending).resolves.toEqual(rows);
  });

  it('reads never send an idempotency key', async () => {
    const reads = [
      () => api.listCompanyActivations('co'), () => api.getCompanyApplication('co', 'crm'),
      () => api.getCompanyAddon('co', 'crm', 'crm.homes'), () => api.getBranchAddon('br', 'crm', 'crm.homes'),
      () => api.getAddonCommand('co', 'crm', 'crm.homes', 'command'),
    ];
    for (const [index, read] of reads.entries()) {
      const pending = read();
      const req = http.expectOne((r) => r.method === 'GET');
      expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      expect(req.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(req.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      if (index > 0) expect(req.request.params.keys()).toEqual([]);
      req.flush(index === 0 ? { success: true, data: [], meta: meta(1, false) }
        : { success: true, data: index === 4 ? receipt : singleton });
      await pending;
    }
  });

  it('writes send key CSRF and the exact body', async () => {
    const actions = [
      { path: `${base}/crm`, body: appBody, run: (key: string) => api.setCompanyApplication('co', 'crm', appBody, key) },
      { path: `${base}/crm/addons/crm.homes`, body: addonBody, run: (key: string) => api.setCompanyAddon('co', 'crm', 'crm.homes', addonBody, key) },
      { path: branchPath, body: branchBody, run: (key: string) => api.setBranchOverride('br', 'crm', 'crm.homes', branchBody, key) },
    ];
    for (const action of actions) {
      const key = newIdempotencyKey();
      const pending = action.run(key);
      const req = http.expectOne(action.path);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(req.request.headers.get('x-csrf-token')).toBe('csrf');
      for (const header of ['If-Match', 'x-mutakamel-company-id', 'x-mutakamel-branch-id']) expect(req.request.headers.has(header)).toBe(false);
      expect(req.request.body).toEqual(action.body);
      req.flush({ success: true, data: receipt });
      await expect(pending).resolves.toEqual(receipt);
    }
  });

  it('accepts 202 pending and unwraps the Core envelope', async () => {
    const pending = api.setCompanyAddon('co', 'crm', 'crm.homes', addonBody, newIdempotencyKey());
    const command = { state: 'PENDING', commandId: 'command', progress: { pageNumber: '1', validatedBranchCount: '100' } };
    http.expectOne(`${base}/crm/addons/crm.homes`).flush({ success: true, data: command }, { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(command);
  });

  it('missing CSRF sends no request for any write', async () => {
    document.cookie = 'mutakamel-http-tenant-csrf=; max-age=0; path=/';
    for (const run of [() => api.setCompanyApplication('co', 'crm', appBody, newIdempotencyKey()),
      () => api.setCompanyAddon('co', 'crm', 'crm.homes', addonBody, newIdempotencyKey()),
      () => api.setBranchOverride('br', 'crm', 'crm.homes', branchBody, newIdempotencyKey())]) {
      await expect(run()).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
      http.expectNone(() => true);
    }
  });

  it('rejects malformed success bodies', async () => {
    const pending = api.getCompanyApplication('co', 'crm');
    const failure = expect(pending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne(`${base}/crm`).flush({ success: true, data: null });
    await failure;
    const list = api.listCompanyActivations('co');
    const listFailure = expect(list).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne((r) => r.url === base).flush({ data: [] });
    await listFailure;
  });
});
