import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState, type Language } from '../../../../../core/i18n/language';
import { currencyCompanyBlocker, type Currency } from '../currencies.model';
import { DeactivateBlockerModal } from './deactivate-blocker-modal';

describe('DeactivateBlockerModal', () => {
  const language = signal<Language>('en');
  let fixture: ComponentFixture<DeactivateBlockerModal>;
  let modal: DeactivateBlockerModal;

  beforeEach(() => {
    language.set('en');
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: LanguageState, useValue: { current: language } },
    ] });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, params) => {
      if (key === 'wsCurrencies.errors.CURRENCY_COMPANY_IN_USE') return 'Active companies still use this currency.';
      if (String(key).startsWith('wsCurrencies.blocker.more.')) return `and ${(params as Record<string, unknown>)['count']} more`;
      return String(key);
    });
    fixture = TestBed.createComponent(DeactivateBlockerModal);
    modal = fixture.componentInstance;
    fixture.detectChanges();
    vi.spyOn(modal['modal'](), 'open').mockImplementation(() => {});
  });

  async function show(error: ApiError) {
    modal.open('deactivate', { id: 'currency', name: 'Dollar', code: 'USD' } as Currency, error);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('company blocker lists names and links', async () => {
    const id = '01970000-0000-7000-8000-000000000001';
    await show(new ApiError(409, 'CURRENCY_COMPANY_IN_USE', { companyIds: [id, 'company-2'], companyNames: ['First company', 'Second company'], more: ['3'] }));
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(Array.from(links, (link) => link.textContent)).toEqual(['First company', 'Second company']);
    expect(links[0].getAttribute('href')).toBe(`/workspace/staff/companies?open=${id}`);
    expect(fixture.nativeElement.textContent).toContain('and 3 more');
  });

  it('company blocker without details', async () => {
    await show(new ApiError(409, 'CURRENCY_COMPANY_IN_USE'));
    expect(fixture.nativeElement.textContent).toContain('Active companies still use this currency.');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('wsCurrencies.blocker.next.CURRENCY_COMPANY_IN_USE');
  });

  it('company remainder selects Arabic plural forms', async () => {
    language.set('ar');
    const translate = vi.mocked(TestBed.inject(TranslocoService).translate);
    for (const [count, category] of [[1, 'one'], [2, 'two'], [3, 'few'], [11, 'many'], [100, 'other']] as const) {
      await show(new ApiError(409, 'CURRENCY_COMPANY_IN_USE', { companyIds: ['company'], companyNames: ['Company'], more: [String(count)] }));
      expect(translate.mock.calls.some((args) => args[0] === `wsCurrencies.blocker.more.${category}`)).toBe(true);
    }
  });

  it('malformed details preserve company pair positions and ignore invalid counts', () => {
    expect(currencyCompanyBlocker(new ApiError(409, 'CURRENCY_COMPANY_IN_USE', {
      companyIds: ['one', 2, 'three'], companyNames: ['First', 'Second', 'Third'], more: ['invalid'],
    }))).toEqual({ companies: [{ id: 'one', name: 'First' }, { id: 'three', name: 'Third' }], more: 0 });
  });
});
