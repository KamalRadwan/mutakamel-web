import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { CurrenciesApi } from '../currencies.api';
import type { Currency } from '../currencies.model';
import { CurrenciesPage } from './currencies-page';

const currency: Currency = { id: '01970000-0000-7000-8000-000000000001', code: 'USD', name: 'Dollar',
  symbol: '$', decimalPlaces: 2, isDefault: false, exchangeRate: '2.00000000', status: 'ACTIVE', createdAt: '', updatedAt: '' };
const emptyPage = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
const owner = { id: 'owner', isTenantOwner: true, permissions: ['currencies.currency.read'], permissionScopes: {} } as TenantMe;

describe('CurrenciesPage', () => {
  const me = signal<TenantMe | null>(owner);
  const api = { listCurrencies: vi.fn(), getDefaultCurrency: vi.fn(), listCurrencyCatalogue: vi.fn(),
    updateCurrency: vi.fn(), deactivateCurrency: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };
  let fixture: ComponentFixture<CurrenciesPage>;
  let page: CurrenciesPage;

  beforeEach(() => {
    vi.clearAllMocks();
    me.set(owner);
    api.listCurrencies.mockResolvedValue(emptyPage);
    api.getDefaultCurrency.mockResolvedValue(null);
    api.listCurrencyCatalogue.mockResolvedValue([]);
    api.updateCurrency.mockResolvedValue({ ...currency, status: 'ACTIVE' });
    api.deactivateCurrency.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: CurrenciesApi, useValue: api }, { provide: AuthSession, useValue: { me } },
      { provide: LanguageState, useValue: { current: signal('en') } }, { provide: Notify, useValue: notify },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, params) => {
      if (key === 'settings.errors.rateLimitedIn') return `Retry in ${(params as Record<string, unknown>)['seconds']} s`;
      if (/^wsCurrencies.errors.(CURRENCY_|TENANT_WIDE_|ACCESS_POLICY_)/.test(String(key))) return String(key) + ' message';
      return String(key);
    });
    fixture = TestBed.createComponent(CurrenciesPage);
    page = fixture.componentInstance;
  });

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('empty list shows the add-first state', async () => {
    await render();
    expect(fixture.nativeElement.textContent).toContain('wsCurrencies.addFirst');
    expect(fixture.nativeElement.querySelector('ui-pagination')).toBeNull();
  });

  it('403 on list shows forbidden', async () => {
    api.listCurrencies.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await render();
    expect(page['loadForbidden']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('settings.errors.permission');
  });

  it('5xx and offline show load-failure', async () => {
    api.listCurrencies.mockRejectedValue(new ApiError(503, 'COMMON.DATABASE.UNAVAILABLE'));
    await render();
    expect(page['loadFailed']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('settings.common.retry');
    api.listCurrencies.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    page['reload']();
    await render();
    expect(page['loadFailed']()).toBe(true);
    expect(notify.connectionLost).toHaveBeenCalledTimes(1);
    api.listCurrencies.mockResolvedValue(emptyPage);
    page['reload']();
    await render();
    expect(page['loadFailed']()).toBe(false);
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('scoped manager sees read-only', async () => {
    me.set({ ...owner, isTenantOwner: false, permissions: ['currencies.currency.read', 'currencies.currency.manage'],
      permissionScopes: { 'currencies.currency.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] } } });
    api.listCurrencies.mockResolvedValue({ data: [currency], meta: { ...emptyPage.meta, total: 1 } });
    await render();
    expect(page['canManage']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('wsCurrencies.readOnly');
    expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
    const modal = page['currencyModal']();
    vi.spyOn(modal['modal'](), 'open').mockImplementation(() => {});
    page['openEdit'](currency);
    await render();
    expect(modal['isReadOnly']()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-currency-modal button[type="submit"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-currency-modal input[id$="-name"]').readOnly).toBe(true);
    page['onRowAction'](currency, { id: 'reactivate' });
    expect(api.updateCurrency).not.toHaveBeenCalled();
  });

  it('reactivate reuses its key on retry', async () => {
    await render();
    api.updateCurrency.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    const inactive = { ...currency, status: 'INACTIVE' as const };
    await page['handleReactivate'](inactive);
    await page['handleReactivate'](inactive);
    expect(api.updateCurrency.mock.calls[1]).toEqual(api.updateCurrency.mock.calls[0]);
    expect(api.updateCurrency.mock.calls[0][1]).toEqual({ status: 'ACTIVE' });
    await page['handleReactivate'](inactive);
    expect(api.updateCurrency.mock.calls[2][2]).not.toBe(api.updateCurrency.mock.calls[0][2]);
  });

  it('reactivate without rate shows the message', async () => {
    await render();
    api.updateCurrency.mockRejectedValue(new ApiError(422, 'CURRENCY_EXCHANGE_RATE_REQUIRED'));
    await page['handleReactivate'](currency);
    expect(notify.error).toHaveBeenCalledWith('wsCurrencies.errors.CURRENCY_EXCHANGE_RATE_REQUIRED message');
  });

  it('deactivate reuses its key on retry', async () => {
    await render();
    vi.spyOn(page['deactivateConfirm'](), 'open').mockResolvedValue(true);
    api.deactivateCurrency.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await page['handleDeactivate'](currency);
    await page['handleDeactivate'](currency);
    expect(api.deactivateCurrency.mock.calls[1]).toEqual(api.deactivateCurrency.mock.calls[0]);
    await page['handleDeactivate'](currency);
    expect(api.deactivateCurrency.mock.calls[2][1]).not.toBe(api.deactivateCurrency.mock.calls[0][1]);
  });

  it('in-use and default blockers', async () => {
    await render();
    vi.spyOn(page['deactivateConfirm'](), 'open').mockResolvedValue(true);
    for (const code of ['CURRENCY_IN_USE', 'CURRENCY_DEFAULT_DELETE']) {
      api.deactivateCurrency.mockRejectedValueOnce(new ApiError(409, code));
      await page['handleDeactivate'](currency);
    }
    expect(notify.error).toHaveBeenCalledWith('wsCurrencies.errors.CURRENCY_IN_USE message');
    expect(notify.error).toHaveBeenCalledWith('wsCurrencies.blocker.next.CURRENCY_DEFAULT_DELETE');
  });

  it('403 on write shows a toast', async () => {
    await render();
    for (const code of ['TENANT_WIDE_PERMISSION_REQUIRED', 'ACCESS_POLICY_BLOCKED']) {
      api.updateCurrency.mockRejectedValueOnce(new ApiError(403, code));
      await page['handleReactivate'](currency);
      expect(notify.error).toHaveBeenCalledWith(`wsCurrencies.errors.${code} message`);
    }
  });

  it('429 shows the rate text', async () => {
    await render();
    // Unknown scope keys fall through to the shared mapper.
    vi.mocked(TestBed.inject(TranslocoService).translate).mockImplementation((key, params) =>
      key === 'settings.errors.rateLimitedIn' ? `Retry in ${(params as Record<string, unknown>)['seconds']} s` : String(key));
    api.updateCurrency.mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['9'] }));
    await page['handleReactivate'](currency);
    expect(notify.error).toHaveBeenCalledWith('Retry in 9 s');
  });

  it('set-default completion reloads the table and default lookup', async () => {
    await render();
    api.listCurrencies.mockClear();
    api.getDefaultCurrency.mockClear();
    page['onDefaultConfirmed']();
    await render();
    expect(api.listCurrencies).toHaveBeenCalledTimes(1);
    expect(api.getDefaultCurrency).toHaveBeenCalledTimes(1);
  });

  it('modal save and not-found outputs reload the list and default', async () => {
    await render();
    for (const action of [() => page['onModalSaved'](), () => page['onModalNotFound']()]) {
      api.listCurrencies.mockClear();
      api.getDefaultCurrency.mockClear();
      action();
      await render();
      expect(api.listCurrencies).toHaveBeenCalledTimes(1);
      expect(api.getDefaultCurrency).toHaveBeenCalledTimes(1);
    }
  });

  it('set-default not-found reloads without opening another modal', async () => {
    await render();
    const blocker = vi.spyOn(page['blockerModal'](), 'open');
    api.listCurrencies.mockClear();
    page['onSetDefaultBlocked']({ currency, error: new ApiError(404, 'CURRENCY_NOT_FOUND') });
    await render();
    expect(api.listCurrencies).toHaveBeenCalledTimes(1);
    expect(blocker).not.toHaveBeenCalled();
  });

  it('no read permission sends no list or default request', async () => {
    me.set({ ...owner, permissions: [] });
    await render();
    expect(api.listCurrencies).not.toHaveBeenCalled();
    expect(api.getDefaultCurrency).not.toHaveBeenCalled();
    expect(page['loadForbidden']()).toBe(true);
  });
});
