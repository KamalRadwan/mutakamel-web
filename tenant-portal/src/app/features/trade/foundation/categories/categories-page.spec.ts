import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeCategories from '../../../../../../public/i18n/trade-categories/en.json';
import arTradeCategories from '../../../../../../public/i18n/trade-categories/ar.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { StatusCounts } from '../../shared/trade-foundation.model';
import { CategoriesPage } from './categories-page';
import { CategoryModal } from './category-modal/category-modal';
import type {
  CategoryDeleteReceipt,
  CategoryDetail,
  CategoryPage,
  CategoryReceipt,
  CategorySummary,
  CategoryTreePage,
} from './categories.model';

const ROOT_ID = '01900000-0000-7000-8000-000000000001';
const REASON_ID = '01900000-0000-7000-8000-000000000099';
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
class CategoriesTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('trade-shared/')) return of(arabic ? arTradeShared : enTradeShared);
    if (path.startsWith('trade-categories/')) return of(arabic ? arTradeCategories : enTradeCategories);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

function makeRoot(overrides: Partial<CategorySummary> = {}): CategorySummary {
  return {
    id: ROOT_ID,
    code: 'ELEC',
    displayName: 'Electronics',
    name: 'Electronics',
    parentId: null,
    sortOrder: 1024,
    status: 'ACTIVE',
    version: 1,
    effectiveActive: true,
    inactiveAncestorId: null,
    depth: 1,
    childCount: 0,
    hasChildren: false,
    path: [
      {
        id: ROOT_ID,
        code: 'ELEC',
        name: 'Electronics',
        siblingPosition: 1,
        siblingTotal: 1,
      },
    ],
    ...overrides,
  };
}

