import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeSettings from '../../../../../../public/i18n/trade-settings/en.json';
import arTradeSettings from '../../../../../../public/i18n/trade-settings/ar.json';
import enTradeReasons from '../../../../../../public/i18n/trade-settings-reasons/en.json';
import arTradeReasons from '../../../../../../public/i18n/trade-settings-reasons/ar.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { REASON_KINDS } from '../../shared/reasons/reason-kinds';
import type { AdminReasonCode, ReasonCounts } from '../../shared/reasons/reasons-admin.api';
import { reasonErrorText } from './reason-errors';
import { ReasonModal } from './reason-modal/reason-modal';
import { ReasonsPage } from './reasons-page';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
class ReasonsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('trade-shared/')) return of(arabic ? arTradeShared : enTradeShared);
    if (path.startsWith('trade-settings-reasons/')) return of(arabic ? arTradeReasons : enTradeReasons);
    if (path.startsWith('trade-settings/')) return of(arabic ? arTradeSettings : enTradeSettings);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

function makeCounts(): ReasonCounts {
  const byKind = Object.fromEntries(REASON_KINDS.map((kind) => [kind, 1])) as Record<
    (typeof REASON_KINDS)[number],
    number
  >;
  byKind.DOCUMENT_CANCEL = 2;
  const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
  return { total, byKind };
}

