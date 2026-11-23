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
import arPolicy from '../../../../../../public/i18n/trade-gov-policy/ar.json';
import enPolicy from '../../../../../../public/i18n/trade-gov-policy/en.json';
import arShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { GovernedDefinition, WirePolicyMetadata } from '../policy.model';
import { PolicyModal } from '../policy-modal/policy-modal';
import { PolicyStudioPage } from './policy-studio-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, tradeShared: enShared, policy: enPolicy },
  ar: { ...arGlobal, governance: arGovernance, tradeShared: arShared, policy: arPolicy },
  'trade-governance/en': enGovernance,
  'trade-governance/ar': arGovernance,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
  'trade-gov-policy/en': enPolicy,
  'trade-gov-policy/ar': arPolicy,
};

@Injectable()
class PolicyStudioTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeWireMetadata(): WirePolicyMetadata {
  return {
    registryVersion: '2026.11.1',
    facts: { 'document.total': 'decimal', 'document.kind': 'string' },
    operatorsByType: { decimal: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'], string: ['EQ', 'NEQ', 'IN', 'CONTAINS'] },
    outcomes: ['ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'SELECT'],
    workflowActions: ['SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW', 'CONFIRM', 'CANCEL', 'HOLD', 'RELEASE', 'RETRY'],
    kinds: {
      policies: [{ kind: 'PRICING_GUARD', supported: true }],
      workflows: [{ kind: 'PURCHASE_ORDER', supported: true }],
    },
    factsByKind: { PRICING_GUARD: ['document.total', 'document.kind'] },
    purchaseOrderWorkflowShape: { states: ['PENDING'], initialState: 'PENDING', terminalStates: [], transitions: [] },
    codePatterns: { definition: '^[A-Z]+$', rule: '^[A-Z]+$', state: '^[A-Z]+$', reason: '^[A-Z]+$' },
  };
}

function makePolicyDef(): GovernedDefinition {
  return {
    id: 'pol-1',
    code: 'DEFAULT_PRICING_GUARD',
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    branchId: null,
    companyScopeKey: 'c1',
    branchScopeKey: 'ALL',
    status: 'ACTIVE',
    version: 1,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    policyKind: 'PRICING_GUARD',
    versions: [],
  };
}

async function flush(fixture: ComponentFixture<PolicyStudioPage>): Promise<void> {
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`PolicyStudioPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<PolicyStudioPage>;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let me: WritableSignal<TenantMe | null>;
      let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

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
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        me = signal<TenantMe | null>(null);
        setGrants(['trade.policy.read', 'trade.policy.manage']);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

        stub = new TradeHttpStub({
          'GET /policies': { items: [makePolicyDef()], total: 1, page: 1, limit: 100 },
          'GET /policy-studio/metadata': makeWireMetadata(),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [PolicyStudioPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: PolicyStudioTranslocoLoader,
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
        TestBed.resetTestingModule();
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('loads policies with OPTIONAL scope and hides create action when trade.policy.manage is absent', async () => {
        setGrants(['trade.policy.read']);
        fixture = TestBed.createComponent(PolicyStudioPage);
        await flush(fixture);

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('DEFAULT_PRICING_GUARD');
        const createButton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
          .find((button) => button.textContent?.trim() === TRANSLATIONS[lang]['policy']['list']['newPolicy']);
        expect(createButton).toBeUndefined();
        expect(stub.recordedReads()[0]?.scope).toEqual({ companyId: 'c1', branchId: 'b1' });
      });

      it('renders forbidden state without error toast when trade.policy.read is missing', async () => {
        setGrants([]);
        fixture = TestBed.createComponent(PolicyStudioPage);
        await flush(fixture);

        const state = fixture.debugElement.query(By.directive(FullState));
        expect(state).not.toBeNull();
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('keeps credit out of creation even when metadata marks it supported', async () => {
        const metadata = makeWireMetadata();
        stub.register('GET', '/policy-studio/metadata', {
          ...metadata,
          kinds: { ...metadata.kinds, policies: [
            { kind: 'PRICING_GUARD', supported: true },
            { kind: 'CREDIT', supported: true },
          ] },
        });
        fixture = TestBed.createComponent(PolicyStudioPage);
        await flush(fixture);
        const modal = fixture.debugElement.query(By.directive(PolicyModal)).componentInstance as PolicyModal;
        expect(modal.kinds()).toEqual(['PRICING_GUARD']);
      });

      it('renders forbidden state without error toast on 403 server response', async () => {
        stub.register('GET', '/policies', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        fixture = TestBed.createComponent(PolicyStudioPage);
        await flush(fixture);

        const state = fixture.debugElement.query(By.directive(FullState));
        expect(state).not.toBeNull();
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
}
