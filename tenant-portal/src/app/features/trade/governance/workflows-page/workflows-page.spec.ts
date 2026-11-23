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
import arWorkflows from '../../../../../../public/i18n/trade-gov-workflows/ar.json';
import enWorkflows from '../../../../../../public/i18n/trade-gov-workflows/en.json';
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
import { ACTIVE_WORKFLOW_KINDS, WORKFLOW_KINDS } from '../policy.registry';
import { WorkflowsPage } from './workflows-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, tradeShared: enShared, workflows: enWorkflows },
  ar: { ...arGlobal, governance: arGovernance, tradeShared: arShared, workflows: arWorkflows },
  'trade-governance/en': enGovernance,
  'trade-governance/ar': arGovernance,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
  'trade-gov-workflows/en': enWorkflows,
  'trade-gov-workflows/ar': arWorkflows,
};

@Injectable()
class WorkflowsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeWireMetadata(): WirePolicyMetadata {
  return {
    registryVersion: '2026.11.1',
    facts: {},
    operatorsByType: {},
    outcomes: ['ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'SELECT'],
    workflowActions: ['SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW', 'CONFIRM', 'CANCEL', 'HOLD', 'RELEASE', 'RETRY'],
    kinds: {
      policies: [],
      workflows: [
        { kind: 'PURCHASE_ORDER', supported: true },
        { kind: 'QUOTATION', supported: false },
        { kind: 'SALES_ORDER', supported: false },
        { kind: 'PRICE_PUBLICATION', supported: false },
        { kind: 'CONFIGURATION_PUBLICATION', supported: false },
      ],
    },
    factsByKind: {},
    purchaseOrderWorkflowShape: { states: ['PENDING'], initialState: 'PENDING', terminalStates: [], transitions: [] },
    codePatterns: { definition: '^[A-Z]+$', rule: '^[A-Z]+$', state: '^[A-Z]+$', reason: '^[A-Z]+$' },
  };
}

function makeWorkflowDef(id: string, code: string, workflowKind: string): GovernedDefinition {
  return {
    id,
    code,
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
    workflowKind,
    versions: [],
  };
}

async function flush(fixture: ComponentFixture<WorkflowsPage>): Promise<void> {
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`WorkflowsPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<WorkflowsPage>;
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
          'GET /workflows': {
            items: [
              makeWorkflowDef('wf-1', 'PO_DEFAULT', 'PURCHASE_ORDER'),
              makeWorkflowDef('wf-2', 'PRICE_PUB', 'PRICE_PUBLICATION'),
              makeWorkflowDef('wf-3', 'CFG_PUB', 'CONFIGURATION_PUBLICATION'),
            ],
            total: 3,
            page: 1,
            limit: 100,
          },
          'GET /policy-studio/metadata': makeWireMetadata(),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [WorkflowsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: WorkflowsTranslocoLoader,
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

      it('renders rows of backend workflow kinds (G-5) and restricts create modal to PURCHASE_ORDER (q5)', async () => {
        expect(WORKFLOW_KINDS).toEqual([
          'PURCHASE_ORDER',
          'QUOTATION',
          'SALES_ORDER',
          'PRICE_PUBLICATION',
          'CONFIGURATION_PUBLICATION',
        ]);
        expect(ACTIVE_WORKFLOW_KINDS).toEqual(['PURCHASE_ORDER']);

        fixture = TestBed.createComponent(WorkflowsPage);
        await flush(fixture);

        const host = fixture.nativeElement as HTMLElement;
        const text = host.textContent ?? '';
        expect(text).toContain('PO_DEFAULT');
        expect(text).toContain('PRICE_PUB');
        expect(text).toContain('CFG_PUB');
        expect(text).toContain(TRANSLATIONS[lang]['workflows']['kinds']['PRICE_PUBLICATION']['name']);
        expect(text).toContain(TRANSLATIONS[lang]['workflows']['kinds']['CONFIGURATION_PUBLICATION']['name']);

        const kindInput = host.querySelector('#wf-create-kind') as HTMLInputElement | null;
        expect(kindInput?.value).toBe(TRANSLATIONS[lang]['workflows']['kinds']['PURCHASE_ORDER']['name']);
      });

      it('renders forbidden state without error toast on 403 server response', async () => {
        stub.register('GET', '/workflows', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        fixture = TestBed.createComponent(WorkflowsPage);
        await flush(fixture);

        const state = fixture.debugElement.query(By.directive(FullState));
        expect(state).not.toBeNull();
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
}
