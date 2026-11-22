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
import type { Company } from '../shared/staff.model';
import { CompaniesPage } from './companies-page';

class EmptyLoader {
  getTranslation() {
    return of({});
  }
}

const companiesPath = '/api/tenant/core/v1/organization/companies';
const company: Company = {
  id: '019f0000-0000-7000-8000-000000000010',
  code: 'C',
  name: 'Core company',
  legalName: null,
  taxNumber: null,
  countryCode: 'EG',
  currencyCode: 'EGP',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const tenantGrant = { tenantWide: true, companyIds: [], branchIds: [] };
const emptyMeta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

describe('Companies with Gateway reads', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    me.set({
      ...FAKE_TENANT_ME,
      permissions: ['org.company.read', 'org.company.manage'],
      permissionScopes: { 'org.company.read': tenantGrant, 'org.company.manage': tenantGrant },
      accessibleCompanies: [],
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
    const fixture = TestBed.createComponent(CompaniesPage);
    fixture.detectChanges();
    return fixture;
  }

  async function finish(fixture: ComponentFixture<CompaniesPage>) {
    await vi.advanceTimersByTimeAsync(2_000);
    fixture.detectChanges();
  }

  it('renders Core rows and totals and fetches read-only details for the selected ID', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    http.expectOne((req) => req.method === 'GET' && req.url === companiesPath).flush({
      success: true, data: [company], meta: { ...emptyMeta, total: 21, totalPages: 2, hasNext: true },
    });
    await finish(fixture);
    expect(page['rows']()).toEqual([company]);
    expect(page['total']()).toBe(21);
    expect(page['actionsFor'](company).map((action) => action.id)).toEqual(['open']);
    const modal = page['companyModal']();
    const open = vi.spyOn(modal, 'openEdit');
    page['openEdit'](company);
    const detail = { ...company, legalName: 'Current legal name' };
    http.expectOne({ method: 'GET', url: companiesPath + '/' + company.id })
      .flush({ success: true, data: detail });
    await finish(fixture);
    expect(open).toHaveBeenCalledWith(detail);
    expect(modal.canManage()).toBe(false);
  });

  it('shows an empty list separately from a denied list request', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    http.expectOne((req) => req.url === companiesPath).flush({ success: true, data: [], meta: emptyMeta });
    await finish(fixture);
    expect(page['rows']()).toEqual([]);
    expect(page['loadFailed']()).toBe(false);
    page['reload']();
    http.expectOne((req) => req.url === companiesPath)
      .flush({ code: 'GW.AUTH.FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    await finish(fixture);
    expect(page['total']()).toBe(0);
    expect(page['loadForbidden']()).toBe(true);
  });
});

