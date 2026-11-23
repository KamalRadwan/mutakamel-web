import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { listDisqualificationReasons, selectLeads } from './lead-bulk.api';

const branchId = '019f0000-0000-7000-8000-000000000011';
const companyId = '019f0000-0000-7000-8000-000000000010';

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('LeadBulkApi %s / %s', (lang, theme) => {
  let http: HttpTestingController;
  let dispose: () => void;
  let restoreRuntime: () => void;
  let attributes: (string | null)[];
  const selection = signal<{ companyId: string; branchId: string | null }>({ companyId, branchId });
  const parents = signal(new Map([[branchId, companyId]]));

  beforeEach(() => {
    attributes = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    selection.set({ companyId, branchId });
    parents.set(new Map([[branchId, companyId]]));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { selection, branchCompanies: parents } },
    ] });
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(`${document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`);
    http = TestBed.inject(HttpTestingController);
    restoreRuntime = bindCrmInjectorForTest(() => TestBed.inject(Injector));
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    crmQueries().clear();
  });

  afterEach(() => {
    http.verify(); dispose(); restoreRuntime(); crmQueries().clear(); vi.restoreAllMocks();
    ['lang', 'dir', 'data-theme'].forEach((key, i) => attributes[i] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attributes[i]!));
  });

  it('LeadBulkApi › selection scope', async () => {
    const pending = selectLeads({ branchId, search: 'Acme', page: 99, hasOpenActivity: true } as { branchId: string; search: string });
    await Promise.resolve();
    const request = http.expectOne('/api/tenant/crm/v1/leads/selection');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ branchId, search: 'Acme', limit: 10000 });
    expect(request.request.body.page).toBeUndefined();
    expect(request.request.body.hasOpenActivity).toBeUndefined();
    expect(request.request.headers.get('x-mutakamel-company-id')).toBe(companyId);
    expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(branchId);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]+$/i);
    const page = { items: [], total: 0, truncated: false };
    request.flush(page);
    await expect(pending).resolves.toEqual(page);
  });

  it('does not request an absent, stale or ambiguous session branch', async () => {
    selection.set({ companyId, branchId: null });
    await expect(selectLeads({ branchId })).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    selection.set({ companyId, branchId }); parents.set(new Map());
    await expect(selectLeads({ branchId })).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    parents.set(new Map([[branchId, companyId]]));
    await expect(selectLeads({ branchId: '019f0000-0000-7000-8000-000000000099' })).rejects.toMatchObject({ code: 'BRANCH_REQUIRED' });
    http.expectNone('/api/tenant/crm/v1/leads/selection');
  });

  it('reads active disqualification reasons without scope headers', async () => {
    const pending = listDisqualificationReasons();
    await Promise.resolve();
    const request = http.expectOne('/api/tenant/crm/v1/settings/reasons?kind=DISQUALIFICATION&active=true');
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    request.flush({ items: [{ id: 'reason', nameEn: 'Other', nameAr: 'أخرى' }] });
    await expect(pending).resolves.toMatchObject([{ id: 'reason' }]);
  });
});
