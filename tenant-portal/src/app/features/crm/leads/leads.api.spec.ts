import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/api/api-errors';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries } from '../shared/crm-http';
import { bindCrmInjectorForTest } from '../shared/crm-runtime';
import { CrmHttpStub } from '../shared/testing/crm-http-testing';
import { canManageTags, deleteLead, getLeadCapabilities, loadBoard, loadLeadKpis, loadSearchOptions, loadStagePage, moveLead, searchLeads, updateLead } from './leads.api';

const branchId = '019f0000-0000-7000-8000-000000000011';
const companyId = '019f0000-0000-7000-8000-000000000010';
const body = { branchId, search: 'Acme', searchField: 'lead' as const, tagIds: ['tag'], hasOverdueActivity: false };

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('LeadsApi %s / %s', (lang, theme) => {
  let http: CrmHttpStub;
  let dispose: () => void;
  let restoreRuntime: () => void;
  let attributes: (string | null)[];
  const selection = signal<{ companyId: string; branchId: string | null }>({ companyId, branchId });

  beforeEach(() => {
    attributes = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    selection.set({ companyId, branchId });
    TestBed.configureTestingModule({ providers: [{ provide: TenantScopeState, useValue: {
      selection, branchCompanies: () => new Map([[branchId, companyId]]),
    } }] });
    restoreRuntime = bindCrmInjectorForTest(() => TestBed.inject(Injector));
    http = new CrmHttpStub({ '/leads/capabilities': { branchId }, '/lead-stages': [], '/acquisition-sources': [], '/tags': [] });
    dispose = bindCrmHttpForTest(http);
    crmQueries().clear();
  });

  afterEach(() => {
    bindAnalyticsPermissions(() => []);
    dispose(); restoreRuntime();
    ['lang', 'dir', 'data-theme'].forEach((key, i) => attributes[i] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attributes[i]!));
  });

  it('search body is image compatible', async () => {
    await searchLeads({ ...body, partyId: 'party', excludeId: 'other', tagIdsAll: ['no'], hasOpenActivity: true } as typeof body, 2, 24);
    expect(http.recordedWrites()[0]).toMatchObject({ method: 'POST', path: '/leads/search', body: { ...body, page: 2, limit: 24 } });
    expect(http.recordedWrites()[0].body).toEqual({ ...body, page: 2, limit: 24 });
    expect(http.recordedWrites()[0].options.scope).toBeUndefined();
  });

  it('kpis body', async () => {
    await loadLeadKpis({ ...body, page: 5, limit: 50, sort: 'createdAt:DESC' } as typeof body);
    expect(http.recordedWrites()[0].body).toEqual(body);
    expect(http.recordedWrites()[0].options.scope).toBeUndefined();
  });

  it('capabilities sends both scope headers', async () => {
    await Promise.resolve();
    await getLeadCapabilities(branchId);
    expect(http.recordedReads()).toEqual([{ path: '/leads/capabilities', query: { branchId }, scope: { branchId, companyId } }]);
  });

  it('uses the session grant for managing tags', () => {
    bindAnalyticsPermissions(() => []);
    expect(canManageTags()).toBe(false);
    bindAnalyticsPermissions(() => ['crm.tags.manage']);
    expect(canManageTags()).toBe(true);
  });

  it('does not request capabilities without a matching session branch', async () => {
    selection.set({ companyId, branchId: null });
    await expect(getLeadCapabilities(branchId)).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    expect(http.recordedReads()).toEqual([]);
  });

  it('board and stage pages use 50 and no scope headers', async () => {
    await loadBoard(body);
    await loadStagePage('stage', body, 2);
    expect(http.recordedWrites().map((call) => call.body)).toEqual([{ ...body, limit: 50 }, { ...body, page: 2, limit: 50 }]);
    expect(http.recordedWrites().every((call) => call.options.scope === undefined)).toBe(true);
  });

  it('uses the loaded stale token and an idempotency key on every write', async () => {
    await updateLead('lead', { rating: 2 }, '2026-11-23T00:00:00.000Z');
    await moveLead('lead', 'stage', 'reason');
    await deleteLead('lead');
    const calls = http.recordedWrites();
    expect(calls.map((call) => call.body)).toEqual([{ rating: 2, expectedUpdatedAt: '2026-11-23T00:00:00.000Z' },
      { stageId: 'stage', disqualificationReasonId: 'reason' }, undefined]);
    expect(calls.every((call) => /^[0-9a-f-]{14}7[0-9a-f-]+$/i.test(call.options.key) && call.options.scope === undefined)).toBe(true);
    expect(new Set(calls.map((call) => call.options.key)).size).toBe(3);
  });

  it('retains the same key only for an uncertain same-body retry', async () => {
    const write = vi.spyOn(http, 'write');
    write.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE'));
    await expect(updateLead('lead', { rating: 1 }, 'token')).rejects.toMatchObject({ status: 503 });
    await updateLead('lead', { rating: 1 }, 'token');
    expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
    await updateLead('lead', { rating: 2 }, 'token');
    expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
  });

  it('does not resend an idempotency mismatch and treats DELETE 404 as done', async () => {
    const write = vi.spyOn(http, 'write');
    write.mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
    await expect(updateLead('lead', { rating: 1 }, 'token')).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    expect(write).toHaveBeenCalledTimes(1);
    write.mockRejectedValueOnce(new ApiError(404, 'LEAD_NOT_FOUND'));
    await expect(deleteLead('lead')).resolves.toBeUndefined();
  });

  it('composes separate catalogues with no scope headers and degrades only the failed facet', async () => {
    vi.spyOn(http, 'read').mockImplementation(async (path, query, options) => {
      if (path === '/tags') throw new ApiError(403, 'PERMISSION_DENIED');
      return CrmHttpStub.prototype.read.call(http, path, query, options) as never;
    });
    await expect(loadSearchOptions()).resolves.toEqual({ stages: [], sources: [], tags: [], unavailable: ['tag'] });
    expect(http.recordedReads().every((call) => call.scope === undefined)).toBe(true);
  });
});
