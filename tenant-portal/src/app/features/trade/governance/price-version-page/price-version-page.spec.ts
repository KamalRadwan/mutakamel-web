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
import arPricing from '../../../../../../public/i18n/trade-gov-pricing/ar.json';
import enPricing from '../../../../../../public/i18n/trade-gov-pricing/en.json';
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
import { ReasonDialog } from '../governance-shared/reason-dialog/reason-dialog';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import type { PriceLineRow } from '../price-lines-table/price-lines-table';
import type {
  ChangeEntriesResult,
  PriceEntry,
  PriceVersionDetailHead,
  PriceVersionHeadDetail,
  PriceVersionRow,
} from '../pricing.model';
import { PriceVersionPage } from './price-version-page';
import { PublishPriceDialog } from '../publish-price-dialog/publish-price-dialog';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, tradeShared: enShared, pricing: enPricing },
  ar: { ...arGlobal, governance: arGovernance, tradeShared: arShared, pricing: arPricing },
  'trade-governance/en': enGovernance,
  'trade-governance/ar': arGovernance,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
  'trade-gov-pricing/en': enPricing,
  'trade-gov-pricing/ar': arPricing,
};

@Injectable()
class PricingTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

interface PriceVersionView {
  loading(): boolean;
  forbidden(): boolean;
  canRead(): boolean;
  canManage(): boolean;
  canPublish(): boolean;
  canViewCost(): boolean;
  awaitingActivation(): boolean;
  detail(): { version: PriceVersionDetailHead } | null;
  serverEntries(): readonly PriceEntry[];
  onEntryChange(row: PriceLineRow): void;
  save(): Promise<boolean>;
  openRetireDialog(): void;
  onRetireConfirmed(result: { reasonCode: string; reasonNote?: string }): Promise<void>;
}

