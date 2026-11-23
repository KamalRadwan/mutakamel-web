import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arBulkJobs from '../../../../../../public/i18n/bulk-jobs/ar.json';
import enBulkJobs from '../../../../../../public/i18n/bulk-jobs/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeAccounts from '../../../../../../public/i18n/trade-accounts/ar.json';
import enTradeAccounts from '../../../../../../public/i18n/trade-accounts/en.json';
import arTradeAccountsBulk from '../../../../../../public/i18n/trade-accounts-bulk/ar.json';
import enTradeAccountsBulk from '../../../../../../public/i18n/trade-accounts-bulk/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import type { Page, ReasonCode } from '../../shared/trade-foundation.model';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { AccountCreditCheck } from './account-credit-check/account-credit-check';
import { AccountModal } from './account-modal/account-modal';
import { AccountsPage } from './accounts-page';
import type {
  AccountDetail,
  AccountStatusCounts,
  AccountWithParty,
  CreditDecision,
  CreditSummary,
} from './commercial-accounts.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    settings: enSettings,
    tradeShared: enTradeShared,
    tradeAccounts: enTradeAccounts,
    accountsBulk: enTradeAccountsBulk,
    bulkJobs: enBulkJobs,
  },
  ar: {
    ...ar,
    settings: arSettings,
    tradeShared: arTradeShared,
    tradeAccounts: arTradeAccounts,
    accountsBulk: arTradeAccountsBulk,
    bulkJobs: arBulkJobs,
  },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-accounts/en': enTradeAccounts,
  'trade-accounts/ar': arTradeAccounts,
  'trade-accounts-bulk/en': enTradeAccountsBulk,
  'trade-accounts-bulk/ar': arTradeAccountsBulk,
  'bulk-jobs/en': enBulkJobs,
  'bulk-jobs/ar': arBulkJobs,
};

@Injectable()
class AccountsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeAccount(overrides: Partial<AccountWithParty> = {}): AccountWithParty {
  return {
    id: '01900000-0000-7000-8000-0000000000a1',
    partyId: '01900000-0000-7000-8000-0000000000p1',
    companyId: 'c1',
    accountRole: 'CUSTOMER',
    paymentTermsId: null,
    creditLimit: '50000.00000000',
    creditCurrencyCode: 'EGP',
    priceBookId: 'pb-1',
    creditPolicyVersionId: null,
    terms: { allowedCurrencies: ['EGP', 'USD'] },
    status: 'ACTIVE',
    blockReasonCode: null,
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    party: {
      id: '01900000-0000-7000-8000-0000000000p1',
      displayName: 'Delta Trading Co.',
      displayNameAr: null,
      partyType: 'ORGANIZATION',
      code: null,
    },
    ...overrides,
  };
}