function makeRows(): AdminReasonCode[] {
  return [
    {
      id: '01900000-0000-7000-8000-000000000010',
      kind: 'DOCUMENT_CANCEL',
      code: 'CUSTOMER_REQUEST',
      localizedNames: { en: 'Customer request', ar: 'طلب العميل' },
      requiresNote: false,
      isActive: true,
      sortOrder: 10,
      isSystem: false,
      version: 1,
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: '01900000-0000-7000-8000-000000000011',
      kind: 'DOCUMENT_CANCEL',
      code: 'OTHER',
      localizedNames: { en: 'Other', ar: 'سبب آخر' },
      requiresNote: true,
      isActive: true,
      sortOrder: 1024,
      isSystem: true,
      version: 1,
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
  ];
}

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`ReasonsPage (${language} ${theme})`, () => {
      let fixture: ComponentFixture<ReasonsPage>;
      let page: ReasonsPage;
      let modal: ReasonModal;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let rows: AdminReasonCode[];
      let customRow: AdminReasonCode;
      let systemRow: AdminReasonCode;
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

        rows = makeRows();
        customRow = rows[0];
        systemRow = rows[1];
        stub = new TradeHttpStub({
          'GET /reason-codes/counts': makeCounts(),
          'GET /reason-codes': { items: rows },
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ReasonsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: ReasonsTranslocoLoader,
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
            tset: language === 'ar' ? arTradeSettings : enTradeSettings,
            treasons: language === 'ar' ? arTradeReasons : enTradeReasons,
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

      function setPermissions(options: { read?: boolean; manage?: boolean; manageTenantWide?: boolean }) {
        const { read = true, manage = true, manageTenantWide = true } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.reasons.read');
          permissionScopes['trade.reasons.read'] = {
            tenantWide: true,
            companyIds: [],
            branchIds: [],
          };
        }
        if (manage) {
          permissions.push('trade.reasons.manage');
          permissionScopes['trade.reasons.manage'] = manageTenantWide
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

      async function render(options: { read?: boolean; manage?: boolean; manageTenantWide?: boolean } = {}) {
        setPermissions(options);
        fixture = TestBed.createComponent(ReasonsPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
        modal = fixture.debugElement.query(By.directive(ReasonModal)).componentInstance;
      }

      async function stable() {
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as
          | FullState
          | undefined;
      }

      it('loads counts and reasons with OPTIONAL scope, filters on client, and toggles includeInactive', async () => {
        await render();
        expect(page['reasons']()).toEqual(rows);
        expect(stub.recordedReads()).toEqual([
          {
            path: '/reason-codes/counts',
            query: { includeInactive: true },
            scope: { companyId: 'company-a', branchId: 'branch-a' },
          },
          {
            path: '/reason-codes',
            query: { kind: 'DOCUMENT_CANCEL', includeInactive: false },
            scope: { companyId: 'company-a', branchId: 'branch-a' },
          },
        ]);
        expect(fixture.nativeElement.textContent).toContain('CUSTOMER_REQUEST');
        expect(fixture.nativeElement.textContent).toContain('OTHER');
        expect(fixture.nativeElement.textContent).not.toContain('treasons.');
        expect(fixture.nativeElement.textContent).not.toContain('tset.');

        page['search'].set('CUST');
        fixture.detectChanges();
        expect(page['visibleReasons']().map((r) => r.code)).toEqual(['CUSTOMER_REQUEST']);
        expect(stub.recordedReads()).toHaveLength(2);

        page['showInactive'].set(true);
        await stable();
        expect(stub.recordedReads()[2]).toEqual({
          path: '/reason-codes',
          query: { kind: 'DOCUMENT_CANCEL', includeInactive: true },
          scope: { companyId: 'company-a', branchId: 'branch-a' },
        });
      });

      it('is read-only without tenant-wide trade.reasons.manage', async () => {
        for (const perm of [{ read: true, manage: false }, { read: true, manage: true, manageTenantWide: false }]) {
          await render(perm);
          expect(page['canRead']()).toBe(true);
          expect(page['canManage']()).toBe(false);

          const transloco = TestBed.inject(TranslocoService);
          const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).map((btn) =>
            (btn as HTMLButtonElement).textContent?.trim(),
          );
          expect(buttons).not.toContain(transloco.translate('treasons.new'));
          expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
          expect(page['rowActions'](customRow).map((item) => item.id)).toEqual(['open']);

          page['openCreate']();
          page['openEdit'](customRow);
          await stable();

          const modalEl = fixture.nativeElement.querySelector('app-trade-reason-modal') as HTMLElement;
          const modalButtons = Array.from(modalEl.querySelector('ui-modal')!.querySelectorAll('[modal-footer] button')).map((btn) =>
            (btn as HTMLButtonElement).textContent?.trim(),
          );
          expect(modalButtons).not.toContain(transloco.translate('treasons.actions.save'));
          expect(modalButtons).not.toContain(transloco.translate('treasons.actions.delete'));
          expect((modalEl.querySelector('input') as HTMLInputElement).readOnly).toBe(true);

          await modal['save']();
          await modal.confirmDelete(customRow, false);
          expect(stub.recordedWrites()).toHaveLength(0);

          fixture.destroy();
          TestBed.resetTestingModule();
          TestBed.configureTestingModule({
            imports: [ReasonsPage],
            providers: [
              provideRouter([]),
              provideTransloco({
                config: {
                  availableLangs: ['en', 'ar'],
                  defaultLang: language,
                  reRenderOnLangChange: true,
                },
                loader: ReasonsTranslocoLoader,
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
              tset: language === 'ar' ? arTradeSettings : enTradeSettings,
              treasons: language === 'ar' ? arTradeReasons : enTradeReasons,
            },
            language,
          );
        }
      });

      it('renders forbidden state with no HTTP calls when trade.reasons.read is missing', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await render({ read: false, manage: false });
        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(errorToast).not.toHaveBeenCalled();
      });

      it('renders forbidden state without error toast when server returns 403', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        stub.register('GET', '/reason-codes', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await render();
        expect(fullState()?.kind()).toBe('forbidden');
        expect(page['failed']()).toBe(false);
        expect(errorToast).not.toHaveBeenCalled();
      });

      it('hides delete control on system rows and shows server TRADE.REASON.SYSTEM_IMMUTABLE code', async () => {
        await render();
        const actions = page['rowActions'](systemRow);
        expect(actions.some((item) => item.id === 'delete')).toBe(false);
        expect(actions.find((item) => item.id === 'deactivate')?.disabled).toBe(true);

        page['openEdit'](systemRow);
        await stable();
        const transloco = TestBed.inject(TranslocoService);
        const modalEl = fixture.nativeElement.querySelector('app-trade-reason-modal') as HTMLElement;
        const modalButtons = Array.from(modalEl.querySelector('ui-modal')!.querySelectorAll('[modal-footer] button')).map((btn) =>
          (btn as HTMLButtonElement).textContent?.trim(),
        );
        expect(modalButtons).not.toContain(transloco.translate('treasons.actions.delete'));

        stub.register(
          'DELETE',
          '/reason-codes/:id',
          new ApiError(409, 'TRADE.REASON.SYSTEM_IMMUTABLE', { field: ['isSystem'] }),
        );
        vi.spyOn(modal['deleteDialog'](), 'open').mockResolvedValue(true);
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await modal.confirmDelete({ ...systemRow, isSystem: false }, false);
        expect(errorToast).toHaveBeenCalledWith(
          transloco.translate('tset.errors.TRADE_REASON_SYSTEM_IMMUTABLE'),
        );
      });

      it('preserves hints, maps code-pattern error to field, and creates with key and NONE scope', async () => {
        await render();
        page['openCreate']();
        await stable();

        const fields = fixture.nativeElement.querySelectorAll('app-trade-reason-modal ui-field');
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
          code: 'LATE_DELIVERY',
          nameAr: 'تأخر التسليم',
          nameEn: 'Late delivery',
          sortOrder: '20',
          requiresNote: true,
          isActive: true,
        });

        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(
            new ApiError(400, 'TRADE.VALIDATION_FAILED', {
              code: ['code must match ^[A-Z][A-Z0-9_]{1,39}$'],
            }),
          );
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await modal['save']();
        await stable();

        const transloco = TestBed.inject(TranslocoService);
        expect(modal['errorText']('code')).toBe(transloco.translate('treasons.validation.reasonCode'));
        expect(
          fixture.nativeElement.querySelector('app-trade-reason-modal [role="alert"]')?.textContent,
        ).toContain(transloco.translate('treasons.validation.reasonCode'));
        expect(errorToast).not.toHaveBeenCalled();

        const created: AdminReasonCode = {
          id: '01900000-0000-7000-8000-000000000099',
          kind: 'DOCUMENT_CANCEL',
          code: 'LATE_DELIVERY_OK',
          localizedNames: { en: 'Late delivery', ar: 'تأخر التسليم' },
          requiresNote: true,
          isActive: true,
          sortOrder: 20,
          isSystem: false,
          version: 1,
          updatedAt: '2026-11-23T11:00:00.000Z',
        };
        modal['onCodeInput']({ target: { value: 'LATE_DELIVERY_OK' } } as unknown as Event);
        expect(modal['errorText']('code')).toBeNull();

        write.mockResolvedValueOnce({ status: 201, data: created, etag: '"1"', location: null });
        await modal['save']();
        await stable();

        expect(write.mock.calls[1][0]).toBe('POST');
        expect(write.mock.calls[1][1]).toBe('/reason-codes');
        expect(write.mock.calls[1][3].key).toMatch(UUID_V7_REGEX);
        expect(write.mock.calls[1][3].scope).toBeUndefined();
        expect(page['reasons']().some((item) => item.id === created.id)).toBe(true);
      });

      it('updates and deletes custom rows with key, If-Match and NONE scope', async () => {
        await render();
        const updatedRow: AdminReasonCode = {
          ...customRow,
          localizedNames: { en: 'Updated reason', ar: 'سبب محدث' },
          version: 2,
        };
        stub.register('PATCH', '/reason-codes/:id', updatedRow);
        stub.register('DELETE', '/reason-codes/:id', { ...updatedRow, version: 3 });

        page['openEdit'](customRow);
        await stable();
        modal['form'].update((curr) => ({ ...curr, nameEn: 'Updated reason', nameAr: 'سبب محدث' }));
        await modal['save']();
        await stable();

        expect(stub.recordedWrites()[0]).toMatchObject({
          method: 'PATCH',
          path: `/reason-codes/${customRow.id}`,
          ifMatch: '"1"',
          scope: undefined,
        });
        expect(stub.recordedWrites()[0].key).toMatch(UUID_V7_REGEX);

        vi.spyOn(modal['deleteDialog'](), 'open').mockResolvedValue(true);
        await modal.confirmDelete(updatedRow, false);
        await stable();

        expect(stub.recordedWrites()[1]).toMatchObject({
          method: 'DELETE',
          path: `/reason-codes/${customRow.id}`,
          ifMatch: '"2"',
          scope: undefined,
        });
        expect(stub.recordedWrites()[1].key).toMatch(UUID_V7_REGEX);
        expect(page['reasons']().some((item) => item.id === customRow.id)).toBe(false);
      });

      it('reasonErrorText resolves TRADE.CONTEXT.MISSING_COMPANY without raw keys', () => {
        const transloco = TestBed.inject(TranslocoService);
        const text = reasonErrorText(new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY'), transloco);
        expect(text).toBe(transloco.translate('tradeShared.errors.TRADE_CONTEXT_MISSING_COMPANY'));
        expect(text).not.toContain('TRADE_CONTEXT_MISSING_COMPANY');
      });
    });
  }
