import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceCompany } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { TaxesApi } from '../taxes.api';
import { taxScopeRevision, type Tax } from '../taxes.model';
import { TaxesPage } from './taxes-page';

const tax: Tax = { id: '01970000-0000-7000-8000-000000000001', code: 'VAT15', name: 'VAT', rate: '15.0000',
  isInclusive: false, companyId: null, status: 'ACTIVE', createdAt: '', updatedAt: '' };
const company: WorkspaceCompany = { id: '12345678-company', code: 'HQ', name: 'Company from lookup', legalName: null,
  taxNumber: null, countryCode: 'EG', currencyCode: 'EGP', status: 'ACTIVE', createdAt: '', updatedAt: '' };
const emptyPage = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
const owner = { id: 'owner', isTenantOwner: true, permissions: [], permissionScopes: {}, accessibleCompanies: [company.id] } as unknown as TenantMe;

describe('TaxesPage', () => {
  const me = signal<TenantMe | null>(owner);
  const api = { listTaxes: vi.fn(), createTax: vi.fn(), updateTax: vi.fn(), deactivateTax: vi.fn(),
    scopeRevision: computed(() => taxScopeRevision(me())) };
  const lookups = { allCompanies: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };
  let fixture: ComponentFixture<TaxesPage>;
  let page: TaxesPage;

  beforeEach(() => {
    vi.resetAllMocks();
    me.set(owner);
    api.listTaxes.mockResolvedValue(emptyPage);
    api.updateTax.mockResolvedValue({ ...tax, status: 'ACTIVE' });
    api.deactivateTax.mockResolvedValue(undefined);
    lookups.allCompanies.mockResolvedValue([company]);
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: TaxesApi, useValue: api }, { provide: WorkspaceLookups, useValue: lookups },
      { provide: AuthSession, useValue: { me } }, { provide: Notify, useValue: notify },
      { provide: LanguageState, useValue: { current: signal('en') } },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, params) => {
      const data = params as Record<string, unknown> | undefined;
      if (key === 'wsTaxes.companyFallback') return `Company ${data?.['id']}`;
      if (key === 'wsTaxes.emptyScoped') return 'No taxes you can see';
      if (key === 'wsTaxes.errors.COMPANY_INVALID_ON_REACTIVATE') return 'Reactivate the company first';
      if (key === 'settings.errors.rateLimitedIn') return `Retry in ${data?.['seconds']} s`;
      if (/^wsTaxes.errors.(ACCESS_POLICY_|PERMISSION_SCOPE_)/.test(String(key))) return String(key) + ' message';
      return String(key);
    });
    fixture = TestBed.createComponent(TaxesPage);
    page = fixture.componentInstance;
  });

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('empty page shows the scoped empty copy', async () => {
    await render();
    expect(fixture.nativeElement.textContent).toContain('No taxes you can see');
    expect(fixture.nativeElement.querySelector('ui-pagination')).toBeNull();
  });

  it('403 shows forbidden', async () => {
    api.listTaxes.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await render();
    expect(page['loadForbidden']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('settings.errors.permission');
    expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
  });

  it('5xx and offline show load-failure', async () => {
    api.listTaxes.mockRejectedValue(new ApiError(503, 'COMMON.GENERIC.INTERNAL_ERROR'));
    await render();
    expect(page['loadFailed']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('settings.common.retry');
    api.listTaxes.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    page['reload']();
    await render();
    expect(page['loadFailed']()).toBe(true);
    expect(notify.connectionLost).toHaveBeenCalledTimes(1);
    api.listTaxes.mockResolvedValue(emptyPage);
    page['reload']();
    await render();
    expect(page['loadFailed']()).toBe(false);
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('unknown company filter resets', async () => {
    await render();
    api.listTaxes.mockRejectedValueOnce(new ApiError(422, 'COMPANY_INVALID'));
    page['onCompanyFilterChange']('deleted-company');
    await render();
    expect(page['companyFilter']()).toBe('');
    expect(notify.error).toHaveBeenCalled();
    expect(api.listTaxes).toHaveBeenLastCalledWith(expect.not.objectContaining({ companyId: 'deleted-company' }));
  });

  it('company names come from the lookup', async () => {
    api.listTaxes.mockResolvedValue({ data: [{ ...tax, companyId: company.id }], meta: { ...emptyPage.meta, total: 1 } });
    await render();
    expect(lookups.allCompanies).toHaveBeenCalled();
    expect(page['scopeLabel']({ ...tax, companyId: company.id })).toBe(company.name);
    expect(page['companyOptions']()).toContainEqual({ value: company.id, label: company.name });
    const modal = page['taxModal']();
    expect(modal['scopeOptions']()).toContainEqual({ value: company.id, label: company.name });
    expect(fixture.nativeElement.querySelector('ui-pagination')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(company.name);
  });

  it.each([403, 503])('lookup 403 falls back to /me companies (status %i)', async (status) => {
    lookups.allCompanies.mockRejectedValue(new ApiError(status, 'MISSING_REQUIRED_PERMISSIONS'));
    me.set({ ...owner, isTenantOwner: false, permissions: ['taxes.tax.manage'],
      permissionScopes: { 'taxes.tax.manage': { tenantWide: false, companyIds: [company.id, 'unlisted'], branchIds: [] } } });
    api.listTaxes.mockResolvedValue({ data: [{ ...tax, companyId: company.id }], meta: { ...emptyPage.meta, total: 1 } });
    await render();
    expect(page['companies']()).toEqual([{ id: company.id, name: 'Company 12345678', status: null, canManage: true }]);
    expect(page['companyOptions']()).toContainEqual({ value: company.id, label: 'Company 12345678' });
    expect(page['taxModal']()['scopeOptions']()).toEqual([{ value: company.id, label: 'Company 12345678' }]);
    expect(page['taxes']()).toHaveLength(1);
    expect(page['companyStatusesKnown']()).toBe(false);
    expect(fixture.nativeElement.querySelector('[id$="-inactive-companies"]')).toBeNull();
  });

  it('inactive companies are hidden by default', async () => {
    lookups.allCompanies.mockResolvedValue([{ ...company, status: 'INACTIVE' }]);
    const companyTax = { ...tax, id: 'inactive-company-tax', companyId: company.id };
    api.listTaxes.mockResolvedValue({ data: [tax, companyTax], meta: { ...emptyPage.meta, total: 2 } });
    await render();
    expect(page['taxes']()).toEqual([tax]);
    page['showInactiveCompanies'].set(true);
    await render();
    expect(page['taxes']()).toEqual([tax, companyTax]);
  });

  it('scope change drops rows while the next request is pending', async () => {
    api.listTaxes.mockResolvedValue({ data: [tax], meta: { ...emptyPage.meta, total: 1 } });
    await render();
    let finish!: (value: typeof emptyPage) => void;
    api.listTaxes.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    me.set({ ...owner, accessibleCompanies: [] });
    fixture.detectChanges();
    await Promise.resolve();
    expect(page['taxes']()).toEqual([]);
    finish(emptyPage);
    await render();
    expect(api.listTaxes).toHaveBeenCalledTimes(2);
  });

  it('COMPANY_INVALID on reactivate', async () => {
    await render();
    api.updateTax.mockRejectedValue(new ApiError(422, 'COMPANY_INVALID'));
    const blocker = page['reactivateBlockerModal']();
    blocker['dialog']().nativeElement.showModal = vi.fn();
    const open = vi.spyOn(blocker, 'open');
    await page['reactivate']({ ...tax, status: 'INACTIVE', companyId: company.id });
    expect(open).toHaveBeenCalled();
    await render();
    expect(fixture.nativeElement.textContent).toContain('Reactivate the company first');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('reactivate reuses its key', async () => {
    await render();
    api.updateTax.mockRejectedValueOnce(new ApiError(503, 'COMMON.GENERIC.INTERNAL_ERROR'));
    const inactive = { ...tax, status: 'INACTIVE' as const };
    await page['reactivate'](inactive);
    await page['reactivate'](inactive);
    expect(api.updateTax.mock.calls[1]).toEqual(api.updateTax.mock.calls[0]);
    await page['reactivate'](inactive);
    expect(api.updateTax.mock.calls[2][2]).not.toBe(api.updateTax.mock.calls[0][2]);
  });

  it('deactivate reuses its key', async () => {
    await render();
    vi.spyOn(page['deactivateConfirm'](), 'open').mockResolvedValue(true);
    api.deactivateTax.mockRejectedValueOnce(new ApiError(503, 'COMMON.GENERIC.INTERNAL_ERROR'));
    await page['requestDeactivate'](tax);
    await page['requestDeactivate'](tax);
    expect(api.deactivateTax.mock.calls[1]).toEqual(api.deactivateTax.mock.calls[0]);
    expect(notify.success).toHaveBeenCalled();
    await render();
    expect(api.listTaxes).toHaveBeenCalledTimes(2);
  });

  it.each(['ACCESS_POLICY_BLOCKED', 'PERMISSION_SCOPE_UNAVAILABLE'])('access-policy 403 on write: %s', async (code) => {
    await render();
    api.updateTax.mockRejectedValue(new ApiError(403, code));
    await page['reactivate']({ ...tax, status: 'INACTIVE' });
    expect(notify.error).toHaveBeenCalledWith(`wsTaxes.errors.${code} message`);
  });

  it('429 shows the rate text', async () => {
    await render();
    api.updateTax.mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['8'] }));
    await page['reactivate']({ ...tax, status: 'INACTIVE' });
    expect(notify.error).toHaveBeenCalledWith('Retry in 8 s');
  });

  it('modal save and not-found reload the list', async () => {
    await render();
    page['onModalSaved']();
    await render();
    page['onModalNotFound']();
    await render();
    expect(api.listTaxes).toHaveBeenCalledTimes(3);
  });
});