function makeReason(overrides: Partial<ReasonCode> = {}): ReasonCode {
  return {
    id: '01900000-0000-7000-8000-000000000rc1',
    kind: 'ACCOUNT_BLOCK',
    code: 'OVERDUE_BALANCE',
    localizedNames: { en: 'Overdue balance', ar: 'رصيد متأخر' },
    requiresNote: false,
    isActive: true,
    sortOrder: 10,
    isSystem: false,
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
    ...overrides,
  };
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

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`AccountsPage (${language} ${theme})`, () => {
      let fixture: ComponentFixture<AccountsPage>;
      let page: AccountsPage;
      let modal: AccountModal;
      let stub: TradeHttpStub;
      let coreStub: TradeCoreStub;
      let dispose: () => void;
      let rows: AccountWithParty[];
      const me = signal<TenantMe | null>(null);
      const dialogPrototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogPrototype['showModal'],
        close: dialogPrototype['close'],
      };

      function configureTestBed(): void {
        TestBed.configureTestingModule({
          imports: [AccountsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: AccountsTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            { provide: LanguageState, useValue: { current: signal(language) } },
            {
              provide: BulkJobsTracker,
              useValue: {
                finished: signal(null),
                jobs: signal([]),
                hasActive: () => false,
                syncExternalJob: () => {},
                submit: vi.fn(),
                openReport: vi.fn(),
              },
            },
          ],
        });
        TestBed.inject(TranslocoService).setActiveLang(language);
      }

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        dialogPrototype['showModal'] = function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        };
        dialogPrototype['close'] = function (this: HTMLDialogElement) {
          if (!this.hasAttribute('open')) return;
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        };
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        rows = [makeAccount()];
        const listPage: Page<AccountWithParty> = { items: rows, total: 1, page: 1, limit: 24 };
        const counts: AccountStatusCounts = {
          ACTIVE: 1,
          BLOCKED: 0,
          total: 1,
          byRole: { CUSTOMER: 1, SUPPLIER: 0 },
        };
        const detail: AccountDetail = { ...rows[0], branchRule: null };
        const summary: CreditSummary = {
          effectiveLimit: '50000',
          exposureAmount: '10000',
          openCommitments: '0',
          remainingAmount: '40000',
          currencyCode: 'EGP',
          orderingHold: false,
          asOf: '2026-11-23T09:59:00.000Z',
          stale: false,
        };

        stub = new TradeHttpStub({
          'GET /commercial-accounts': listPage,
          'GET /commercial-accounts/status-counts': counts,
          'GET /commercial-accounts/lookups': {
            creditPolicies: [],
            priceBooks: [
              {
                id: 'pb-1',
                code: 'RETAIL',
                name: 'Retail Price Book',
                purpose: 'SALES',
                currencyCode: 'EGP',
                status: 'ACTIVE',
              },
            ],
          },
          'GET /commercial-accounts/:id': detail,
          'GET /commercial-accounts/:id/branch-rules': { items: [] },
          'GET /commercial-accounts/:id/credit-summary': summary,
          'GET /reason-codes': { items: [makeReason()] },
        });
        coreStub = new TradeCoreStub({
          'GET /api/tenant/core/v1/directory/parties': {
            data: [
              {
                id: '01900000-0000-7000-8000-0000000000p2',
                displayName: 'Nile Logistics',
                partyType: 'ORGANIZATION',
                status: 'ACTIVE',
                branchId: null,
                roles: [{ roleType: 'CUSTOMER', status: 'ACTIVE' }],
              },
            ],
            meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
          },
        });
        dispose = bindTradeHttpForTest(stub, coreStub);
        me.set(
          makeMe([
            'trade.commercial_accounts.read',
            'trade.commercial_accounts.manage',
            'trade.credit.view',
          ]),
        );
        configureTestBed();
      });

      afterEach(() => {
        fixture?.destroy();
        TestBed.resetTestingModule();
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        if (originalDialog.showModal) dialogPrototype['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogPrototype, 'showModal');
        if (originalDialog.close) dialogPrototype['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogPrototype, 'close');
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
      });

      async function stable(): Promise<void> {
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      async function render(
        keys: readonly string[] = [
          'trade.commercial_accounts.read',
          'trade.commercial_accounts.manage',
          'trade.credit.view',
        ],
      ): Promise<void> {
        me.set(makeMe(keys));
        fixture = TestBed.createComponent(AccountsPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
        modal = fixture.debugElement.query(By.directive(AccountModal)).componentInstance;
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      }

      it('loads accounts, status counts, and lookups with OPTIONAL scope and renders without raw keys', async () => {
        await render();
        expect(page['accounts']()).toEqual(rows);
        const paths = stub.recordedReads().map((r) => r.path);
        expect(paths).toContain('/commercial-accounts');
        expect(paths).toContain('/commercial-accounts/status-counts');
        expect(paths).toContain('/commercial-accounts/lookups');
        expect(fixture.nativeElement.textContent).toContain('Delta Trading Co.');
        expect(fixture.nativeElement.textContent).toContain('Retail Price Book');
        expect(fixture.nativeElement.textContent).not.toContain('tradeAccounts.');
        expect(fixture.nativeElement.textContent).not.toContain('tradeShared.');
      });

      it('is read-only without trade.commercial_accounts.manage and hides credit check without trade.credit.view', async () => {
        await render(['trade.commercial_accounts.read']);
        expect(page['canRead']()).toBe(true);
        expect(page['canManage']()).toBe(false);
        expect(page['canViewCredit']()).toBe(false);

        const transloco = TestBed.inject(TranslocoService);
        const buttonTexts = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) =>
          (b as HTMLButtonElement).textContent?.trim(),
        );
        expect(buttonTexts).not.toContain(transloco.translate('tradeAccounts.toolbar.new'));
        expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();

        page['openCreate']();
        expect(modal['isOpen']()).toBe(false);

        modal.openEdit(rows[0].id);
        await vi.waitFor(() => expect(modal['loading']()).toBe(false));
        fixture.detectChanges();

        const modalEl = fixture.nativeElement.querySelector('app-account-modal') as HTMLElement;
        expect(modalEl.querySelector('app-account-credit-check')).toBeNull();
        expect(stub.recordedReads().some((r) => r.path.endsWith('/credit-summary'))).toBe(false);
        const footerBtns = Array.from(modalEl.querySelectorAll('dialog[open] [modal-footer] button')).map((b) =>
          (b as HTMLButtonElement).textContent?.trim(),
        );
        expect(footerBtns).not.toContain(transloco.translate('tradeShared.common.save'));
        expect(footerBtns).not.toContain(transloco.translate('tradeAccounts.actions.block'));
        expect(stub.recordedWrites()).toHaveLength(0);
      });

      it('renders forbidden full-state with no HTTP calls when trade.commercial_accounts.read is missing', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await render([]);
        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(coreStub.recordedReads()).toHaveLength(0);
        expect(errorToast).not.toHaveBeenCalled();
      });

      it('renders forbidden full-state without error toast when server returns 403 on read or block', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        stub.register('GET', '/commercial-accounts', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await render();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(page['loadFailed']()).toBe(false);
        expect(errorToast).not.toHaveBeenCalled();

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub.reset();
        stub.register('GET', '/commercial-accounts', { items: rows, total: 1, page: 1, limit: 24 });
        stub.register('POST', '/commercial-accounts/:id/block', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await render();
        const errorToast2 = vi.spyOn(TestBed.inject(Notify), 'error');
        page['statusTarget'].set(rows[0]);
        page['statusMode'].set('block');
        await page['onStatusConfirmed']({ reasonCodeId: '01900000-0000-7000-8000-000000000rc1' });
        fixture.detectChanges();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(errorToast2).not.toHaveBeenCalled();
      });

      it('shows picker hint on 403 from Core listParties without triggering page forbidden or error toast', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        coreStub.register('GET', '/api/tenant/core/v1/directory/parties', new ApiError(403, 'AUTH_FORBIDDEN'));
        await render();

        page['openCreate']();
        await vi.waitFor(() => expect(modal['partyPickerForbidden']()).toBe(true));
        fixture.detectChanges();

        expect(fullState()).toBeUndefined();
        const transloco = TestBed.inject(TranslocoService);
        const modalEl = fixture.nativeElement.querySelector('app-account-modal') as HTMLElement;
        expect(modalEl.textContent).toContain(transloco.translate('tradeAccounts.modal.partyDirectoryForbidden'));
        expect(errorToast).not.toHaveBeenCalled();
      });

      it('preserves hint icons, maps 400 validation details to matching field, and sends fresh key per evaluateCredit call', async () => {
        const decision: CreditDecision = {
          id: 'dec-1',
          explanation: 'Within limit.',
          evaluatedAt: '2026-11-23T10:00:00.000Z',
          matchedRules: ['CREDIT_WITHIN_LIMIT'],
          rejectedRules: [],
          result: {
            outcome: 'ALLOW',
            reasonCode: 'CREDIT_WITHIN_LIMIT',
            accountVersion: 1,
            branchRuleId: null,
            effectiveLimit: '50000',
            exposureAmount: '10000',
            openCommitments: '0',
            proposedAmount: '1000',
            remainingAmount: '40000',
            currencyCode: 'EGP',
            orderingHold: false,
            asOf: '2026-11-23T09:59:00.000Z',
          },
        };
        stub.register('POST', '/commercial-accounts/:id/evaluate-credit', decision);
        stub.register(
          'POST',
          '/commercial-accounts',
          new ApiError(400, 'TRADE.VALIDATION_FAILED', { creditLimit: ['limit invalid'] }),
        );

        await render();
        page['openCreate']();
        await vi.waitFor(() => expect(modal['parties']().length).toBeGreaterThan(0));
        fixture.detectChanges();

        const fields = fixture.nativeElement.querySelectorAll('app-account-modal ui-field');
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
        }

        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        modal['accountDraft'].update((d) => ({
          ...d,
          partyId: '01900000-0000-7000-8000-0000000000p2',
          creditLimit: '1000',
          creditCurrencyCode: 'EGP',
        }));
        await modal['save']();
        fixture.detectChanges();
        expect(modal['creditLimitError']()).toBe('limit invalid');
        expect(errorToast).not.toHaveBeenCalled();

        modal['forceClose']();
        fixture.detectChanges();

        modal.openEdit(rows[0].id);
        await vi.waitFor(() => expect(modal['loading']()).toBe(false));
        fixture.detectChanges();

        const creditCheck = fixture.debugElement.query(By.directive(AccountCreditCheck))
          .componentInstance as AccountCreditCheck;
        creditCheck['amount'].set('1000');
        await creditCheck['runCheck']();
        await creditCheck['runCheck']();

        const evalWrites = stub
          .recordedWrites()
          .filter((w) => w.path === `/commercial-accounts/${rows[0].id}/evaluate-credit`);
        expect(evalWrites).toHaveLength(2);
        expect(evalWrites[0].key).toMatch(UUID_V7_REGEX);
        expect(evalWrites[1].key).toMatch(UUID_V7_REGEX);
        expect(evalWrites[0].key).not.toBe(evalWrites[1].key);
      });
    });
  }
