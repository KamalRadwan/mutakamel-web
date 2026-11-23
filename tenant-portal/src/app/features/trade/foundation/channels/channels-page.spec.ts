import { ScopeState } from '../../../../core/scope/scope';
import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeChannels from '../../../../../../public/i18n/trade-channels/ar.json';
import enTradeChannels from '../../../../../../public/i18n/trade-channels/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { ChannelModal } from './channel-modal/channel-modal';
import type { ChannelDetail, ChannelListResult, ChannelRow, ChannelStatusCounts } from './channels.model';
import { ChannelsPage } from './channels-page';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, settings: enSettings, tradeShared: enTradeShared, tradeChannels: enTradeChannels },
  ar: { ...ar, settings: arSettings, tradeShared: arTradeShared, tradeChannels: arTradeChannels },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-channels/en': enTradeChannels,
  'trade-channels/ar': arTradeChannels,
};

@Injectable()
class ChannelsTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeRows(): ChannelRow[] {
  return [
    {
      id: '01900000-0000-7000-8000-000000000010',
      companyId: 'c1',
      code: 'POS_CAIRO',
      name: 'Cairo POS',
      channelType: 'POS',
      status: 'ACTIVE',
      configurationProfileVersionId: null,
      activeBranchCount: 2,
      version: 1,
      createdAt: '2026-11-23T08:00:00.000Z',
      updatedAt: '2026-11-23T09:00:00.000Z',
    },
    {
      id: '01900000-0000-7000-8000-000000000011',
      companyId: 'c1',
      code: 'WEB_EG',
      name: 'Egypt Store',
      channelType: 'ECOMMERCE',
      status: 'ACTIVE',
      configurationProfileVersionId: null,
      activeBranchCount: 0,
      version: 2,
      createdAt: '2026-11-23T08:00:00.000Z',
      updatedAt: '2026-11-23T09:00:00.000Z',
    },
  ];
}

