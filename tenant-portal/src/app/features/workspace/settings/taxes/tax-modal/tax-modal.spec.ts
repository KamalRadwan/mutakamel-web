import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TaxesApi } from '../taxes.api';
import type { Tax } from '../taxes.model';
import { TaxModal } from './tax-modal';

const tax: Tax = { id: '01970000-0000-7000-8000-000000000001', code: 'VAT15', name: 'VAT', rate: '15.0000',
  isInclusive: false, companyId: null, status: 'ACTIVE', createdAt: '', updatedAt: '' };
const owner = { id: 'owner', isTenantOwner: true, permissions: [], permissionScopes: {}, accessibleCompanies: [] } as unknown as TenantMe;
const messages: Record<string, string> = {
  'wsTaxes.notSaved': 'Not saved. Try again',
  'wsTaxes.errors.TAX_CODE_TAKEN': 'Code already used',
  'wsTaxes.errors.COMPANY_INVALID_CREATE': 'Company is not active',
  'wsTaxes.errors.COMPANY_INVALID_ON_REACTIVATE': 'Reactivate the company first',
  'wsTaxes.errors.TAX_NOT_FOUND': 'Tax no longer exists',
  'wsTaxes.errors.TENANT_WIDE_PERMISSION_REQUIRED': 'Workspace permission required',
  'wsTaxes.errors.COMPANY_PERMISSION_DENIED': 'Company permission denied',
  'settings.errors.idempotency': 'Request processing',
  'settings.errors.idempotencyMismatch': 'Earlier body differs',
  'wsTaxes.fields.rateHint': '0 to 100, up to 4 decimals.',
  'wsTaxes.fields.rateEditHint': 'Changes apply to new documents only',
};

