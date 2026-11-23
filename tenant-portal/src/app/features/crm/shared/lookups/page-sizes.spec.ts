import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { listBranchOwners, listLeadBranches, listLeadCurrencies } from '../../leads/leads.api';
import { listAssignableOwners, listPageSizes as leadPageSizes } from '../../leads/lead-bulk/lead-bulk.api';
import { bindCrmHttpForTest } from '../crm-http';
import { CRM_SETTINGS_FIXTURES } from '../testing/crm-settings-fixtures';
import { CrmHttpStub } from '../testing/crm-http-testing';
import { listPageSizes } from './page-sizes';
import { branchOptions } from './session-branch';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const branch = { id: branchId, name: 'Branch', companyId, code: 'BR', address: null, phone: null,
  isHeadquarters: true, status: 'ACTIVE' as const, createdAt: '', updatedAt: '' };
const company = { id: companyId, name: 'Company', code: 'CO', legalName: null, taxNumber: null,
  countryCode: null, currencyCode: null, status: 'ACTIVE' as const, createdAt: '', updatedAt: '' };

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  let htmlAttributes: (string | null)[];
  const me = signal({ ...FAKE_TENANT_ME });
  const run = <T>(fn: () => T) => TestBed.runInInjectionContext(fn);
  beforeEach(() => {
    htmlAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [], permissionScopes: {} });
    bindAnalyticsPermissions(() => ['org.branch.read', 'org.company.read']);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me, selection: () => ({ companyId, branchId }), branchCompanies: () => new Map([[branchId, companyId]]) } },
    ] });
    stub = new CrmHttpStub({ ...CRM_SETTINGS_FIXTURES,
      '/assignable-owners': { items: [{ id: 'owner', displayName: 'Owner', avatarUrl: null }], nextCursor: 'next-page' },
    });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => {
    ['lang', 'dir', 'data-theme'].forEach((name, i) => htmlAttributes[i] === null
      ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, htmlAttributes[i]!));
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
    bindAnalyticsPermissions(() => []);
    dispose();
    TestBed.resetTestingModule();
  });

  describe('pageSizes', () => {
    it('uses static-data pagination with no scope headers', async () => {
      expect(await listPageSizes()).toEqual({ pageSizes: [20, 50, 100], defaultPageSize: 20 });
      expect(stub.recordedReads()).toEqual([{ path: '/static-data', query: undefined, scope: undefined }]);
    });
  });

  describe('branchOptions', () => {
    it('gates branch names and keeps company names optional', async () => {
      const workspace = TestBed.inject(WorkspaceLookups);
      const branches = vi.spyOn(workspace, 'allBranches').mockResolvedValue([branch]);
      const companies = vi.spyOn(workspace, 'allCompanies');
      bindAnalyticsPermissions(() => []);
      expect(await run(branchOptions)).toEqual([]);
      expect(branches).not.toHaveBeenCalled();
      bindAnalyticsPermissions(() => ['org.branch.read']);
      expect(await run(branchOptions)).toEqual([{ id: branchId, name: 'Branch', companyName: '' }]);
      expect(companies).not.toHaveBeenCalled();
    });

    it('uses Workspace lookups with no scope headers', async () => {
      const pending = run(branchOptions);
      const http = TestBed.inject(HttpTestingController);
      const branches = http.expectOne('/api/tenant/core/v1/organization/branches?status=ACTIVE&page=1&limit=100');
      const companies = http.expectOne('/api/tenant/core/v1/organization/companies?page=1&limit=100');
      const meta = { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
      for (const request of [branches, companies]) {
        expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
        expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      }
      branches.flush({ success: true, data: [branch], meta });
      companies.flush({ success: true, data: [company], meta });
      expect(await pending).toEqual([{ id: branchId, name: 'Branch', companyName: 'Company' }]);
    });
  });

  describe('leads lookups', () => {
    it('delegate to shared lookups', async () => {
      const owner = { id: 'owner', displayName: 'Owner', avatarUrl: null };
      const owners = vi.spyOn(stub, 'read');
      const workspace = TestBed.inject(WorkspaceLookups);
      vi.spyOn(workspace, 'allBranches').mockResolvedValue([branch]);
      vi.spyOn(workspace, 'allCompanies').mockResolvedValue([company]);

      // Resume outside Angular's injection context, as resource loaders and async handlers do.
      await Promise.resolve();
      expect(await listBranchOwners(branchId)).toEqual([owner]);
      expect(await listBranchOwners(branchId, 'update', 'opportunities')).toEqual([owner]);
      expect(await listAssignableOwners(branchId, 'opportunities')).toEqual([owner]);
      for (const [index, resource, action] of [[0, 'leads', 'create'], [1, 'opportunities', 'update'], [2, 'opportunities', 'update']] as const) {
        expect(owners.mock.calls[index]).toEqual(['/assignable-owners', {
          branchId, resource, action, cursor: undefined, limit: 100,
        }, { scope: { companyId, branchId } }]);
      }
      expect(await listLeadBranches()).toEqual([{ id: branchId, name: 'Branch', companyName: 'Company' }]);
      expect(await leadPageSizes()).toEqual(await listPageSizes());

      const http = TestBed.inject(HttpTestingController);
      const permission = 'currencies.currency.read';
      for (const permissions of [[], [permission], [`${permission}.all`]]) {
        me.set({ ...me(), permissions, permissionScopes: { [permission]: { tenantWide: false, companyIds: [], branchIds: [] } } });
        const empty = listLeadCurrencies();
        http.expectOne('/api/tenant/core/v1/currencies/options').flush({ success: true, data: [] });
        expect(await empty).toEqual([]);
        http.expectNone((req) => req.url.endsWith('/currencies'));
      }
      me.set({ ...me(), permissions: [permission], permissionScopes: { [permission]: { tenantWide: true, companyIds: [], branchIds: [] } } });
      const pending = listLeadCurrencies();
      const request = http.expectOne('/api/tenant/core/v1/currencies/options');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      const currency = { code: 'EGP', name: 'Egyptian Pound', decimalPlaces: 2, isDefault: true, status: 'ACTIVE' };
      request.flush({ success: true, data: [currency], meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false } });
      expect(await pending).toEqual([currency]);
    });
  });
});
