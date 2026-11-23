import { Injectable, signal } from '@angular/core';
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
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { WireDecisionReceipt } from '../policy.model';
import { DecisionModal } from './decision-modal';

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
class DecisionTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

async function flush(fixture: ComponentFixture<DecisionModal>): Promise<void> {
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`DecisionModal (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<DecisionModal>;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

      beforeEach(() => {
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

        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        stub = new TradeHttpStub();
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [DecisionModal],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: DecisionTranslocoLoader,
            }),
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { me: signal(FAKE_TENANT_ME), selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'], showScopeSwitcher: signal(false) } },
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

      it('renders mapped G-1/G-2 receipt with every matched rule and policyVersions[] ref', async () => {
        const wire: WireDecisionReceipt = {
          id: 'dec-1',
          decisionType: 'PURCHASE_APPROVAL',
          scopeTarget: 'BRANCH',
          companyId: 'c1',
          branchId: 'b1',
          channelId: null,
          aggregateType: 'PURCHASE_ORDER',
          aggregateId: '0193a000-0000-7000-8000-000000000055',
          matchedRules: ['RULE_ALPHA', 'RULE_BETA'],
          result: {
            outcome: 'REQUIRE_APPROVAL',
            reasonCode: 'HIGH_TOTAL',
            explanationCode: 'RULE_MATCHED',
            selectedValue: 'FINANCE',
          },
          explanation: 'Order total exceeded threshold',
          policyVersions: [
            {
              type: 'POLICY',
              policyKind: 'PURCHASE_APPROVAL',
              definitionId: 'pol-1',
              definitionCode: 'PO_GUARD',
              id: 'pv-4',
              version: 4,
              contentHash: 'hash4',
              registryVersion: '2026.11.1',
            },
          ],
          evaluatedAt: '2026-11-23T10:00:00.000Z',
          correlationId: 'corr-1',
        };
        stub.register('GET', '/decisions/dec-1', wire);

        fixture = TestBed.createComponent(DecisionModal);
        const modal = fixture.componentInstance;
        const promise = modal.open('dec-1');
        await flush(fixture);
        await promise;
        await flush(fixture);

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('RULE_ALPHA');
        expect(text).toContain('RULE_BETA');
        expect(text).toContain('PO_GUARD');
        expect(text).toContain('4');
        const values = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'))
          .map((input) => input.value);
        expect(values).toContain('corr-1');
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('shows not-ready state without toast on 503 TRADE.POLICY.DECISION_UNAVAILABLE', async () => {
        stub.register('GET', '/decisions/dec-503', new ApiError(503, 'TRADE.POLICY.DECISION_UNAVAILABLE'));

        fixture = TestBed.createComponent(DecisionModal);
        await fixture.componentInstance.open('dec-503');
        await flush(fixture);

        const state = fixture.debugElement.query(By.directive(FullState));
        expect(state).not.toBeNull();
        expect((state.componentInstance as FullState).kind()).toBe('provisioning');
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('shows forbidden state without toast on 403', async () => {
        stub.register('GET', '/decisions/dec-403', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        fixture = TestBed.createComponent(DecisionModal);
        await fixture.componentInstance.open('dec-403');
        await flush(fixture);

        const state = fixture.debugElement.query(By.directive(FullState));
        expect(state).not.toBeNull();
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
}