function makeHeadDetail(overrides: Partial<PriceVersionHeadDetail> = {}): PriceVersionHeadDetail {
  const versionHead: PriceVersionDetailHead = {
    id: 'pv-1',
    versionNumber: 1,
    status: 'DRAFT',
    effectiveFrom: '2026-12-01T10:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 3,
    checksum: 'chk-1',
    createdByUserId: 'user-maker',
    createdByDisplayName: null,
    createdByEmail: null,
    notes: null,
    clonedFromVersionId: null,
    sourceMode: 'MANUAL',
    ...(overrides.versionHead ?? {}),
  };

  return {
    canViewCost: false,
    entryCount: 1,
    soloOwnerGovernanceEligible: false,
    book: {
      id: 'pb-1',
      code: 'RETAIL-EGP',
      purpose: 'SALES',
      currencyCode: 'EGP',
      status: 'ACTIVE',
      version: 2,
      name: 'Retail',
      localizedNames: { en: 'Retail', ar: 'التجزئة' },
      description: null,
      versions: [versionHead],
    },
    versionHead,
    version: versionHead.version,
    promotions: [],
    latestTestEvidence: null,
    auditTrail: [],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<PriceEntry> = {}): PriceEntry {
  return {
    id: 'pe-1',
    version: 1,
    itemCompanyProfileId: 'icp-1',
    itemId: 'item-1',
    itemCode: 'SUGAR-1',
    itemLocalizedNames: { en: 'Sugar', ar: 'سكر' },
    uomId: 'uom-1',
    uomCode: 'KG',
    uomDisplayName: 'Kilogram',
    uomLocalizedNames: { en: 'Kilogram', ar: 'كيلوجرام' },
    currencyCode: 'EGP',
    minimumQuantity: '1',
    maximumQuantity: null,
    unitPrice: '25.000',
    minimumAllowedPrice: '20.000',
    priority: 100,
    standardCost: '15.000',
    catalogSalesPrice: '25.000',
    ...overrides,
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
    describe(`PriceVersionPage (${lang} ${theme})`, () => {
      let stub: TradeHttpStub;
      let dispose: () => void;
      let harness: RouterTestingHarness;
      let notify: {
        success: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        warning: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
      };
      let me: WritableSignal<TenantMe | null>;
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
          id: 'user-reviewer',
          isTenantOwner: false,
          permissions: keys,
          permissionScopes,
          accessibleCompanies: ['c1'],
          accessibleBranches: ['b1'],
          accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
        });
      }

      beforeEach(async () => {
        Element.prototype.scrollIntoView = () => undefined;
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
          'GET /price-book-versions/:id': makeHeadDetail(),
          'GET /price-book-versions/:id/entries': {
            items: [makeEntry()],
            total: 1,
            page: 1,
            limit: 50,
          },
          'GET /pricing/reference-data': {
            canViewCost: false,
            items: [],
            uoms: [],
            branches: [{ id: 'b1', code: 'HQ', name: 'Main Branch', isHeadquarters: true }],
            channels: [],
            commercialAccounts: [],
            currencies: [{ code: 'EGP', name: 'EGP', symbol: 'E£', decimalPlaces: 2, isDefault: true }],
          },
          'GET /uoms': { items: [], total: 0, page: 1, limit: 100 },
          'GET /channels': { items: [] },
          'GET /commercial-accounts': { items: [], total: 0, page: 1, limit: 20 },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [PriceVersionPage],
          providers: [
            provideRouter([
              { path: '', children: [] },
              { path: 'trade/governance/price-books/:id', children: [] },
              {
                path: 'trade/governance/price-books/:id/versions/:versionId',
                component: PriceVersionPage,
              },
            ]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true },
              loader: PricingTranslocoLoader,
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

      it('drives canViewCost from reference-data (P-2) and renders null joined labels without crashing (P-1)', async () => {
        stub.register('GET', '/price-book-versions/:id/entries', {
          items: [
            {
              ...makeEntry(),
              itemCode: null as unknown as string,
              itemLocalizedNames: null as unknown as Record<string, string>,
              uomCode: null as unknown as string,
              uomLocalizedNames: null as unknown as Record<string, string>,
            },
          ],
          total: 1,
          page: 1,
          limit: 50,
        });

        const page = (await harness.navigateByUrl(
          '/trade/governance/price-books/pb-1/versions/pv-1',
          PriceVersionPage,
        )) as unknown as PriceVersionView;
        await flush(harness);

        expect(page.canViewCost()).toBe(false);
        const headersHidden = Array.from(
          (harness.fixture.nativeElement as HTMLElement).querySelectorAll('[role="columnheader"]'),
        ).map((el) => el.textContent?.trim());
        expect(headersHidden).not.toContain(TRANSLATIONS[lang]['pricing']['lines']['columns']['standardCost']);
        expect(page.serverEntries()).toHaveLength(1);
        expect(page.serverEntries()[0].itemCode).toBeNull();

        // Re-register with canViewCost: true and reload
        stub.register('GET', '/pricing/reference-data', {
          canViewCost: true,
          branches: [],
          currencies: [{ code: 'EGP', name: 'EGP', decimalPlaces: 2 }],
        });
        await (page as unknown as { retryLoad(): Promise<void> }).retryLoad();
        await flush(harness);
        expect(page.canViewCost()).toBe(true);
      });

      it('enforces 4,000 op save limit (B2), sends batch entries/changes with If-Match, and opens conflict on 409', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/price-books/pb-1/versions/pv-1',
          PriceVersionPage,
        )) as unknown as PriceVersionView;
        await flush(harness);

        // B2: 4001 pending ops hits the warning limit
        for (let i = 0; i < 4001; i += 1) {
          page.onEntryChange({ ...makeEntry({ id: `temp-${i}` }), unitPrice: '10' });
        }
        expect(await page.save()).toBe(false);
        expect(notify.warning).toHaveBeenCalledWith(TRANSLATIONS[lang]['pricing']['toasts']['tooManyChanges']);
        expect(stub.recordedWrites()).toHaveLength(0);

        // Fresh page for single-batch save + 409
        const row = makeEntry();
        const savedBatch: ChangeEntriesResult = {
          id: 'pv-1',
          status: 'DRAFT',
          checksum: 'chk-2',
          version: 4,
          entryCount: 1,
          promotionCount: 0,
          changedEntryIds: ['pe-1'],
        };
        stub.register('POST', '/price-book-versions/:id/entries/changes', savedBatch);

        const page2 = page;
        (page2 as unknown as { undoChanges(): void }).undoChanges();
        page2.onEntryChange({ ...row, unitPrice: '30.000' });
        expect(await page2.save()).toBe(true);

        const writes = stub.recordedWrites();
        expect(writes).toHaveLength(1);
        expect(writes[0].method).toBe('POST');
        expect(writes[0].path).toBe('/price-book-versions/pv-1/entries/changes');
        expect(writes[0].ifMatch).toBe('"3"');
        expect(writes[0].key).toMatch(UUID_V7_REGEX);

        // 409 conflict triggers ConflictDialog without error toast
        stub.register(
          'POST',
          '/price-book-versions/:id/entries/changes',
          new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'),
        );
        page2.onEntryChange({ ...row, unitPrice: '31.000' });
        expect(await page2.save()).toBe(false);
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('submits a large entries delta once and preserves it when the server rejects it', async () => {
        const page = (await harness.navigateByUrl(
          '/trade/governance/price-books/pb-1/versions/pv-1',
          PriceVersionPage,
        )) as unknown as PriceVersionView;
        await flush(harness);
        for (let i = 0; i < 1001; i += 1) {
          page.onEntryChange(makeEntry({ id: `temp-${i}` }));
        }
        stub.register('POST', '/price-book-versions/:id/entries/changes',
          new ApiError(400, 'TRADE.VALIDATION_FAILED', { upserts: ['array_max_size'] }));
        expect(await page.save()).toBe(false);
        expect(stub.recordedWrites()).toHaveLength(1);
        expect((stub.recordedWrites()[0].body as { upserts: unknown[] }).upserts).toHaveLength(1001);
        expect(stub.recordedWrites()[0].ifMatch).toBe('"3"');
      });

      it('wires B5 awaitingActivation on future SCHEDULED version and gates retire on trade.policy.publish', async () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        stub.register(
          'GET',
          '/price-book-versions/:id',
          makeHeadDetail({
            versionHead: {
              ...makeHeadDetail().versionHead,
              status: 'SCHEDULED',
              effectiveFrom: future,
            },
          }),
        );

        const page = (await harness.navigateByUrl(
          '/trade/governance/price-books/pb-1/versions/pv-1',
          PriceVersionPage,
        )) as unknown as PriceVersionView;
        await flush(harness);

        expect(page.awaitingActivation()).toBe(true);
        const badge = harness.fixture.debugElement.query(By.directive(VersionStatusBadge)).componentInstance as VersionStatusBadge;
        expect(badge.awaitingActivation()).toBe(true);

        // Retire uses reasonCode + reasonNote (P-6)
        const retired: PriceVersionRow = {
          id: 'pv-1',
          priceBookId: 'pb-1',
          versionNumber: 1,
          status: 'RETIRED',
          effectiveFrom: future,
          effectiveTo: null,
          supersededByVersionId: null,
          supersededAt: null,
          checksum: 'chk',
          version: 4,
          createdBy: null,
          updatedBy: null,
          createdAt: '2026-11-23T00:00:00.000Z',
          updatedAt: '2026-11-23T00:00:00.000Z',
        };
        stub.register('POST', '/price-book-versions/:id/retire', retired);
        await page.onRetireConfirmed({ reasonCode: 'OBSOLETE', reasonNote: 'Replaced' });
        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'POST',
          path: '/price-book-versions/pv-1/retire',
          ifMatch: '"3"',
          body: { reasonCode: 'OBSOLETE', reasonNote: 'Replaced' },
        });
      });

      it('shows the page forbidden state when publishing is denied', async () => {
        await harness.navigateByUrl('/trade/governance/price-books/pb-1/versions/pv-1', PriceVersionPage);
        await flush(harness);
        stub.register('POST', '/price-book-versions/:id/publish', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const dialog = harness.fixture.debugElement.query(By.directive(PublishPriceDialog)).componentInstance as PublishPriceDialog;
        dialog.open();
        await (dialog as unknown as { submit(): Promise<void> }).submit();
        await flush(harness);
        expect(notify.error).not.toHaveBeenCalled();
        expect(harness.fixture.debugElement.query(By.directive(FullState)).componentInstance.kind()).toBe('forbidden');
      });

      it('is read-only when manage/publish keys are missing and renders ui-full-state forbidden on 403 without error toast', async () => {
        setGrants(['trade.pricing.read']);
        const page = (await harness.navigateByUrl(
          '/trade/governance/price-books/pb-1/versions/pv-1',
          PriceVersionPage,
        )) as unknown as PriceVersionView;
        await flush(harness);

        expect(page.canRead()).toBe(true);
        expect(page.canManage()).toBe(false);
        expect(page.canPublish()).toBe(false);

        const reasonDlg = harness.fixture.debugElement.query(By.directive(ReasonDialog));
        expect(reasonDlg).toBeTruthy();

        stub.register(
          'GET',
          '/price-book-versions/:id',
          new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'),
        );
        await (page as unknown as { retryLoad(): Promise<void> }).retryLoad();
        await flush(harness);

        expect(page.forbidden()).toBe(true);
        expect(notify.error).not.toHaveBeenCalled();
        const fullState = harness.fixture.debugElement.query(By.directive(FullState));
        expect(fullState).toBeTruthy();
        expect(fullState.componentInstance.kind()).toBe('forbidden');
      });
    });
  }
}
