import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../shared/crm-http';
import { bindAnalyticsPermissions } from '../../../shared/widgets/dashboard/analytics-permissions';
import {
  canExport, canManageStatus, canManageTags, listBranches, listBranchOwners,
  listCurrencies, listCustomerCustomFields, listCustomerStatusOptions, listSources, listTags,
} from './customers.api';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const base = '/api/tenant/crm/v1';

describe('legacy customer lookups use live adapters', () => {
  let http: HttpTestingController;
  let dispose: () => void;
  let tenantOwner: boolean;

  beforeEach(() => {
    tenantOwner = false;
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: {
        selection: signal({ companyId, branchId }),
        branchCompanies: () => new Map([[branchId, companyId]]),
        me: () => tenantOwner ? { isTenantOwner: true } : null,
      } },
    ] });
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    bindAnalyticsPermissions(() => []);
  });

  afterEach(() => {
    http.verify();
    dispose();
    crmQueries().clear();
    bindAnalyticsPermissions(() => []);
  });

  it.each([
    [listCustomerCustomFields, '/custom-fields'],
    [listSources, '/acquisition-sources'],
    [listTags, '/tags'],
  ] as const)('reads the live bare catalogue (%#)', async (read, path) => {
    const result = read();
    http.expectOne(`${base}${path}`).flush([]);
    await expect(result).resolves.toEqual([]);
  });

  it.each([
    [listCustomerCustomFields, '/custom-fields'],
    [listCustomerStatusOptions, '/static-data'],
    [listSources, '/acquisition-sources'],
    [listTags, '/tags'],
  ] as const)('preserves backend failures without fixture fallback (%#)', async (read, path) => {
    const result = read();
    const rejected = expect(result).rejects.toMatchObject({ code: 'CRM_SCOPED_PERMISSION_DENIED' });
    http.expectOne(`${base}${path}`).flush({ code: 'CRM_SCOPED_PERMISSION_DENIED' }, {
      status: 403, statusText: 'Forbidden',
    });
    await rejected;
  });

  it('extracts customer statuses from static data', async () => {
    const result = listCustomerStatusOptions();
    const statuses = [{ value: 'PROSPECT', label: { en: 'Prospect', ar: 'عميل محتمل' } }];
    http.expectOne(`${base}/static-data`).flush({ enumOptions: { customerStatuses: statuses } });
    await expect(result).resolves.toEqual(statuses);
  });

  it('filters custom fields and options and adapts operation requirements', async () => {
    const result = listCustomerCustomFields();
    const field = {
      id: 'field', ownerType: 'CUSTOMER_PROFILE', isActive: true,
      options: [{ key: 'active', isActive: true }, { key: 'inactive', isActive: false }],
      requirements: [
        { operation: 'CREATE', entityScope: null, isRequired: true },
        { operation: 'UPDATE', entityScope: 'other', isRequired: true },
      ],
    };
    http.expectOne(`${base}/custom-fields`).flush([
      field, { ...field, id: 'inactive', isActive: false }, { ...field, id: 'lead', ownerType: 'LEAD' },
    ]);
    await expect(result).resolves.toEqual([{
      ...field, options: [field.options[0]], requiredOnCreate: true, requiredOnUpdate: false,
    }]);
  });

  it('flattens Core currency pages and maps ISO codes rather than database IDs', async () => {
    tenantOwner = true;
    const result = listCurrencies();
    for (const page of [1, 2]) {
      const req = http.expectOne((request) => request.url === '/api/tenant/core/v1/currencies');
      expect(req.request.params.get('status')).toBe('ACTIVE');
      expect(req.request.params.get('page')).toBe(String(page));
      expect(req.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      req.flush({ success: true, data: [{
        id: `database-${page}`, code: page === 1 ? 'EGP' : 'USD', name: `Currency ${page}`,
        decimalPlaces: 2, isDefault: page === 1, status: 'ACTIVE',
      }], meta: { page, limit: 100, total: 101, totalPages: 2, hasNext: page === 1, hasPrev: page === 2 } });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await expect(result).resolves.toEqual([
      { id: 'EGP', label: 'Currency 1', decimals: 2, isDefault: true },
      { id: 'USD', label: 'Currency 2', decimals: 2, isDefault: false },
    ]);
  });

  it('maps cursor-paged owners and preserves explicit create and default update actions', async () => {
    for (const action of ['create', 'update'] as const) {
      const result = action === 'create' ? listBranchOwners(branchId, action) : listBranchOwners(branchId);
      const first = http.expectOne((req) => req.url === `${base}/assignable-owners`);
      expect(first.request.params.get('action')).toBe(action);
      expect(first.request.params.get('resource')).toBe('customer_profiles');
      expect(first.request.headers.get('x-mutakamel-company-id')).toBe(companyId);
      expect(first.request.headers.get('x-mutakamel-branch-id')).toBe(branchId);
      first.flush({ items: [{ id: 'owner', displayName: 'Owner', avatarUrl: null }], nextCursor: null });
      await expect(result).resolves.toEqual([{ userId: 'owner', name: 'Owner', avatarUrl: null }]);
    }
  });

  it('returns no branch or currency options without catalogue permissions', async () => {
    await expect(listBranches()).resolves.toEqual([]);
    await expect(listCurrencies()).resolves.toEqual([]);
    http.expectNone((req) => req.url.startsWith('/api/tenant/core/v1/'));
  });

  it('derives synchronous controls from bound session permissions', () => {
    expect(canManageStatus()).toBe(false);
    expect(canManageTags()).toBe(false);
    expect(canExport()).toBe(false);
    bindAnalyticsPermissions(() => [
      'crm.customer_profiles.status.manage', 'crm.tags.manage', 'crm.customer_profiles.export',
    ]);
    expect(canManageStatus()).toBe(true);
    expect(canManageTags()).toBe(true);
    expect(canExport()).toBe(true);
  });
});
