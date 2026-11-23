import { Injectable, type WritableSignal, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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
import type {
  GovernedDefinition,
  GovernedVersionDetail,
  PolicyContent,
  PolicyTestCase,
  WirePolicyMetadata,
} from '../policy.model';
import { PolicyTests } from '../policy-tests/policy-tests';
import { PolicyVersionPage } from './policy-version-page';

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
class PolicyVersionTranslocoLoader implements TranslocoLoader {
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
      policies: [{ kind: 'PURCHASE_APPROVAL', supported: true }],
      workflows: [],
    },
    factsByKind: { PURCHASE_APPROVAL: ['document.total', 'document.kind'] },
    purchaseOrderWorkflowShape: { states: ['PENDING'], initialState: 'PENDING', terminalStates: [], transitions: [] },
    codePatterns: { definition: '^[A-Z]+$', rule: '^[A-Z]+$', state: '^[A-Z]+$', reason: '^[A-Z]+$' },
  };
}

function makeDetail(status: GovernedVersionDetail['status'] = 'DRAFT'): GovernedVersionDetail<PolicyContent, PolicyTestCase> {
  return {
    id: 'pv-1',
    versionNumber: 1,
    version: 2,
    status,
    contentHash: 'h1',
    registryVersion: '2026.11.1',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    createdBy: 'other-user',
    submittedBy: null,
    approvedBy: null,
    approvedAt: null,
    restoredFromVersionId: null,
    content: {
      rules: [
        {
          code: 'HIGH_TOTAL',
          priority: 10,
          all: [{ fact: 'document.total', operator: 'GT', value: '5000' }],
          outcome: 'REQUIRE_APPROVAL',
          reasonCode: 'ABOVE_LIMIT',
        },
      ],
      defaultOutcome: 'ALLOW',
    },
    testCases: [
      {
        code: 'LARGE_PO',
        facts: { 'document.total': '6000' },
        expectedOutcome: 'REQUIRE_APPROVAL',
        expectedRuleCode: 'HIGH_TOTAL',
      },
    ],
    definition: { id: 'pol-1', code: 'PO_POLICY', kind: 'PURCHASE_APPROVAL', scopeTarget: 'COMPANY' },
    evidence: { validation: null, test: null },
    actions: [],
  };
}

function makeDef(): GovernedDefinition {
  return {
    id: 'pol-1',
    code: 'PO_POLICY',
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    branchId: null,
    companyScopeKey: 'c1',
    branchScopeKey: 'ALL',
    status: 'ACTIVE',
    version: 1,
    createdBy: 'other-user',
    updatedBy: 'other-user',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    policyKind: 'PURCHASE_APPROVAL',
    versions: [],
  };
}

async function flush(fixture: ComponentFixture<PolicyVersionPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`PolicyVersionPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<PolicyVersionPage>;
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
        setGrants(['trade.policy.read', 'trade.policy.manage', 'trade.policy.test']);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

        stub = new TradeHttpStub({
          'GET /policy-versions/pv-1': makeDetail('DRAFT'),
          'GET /policies/pol-1': makeDef(),
          'GET /policy-studio/metadata': makeWireMetadata(),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [PolicyVersionPage],
          providers: [
            provideRouter([]),
            {
              provide: ActivatedRoute,
              useValue: {
                paramMap: of(convertToParamMap({ id: 'pol-1', versionId: 'pv-1' })),
                snapshot: { paramMap: convertToParamMap({ id: 'pol-1', versionId: 'pv-1' }) },
              },
            },
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: PolicyVersionTranslocoLoader,
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

      it('gates validate/test actions on trade.policy.test and displays 422 TRADE.POLICY.TEST_FAILED in tests panel', async () => {
        stub.register('POST', '/policy-versions/pv-1/test', new ApiError(422, 'TRADE.POLICY.TEST_FAILED'));
        fixture = TestBed.createComponent(PolicyVersionPage);
        await flush(fixture);

        const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
        const runTestsBtn = buttons.find((b) =>
          b.textContent?.includes(TRANSLATIONS[lang]['policy']['version']['runTests']),
        );
        expect(runTestsBtn).toBeTruthy();
        runTestsBtn!.click();
        await flush(fixture);

        const testsCmp = fixture.debugElement.query(By.directive(PolicyTests));
        expect(testsCmp).not.toBeNull();
        expect((testsCmp.componentInstance as PolicyTests).testError()).toBeTruthy();
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('hides validate and test buttons when trade.policy.test grant is absent', async () => {
        setGrants(['trade.policy.read', 'trade.policy.manage']);
        fixture = TestBed.createComponent(PolicyVersionPage);
        await flush(fixture);

        const buttonLabels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
          .map((button) => button.textContent?.trim());
        expect(buttonLabels).not.toContain(TRANSLATIONS[lang]['policy']['version']['runTests']);
        expect(buttonLabels).not.toContain(TRANSLATIONS[lang]['policy']['version']['validate']);
      });

      it('renders forbidden state without toast on 403', async () => {
        stub.register('GET', '/policy-versions/pv-1', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        fixture = TestBed.createComponent(PolicyVersionPage);
        await flush(fixture);

        const state = fixture.debugElement.query(By.directive(FullState));
        expect(state).not.toBeNull();
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
}
