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
import arEval from '../../../../../../public/i18n/trade-gov-price-eval/ar.json';
import enEval from '../../../../../../public/i18n/trade-gov-price-eval/en.json';
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
import { PRICING_ENGINE_VERSION, type PricingDecision } from '../pricing.model';
import { PriceEvaluationPage } from './price-evaluation-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, tradeShared: enShared, priceEval: enEval },
  ar: { ...arGlobal, governance: arGovernance, tradeShared: arShared, priceEval: arEval },
  'trade-governance/en': enGovernance,
  'trade-governance/ar': arGovernance,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
  'trade-gov-price-eval/en': enEval,
  'trade-gov-price-eval/ar': arEval,
};

@Injectable()
class EvalTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

async function flush(fixture: ComponentFixture<PriceEvaluationPage>): Promise<void> {
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`PriceEvaluationPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<PriceEvaluationPage>;
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

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        localStorage.clear();
        sessionStorage.clear();
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        me = signal<TenantMe | null>(null);
        setGrants(['trade.pricing.read', 'trade.pricing.manage']);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

        const decision: PricingDecision = {
          priceBookSource: 'COMPANY_DEFAULT',
          engineVersion: PRICING_ENGINE_VERSION,
          decisionId: 'dec-1',
          decisionType: 'SALES_PRICE',
          outcome: 'ALLOW',
          unitPrice: '42.000',
          currencyCode: 'EGP',
          priceBookId: 'pb-1',
          priceBookVersionId: 'pv-1',
          priceBookVersion: 1,
          checksum: 'chk-1',
          matchedEntryId: 'e-1',
          baselineUnitPrice: '42.000',
          minimumAllowedPrice: null,
          matchedPromotions: [],
          rejectedPromotions: [],
          components: [{ kind: 'BASE_PRICE', referenceId: 'e-1', amount: '42.000' }],
          rejectedCandidates: [],
          inputFingerprint: 'fp-1',
          evaluatedAt: '2026-11-23T10:00:00.000Z',
          taxFinal: false,
        };

        stub = new TradeHttpStub({
          'GET /pricing/reference-data': {
            canViewCost: false,
            branches: [{ id: 'b1', code: 'HQ', name: 'Main Branch', isHeadquarters: true }],
            currencies: [{ code: 'EGP', name: 'EGP', symbol: 'E£', decimalPlaces: 2, isDefault: true }],
          },
          'GET /price-books': { items: [], total: 0, page: 1, limit: 100 },
          'GET /channels': [],
          'POST /pricing/evaluate': decision,
          'GET /price-book-versions/:id': {
            canViewCost: false,
            entryCount: 0,
            soloOwnerGovernanceEligible: false,
            book: {
              id: 'pb-1',
              code: 'PB-1',
              purpose: 'SALES',
              currencyCode: 'EGP',
              status: 'ACTIVE',
              version: 1,
              name: 'Default',
              localizedNames: { en: 'Default' },
              description: null,
              versions: [],
            },
            versionHead: {
              id: 'pv-1',
              versionNumber: 1,
              status: 'PUBLISHED',
              effectiveFrom: '2026-11-01T00:00:00.000Z',
              effectiveTo: null,
              supersededAt: null,
              supersededByVersionId: null,
              version: 1,
              checksum: 'chk',
              createdByUserId: null,
              createdByDisplayName: null,
              createdByEmail: null,
              notes: null,
              clonedFromVersionId: null,
              sourceMode: 'MANUAL',
            },
            version: 1,
            promotions: [],
            latestTestEvidence: null,
            auditTrail: [],
          },
          'GET /price-book-versions/:id/entries': { items: [], total: 0, page: 1, limit: 200 },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [PriceEvaluationPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: EvalTranslocoLoader,
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
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('evaluates via a single POST /pricing/evaluate call, keeps branches from normalized reference-data, and transitions to forbidden on 403', async () => {
        fixture = TestBed.createComponent(PriceEvaluationPage);
        await flush(fixture);

        const comp = fixture.componentInstance as unknown as {
          branchOptions(): { value: string; label: string }[];
          onItemChange(id: string | null): void;
          onUomChange(id: string): void;
          calculate(): Promise<void>;
          answerDecision(): PricingDecision | null;
          forbidden(): boolean;
        };
        expect(comp.branchOptions().some((b) => b.value === 'b1')).toBe(true);

        comp.onItemChange('item-1');
        comp.onUomChange('uom-1');
        await flush(fixture);
        await comp.calculate();
        await flush(fixture);

        expect(comp.answerDecision()?.unitPrice).toBe('42.000');
        expect(stub.recordedWrites().filter((w) => w.path === '/pricing/evaluate')).toHaveLength(1);

        stub.register('POST', '/pricing/evaluate', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await comp.calculate();
        await flush(fixture);

        expect(comp.forbidden()).toBe(true);
        expect(notify.error).not.toHaveBeenCalled();
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).toBeTruthy();
        expect(fullState.componentInstance.kind()).toBe('forbidden');
      });
    });
  }
}