describe('TaxModal', () => {
  const api = { createTax: vi.fn(), updateTax: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };
  const me = signal<TenantMe | null>(owner);
  let fixture: ComponentFixture<TaxModal>;
  let modal: TaxModal;
  let close: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetAllMocks();
    me.set(owner);
    api.createTax.mockResolvedValue(tax);
    api.updateTax.mockResolvedValue(tax);
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: TaxesApi, useValue: api }, { provide: Notify, useValue: notify },
      { provide: AuthSession, useValue: { me } },
      { provide: LanguageState, useValue: { current: signal('en') } },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key) => messages[String(key)] ?? String(key));
    fixture = TestBed.createComponent(TaxModal);
    modal = fixture.componentInstance;
    await render();
    vi.spyOn(modal['modal'](), 'open').mockImplementation(() => {});
    close = vi.spyOn(modal['modal'](), 'close').mockImplementation(() => {});
  });

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function create() {
    modal.openCreate();
    modal['codeDraft'].set('VAT15');
    modal['nameDraft'].set('VAT');
    modal['rateDraft'].set('15');
  }

  it('create succeeds', async () => {
    create();
    const saved = vi.fn();
    modal.saved.subscribe(saved);
    expect(await modal['save']()).toBe(true);
    expect(api.createTax).toHaveBeenCalledWith({ code: 'VAT15', name: 'VAT', rate: 15 }, expect.any(String));
    expect(saved).toHaveBeenCalledWith(tax);
    expect(notify.success).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('validation errors map to fields', async () => {
    create();
    api.createTax.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED', {
      code: ['Code invalid'], name: ['Name invalid'], rate: ['Rate invalid'], companyId: ['Company invalid'], isInclusive: ['Inclusive invalid'],
    }));
    await modal['save']();
    expect(modal['codeError']()).toBe('Code invalid');
    expect(modal['nameError']()).toBe('Name invalid');
    expect(modal['rateError']()).toBe('Rate invalid');
    expect(modal['scopeError']()).toBe('Company invalid');
    expect(modal['inclusiveError']()).toBe('Inclusive invalid');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('validation on an unrendered field uses a toast', async () => {
    create();
    api.createTax.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED', { _: ['Invalid request'] }));
    await modal['save']();
    expect(notify.error).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('code taken is a field message', async () => {
    create();
    api.createTax.mockRejectedValue(new ApiError(409, 'TAX_CODE_TAKEN'));
    await modal['save']();
    expect(modal['codeError']()).toBe('Code already used');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('COMPANY_INVALID on create', async () => {
    create();
    api.createTax.mockRejectedValue(new ApiError(422, 'COMPANY_INVALID'));
    await modal['save']();
    expect(modal['scopeError']()).toBe('Company is not active');
  });

  it.each(['TENANT_WIDE_PERMISSION_REQUIRED', 'COMPANY_PERMISSION_DENIED'])('403 on create shows a toast: %s', async (code) => {
    create();
    api.createTax.mockRejectedValue(new ApiError(403, code));
    await modal['save']();
    expect(notify.error).toHaveBeenCalledWith(messages[`wsTaxes.errors.${code}`]);
    expect(close).not.toHaveBeenCalled();
  });

  it('401 on create keeps the form', async () => {
    create();
    api.createTax.mockRejectedValue(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await modal['save']();
    const [body, key] = api.createTax.mock.calls[0];
    expect(modal['nameDraft']()).toBe('VAT');
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    expect(close).not.toHaveBeenCalled();
    await modal['save']();
    expect(api.createTax.mock.calls[1]).toEqual([body, key]);
    modal['nameDraft'].set('New name');
    await modal['save']();
    expect(api.createTax.mock.calls[2][1]).not.toBe(key);
  });

  it.each([['GW.IDEM.IN_FLIGHT', 'Request processing'], ['GW.IDEM.MISMATCH', 'Earlier body differs']])(
    'idempotency codes use the core mapper: %s', async (code, message) => {
      create();
      api.createTax.mockRejectedValue(new ApiError(code.endsWith('IN_FLIGHT') ? 409 : 422, code));
      await modal['save']();
      expect(notify.error).toHaveBeenCalledWith(message);
    });

  it('update succeeds', async () => {
    modal.openEdit(tax);
    modal['nameDraft'].set('New VAT');
    const saved = vi.fn();
    modal.saved.subscribe(saved);
    expect(await modal['save']()).toBe(true);
    expect(api.updateTax).toHaveBeenCalledWith(tax.id, { name: 'New VAT' }, expect.any(String));
    expect(saved).toHaveBeenCalledWith(tax);
    expect(close).toHaveBeenCalled();
  });

  it('404 on update reloads', async () => {
    modal.openEdit(tax);
    modal['nameDraft'].set('New VAT');
    api.updateTax.mockRejectedValue(new ApiError(404, 'TAX_NOT_FOUND'));
    const notFound = vi.fn();
    modal.notFound.subscribe(notFound);
    await modal['save']();
    expect(notify.error).toHaveBeenCalledWith('Tax no longer exists');
    expect(notFound).toHaveBeenCalledWith(tax.id);
    expect(close).toHaveBeenCalled();
  });

  it('rate allows four decimals only', async () => {
    create();
    modal['rateDraft'].set('14.99995');
    expect(await modal['save']()).toBe(false);
    expect(api.createTax).not.toHaveBeenCalled();
    for (const rate of ['0', '100', '14.9999']) {
      modal['rateDraft'].set(rate);
      expect(modal['isValid']()).toBe(true);
    }
    for (const rate of ['100.0001', '-1', '1e2', '.5', 'abc']) {
      modal['rateDraft'].set(rate);
      expect(modal['isValid']()).toBe(false);
    }
  });

  it('offline save keeps its payload and key and shows one connection toast', async () => {
    create();
    api.createTax.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await modal['save']();
    expect(notify.connectionLost).toHaveBeenCalledTimes(1);
    expect(notify.error).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    await modal['save']();
    expect(api.createTax.mock.calls[1]).toEqual(api.createTax.mock.calls[0]);
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('scope revocation prevents creating a tax in the old scope', async () => {
    create();
    fixture.componentRef.setInput('companies', [{ id: 'company', name: 'Company', status: 'ACTIVE', canManage: true }]);
    me.set({ ...owner, isTenantOwner: false, permissions: ['taxes.tax.manage'],
      permissionScopes: { 'taxes.tax.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] } } });
    expect(await modal['save']()).toBe(false);
    expect(api.createTax).not.toHaveBeenCalled();
    expect(modal['scopeError']()).toBe('wsTaxes.validation.scopeRequired');
  });

  it('rate hint follows V-TX1' , async () => {
    create();
    expect(modal['rateHint']()).not.toContain('Changes apply');
    modal.openEdit(tax);
    expect(modal['rateHint']()).toContain('Changes apply to new documents only');
  });

  it('scoped grants keep company taxes editable when company names are unavailable', async () => {
    me.set({ ...owner, isTenantOwner: false, permissions: ['taxes.tax.manage'],
      permissionScopes: { 'taxes.tax.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] } } });
    modal.openEdit({ ...tax, companyId: 'company' });
    expect(modal['isEditable']()).toBe(true);
    modal.openEdit(tax);
    expect(modal['isEditable']()).toBe(false);
  });
});
