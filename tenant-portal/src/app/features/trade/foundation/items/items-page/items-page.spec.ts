import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../../public/i18n/ar.json';
import en from '../../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import arItems from '../../../../../../../public/i18n/trade-items/ar.json';
import enItems from '../../../../../../../public/i18n/trade-items/en.json';
import arShared from '../../../../../../../public/i18n/trade-shared/ar.json';
import enShared from '../../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../../shared/trade-api';
import type { ItemRow, ItemStatus, StatusCounts, Uom } from '../../../shared/trade-foundation.model';
import { bindTradeHttpForTest, tradeQueries } from '../../../shared/trade-http';
import { TradeHttpStub } from '../../../shared/testing/trade-http-testing';
import { ItemsPage } from './items-page';

@Injectable()
class ItemsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('trade-shared/')) return of(arabic ? arShared : enShared);
    if (path.startsWith('trade-items/')) return of(arabic ? arItems : enItems);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

function makeUom(): Uom {
  return {
    id: '01900000-0000-7000-8000-000000000010',
    code: 'PCS',
    displayName: 'Piece',
    localizedNames: { en: 'Piece', ar: 'قطعة' },
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
  };
}

function makeItemRow(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    canonicalCode: 'STEEL-01',
    itemKind: 'PRODUCT',
    status: 'ACTIVE',
    localizedNames: { en: 'Steel shelf', ar: 'رف فولاذي' },
    baseUomId: '01900000-0000-7000-8000-000000000010',
    categoryId: null,
    barcode: null,
    ownerUserId: null,
    weightKg: null,
    volumeM3: null,
    notes: null,
    quotationDescription: null,
    salesOrderDescription: null,
    receiptDescription: null,
    deliveryOrderDescription: null,
    variantIdentity: null,
    currentImageId: null,
    image: null,
    categorySummary: null,
    eligibility: null,
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    createdBy: 'usr-1',
    updatedBy: 'usr-1',
    ...overrides,
  };
}

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`ItemsPage (${language} ${theme})`, () => {
      let fixture: ComponentFixture<ItemsPage>;
      let page: ItemsPage;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let notify: {
        success: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        warning: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
      };
      const dialogPrototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogPrototype['showModal'],
        close: dialogPrototype['close'],
      };
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);
      const selection = signal<{ companyId: string; branchId: string | null } | null>({
        companyId: 'c1',
        branchId: 'b1',
      });

      function setPermissions(opts: { read?: boolean; manage?: boolean; manageTenantWide?: boolean } = {}): void {
        const { read = true, manage = true, manageTenantWide = true } = opts;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.items.read');
          permissionScopes['trade.items.read'] = { tenantWide: true, companyIds: [], branchIds: [] };
        }
        if (manage) {
          permissions.push('trade.catalog_master.manage');
          permissionScopes['trade.catalog_master.manage'] = manageTenantWide
            ? { tenantWide: true, companyIds: [], branchIds: [] }
            : { tenantWide: false, companyIds: ['c1'], branchIds: ['b1'] };
        }

        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes,
        });
      }

      async function render(opts: { read?: boolean; manage?: boolean; manageTenantWide?: boolean; view?: string } = {}) {
        setPermissions(opts);
        fixture = TestBed.createComponent(ItemsPage);
        page = fixture.componentInstance;
        if (opts.view) {
          fixture.componentRef.setInput('view', opts.view);
        }
        fixture.detectChanges();
        await vi.waitFor(() => {
          fixture.detectChanges();
          if (opts.view && opts.view !== 'board' && opts.read !== false) {
            expect(page['listLoading']()).toBe(false);
          }
        });
        await fixture.whenStable();
        fixture.detectChanges();
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
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
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        };
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        const row = makeItemRow();
        const counts: StatusCounts<ItemStatus> = {
          DRAFT: 0,
          ACTIVE: 1,
          INACTIVE: 0,
          DISCONTINUED: 0,
          total: 1,
        };
        stub = new TradeHttpStub({
          'GET /uoms': { items: [makeUom()], total: 1, page: 1, limit: 100 },
          'GET /catalog/categories': { items: [] },
          'GET /items/status-counts': counts,
          'GET /items': { items: [row], total: 1, page: 1, limit: 24 },
        });
        dispose = bindTradeHttpForTest(stub);
        notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

        TestBed.configureTestingModule({
          imports: [ItemsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: ItemsTranslocoLoader,
            }),
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { me, selection, branchesFor: () => ['b1'] } },
            { provide: LanguageState, useValue: { current: signal(language) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(language === 'ar' ? ar : en),
            settings: language === 'ar' ? arSettings : enSettings,
            tradeShared: language === 'ar' ? arShared : enShared,
            tradeItems: language === 'ar' ? arItems : enItems,
          },
          language,
        );
      });

      afterEach(() => {
        fixture?.destroy();
        dialogPrototype['showModal'] = originalDialog.showModal;
        dialogPrototype['close'] = originalDialog.close;
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
      });

      it('loads items and status counts in table view with OPTIONAL scope and renders without raw keys', async () => {
        await render({ view: 'table' });

        expect(page['visibleItems']()).toHaveLength(1);
        expect(
          stub.recordedReads().some((r) => r.path === '/items' && r.scope?.companyId === 'c1'),
        ).toBe(true);
        expect(
          stub.recordedReads().some((r) => r.path === '/items/status-counts' && r.scope?.companyId === 'c1'),
        ).toBe(true);

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('STEEL-01');
        expect(text).not.toContain('tradeItems.');
        expect(text).not.toContain('tradeShared.');
      });

      it('shows forbidden FullState and skips HTTP calls without trade.items.read', async () => {
        await render({ read: false, manage: false, view: 'table' });

        expect(page['canRead']()).toBe(false);
        expect(page['isForbidden']()).toBe(true);
        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
      });

      it('hides New item and disables manage actions without tenant-wide trade.catalog_master.manage', async () => {
        for (const perm of [
          { read: true, manage: false },
          { read: true, manage: true, manageTenantWide: false },
        ]) {
          await render({ ...perm, view: 'table' });
          expect(page['canRead']()).toBe(true);
          expect(page['canManage']()).toBe(false);

          const transloco = TestBed.inject(TranslocoService);
          const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).map((btn) =>
            (btn as HTMLButtonElement).textContent?.trim(),
          );
          expect(buttons).not.toContain(transloco.translate('tradeItems.toolbar.new'));
        }
      });

      it('shows forbidden FullState without error toast on server 403', async () => {
        stub.register('GET', '/items', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await render({ view: 'table' });

        expect(page['isForbidden']()).toBe(true);
        expect(fullState()?.kind()).toBe('forbidden');
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
