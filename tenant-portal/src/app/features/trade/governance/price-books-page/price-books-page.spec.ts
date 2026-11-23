import { Injectable, type WritableSignal, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import arGlobal from '../../../../../../public/i18n/ar.json';
import enGlobal from '../../../../../../public/i18n/en.json';
import arGovernance from '../../../../../../public/i18n/trade-governance/ar.json';
import enGovernance from '../../../../../../public/i18n/trade-governance/en.json';
import arBooks from '../../../../../../public/i18n/trade-gov-price-books/ar.json';
import enBooks from '../../../../../../public/i18n/trade-gov-price-books/en.json';
import arShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import type { PriceBookKpis, PriceBookListItem } from '../pricing.model';
import { PriceBooksPage } from './price-books-page';
import { PriceBookModal } from '../price-book-modal/price-book-modal';
import { CompanyDefaultsModal } from '../company-defaults-modal/company-defaults-modal';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, tradeShared: enShared, priceBooks: enBooks },
  ar: { ...arGlobal, governance: arGovernance, tradeShared: arShared, priceBooks: arBooks },
  'trade-governance/en': enGovernance,
  'trade-governance/ar': arGovernance,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
  'trade-gov-price-books/en': enBooks,
  'trade-gov-price-books/ar': arBooks,
};

@Injectable()
class BooksTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeBook(): PriceBookListItem {
  return {
    id: 'pb-1',
    companyId: 'c1',
    code: 'RETAIL-EGP',
    purpose: 'SALES',
    currencyCode: 'EGP',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    name: 'Retail',
    localizedNames: { en: 'Retail', ar: 'التجزئة' },
    description: null,
    versionCount: 1,
    versions: [
      {
        id: 'pv-1',
        versionNumber: 1,
        status: 'PUBLISHED',
        effectiveFrom: '2026-11-01T00:00:00.000Z',
        effectiveTo: null,
        supersededAt: null,
        version: 1,
        createdByUserId: null,
      },
    ],
    isCompanyDefault: true,
    linkedAccountsCount: 2,
    entryCount: 10,
    promotionCount: 1,
  };
}

async function flush(fixture: ComponentFixture<PriceBooksPage>): Promise<void> {
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`PriceBooksPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<PriceBooksPage>;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let me: WritableSignal<TenantMe | null>;
      let notify: {
        success: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        warning: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
      };
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogProto['showModal'],
        close: dialogProto['close'],
      };

      function setGrants(keys: string[]): void {
        const permissionScopes: TenantMe['permissionScopes'] = {};
        for (const k of keys) {
          permissionScopes[k] = { tenantWide: true, companyIds: ['c1'], branchIds: [] };
        }
        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions: keys,
          permissionScopes,
          accessibleCompanies: ['c1'],
          accessibleBranches: ['b1'],
          accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
        });
      }

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        dialogProto['showModal'] = function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        };
        dialogProto['close'] = function (this: HTMLDialogElement) {
          if (!this.hasAttribute('open')) return;
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        };
        localStorage.clear();
        sessionStorage.clear();
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        me = signal<TenantMe | null>(null);
        setGrants(['trade.pricing.read', 'trade.pricing.manage', 'trade.configuration.manage']);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

        const kpis: PriceBookKpis = {
          total: 1,
          active: 1,
          inactive: 0,
          sales: 1,
          purchase: 0,
          publishedBooks: 1,
          scheduledBooks: 0,
          testedBooks: 0,
          draftOnlyBooks: 0,
          mappedDefaults: 1,
          distinctCurrencies: ['EGP'],
        };
        stub = new TradeHttpStub({
          'GET /price-books': { items: [makeBook()], total: 1, page: 1, limit: 24 },
          'GET /price-books/kpis': kpis,
          'GET /configuration/company-default-price-books': { items: [] },
          'GET /pricing/reference-data': { branches: [], currencies: [] },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [PriceBooksPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: BooksTranslocoLoader,
            }),
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'], showScopeSwitcher: signal(false) } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });
        TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS[lang], lang);
      });

      afterEach(() => {
        fixture?.destroy();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        localStorage.clear();
        sessionStorage.clear();
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('loads price books & KPIs, and hides create/defaults actions without manage/configuration keys', async () => {
        fixture = TestBed.createComponent(PriceBooksPage);
        await flush(fixture);

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('RETAIL-EGP');
        expect(text).toContain(TRANSLATIONS[lang]['priceBooks']['toolbar']['new']);
        expect(text).toContain(TRANSLATIONS[lang]['priceBooks']['toolbar']['companyDefaults']);

        setGrants(['trade.pricing.read']);
        await flush(fixture);

        // Closed dialog titles remain in the DOM; check the page's action buttons.
        const readOnlyText = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).filter((button) => !button.closest('dialog')).map((button) => button.textContent).join(' ');
        expect(readOnlyText).not.toContain(TRANSLATIONS[lang]['priceBooks']['toolbar']['new']);
        expect(readOnlyText).not.toContain(
          TRANSLATIONS[lang]['priceBooks']['toolbar']['companyDefaults'],
        );
      });

      it.each(['create', 'defaults'])('shows the page forbidden state when the %s modal is denied', async (kind) => {
        fixture = TestBed.createComponent(PriceBooksPage);
        await flush(fixture);
        if (kind === 'create') {
          stub.register('GET', '/pricing/reference-data', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
          await (fixture.debugElement.query(By.directive(PriceBookModal)).componentInstance as PriceBookModal).open();
        } else {
          stub.register('GET', '/configuration/company-default-price-books', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
          await (fixture.debugElement.query(By.directive(CompanyDefaultsModal)).componentInstance as CompanyDefaultsModal).open();
        }
        await flush(fixture);
        expect(notify.error).not.toHaveBeenCalled();
        expect(fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
      });

      it('renders ui-full-state forbidden without error toast on 403 or missing read grant', async () => {
        stub.register('GET', '/price-books', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        fixture = TestBed.createComponent(PriceBooksPage);
        await flush(fixture);

        expect(notify.error).not.toHaveBeenCalled();
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).toBeTruthy();
        expect(fullState.componentInstance.kind()).toBe('forbidden');
      });
    });
  }
}
