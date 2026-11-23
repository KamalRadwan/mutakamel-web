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
import enStages from '../../../../../../public/i18n/settings-lead-stages/en.json';
import arStages from '../../../../../../public/i18n/settings-lead-stages/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import type { CrmSettings } from '../general/general.model';
import { LeadStageModal } from './lead-stage-modal/lead-stage-modal';
import { LeadStagesPage } from './lead-stages-page';
import { LEAD_STAGE_SETTINGS_READER, requireQualifiedForConversion } from './lead-stages.api';
import type { LeadStage } from './lead-stages.model';

@Injectable()
class SettingsLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('settings-lead-stages/')) return of(arabic ? arStages : enStages);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark']) {
    describe(`${language} ${theme}`, () => {
      let fixture: ComponentFixture<LeadStagesPage>;
      let page: LeadStagesPage;
      let modal: LeadStageModal;
      let stub: CrmHttpStub;
      let dispose: () => void;
      let rows: LeadStage[];
      let custom: LeadStage;
      const dialogPrototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogPrototype['showModal'],
        close: dialogPrototype['close'],
      };
      const me = signal(FAKE_TENANT_ME);
      let readSettings: ReturnType<typeof vi.fn<() => Promise<CrmSettings>>>;

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
        rows = structuredClone(CRM_SETTINGS_FIXTURES['/lead-stages']) as LeadStage[];
        custom = rows.find((row) => row.flag === 'CONTACTED')!;
        stub = new CrmHttpStub({ '/lead-stages': rows });
        dispose = bindCrmHttpForTest(stub);
        readSettings = vi
          .fn<() => Promise<CrmSettings>>()
          .mockResolvedValue({
            ...(CRM_SETTINGS_FIXTURES['/settings'] as CrmSettings),
            requireQualifiedStageForConversion: true,
          });
        TestBed.configureTestingModule({
          imports: [LeadStagesPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: SettingsLoader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            { provide: LanguageState, useValue: { current: signal(language) } },
            { provide: LEAD_STAGE_SETTINGS_READER, useValue: readSettings },
          ],
        });
        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(language === 'ar' ? ar : en),
            settings: language === 'ar' ? arSettings : enSettings,
            leadStages: language === 'ar' ? arStages : enStages,
          },
          language,
        );
      });

      afterEach(() => {
        fixture?.destroy();
        dialogPrototype['showModal'] = originalDialog.showModal;
        dialogPrototype['close'] = originalDialog.close;
        crmQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
      });

      async function render(manage = true, settings = true, read = true) {
        const permissions = [
          read ? 'crm.lead_stages.read' : '',
          manage ? 'crm.lead_stages.manage' : '',
          settings ? 'crm.settings.read' : '',
        ].filter(Boolean);
        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes: Object.fromEntries(
            permissions.map((key) => [key, { tenantWide: true, companyIds: [], branchIds: [] }]),
          ),
        });
        fixture = TestBed.createComponent(LeadStagesPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
        modal = fixture.debugElement.query(By.directive(LeadStageModal)).componentInstance;
      }

      async function stable() {
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      function fullState() {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as
          FullState | undefined;
      }

      function errorToast() {
        return vi.spyOn(TestBed.inject(Notify), 'error');
      }

      describe('LeadStagesPage', () => {
        it('loads stages', async () => {
          await render();
          expect(page['stages']().map((row) => row.id)).toEqual(rows.map((row) => row.id));
          expect(page['stages']()[0].flag).toBe('NEW');
          expect(
            page['stages']()
              .slice(-2)
              .map((row) => row.flag),
          ).toEqual(['DISQUALIFIED', 'CONVERTED']);
          expect(fixture.nativeElement.textContent).toContain(custom.nameAr);
          expect(fixture.nativeElement.textContent).toContain(custom.nameEn);
        });

        it('load failure', async () => {
          const read = vi.spyOn(stub, 'read');
          read.mockRejectedValue(
            new ApiError(503, 'INTERNAL_ERROR', undefined, { correlationId: 'ref-ls' }),
          );
          await render();
          expect(fullState()?.kind()).toBe('load-failure');
          expect(fullState()?.text()).toContain('ref-ls');
          expect(fullState()?.actionLabel()).toBe(
            TestBed.inject(TranslocoService).translate('settings.common.retry'),
          );
          for (const code of ['LEAD_STAGE_REORDER_INVALID', 'LEAD_STAGE_LIMIT_EXCEEDED']) {
            read.mockRejectedValue(new ApiError(422, code));
            page['reload']();
            await stable();
            expect(fullState()?.kind()).toBe('load-failure');
            expect(fullState()?.text()).toBe(
              TestBed.inject(TranslocoService).translate(`leadStages.errors.${code}`),
            );
          }
          read.mockResolvedValue(rows);
          fullState()?.action.emit();
          await stable();
          expect(fullState()).toBeUndefined();
        });

        it('in use offers deactivate', async () => {
          await render();
          page['openEdit'](custom);
          await stable();
          modal['onFlagChange']('NURTURING');
          const write = vi
            .spyOn(stub, 'write')
            .mockRejectedValueOnce(new ApiError(409, 'LEAD_STAGE_IN_USE'));
          await modal['save']();
          await stable();
          expect(page['inUseStage']()?.id).toBe(custom.id);
          expect(fixture.nativeElement.textContent).toContain(
            TestBed.inject(TranslocoService).translate('leadStages.delete.makeInactive'),
          );
          write.mockResolvedValue({
            status: 200,
            data: { ...custom, isActive: false },
            etag: null,
            location: null,
          });
          await page['deactivateInUseStage']();
          expect(write.mock.calls[1].slice(0, 3)).toEqual([
            'PATCH',
            `/lead-stages/${custom.id}`,
            { isActive: false },
          ]);
          expect(page['inUseStage']()).toBeNull();
        });

        it('reorder invalid reloads', async () => {
          await render();
          const read = vi.spyOn(stub, 'read').mockResolvedValue(rows);
          const write = vi
            .spyOn(stub, 'write')
            .mockRejectedValue(new ApiError(422, 'LEAD_STAGE_REORDER_INVALID'));
          const toast = errorToast();
          const next = [...rows].reverse();
          await expect(page['commitReorder'](rows, next)).resolves.toBe(false);
          expect(page['stages']()).toEqual(rows);
          expect(read).toHaveBeenCalledOnce();
          expect(write).toHaveBeenCalledOnce();
          expect(toast).toHaveBeenCalledOnce();
        });

        it('delete outcomes', async () => {
          await render();
          vi.spyOn(page['confirmDelete'](), 'open').mockResolvedValue(true);
          const write = vi
            .spyOn(stub, 'write')
            .mockRejectedValueOnce(new ApiError(409, 'LEAD_STAGE_IN_USE'));
          await page['requestDelete'](custom);
          expect(page['inUseStage']()?.id).toBe(custom.id);
          page['closeInUseModal']();
          const toast = errorToast();
          for (const code of ['LEAD_STAGE_PROTECTED', 'LEAD_STAGE_DEFAULT_DELETE']) {
            write.mockRejectedValueOnce(new ApiError(422, code));
            await page['requestDelete'](custom);
            expect(toast).toHaveBeenLastCalledWith(
              TestBed.inject(TranslocoService).translate(`leadStages.errors.${code}`),
            );
          }
          write.mockResolvedValueOnce({ status: 204, data: undefined, etag: null, location: null });
          const read = vi.spyOn(stub, 'read');
          await page['requestDelete'](custom);
          expect(read).toHaveBeenCalledOnce();
        });

        it('qualified warning hidden without settings read', async () => {
          await render(true, false);
          expect(readSettings).not.toHaveBeenCalled();
          expect(page['showMissingQualifiedWarning']()).toBe(false);
        });

        it('qualified warning hidden on failure', async () => {
          readSettings.mockRejectedValue(new ApiError(503, 'INTERNAL_ERROR'));
          await render();
          expect(readSettings).toHaveBeenCalledOnce();
          expect(page['showMissingQualifiedWarning']()).toBe(false);
          expect(page['stages']()).toEqual(rows);
          expect(page['loadFailed']()).toBe(false);
          expect(requireQualifiedForConversion()).toBe(false);
        });

        it('qualified warning loads independently and reacts to the real flag', async () => {
          let resolve!: (value: CrmSettings) => void;
          readSettings.mockReturnValue(
            new Promise((done) => {
              resolve = done;
            }),
          );
          await render();
          expect(page['loading']()).toBe(false);
          expect(page['showMissingQualifiedWarning']()).toBe(false);
          page['stages'].set(rows.filter((row) => row.flag !== 'QUALIFIED'));
          resolve({
            ...(CRM_SETTINGS_FIXTURES['/settings'] as CrmSettings),
            requireQualifiedStageForConversion: true,
          });
          await stable();
          expect(page['showMissingQualifiedWarning']()).toBe(true);
          expect(requireQualifiedForConversion()).toBe(true);
        });

        it('read-only render', async () => {
          await render(false);
          expect(page['canManage']()).toBe(false);
        expect(
          Array.from(fixture.nativeElement.querySelectorAll('button')).some(
            (button) =>
              (button as HTMLButtonElement).textContent?.trim() ===
              TestBed.inject(TranslocoService).translate('leadStages.new'),
          ),
        ).toBe(false);
          expect(fixture.nativeElement.querySelector('[data-drag-handle]')).toBeNull();
          expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
          expect(page['rowActions'](custom)).toEqual([]);
          expect(page['canRowDrag'](custom)).toBe(false);
          page['openCreate']();
          page['openEdit'](custom);
          await stable();
          expect(modal['isReadOnly']()).toBe(true);
          expect(
            fixture.nativeElement.querySelector('app-lead-stage-modal input[type="text"]').readOnly,
          ).toBe(true);
          const dialog = fixture.nativeElement.querySelector('app-lead-stage-modal');
          const labels = Array.from(dialog.querySelectorAll('button')).map((button) =>
            (button as HTMLButtonElement).textContent?.trim(),
          );
          expect(labels).not.toContain(
            TestBed.inject(TranslocoService).translate('settings.common.save'),
          );
          expect(labels).not.toContain(
            TestBed.inject(TranslocoService).translate('settings.common.delete'),
          );
          await modal['save']();
          await page['makeDefault'](custom);
          await page['requestDelete'](custom);
          expect(stub.recordedWrites()).toHaveLength(0);
        });

        it('forbidden loads send no request without tenant-wide read', async () => {
          const read = vi.spyOn(stub, 'read');
          await render(true, true, false);
          expect(fullState()?.kind()).toBe('forbidden');
          expect(read).not.toHaveBeenCalled();
          expect(readSettings).not.toHaveBeenCalled();
        });

        it('403 loads show forbidden and write restrictions switch the page to read-only', async () => {
          const read = vi
            .spyOn(stub, 'read')
            .mockRejectedValue(new ApiError(403, 'CRM_MODULE_SEAT_REQUIRED'));
          await render();
          expect(fullState()?.kind()).toBe('forbidden');
          read.mockResolvedValue(rows);
          page['reload']();
          await stable();
          vi.spyOn(stub, 'write').mockRejectedValue(
            new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'),
          );
          await page['makeDefault'](custom);
          await stable();
          expect(page['canManage']()).toBe(false);
          expect(page['loadFailed']()).toBe(false);
        });
      });

      describe('LeadStageModal', () => {
        it('create outcomes', async () => {
          await render();
          page['openCreate']();
          await stable();
          modal['nameAr'].set('متابعة');
          modal['nameEn'].set('Follow up');
          const write = vi
            .spyOn(stub, 'write')
            .mockRejectedValueOnce(
              new ApiError(400, 'CRM_VALIDATION_FAILED', {
                nameAr: ['Invalid Arabic name'],
                nameEn: ['Invalid English name'],
                flag: ['Invalid flag'],
                category: ['Invalid category'],
              }),
            );
          await modal['save']();
          await stable();
          expect(Object.keys(modal['serverErrors']()).sort()).toEqual([
            'category',
            'flag',
            'nameAr',
            'nameEn',
          ]);
          expect(
            fixture.nativeElement.querySelectorAll('app-lead-stage-modal [role="alert"]'),
          ).toHaveLength(4);
          for (const field of fixture.nativeElement.querySelectorAll(
            'app-lead-stage-modal ui-field',
          )) {
            expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
            const control = field.querySelector('input, button[aria-haspopup]');
            if (control)
              for (const id of control.getAttribute('aria-describedby')?.split(' ') ?? [])
                expect(document.getElementById(id)).not.toBeNull();
          }
          const toast = errorToast();
          for (const code of [
            'LEAD_STAGE_CATEGORY_INVALID',
            'LEAD_STAGE_PROTECTED',
            'LEAD_STAGE_LIMIT_EXCEEDED',
          ]) {
            write.mockRejectedValueOnce(new ApiError(422, code));
            await modal['save']();
            expect(toast).toHaveBeenLastCalledWith(
              TestBed.inject(TranslocoService).translate(`leadStages.errors.${code}`),
            );
            expect(modal['nameEn']()).toBe('Follow up');
          }
          const created = { ...custom, id: 'created', nameAr: 'متابعة', nameEn: 'Follow up' };
          write.mockResolvedValueOnce({ status: 201, data: created, etag: null, location: null });
          vi.spyOn(stub, 'read').mockResolvedValue([
            ...rows.slice(0, -2),
            created,
            ...rows.slice(-2),
          ]);
          await modal['save']();
          await stable();
          expect(page['stages']().some((row) => row.id === 'created')).toBe(true);
        });

        it('keeps unsaved values on 401, network, gateway, permission and rate-limit failures', async () => {
          await render();
          page['openCreate']();
          await stable();
          modal['nameAr'].set('متابعة');
          modal['nameEn'].set('Follow up');
          const write = vi.spyOn(stub, 'write');
          const toast = errorToast();
          for (const [status, code, key] of [
            [401, 'UNAUTHORIZED', 'notSaved'],
            [0, 'NETWORK_ERROR', 'network'],
            [503, 'INTERNAL_ERROR', 'generic'],
            [409, 'GW.IDEM.IN_FLIGHT', 'GW.IDEM.IN_FLIGHT'],
            [422, 'GW.IDEM.MISMATCH', 'GW.IDEM.MISMATCH'],
            [403, 'CRM_PERMISSION_DENIED', 'CRM_PERMISSION_DENIED'],
            [429, 'RATE_LIMITED', 'rateLimitedIn'],
          ] as const) {
            write.mockRejectedValueOnce(new ApiError(status, code, { retryAfterSeconds: ['9'] }));
            await modal['save']();
            expect(toast).toHaveBeenLastCalledWith(
              TestBed.inject(TranslocoService).translate(`settings.errors.${key}`, {
                seconds: '9',
              }),
            );
            expect(modal['nameEn']()).toBe('Follow up');
            expect(modal['saving']()).toBe(false);
          }
          write.mockRejectedValueOnce(new ApiError(403, 'SEAT_OVER_CAPACITY_READ_ONLY'));
          await modal['save']();
          await stable();
          expect(modal['isReadOnly']()).toBe(true);
          expect(page['canManage']()).toBe(false);
          expect(modal['nameEn']()).toBe('Follow up');
        });

        it('PATCH not found toasts and reloads; PATCH never includes isDefault', async () => {
          await render();
          page['openEdit'](custom);
          await stable();
          modal['nameEn'].set('Changed');
          const write = vi
            .spyOn(stub, 'write')
            .mockRejectedValue(new ApiError(404, 'LEAD_STAGE_NOT_FOUND'));
          const read = vi.spyOn(stub, 'read');
          const toast = errorToast();
          await modal['save']();
          await stable();
          expect(write.mock.calls[0][2]).toEqual({ nameEn: 'Changed' });
          expect(read).toHaveBeenCalledOnce();
          expect(toast).toHaveBeenCalledOnce();
        });
      });
    });
  }
