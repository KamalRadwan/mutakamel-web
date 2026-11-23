import { Injectable, type WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
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
import type { GovernedRow } from '../governance-shared/governed-versions-table/governed-versions-table';
import type { PriceBookDossier } from '../pricing.model';
import { PriceBookPage } from './price-book-page';

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
class BookTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeDossier(): PriceBookDossier {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  return {
    book: {
      id: 'pb-1',
      companyId: 'c1',
      code: 'RETAIL-EGP',
      purpose: 'SALES',
      currencyCode: 'EGP',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      name: 'Retail',
      localizedNames: { en: 'Retail', ar: 'التجزئة' },
      description: null,
      isCompanyDefault: false,
    },
    companyDefaultMapping: null,
    versions: [
      {
        id: 'pv-1',
        versionNumber: 1,
        status: 'SCHEDULED',
        effectiveFrom: future,
        effectiveTo: null,
        supersededAt: null,
        supersededByVersionId: null,
        version: 2,
        checksum: 'chk-1',
        createdByUserId: null,
        createdByDisplayName: null,
        createdByEmail: null,
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
        entryCount: 4,
        promotionCount: 0,
        latestTestPassed: true,
        latestTestedAt: '2026-11-20T01:00:00.000Z',
        notes: null,
        clonedFromVersionId: null,
        sourceMode: 'MANUAL',
      },
    ],
    linkedAccounts: [],
    activeLocksCount: 0,
    auditTrail: [
      {
        id: 'aud-1',
        resourceType: 'PRICE_BOOK',
        resourceId: 'pb-1',
        action: 'CREATE',
        actorUserId: null,
        actorDisplayName: null,
        reason: null,
        occurredAt: '2026-11-20T00:00:00.000Z',
      },
    ],
  };
}

async function flush(harness: RouterTestingHarness): Promise<void> {
  harness.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  harness.detectChanges();
  await Promise.resolve();
  harness.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`PriceBookPage (${lang} ${theme})`, () => {
      let stub: TradeHttpStub;
      let dispose: () => void;
      let harness: RouterTestingHarness;
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
          id: 'user-1',
          isTenantOwner: false,
          permissions: keys,
          permissionScopes,
          accessibleCompanies: ['c1'],
          accessibleBranches: ['b1'],
          accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
        });
      }

      beforeEach(async () => {
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
        setGrants(['trade.pricing.read', 'trade.pricing.manage', 'trade.policy.publish']);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        stub = new TradeHttpStub({
          'GET /price-books/:id': makeDossier(),
          'GET /pricing/reference-data': { branches: [], currencies: [] },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [PriceBookPage],
          providers: [
            provideRouter([
              { path: '', children: [] },
              { path: 'trade/governance/price-books/:id', component: PriceBookPage },
            ]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: BookTranslocoLoader,
            }),
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'], showScopeSwitcher: signal(false) } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });
        TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS[lang], lang);
        harness = await RouterTestingHarness.create();
      });

      afterEach(() => {
        harness?.fixture.destroy();
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

      it('loads dossier, wires B5 awaitingActivation, handles null creator (P-4), and gates retire on trade.policy.publish', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/price-books/pb-1',
          PriceBookPage,
        )) as unknown as {
          versionRows(): GovernedRow[];
          retryLoad(): void;
        };
        await flush(harness);

        const rows = page.versionRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].awaitingActivation).toBe(true);
        expect(rows[0].byPrimary).toBe('—');
        expect(rows[0].actions?.some((a) => a.key === 'retire')).toBe(true);

        // Without trade.policy.publish, retire action must not be offered even if manage is granted
        setGrants(['trade.pricing.read', 'trade.pricing.manage']);
        await flush(harness);
        expect(page.versionRows()[0].actions?.some((a) => a.key === 'retire')).toBe(false);
      });

      it.each(['/price-books/:id', '/pricing/reference-data'])('renders ui-full-state forbidden without error toast on 403 from %s', async (path) => {
        stub.register('GET', path, new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await harness.navigateByUrl('/trade/governance/price-books/pb-1', PriceBookPage);
        await flush(harness);

        expect(notify.error).not.toHaveBeenCalled();
        const fullState = harness.fixture.debugElement.query(By.directive(FullState));
        expect(fullState).toBeTruthy();
        expect(fullState.componentInstance.kind()).toBe('forbidden');
      });
    });
  }
}
