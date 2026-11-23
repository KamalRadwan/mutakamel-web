import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { CurrenciesApi } from '../currencies.api';
import { isValidRateText, type Currency } from '../currencies.model';
import { CurrencyModal } from './currency-modal';

const currency: Currency = { id: '01970000-0000-7000-8000-000000000001', code: 'USD', name: 'Dollar',
  symbol: '$', decimalPlaces: 2, isDefault: false, exchangeRate: '2.00000000', status: 'ACTIVE', createdAt: '', updatedAt: '' };

describe('CurrencyModal', () => {
  const api = { createCurrency: vi.fn(), updateCurrency: vi.fn(), listCurrencyCatalogue: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn() };
  let fixture: ComponentFixture<CurrencyModal>;
  let modal: CurrencyModal;
  let close: ReturnType<typeof vi.spyOn>;
  const messages: Record<string, string> = {
    'wsCurrencies.validation.unsupportedCode': 'This code is not supported',
    'wsCurrencies.errors.CURRENCY_CODE_TAKEN': 'Currency already exists',
    'wsCurrencies.errors.CURRENCY_EXCHANGE_RATE_REQUIRED': 'Set an exchange rate',
    'wsCurrencies.errors.CURRENCY_REBASE_OUT_OF_RANGE': 'Rebase out of range',
    'wsCurrencies.errors.CURRENCY_REBASE_PRECISION_LOSS': 'Rebase loses precision',
    'wsCurrencies.errors.notSaved': 'Not saved. Try again',
    'settings.errors.idempotency': 'Still processing',
    'settings.errors.idempotencyMismatch': 'Earlier body differs',
    'wsCurrencies.errors.CURRENCY_NOT_FOUND': 'Currency no longer exists',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listCurrencyCatalogue.mockResolvedValue([]);
    api.createCurrency.mockResolvedValue(currency);
    api.updateCurrency.mockResolvedValue(currency);
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: CurrenciesApi, useValue: api }, { provide: Notify, useValue: notify },
      { provide: AuthSession, useValue: { me: signal({ isTenantOwner: true, permissions: [], permissionScopes: {} }) } },
      { provide: LanguageState, useValue: { current: signal('en') } },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key) => messages[String(key)] ?? String(key));
    fixture = TestBed.createComponent(CurrencyModal);
    modal = fixture.componentInstance;
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('hasCurrencies', false);
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
    modal['codeDraft'].set('USD');
    modal['nameDraft'].set('Dollar');
  }

  it('create succeeds and reloads', async () => {
    const saved = vi.fn();
    modal.saved.subscribe(saved);
    create();
    await modal['save']();
    expect(api.createCurrency).toHaveBeenCalledWith({ code: 'USD', name: 'Dollar', isDefault: true }, expect.any(String));
    expect(saved).toHaveBeenCalledWith(currency);
    expect(close).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalled();
  });

  it('validation errors map to fields', async () => {
    create();
    api.createCurrency.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED', {
      name: ['Name rejected'], symbol: ['Symbol rejected'], exchangeRate: ['Rate rejected'], code: ['Code rejected'],
    }));
    await modal['save']();
    await render();
    for (const text of ['Name rejected', 'Symbol rejected', 'Rate rejected', 'Code rejected']) {
      expect(fixture.nativeElement.textContent).toContain(text);
    }
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('server-unsupported code is a field message', async () => {
    create();
    api.createCurrency.mockRejectedValue(new ApiError(422, 'CURRENCY_CODE_INVALID'));
    await modal['save']();
    await render();
    expect(modal['codeError']()).toBe('This code is not supported');
    expect(fixture.nativeElement.textContent).toContain('This code is not supported');
    expect(close).not.toHaveBeenCalled();
  });

  it('rate 422 codes map to the rate field', async () => {
    create();
    for (const code of ['CURRENCY_EXCHANGE_RATE_REQUIRED', 'CURRENCY_REBASE_OUT_OF_RANGE', 'CURRENCY_REBASE_PRECISION_LOSS']) {
      api.createCurrency.mockRejectedValueOnce(new ApiError(422, code));
      await modal['save']();
      expect(modal['rateError']()).toBe(messages[`wsCurrencies.errors.${code}`]);
    }
    expect(close).not.toHaveBeenCalled();
  });

  it('code taken is a field message', async () => {
    create();
    api.createCurrency.mockRejectedValue(new ApiError(409, 'CURRENCY_CODE_TAKEN'));
    await modal['save']();
    expect(modal['codeError']()).toBe('Currency already exists');
  });

  it('401 on create keeps the form', async () => {
    create();
    api.createCurrency.mockRejectedValueOnce(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await modal['save']();
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    expect(modal['codeDraft']()).toBe('USD');
    expect(modal['nameDraft']()).toBe('Dollar');
    expect(close).not.toHaveBeenCalled();
    await modal['save']();
    expect(api.createCurrency.mock.calls[1]).toEqual(api.createCurrency.mock.calls[0]);
  });

  it('idempotency codes use the core mapper', async () => {
    create();
    for (const [status, code, message] of [[409, 'GW.IDEM.IN_FLIGHT', 'Still processing'], [422, 'GW.IDEM.MISMATCH', 'Earlier body differs']] as const) {
      api.createCurrency.mockRejectedValueOnce(new ApiError(status, code));
      await modal['save']();
      expect(notify.error).toHaveBeenCalledWith(message);
    }
    expect(api.createCurrency.mock.calls[1]).toEqual(api.createCurrency.mock.calls[0]);
    expect(close).not.toHaveBeenCalled();
  });

  it('update succeeds', async () => {
    modal.openEdit(currency);
    modal['nameDraft'].set('US dollar');
    const saved = vi.fn();
    modal.saved.subscribe(saved);
    await modal['save']();
    expect(api.updateCurrency).toHaveBeenCalledWith(currency.id, { name: 'US dollar' }, expect.any(String));
    expect(saved).toHaveBeenCalledWith(currency);
    expect(close).toHaveBeenCalled();
  });

  it('clearing the symbol sends an empty string', async () => {
    modal.openEdit(currency);
    modal['symbolDraft'].set('');
    await modal['save']();
    expect(api.updateCurrency).toHaveBeenCalledWith(currency.id, { symbol: '' }, expect.any(String));
    modal.openEdit({ ...currency, symbol: null });
    expect(modal['symbolDraft']()).toBe('');
    expect(modal['dirty']()).toBe(false);
  });

  it('symbols retain whitespace because the DTO does not trim them', async () => {
    modal.openEdit({ ...currency, symbol: ' $ ' });
    expect(modal['dirty']()).toBe(false);
    modal['symbolDraft'].set(' USD ');
    await modal['save']();
    expect(api.updateCurrency).toHaveBeenCalledWith(currency.id, { symbol: ' USD ' }, expect.any(String));
  });

  it('rate up to 1e10 is accepted', async () => {
    for (const rate of ['1000000000.00000001', '9999999999.99999999', '10000000000']) {
      modal.openEdit(currency);
      modal['rateDraft'].set(rate);
      expect(modal['isValid']()).toBe(true);
      await modal['save']();
      expect(api.updateCurrency).toHaveBeenLastCalledWith(currency.id, { exchangeRate: Number(rate) }, expect.any(String));
    }
    expect(isValidRateText('10000000000.00000001')).toBe(false);
    expect(isValidRateText('1.123456789')).toBe(false);
    expect(isValidRateText('0')).toBe(false);
  });

  it('404 on update reloads', async () => {
    const notFound = vi.fn();
    modal.notFound.subscribe(notFound);
    modal.openEdit(currency);
    modal['nameDraft'].set('Changed');
    api.updateCurrency.mockRejectedValue(new ApiError(404, 'CURRENCY_NOT_FOUND'));
    await modal['save']();
    expect(notify.error).toHaveBeenCalledWith('Currency no longer exists');
    expect(notFound).toHaveBeenCalledWith(currency.id);
    expect(close).toHaveBeenCalled();
  });

  it('a changed body gets a new key while an unchanged retry keeps its key', async () => {
    create();
    api.createCurrency.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await modal['save']();
    await modal['save']();
    expect(api.createCurrency.mock.calls[1][1]).toBe(api.createCurrency.mock.calls[0][1]);
    modal['nameDraft'].set('Changed');
    await modal['save']();
    expect(api.createCurrency.mock.calls[2][1]).not.toBe(api.createCurrency.mock.calls[0][1]);
  });

  it('every field keeps its hint linked and numeric inputs stay LTR', async () => {
    create();
    await render();
    const fields: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('ui-field input');
    for (const field of fields) expect(field.getAttribute('aria-describedby')).toContain(`${field.id}-hint`);
    expect(fixture.nativeElement.querySelector('input[id$="-rate"]').dir).toBe('ltr');
    expect(fixture.nativeElement.querySelector('input[id$="-decimals"]').dir).toBe('ltr');
  });
});
