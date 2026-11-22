import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import type { Branch } from '../shared/staff.model';
import { BranchesPage } from './branches-page';

class EmptyLoader {
  getTranslation() {
    return of({});
  }
}

const organization = '/api/tenant/core/v1/organization';
const companyId = '019f0000-0000-7000-8000-000000000010';
const firstBranch: Branch = {
  id: '019f0000-0000-7000-8000-000000000011',
  companyId,
  code: 'EAST',
  name: 'East branch',
  address: null,
  phone: null,
  isHeadquarters: false,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const secondBranch: Branch = {
  ...firstBranch,
  id: '019f0000-0000-7000-8000-000000000012',
  code: 'WEST',
  name: 'West branch',
};
const branchGrant = { tenantWide: false, companyIds: [], branchIds: [firstBranch.id, secondBranch.id] };
const tenantGrant = { tenantWide: true, companyIds: [], branchIds: [] };

function branchPage(data: Branch[], total = data.length, page = 1) {
  return { success: true, data, meta: {
    page, limit: 1, total, totalPages: total, hasNext: page < total, hasPrev: page > 1,
  } };
}

describe('Branches with Gateway reads', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    me.set({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions: ['org.branch.read', 'org.branch.manage'],
      permissionScopes: { 'org.branch.read': branchGrant, 'org.branch.manage': tenantGrant },
      accessibleBranches: [firstBranch.id],
      accessibleCompanies: [companyId],
      accessibleBranchCompanies: [{ companyId, branchId: firstBranch.id }],
      accessScope: { ...FAKE_TENANT_ME.accessScope, branchesTruncated: true },
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: EmptyLoader,
        }),
        {
          provide: AuthSession,
          useValue: { me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in' },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(BranchesPage);
    fixture.componentInstance['pageSize'].set(1);
    fixture.detectChanges();
    return fixture;
  }

  async function finish(fixture: ComponentFixture<BranchesPage>) {
    await vi.advanceTimersByTimeAsync(2_000);
    fixture.detectChanges();
  }

  function expectPage(page: number) {
    return http.expectOne((req) => req.method === 'GET' &&
      req.url === organization + '/branches' && req.params.get('page') === String(page));
  }

  it('uses server pagination even for a permitted row absent from the navigation projection', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    expectPage(1).flush(branchPage([firstBranch], 2));
    await finish(fixture);
    expect(page['rows']()).toEqual([firstBranch]);
    expect(page['total']()).toBe(2);

    page['page'].set(2);
    fixture.detectChanges();
    expectPage(2).flush(branchPage([secondBranch], 2, 2));
    await finish(fixture);
    expect(page['rows']()).toEqual([secondBranch]);
    expect(page['total']()).toBe(2);

    me.update((actor) => ({ ...actor, permissions: [], permissionScopes: {} }));
    expect(page['rows']()).toEqual([]);
    expect(page['total']()).toBe(0);
    fixture.detectChanges();
    await finish(fixture);
    expect(page['loadForbidden']()).toBe(true);
    http.expectNone((req) => req.url === organization + '/branches');
  });

  it('loads the company filter from Core and passes the selected ID back to Core', async () => {
    me.update((actor) => ({
      ...actor,
      permissions: [...actor.permissions, 'org.company.read'],
      permissionScopes: { ...actor.permissionScopes, 'org.company.read': tenantGrant },
    }));
    const fixture = render();
    const page = fixture.componentInstance;
    const company = { id: companyId, name: 'Real company' };
    const directory = http.expectOne((req) => req.method === 'GET' && req.url === organization + '/companies');
    directory.flush({ ...branchPage([], 1), data: [company] });
    expectPage(1).flush(branchPage([firstBranch]));
    await finish(fixture);
    expect(page['filters']().find((filter) => filter.id === 'companyId')?.options)
      .toContainEqual({ value: companyId, label: company.name });

    page['filterValues'].set({ companyId });
    fixture.detectChanges();
    const filtered = expectPage(1);
    expect(filtered.request.params.get('companyId')).toBe(companyId);
    filtered.flush(branchPage([firstBranch]));
    await finish(fixture);
    expect(page['total']()).toBe(1);
  });

  it('loads record details and offers no fixture mutations even with the manage grant', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    expectPage(1).flush(branchPage([firstBranch]));
    await finish(fixture);
    expect(page['actionsFor'](firstBranch).map((action) => action.id)).toEqual(['open']);
    expect(page['canAddBranch']()).toBe(false);
    const modal = page['branchModal']();
    const open = vi.spyOn(modal, 'openEdit');
    page['openEdit'](firstBranch);
    const detail = { ...firstBranch, name: 'Current branch name' };
    http.expectOne({ method: 'GET', url: organization + '/branches/' + firstBranch.id })
      .flush({ success: true, data: detail });
    await finish(fixture);
    expect(open).toHaveBeenCalledWith(detail);
    expect(modal.canManage()).toBe(false);
  });

  it.each([200, 403])('keeps the 200-empty and forbidden views distinct for HTTP %i', async (status) => {
    const fixture = render();
    const page = fixture.componentInstance;
    const request = expectPage(1);
    if (status === 200) request.flush(branchPage([]));
    else request.flush({ code: 'GW.AUTH.FORBIDDEN' }, { status, statusText: 'Forbidden' });
    await finish(fixture);
    expect(page['rows']()).toEqual([]);
    expect(page['total']()).toBe(0);
    expect(page['loadFailed']()).toBe(status === 403);
    expect(page['loadForbidden']()).toBe(status === 403);
    expect(fixture.nativeElement.querySelector('ui-pagination')).toBeNull();
  });
});

