import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeSettings from '../../../../../../public/i18n/trade-settings/ar.json';
import enTradeSettings from '../../../../../../public/i18n/trade-settings/en.json';
import arTerms from '../../../../../../public/i18n/trade-settings-terms/ar.json';
import enTerms from '../../../../../../public/i18n/trade-settings-terms/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { TermCounts, TermPage, TradeTerm } from '../../shared/terms/terms.model';
import { TermsPage } from './terms-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, settings: enSettings, tradeShared: enTradeShared, tset: enTradeSettings, tterms: enTerms },
  ar: { ...ar, settings: arSettings, tradeShared: arTradeShared, tset: arTradeSettings, tterms: arTerms },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-settings/en': enTradeSettings,
  'trade-settings/ar': arTradeSettings,
  'trade-settings-terms/en': enTerms,
  'trade-settings-terms/ar': arTerms,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

function makeTerm(over: Partial<TradeTerm> = {}): TradeTerm {
  return {
    id: '019a0000-0000-7000-8000-000000000010',
    termType: 'PAYMENT',
    side: 'SALES',
    code: 'NET30',
    displayName: 'Net 30',
    localizedNames: { en: 'Net 30', ar: 'صافي 30 يومًا' },
    localizedTexts: { en: 'Pay in 30 days', ar: 'الدفع خلال 30 يومًا' },
    dueDays: 30,
    incotermCode: null,
    isDefault: false,
    isActive: true,
    sortOrder: 10,
    version: 1,
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...over,
  };
}

function emptyCounts(): TermCounts {
  return { total: 0, byType: { PAYMENT: 0, DELIVERY: 0, WARRANTY: 0, RETURNS: 0, GENERAL: 0 } };
}

function makeMe(keys: readonly string[]): TenantMe {
  const permissionScopes: TenantMe['permissionScopes'] = {};
  for (const key of keys) {
    permissionScopes[key] = { tenantWide: false, companyIds: ['c1'], branchIds: [] };
  }
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    accessibleCompanies: ['c1'],
    accessibleBranches: ['b1'],
    accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
    permissions: [...keys],
    permissionScopes,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`TermsPage (${lang} ${theme})`, () => {
      const me = signal<TenantMe | null>(null);
      let stub: TradeHttpStub;
      let restoreHttp: () => void;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;

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
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        me.set(makeMe(['trade.terms.read', 'trade.terms.manage']));
        stub = new TradeHttpStub({
          'GET /terms/counts': { total: 1, byType: { PAYMENT: 1, DELIVERY: 0, WARRANTY: 0, RETURNS: 0, GENERAL: 0 } },
          'GET /terms': { items: [makeTerm()], total: 1, page: 1, limit: 25 } satisfies TermPage,
        });
        restoreHttp = bindTradeHttpForTest(stub);
      });

      afterEach(() => {
        TestBed.resetTestingModule();
        restoreHttp();
        vi.restoreAllMocks();
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      async function render(options: { missingCompany?: boolean } = {}): Promise<ComponentFixture<TermsPage>> {
        const providers: unknown[] = [
          provideRouter([]),
          provideTransloco({
            config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
            loader: TestTranslocoLoader,
          }),
          { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'] } },
          { provide: LanguageState, useValue: { current: signal(lang) } },
        ];
        if (options.missingCompany) {
          providers.push({
            provide: ScopeState,
            useValue: {
              company: signal(undefined),
              branch: signal(undefined),
              companies: signal([]),
              branches: signal([]),
            },
          });
        }
        TestBed.configureTestingModule({ providers: providers as never[] });
        const transloco = TestBed.inject(TranslocoService);
        transloco.setActiveLang(lang);
        const fixture = TestBed.createComponent(TermsPage);
        fixture.detectChanges();
        await vi.waitFor(() => expect(fixture.componentInstance['loading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
      }

      it('loads terms with read + manage grants and keeps field hint icons', async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain(t.translate('tterms.new'));
        expect(el.textContent).toContain('NET30');
        expect(el.querySelectorAll('button[data-ui-hint]').length).toBeGreaterThanOrEqual(2);
        expect(stub.recordedReads().map((r) => r.path)).toEqual(['/terms/counts', '/terms']);
      });

      it('shows designed empty state when catalogue is empty', async () => {
        stub.register('GET', '/terms/counts', emptyCounts());
        stub.register('GET', '/terms', { items: [], total: 0, page: 1, limit: 25 } satisfies TermPage);

        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('ui-full-state')).toBeNull();
        expect(el.querySelectorAll('[role="row"]').length).toBeGreaterThanOrEqual(2);
      });

      it('hides create and edit controls when trade.terms.manage is absent', async () => {
        me.set(makeMe(['trade.terms.read']));
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(Array.from(el.querySelectorAll('button')).filter(
          (button) => button.textContent?.trim() === t.translate('tterms.new'),
        )).toHaveLength(0);
        const actions = fixture.componentInstance['rowActions'](makeTerm());
        expect(actions.map((a) => a.id)).toEqual(['open']);
      });

      it('shows forbidden state without issuing requests when trade.terms.read is absent', async () => {
        me.set(makeMe([]));
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const fullState = el.querySelector('ui-full-state');

        expect(fullState).not.toBeNull();
        expect(fullState?.getAttribute('kind')).toBe('forbidden');
        expect(stub.recordedReads()).toEqual([]);
      });

      it('renders forbidden state instead of an error toast when server returns 403', async () => {
        stub.register('GET', '/terms', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const fullState = el.querySelector('ui-full-state');

        expect(fullState?.getAttribute('kind')).toBe('forbidden');
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('shows choose-company state before any request when no company is in scope', async () => {
        const fixture = await render({ missingCompany: true });
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.querySelector('ui-full-state')).not.toBeNull();
        expect(el.textContent).toContain(t.translate('tterms.states.chooseCompanyTitle'));
        expect(stub.recordedReads()).toEqual([]);
      });

      it('opens conflict modal on 409 stale version during row makeDefault without error toast', async () => {
        const term = makeTerm({ id: 'term-409', version: 4 });
        stub.register('GET', '/terms', { items: [term], total: 1, page: 1, limit: 25 } satisfies TermPage);
        stub.register('POST', `/terms/${term.id}/make-default`, new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        const fixture = await render();
        await fixture.componentInstance['handleAction'](term, { id: 'makeDefault' });
        fixture.detectChanges();

        expect(notifyError).not.toHaveBeenCalled();
        const dialogs = (fixture.nativeElement as HTMLElement).querySelectorAll('dialog');
        expect(dialogs[1]?.hasAttribute('open')).toBe(true);
      });
    });
  }
}