function makeDetail(row: ChannelRow): ChannelDetail {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    channelType: row.channelType,
    status: row.status,
    configurationProfileVersionId: row.configurationProfileVersionId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    branches: [
      {
        id: '01900000-0000-7000-8000-000000000101',
        channelId: row.id,
        companyId: row.companyId,
        branchId: 'b1',
        isActive: true,
        version: 1,
        branchName: 'Cairo HQ',
        branchNameAr: null,
      },
    ],
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ChannelsPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ChannelsPage>;
      let page: ChannelsPage;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let rows: ChannelRow[];
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogProto['showModal'],
        close: dialogProto['close'],
      };
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);

      function configureTestBed(): void {
        TestBed.configureTestingModule({
          imports: [ChannelsPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: ChannelsTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }), branchesFor: () => ['b1'] } },
            { provide: ScopeState, useValue: { company: signal({ id: 'c1', nameEn: 'Test company', nameAr: 'شركة الاختبار', branches: [{ id: 'b1', nameEn: 'Cairo HQ', nameAr: 'القاهرة' }, { id: 'b2', nameEn: 'Alexandria', nameAr: 'الإسكندرية' }] }),
              branch: signal({ id: 'b1', nameEn: 'Cairo HQ', nameAr: 'القاهرة' }), companies: signal([]),
              branches: signal([{ id: 'b1', nameEn: 'Cairo HQ', nameAr: 'القاهرة' }, { id: 'b2', nameEn: 'Alexandria', nameAr: 'الإسكندرية' }]) } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(lang === 'ar' ? ar : en),
            settings: lang === 'ar' ? arSettings : enSettings,
            tradeShared: lang === 'ar' ? arTradeShared : enTradeShared,
            tradeChannels: lang === 'ar' ? arTradeChannels : enTradeChannels,
          },
          lang,
        );
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
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        rows = makeRows();
        const pageData: ChannelListResult = { items: rows, total: rows.length, page: 1, limit: 100 };
        const counts: ChannelStatusCounts = { ACTIVE: 2, INACTIVE: 0, total: 2 };
        stub = new TradeHttpStub({
          'GET /channels': pageData,
          'GET /channels/status-counts': counts,
          'GET /channels/:id': makeDetail(rows[0]),
        });
        dispose = bindTradeHttpForTest(stub);
        configureTestBed();
      });

      afterEach(() => {
        fixture?.destroy();
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      function setPermissions(options: {
        read?: boolean;
        manage?: boolean;
        manageCompanyId?: string;
      } = {}): void {
        const { read = true, manage = true, manageCompanyId = 'c1' } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.items.read');
          permissionScopes['trade.items.read'] = {
            tenantWide: false,
            companyIds: ['c1'],
            branchIds: [],
          };
        }
        if (manage) {
          permissions.push('trade.items.manage');
          permissionScopes['trade.items.manage'] = {
            tenantWide: false,
            companyIds: [manageCompanyId],
            branchIds: [],
          };
        }

        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          accessibleCompanies: ['c1', 'c2'],
          accessibleBranches: ['b1', 'b2', 'b3', 'b4', 'b5'],
          accessibleBranchCompanies: [
            { companyId: 'c1', branchId: 'b1' },
            { companyId: 'c1', branchId: 'b2' },
            { companyId: 'c1', branchId: 'b3' },
            { companyId: 'c2', branchId: 'b4' },
            { companyId: 'c2', branchId: 'b5' },
          ],
          permissions,
          permissionScopes,
        });
      }

      async function stable(): Promise<void> {
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      async function render(options: {
        read?: boolean;
        manage?: boolean;
        manageCompanyId?: string;
        channelParam?: string;
      } = {}): Promise<void> {
        setPermissions(options);
        fixture = TestBed.createComponent(ChannelsPage);
        page = fixture.componentInstance;
        if (options.channelParam !== undefined) {
          fixture.componentRef.setInput('channel', options.channelParam);
        }
        fixture.detectChanges();
        await stable();
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      }

      function modalInstance(): ChannelModal | undefined {
        return fixture.debugElement.query(By.directive(ChannelModal))?.componentInstance as ChannelModal | undefined;
      }

      it('loads channels with activeBranchCount and status-counts without raw translation keys', async () => {
        await render();

        expect(page['rows']()).toEqual(rows);
        expect(stub.recordedReads()).toEqual([
          {
            path: '/channels',
            query: { status: 'ACTIVE', sort: 'createdAt', direction: 'desc', page: 1, limit: 100 },
            scope: { companyId: 'c1' },
          },
          {
            path: '/channels/status-counts',
            query: undefined,
            scope: { companyId: 'c1' },
          },
        ]);
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('POS_CAIRO');
        expect(text).toContain('2');
        expect(text).not.toContain('tradeChannels.');
        expect(text).not.toContain('tradeShared.');
      });

      it('shows the empty state when the company has no channels', async () => {
        stub.register('GET', '/channels', { items: [], total: 0, page: 1, limit: 100 });
        stub.register('GET', '/channels/status-counts', { ACTIVE: 0, INACTIVE: 0, total: 0 });
        await render({ manage: false });

        const transloco = TestBed.inject(TranslocoService);
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain(transloco.translate('tradeChannels.empty.title', { company: page['companyName']() }));
        expect((fixture.nativeElement as HTMLElement).querySelector('[role="table"]')).toBeNull();
      });

      it('is read-only without trade.items.manage for the current company', async () => {
        for (const perm of [{ read: true, manage: false }, { read: true, manage: true, manageCompanyId: 'c2' }]) {
          await render({ ...perm, channelParam: rows[0].id });
          const modal = modalInstance();
          expect(modal).toBeDefined();
          await vi.waitFor(() => expect(modal!['loading']()).toBe(false));
          await fixture.whenStable();
          fixture.detectChanges();

          expect(page['canRead']()).toBe(true);
          expect(page['canManage']()).toBe(false);

          const transloco = TestBed.inject(TranslocoService);
          const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button:not(dialog:not([open]) button)')).map((btn) =>
            btn.textContent?.trim(),
          );
          expect(buttons).not.toContain(transloco.translate('tradeChannels.toolbar.new'));
          expect(buttons).not.toContain(transloco.translate('tradeChannels.modal.save'));

          const nameInput = (fixture.nativeElement as HTMLElement).querySelector('app-channel-modal input[dir="auto"]') as HTMLInputElement;
          expect(nameInput.readOnly).toBe(true);

          await modal!['submit']();
          expect(stub.recordedWrites()).toHaveLength(0);

          fixture.destroy();
          TestBed.resetTestingModule();
          configureTestBed();
        }
      });

      it('shows forbidden state with zero HTTP requests when trade.items.read is absent', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await render({ read: false, manage: false });

        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(errorToast).not.toHaveBeenCalled();
      });

      it('shows forbidden state without error toast when server returns 403 on read or write', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        stub.register('GET', '/channels', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        await render();

        expect(fullState()?.kind()).toBe('forbidden');
        expect(page['loadFailed']()).toBe(false);
        expect(errorToast).not.toHaveBeenCalled();

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub = new TradeHttpStub({
          'GET /channels': { items: rows, total: rows.length, page: 1, limit: 100 },
          'GET /channels/status-counts': { ACTIVE: 2, INACTIVE: 0, total: 2 },
          'PATCH /channels/:id': new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'),
        });
        dispose();
        dispose = bindTradeHttpForTest(stub);

        await render();
        const errorToast2 = vi.spyOn(TestBed.inject(Notify), 'error');
        vi.spyOn(page['deactivateDialog'](), 'open').mockResolvedValue(true);
        await page['onToggleStatus'](rows[1]);
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fullState()?.kind()).toBe('forbidden');
        expect(errorToast2).not.toHaveBeenCalled();
      });

      it('preserves hint icons, maps field validation error, and saves create/edit/branches via COMPANY scope', async () => {
        await render({ channelParam: 'new' });
        const modal = modalInstance();
        expect(modal).toBeDefined();
        await fixture.whenStable();
        fixture.detectChanges();

        const fields = (fixture.nativeElement as HTMLElement).querySelectorAll('app-channel-modal ui-field');
        expect(fields.length).toBeGreaterThan(0);
        for (const field of Array.from(fields)) {
          expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
          const control = field.querySelector('input, button[role="switch"], button[role="combobox"]');
          if (control) {
            for (const id of control.getAttribute('aria-describedby')?.split(' ').filter(Boolean) ?? []) {
              expect(document.getElementById(id)).not.toBeNull();
            }
          }
        }

        modal!['onCodeInput']('NEW_CH');
        modal!['onNameInput']('New Channel');
        modal!['onTypeChange']('ECOMMERCE');

        const writeSpy = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(
            new ApiError(400, 'TRADE.VALIDATION_FAILED', {
              name: ['name is invalid'],
            }),
          );
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');

        expect(await modal!['submit']()).toBe(false);
        fixture.detectChanges();

        const transloco = TestBed.inject(TranslocoService);
        expect(modal!['nameError']()).toBe(transloco.translate('tradeChannels.errors.nameInvalid'));
        expect((fixture.nativeElement as HTMLElement).querySelector('app-channel-modal [role="alert"]')?.textContent).toContain(
          transloco.translate('tradeChannels.errors.nameInvalid'),
        );
        expect(errorToast).not.toHaveBeenCalled();

        modal!['onNameInput']('Valid Channel');
        expect(modal!['nameError']()).toBeNull();

        const created = {
          id: '01900000-0000-7000-8000-000000000099',
          companyId: 'c1',
          code: 'NEW_CH',
          name: 'Valid Channel',
          channelType: 'ECOMMERCE' as const,
          status: 'ACTIVE' as const,
          configurationProfileVersionId: null,
          version: 1,
          createdAt: '2026-11-23T10:00:00.000Z',
          updatedAt: '2026-11-23T10:00:00.000Z',
        };
        writeSpy.mockResolvedValueOnce({ status: 201, data: created, etag: '"1"', location: null });

        expect(await modal!['submit']()).toBe(true);
        expect(writeSpy.mock.calls[1][0]).toBe('POST');
        expect(writeSpy.mock.calls[1][1]).toBe('/channels');
        expect(writeSpy.mock.calls[1][3].key).toMatch(UUID_V7_REGEX);
        expect(writeSpy.mock.calls[1][3].scope).toEqual({ companyId: 'c1' });

        const patched = { ...created, name: 'Updated Channel', version: 2 };
        const updatedDetail: ChannelDetail = {
          ...patched,
          branches: [
            {
              id: 'link-b2',
              channelId: created.id,
              companyId: 'c1',
              branchId: 'b2',
              isActive: true,
              version: 1,
              branchName: 'Alexandria',
              branchNameAr: null,
            },
          ],
        };
        writeSpy
          .mockResolvedValueOnce({ status: 200, data: patched, etag: '"2"', location: null })
          .mockResolvedValueOnce({ status: 200, data: updatedDetail, etag: '"3"', location: null });

        modal!['onNameInput']('Updated Channel');
        modal!['onBranchToggle']({ branchId: 'b2', isActive: true });
        expect(await modal!['submit']()).toBe(true);

        expect(writeSpy.mock.calls[2][0]).toBe('PATCH');
        expect(writeSpy.mock.calls[2][1]).toBe(`/channels/${created.id}`);
        expect(writeSpy.mock.calls[2][3].ifMatch).toBe('"1"');
        expect(writeSpy.mock.calls[2][3].scope).toEqual({ companyId: 'c1' });
        expect(writeSpy.mock.calls[2][3].key).toMatch(UUID_V7_REGEX);

        expect(writeSpy.mock.calls[3][0]).toBe('PUT');
        expect(writeSpy.mock.calls[3][1]).toBe(`/channels/${created.id}/branches`);
        expect(writeSpy.mock.calls[3][2]).toEqual({ links: [{ branchId: 'b2', isActive: true }] });
        expect(writeSpy.mock.calls[3][3].ifMatch).toBe('"2"');
        expect(writeSpy.mock.calls[3][3].scope).toEqual({ companyId: 'c1' });
        expect(writeSpy.mock.calls[3][3].key).toMatch(UUID_V7_REGEX);
      });
    });
  }
}
