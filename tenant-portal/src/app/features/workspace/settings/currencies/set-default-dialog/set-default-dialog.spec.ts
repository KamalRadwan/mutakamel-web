import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { Notify } from '../../../../../core/notify/notify';
import { CurrenciesApi } from '../currencies.api';
import type { Currency } from '../currencies.model';
import { SetDefaultDialog } from './set-default-dialog';

const currency = { id: '01970000-0000-7000-8000-000000000001', code: 'USD', name: 'Dollar',
  isDefault: false, exchangeRate: '2.00000000', status: 'ACTIVE' } as Currency;

describe('SetDefaultDialog', () => {
  const api = { setDefaultCurrency: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn() };
  const me = signal({ isTenantOwner: true, permissions: [] });
  let fixture: ComponentFixture<SetDefaultDialog>;
  let dialog: SetDefaultDialog;

  beforeEach(() => {
    vi.clearAllMocks();
    me.set({ isTenantOwner: true, permissions: [] });
    api.setDefaultCurrency.mockResolvedValue({ ...currency, isDefault: true });
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: CurrenciesApi, useValue: api }, { provide: Notify, useValue: notify },
      { provide: AuthSession, useValue: { me } },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key) =>
      key === 'wsCurrencies.errors.CURRENCY_INACTIVE_DEFAULT' ? 'Reactivate this currency first' : String(key));
    fixture = TestBed.createComponent(SetDefaultDialog);
    dialog = fixture.componentInstance;
    fixture.detectChanges();
    vi.spyOn(dialog['modal'](), 'open').mockImplementation(() => {});
    vi.spyOn(dialog['modal'](), 'close').mockImplementation(() => {});
    dialog.open(currency, null);
  });

  it('inactive default is refused', async () => {
    api.setDefaultCurrency.mockRejectedValue(new ApiError(409, 'CURRENCY_INACTIVE_DEFAULT'));
    await dialog['confirm']();
    expect(notify.error).toHaveBeenCalledWith('Reactivate this currency first');
    expect(dialog['target']()).toEqual(currency);
    expect(dialog['modal']().close).not.toHaveBeenCalled();
  });

  it('set-default retry keeps its key and success emits the updated currency', async () => {
    const confirmed = vi.fn();
    dialog.confirmed.subscribe(confirmed);
    api.setDefaultCurrency.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await dialog['confirm']();
    dialog['close']();
    dialog.open(currency, null);
    await dialog['confirm']();
    expect(api.setDefaultCurrency.mock.calls[1]).toEqual(api.setDefaultCurrency.mock.calls[0]);
    expect(confirmed).toHaveBeenCalledWith({ ...currency, isDefault: true });
    dialog.open(currency, null);
    await dialog['confirm']();
    expect(api.setDefaultCurrency.mock.calls[2][1]).not.toBe(api.setDefaultCurrency.mock.calls[0][1]);
  });

  it('loss of permission prevents submission', async () => {
    me.set({ isTenantOwner: false, permissions: [] });
    await dialog['confirm']();
    expect(api.setDefaultCurrency).not.toHaveBeenCalled();
  });
});
