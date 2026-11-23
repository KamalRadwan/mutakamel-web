import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import arTradeUnits from '../../../../../../public/i18n/trade-units/ar.json';
import enTradeUnits from '../../../../../../public/i18n/trade-units/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import type { StatusCounts, Uom } from '../../shared/trade-foundation.model';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { UnitModal } from './unit-modal/unit-modal';
import type { UomListPage } from './units.model';
import { UnitsPage } from './units-page';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
class UnitsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('trade-shared/')) return of(arabic ? arTradeShared : enTradeShared);
    if (path.startsWith('trade-units/')) return of(arabic ? arTradeUnits : enTradeUnits);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

function makeUoms(): Uom[] {
  return [
    {
      id: '01900000-0000-7000-8000-000000000010',
      code: 'KG',
      displayName: 'Kilogram',
      localizedNames: { en: 'Kilogram', ar: 'كيلوجرام' },
      status: 'ACTIVE',
      version: 1,
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: '01900000-0000-7000-8000-000000000011',
      code: 'PCS',
      displayName: 'Piece',
      localizedNames: { en: 'Piece', ar: 'قطعة' },
      status: 'ACTIVE',
      version: 2,
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
  ];
}

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`UnitsPage (${language} ${theme})`, () => {
      let fixture: ComponentFixture<UnitsPage>;
      let page: UnitsPage;
      let modal: UnitModal;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let rows: Uom[];
      const dialogPrototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogPrototype['showModal'],
        close: dialogPrototype['close'],
      };
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);
      const selection = signal<{ companyId: string; branchId: string | null } | null>({
        companyId: 'company-a',
        branchId: 'branch-a',
      });

      function configureTestBed(): void {
        TestBed.configureTestingModule({
          imports: [UnitsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: UnitsTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me, selection } },
            { provide: LanguageState, useValue: { current: signal(language) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(language === 'ar' ? ar : en),
            settings: language === 'ar' ? arSettings : enSettings,
            tradeShared: language === 'ar' ? arTradeShared : enTradeShared,
            tradeUnits: language === 'ar' ? arTradeUnits : enTradeUnits,
          },
          language,
        );
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

        rows = makeUoms();
        const pageData: UomListPage = {
          items: rows,
          total: rows.length,
          page: 1,
          limit: 100,
          source: 'AUTHORIZED_TRADE_UOM_MASTER',
        };
        const counts: StatusCounts<'ACTIVE' | 'RETIRED'> = { ACTIVE: 2, RETIRED: 0, total: 2 };
        stub = new TradeHttpStub({
          'GET /uoms': pageData,
          'GET /uoms/status-counts': counts,
        });
        dispose = bindTradeHttpForTest(stub);
        configureTestBed();
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

      function setPermissions(options: { read?: boolean; manage?: boolean; manageTenantWide?: boolean }) {
        const { read = true, manage = true, manageTenantWide = true } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.items.read');
          permissionScopes['trade.items.read'] = {
            tenantWide: true,
            companyIds: [],
            branchIds: [],
          };
        }
        if (manage) {
          permissions.push('trade.catalog_master.manage');
          permissionScopes['trade.catalog_master.manage'] = manageTenantWide
            ? { tenantWide: true, companyIds: [], branchIds: [] }
            : { tenantWide: false, companyIds: ['company-a'], branchIds: ['branch-a'] };
        }

        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes,
        });
      }

      async function stable() {
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      async function render(options: { read?: boolean; manage?: boolean; manageTenantWide?: boolean } = {}) {
        setPermissions(options);
        fixture = TestBed.createComponent(UnitsPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
        modal = fixture.debugElement.query(By.directive(UnitModal)).componentInstance;
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      }

      it('loads units and aggregated status-counts with OPTIONAL scope and renders without raw translation keys', async () => {
        await render();
        expect(page['units']()).toEqual(rows);
        expect(stub.recordedReads()).toEqual([
          {
            path: '/uoms',
            query: { page: 1, limit: 100 },
            scope: { companyId: 'company-a', branchId: 'branch-a' },
          },
          {
            path: '/uoms/status-counts',
            query: undefined,
            scope: { companyId: 'company-a', branchId: 'branch-a' },
          },
        ]);
        expect(fixture.nativeElement.textContent).toContain('KG');
        expect(fixture.nativeElement.textContent).toContain('PCS');
        expect(fixture.nativeElement.textContent).not.toContain('tradeUnits.');
        expect(fixture.nativeElement.textContent).not.toContain('tradeShared.');
      });

      it('is read-only without tenant-wide trade.catalog_master.manage', async () => {
        for (const perm of [{ read: true, manage: false }, { read: true, manage: true, manageTenantWide: false }]) {
          await render(perm);
          expect(page['canRead']()).toBe(true);
          expect(page['canManage']()).toBe(false);

          const transloco = TestBed.inject(TranslocoService);
          const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).map((btn) =>
            (btn as HTMLButtonElement).textContent?.trim(),
          );
          expect(buttons).not.toContain(transloco.translate('tradeUnits.toolbar.new'));
          expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();

          page['openCreate']();
          page['openUnit'](rows[0]);
          await stable();

          const modalEl = fixture.nativeElement.querySelector('app-unit-modal') as HTMLElement;
          const modalButtons = Array.from(modalEl.querySelector('ui-modal')!.querySelectorAll('[modal-footer] button')).map((btn) =>
            (btn as HTMLButtonElement).textContent?.trim(),
          );
          expect(modalButtons).not.toContain(transloco.translate('tradeShared.common.save'));
          expect((modalEl.querySelector('input') as HTMLInputElement).readOnly).toBe(true);

          await modal['save']();
          expect(stub.recordedWrites()).toHaveLength(0);

          fixture.destroy();
          TestBed.resetTestingModule();
          configureTestBed();
        }
      });

      it('renders forbidden state with no HTTP calls when trade.items.read is missing', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await render({ read: false, manage: false });
        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(errorToast).not.toHaveBeenCalled();
      });

      it('renders forbidden state without error toast when server returns 403 on read or write', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        stub.register('GET', '/uoms', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await render();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(page['failed']()).toBe(false);
        expect(errorToast).not.toHaveBeenCalled();

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub = new TradeHttpStub({
          'GET /uoms': { items: rows, total: rows.length, page: 1, limit: 100, source: 'AUTHORIZED_TRADE_UOM_MASTER' },
          'GET /uoms/status-counts': { ACTIVE: 2, RETIRED: 0, total: 2 },
          'POST /uoms': new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'),
        });
        dispose();
        dispose = bindTradeHttpForTest(stub);

        await render();
        const errorToast2 = vi.spyOn(TestBed.inject(Notify), 'error');
        page['openCreate']();
        await stable();
        modal['form'].set({
          code: 'BOX',
          displayName: 'Box',
          nameEn: 'Box',
          nameAr: 'صندوق',
          active: true,
        });
        await modal['save']();
        await stable();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(errorToast2).not.toHaveBeenCalled();
      });

      it('preserves hint icons, maps field validation error, and creates via POST /uoms with key and NONE scope', async () => {
        await render();
        page['openCreate']();
        await stable();

        const fields = fixture.nativeElement.querySelectorAll('app-unit-modal ui-field');
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
          const control = field.querySelector('input, button[role="switch"]');
          if (control) {
            for (const id of control.getAttribute('aria-describedby')?.split(' ') ?? []) {
              expect(document.getElementById(id)).not.toBeNull();
            }
          }
        }

        modal['form'].set({
          code: 'BOX',
          displayName: 'Box',
          nameEn: 'Box',
          nameAr: 'صندوق',
          active: true,
        });

        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(
            new ApiError(400, 'TRADE.VALIDATION_FAILED', {
              code: ['code must match /^[A-Za-z][A-Za-z0-9._-]*$/ regular expression'],
            }),
          );
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await modal['save']();
        await stable();

        const transloco = TestBed.inject(TranslocoService);
        expect(modal['errorText']('code')).toBe(transloco.translate('tradeUnits.modal.codePattern'));
        expect(
          fixture.nativeElement.querySelector('app-unit-modal [role="alert"]')?.textContent,
        ).toContain(transloco.translate('tradeUnits.modal.codePattern'));
        expect(errorToast).not.toHaveBeenCalled();

        const created: Uom = {
          id: '01900000-0000-7000-8000-000000000099',
          code: 'BOX_OK',
          displayName: 'Box',
          localizedNames: { en: 'Box', ar: 'صندوق' },
          status: 'ACTIVE',
          version: 1,
          updatedAt: '2026-11-23T11:00:00.000Z',
        };
        modal['onCodeInput']({ target: { value: 'BOX_OK' } } as unknown as Event);
        expect(modal['errorText']('code')).toBeNull();

        write.mockResolvedValueOnce({ status: 201, data: created, etag: '"1"', location: null });
        await modal['save']();
        await stable();

        expect(write.mock.calls[1][0]).toBe('POST');
        expect(write.mock.calls[1][1]).toBe('/uoms');
        expect(write.mock.calls[1][3].key).toMatch(UUID_V7_REGEX);
        expect(write.mock.calls[1][3].scope).toBeUndefined();
        expect(page['units']().some((item) => item.id === created.id)).toBe(true);
      });

      it('checks references before retire, patches with key + If-Match + NONE scope, and opens conflict modal on 409', async () => {
        await render();
        const unit = rows[0];

        stub.register('GET', '/uoms/:id/references', {
          blocking: true,
          groups: [{ key: 'ITEM_BASE', count: 2 }],
        });
        await page['onRetireRequested'](unit);
        await stable();
        expect(stub.recordedWrites()).toHaveLength(0);
        const inUseDialog = fixture.nativeElement.querySelectorAll('app-unit-modal dialog')[2];
        expect(inUseDialog?.hasAttribute('open')).toBe(true);
        modal['closeInUse']();

        stub.register('GET', '/uoms/:id/references', { blocking: false, groups: [] });
        vi.spyOn(page['retireDialog'](), 'open').mockResolvedValue(true);
        stub.register('PATCH', '/uoms/:id', new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');

        await page['onRetireRequested'](unit);
        await stable();

        expect(errorToast).not.toHaveBeenCalled();
        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'PATCH',
          path: `/uoms/${unit.id}`,
          body: { status: 'RETIRED' },
          ifMatch: '"1"',
          scope: undefined,
        });
        expect(stub.recordedWrites()[0].key).toMatch(UUID_V7_REGEX);
        const conflictDialog = fixture.nativeElement.querySelectorAll('app-unit-modal dialog')[1];
        expect(conflictDialog?.hasAttribute('open')).toBe(true);

        const freshUnit: Uom = { ...unit, version: 2, displayName: 'Kilogram v2' };
        stub.register('GET', '/uoms/:id', freshUnit);
        await modal['reloadLatest']();
        await stable();
        expect(stub.recordedReads().filter((read) => read.path === `/uoms/${unit.id}`).at(-1)).toEqual({
          path: `/uoms/${unit.id}`,
          query: undefined,
          scope: { companyId: 'company-a', branchId: 'branch-a' },
        });
        expect(page['units']().find((u) => u.id === unit.id)?.version).toBe(2);
      });
    });
  }