function makeDetail(root: CategorySummary): CategoryDetail {
  return {
    ...root,
    localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
    treeVersion: 5,
    subtreeHeight: 1,
    createdAt: '2026-11-23T09:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    usage: {
      directItemCount: 0,
      subtreeItemCount: 0,
      descendantCount: 0,
      hasRetainedItemReferences: false,
      canDelete: root.status === 'INACTIVE' && !root.hasChildren,
      deleteBlockers: root.status === 'ACTIVE' ? ['ACTIVE'] : [],
      asOf: '2026-11-23T10:00:00.000Z',
    },
  };
}

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`CategoriesPage (${language} ${theme})`, () => {
      let fixture: ComponentFixture<CategoriesPage>;
      let page: CategoriesPage;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let rootNode: CategorySummary;
      let rootDetail: CategoryDetail;
      let treePage: CategoryTreePage;
      let counts: StatusCounts<'ACTIVE' | 'INACTIVE'>;
      const dialogPrototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogPrototype['showModal'],
        close: dialogPrototype['close'],
      };
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);

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

        rootNode = makeRoot();
        rootDetail = makeDetail(rootNode);
        treePage = {
          items: [rootNode],
          total: 1,
          page: 1,
          limit: 100,
          treeVersion: 5,
          asOf: '2026-11-23T10:00:00.000Z',
          parentId: null,
        };
        counts = { ACTIVE: 1, INACTIVE: 0, total: 1 };
        const emptySearchPage: CategoryPage = {
          items: [rootNode],
          total: 1,
          page: 1,
          limit: 100,
          treeVersion: 5,
          asOf: '2026-11-23T10:00:00.000Z',
        };
        const receipt: CategoryReceipt = {
          id: ROOT_ID,
          version: 2,
          treeVersion: 6,
          changed: true,
        };
        const deleteReceipt: CategoryDeleteReceipt = {
          id: ROOT_ID,
          deleted: true,
          version: 2,
          treeVersion: 6,
          deletedAt: '2026-11-23T12:00:00.000Z',
        };

        stub = new TradeHttpStub({
          'GET /categories/tree': treePage,
          'GET /categories/status-counts': counts,
          'GET /categories': emptySearchPage,
          'GET /categories/:id': rootDetail,
          'POST /categories/search': emptySearchPage,
          'POST /categories': receipt,
          'PATCH /categories/:id': receipt,
          'POST /categories/:id/move': receipt,
          'POST /categories/:id/reorder': receipt,
          'POST /categories/:id/status': receipt,
          'POST /categories/:id/delete': deleteReceipt,
          'GET /reason-codes': { items: [] },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [CategoriesPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: CategoriesTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            { provide: LanguageState, useValue: { current: signal(language) } },
          ],
        });
        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(language === 'ar' ? ar : en),
            settings: language === 'ar' ? arSettings : enSettings,
            tradeShared: language === 'ar' ? arTradeShared : enTradeShared,
            tradeCategories: language === 'ar' ? arTradeCategories : enTradeCategories,
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

      function setPermissions(opts: { manage: boolean; tenantWideManage?: boolean }) {
        const permissions = ['trade.items.read'];
        const permissionScopes: TenantMe['permissionScopes'] = {
          'trade.items.read': { tenantWide: true, companyIds: [], branchIds: [] },
        };
        if (opts.manage) {
          permissions.push('trade.catalog_master.manage');
          permissionScopes['trade.catalog_master.manage'] = {
            tenantWide: opts.tenantWideManage ?? true,
            companyIds: [],
            branchIds: opts.tenantWideManage === false ? ['branch-a'] : [],
          };
        }
        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes,
        });
      }

      async function render(opts: { manage?: boolean; tenantWideManage?: boolean } = {}) {
        setPermissions({ manage: opts.manage ?? true, tenantWideManage: opts.tenantWideManage ?? true });
        fixture = TestBed.createComponent(CategoriesPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
      }

      async function stable() {
        await vi.waitFor(() => expect(page['service'].initialLoading()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      function fullState() {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      }

      function categoryModal() {
        return fixture.debugElement.query(By.directive(CategoryModal))?.componentInstance as CategoryModal | undefined;
      }

      it('loads tree and counts with NONE scope and shows manage controls when tenant-wide manage is granted', async () => {
        await render({ manage: true });
        expect(page['canManage']()).toBe(true);
        expect(page['forbidden']()).toBe(false);
        expect(stub.recordedReads()).toEqual([
          { path: '/categories/tree', query: { page: 1, limit: 100 }, scope: undefined },
          { path: '/categories/status-counts', query: undefined, scope: undefined },
        ]);

        const newLabel = TestBed.inject(TranslocoService).translate('tradeCategories.toolbar.new');
        const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
        expect(buttons.some((b) => b.textContent?.includes(newLabel))).toBe(true);
        expect(fixture.nativeElement.querySelector('[data-drag-handle]')).not.toBeNull();
        expect(page['actionsForNode']()(rootNode).map((item) => item.id)).toContain('delete');
      });

      it('hides manage controls without tenantWide(trade.catalog_master.manage) and keeps modal read-only with hints', async () => {
        await render({ manage: false });
        expect(page['canManage']()).toBe(false);

        const newLabel = TestBed.inject(TranslocoService).translate('tradeCategories.toolbar.new');
        const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
        expect(buttons.some((b) => b.textContent?.includes(newLabel))).toBe(false);
        expect(fixture.nativeElement.querySelector('[data-drag-handle]')).toBeNull();
        expect(page['actionsForNode']()(rootNode).map((item) => item.id)).toEqual(['open']);

        page['openCreateRoot']();
        await page['onTreeReorder']({ id: ROOT_ID, parentId: null, beforeId: null });
        expect(stub.recordedWrites()).toHaveLength(0);

        await page['onNodeAction']({ node: rootNode, action: 'open' });
        const modal = categoryModal()!;
        await vi.waitFor(() => expect(modal['loadingDetail']()).toBe(false));
        fixture.detectChanges();

        const modalEl = fixture.nativeElement.querySelector('app-category-modal') as HTMLElement;
        const firstInput = modalEl.querySelector('input[type="text"]') as HTMLInputElement;
        expect(firstInput.readOnly).toBe(true);
        const saveLabel = TestBed.inject(TranslocoService).translate('tradeShared.common.save');
        const modalButtons = Array.from(modalEl.querySelectorAll('button')) as HTMLButtonElement[];
        expect(modalButtons.some((b) => b.textContent?.trim() === saveLabel)).toBe(false);

        for (const field of modalEl.querySelectorAll('ui-field')) {
          expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
          const control = field.querySelector('input');
          if (control) {
            for (const id of control.getAttribute('aria-describedby')?.split(' ') ?? []) {
              expect(document.getElementById(id)).not.toBeNull();
            }
          }
        }

        setPermissions({ manage: true, tenantWideManage: false });
        fixture.detectChanges();
        expect(page['canManage']()).toBe(false);
      });

      it('renders forbidden FullState on server 403 initial load without an error toast', async () => {
        stub.register('GET', '/categories/tree', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const toastError = vi.spyOn(TestBed.inject(Notify), 'error');
        await render({ manage: true });

        expect(page['forbidden']()).toBe(true);
        expect(page['service'].loadFailed()).toBe(false);
        expect(fullState()?.kind()).toBe('forbidden');
        expect(fullState()?.title()).toBe(TestBed.inject(TranslocoService).translate('errors.forbidden.title'));
        expect(toastError).not.toHaveBeenCalled();

        const navSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fullState()?.action.emit();
        expect(navSpy).toHaveBeenCalledWith('/');
      });

      it('renders forbidden FullState on server 403 search without an error toast', async () => {
        await render({ manage: true });
        stub.register('POST', '/categories/search', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const toastError = vi.spyOn(TestBed.inject(Notify), 'error');

        page['debouncedSearch'].set('elec');
        fixture.detectChanges();
        await vi.waitFor(() => expect(page['forbidden']()).toBe(true));
        fixture.detectChanges();

        expect(fullState()?.kind()).toBe('forbidden');
        expect(toastError).not.toHaveBeenCalled();
      });

      it('sends reasonCodeId without deprecated reason (F-12) and opens conflict modal on 409', async () => {
        await render({ manage: true });

        await page['onNodeAction']({ node: rootNode, action: 'deactivate' });
        await page['onReasonConfirmed']({ reasonCodeId: REASON_ID, reasonNote: 'End of season' });

        const statusWrite = stub.recordedWrites().find((w) => w.path === `/categories/${ROOT_ID}/status`);
        expect(statusWrite).toBeDefined();
        expect(statusWrite?.body).toEqual({
          expectedTreeVersion: 5,
          status: 'INACTIVE',
          reasonCodeId: REASON_ID,
          reasonNote: 'End of season',
        });
        expect('reason' in (statusWrite?.body as Record<string, unknown>)).toBe(false);
        expect(statusWrite?.ifMatch).toBe('"1"');
        expect(statusWrite?.scope).toBeUndefined();
        expect(statusWrite?.key).toMatch(UUID_V7_REGEX);

        const inactiveNode = makeRoot({ status: 'INACTIVE', effectiveActive: false });
        stub.register('GET', '/categories/:id', makeDetail(inactiveNode));
        await page['onNodeAction']({ node: inactiveNode, action: 'delete' });
        await page['onReasonConfirmed']({ reasonCodeId: REASON_ID });

        const deleteWrite = stub.recordedWrites().find((w) => w.path === `/categories/${ROOT_ID}/delete`);
        expect(deleteWrite).toBeDefined();
        expect(deleteWrite?.body).toEqual({
          expectedTreeVersion: 6,
          reasonCodeId: REASON_ID,
        });
        expect('reason' in (deleteWrite?.body as Record<string, unknown>)).toBe(false);
        expect(deleteWrite?.ifMatch).toBe('"1"');
        expect(deleteWrite?.scope).toBeUndefined();

        stub.register(
          'POST',
          '/categories/:id/reorder',
          new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['tree'] }),
        );
        await page['executeReorder'](ROOT_ID, null, null, 1, 6);
        expect(page['conflictTextKey']()).toBe('tradeCategories.conflict.tree');
      });

      it('maps 400 TRADE.VALIDATION_FAILED field details to the modal controls without a toast', async () => {
        await render({ manage: true });
        page['openCreateRoot']();
        const modal = categoryModal()!;
        modal['form'].set({
          code: 'ELEC',
          displayName: 'Electronics',
          nameEn: 'Electronics',
          nameAr: 'إلكترونيات',
        });
        stub.register(
          'POST',
          '/categories',
          new ApiError(400, 'TRADE.VALIDATION_FAILED', {
            code: ['Invalid code format'],
            displayName: ['Invalid display name'],
          }),
        );
        const toastError = vi.spyOn(TestBed.inject(Notify), 'error');

        await modal['save']();
        fixture.detectChanges();

        expect(modal['errorText']('code')).toBe('Invalid code format');
        expect(modal['errorText']('displayName')).toBe('Invalid display name');
        expect(toastError).not.toHaveBeenCalled();
      });
    });
  }
