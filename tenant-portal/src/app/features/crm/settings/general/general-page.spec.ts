import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
  type Translation,
} from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arGeneral from '../../../../../../public/i18n/settings-general/ar.json';
import enGeneral from '../../../../../../public/i18n/settings-general/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { CrmCallSettings } from '../../../../shared/widgets/phone-actions/crm-call-settings';
import { StaffReadAccess } from '../../../workspace/staff/staff-read-access';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import type { CrmModulesState } from '../../shared/crm-modules/crm-modules.model';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { GeneralPage } from './general-page';
import type { CrmSettings } from './general.model';

const translations: Record<string, Translation> = {
  en: { ...en, settings: enSettings, general: enGeneral, recordPage: enRecord },
  ar: { ...ar, settings: arSettings, general: arGeneral, recordPage: arRecord },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'settings-general/en': enGeneral,
  'settings-general/ar': arGeneral,
  'record-page/en': enRecord,
  'record-page/ar': arRecord,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(translations[path] ?? {}));
  }
}
const response = (data: unknown) => ({ data, status: 200, etag: null, location: null });
const initial = CRM_SETTINGS_FIXTURES['/settings'] as CrmSettings;
const readKey = 'crm.settings.read';
const manageKey = 'crm.settings.manage';
const companyId = '01940000-0000-7000-8000-000000000001';
const moduleState = (companies = true): CrmModulesState => ({
  revision: 4,
  defaults: { leadsEnabled: true, opportunitiesEnabled: true },
  companies: companies
    ? [
        {
          companyId,
          code: 'CO1',
          name: 'Company One',
          status: 'ACTIVE',
          override: { leadsEnabled: null, opportunitiesEnabled: null },
          effective: { leadsEnabled: true, opportunitiesEnabled: true },
        },
      ]
    : [],
});

for (const lang of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`GeneralPage ${lang} ${theme}`, () => {
      const me = signal<TenantMe | null>(null);
      let stub: CrmHttpStub;
      let dispose: () => void;
      let fixtures: Record<string, unknown>;
      const coreRead = vi.fn();
      const refreshCalls = vi.fn().mockResolvedValue(undefined);
      const staffAllows = vi.fn().mockReturnValue(true);
      let previousTheme: string | null;
      let previousDir: string;
      const dialog = HTMLDialogElement.prototype;
      const originalDialog = { showModal: dialog.showModal, close: dialog.close };

      function permissions(keys: string[]) {
        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions: keys,
          permissionScopes: Object.fromEntries(
            keys.map((key) => [key, { tenantWide: true, companyIds: [], branchIds: [] }]),
          ),
        });
      }
      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        dialog.showModal = function () {
          this.open = true;
        };
        dialog.close = function () {
          if (!this.open) return;
          this.open = false;
          queueMicrotask(() => this.dispatchEvent(new Event('close')));
        };
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        permissions([
          readKey,
          manageKey,
          'webphone.settings.read',
          'webphone.extensions.read',
          'crm.pipelines.read',
        ]);
        fixtures = {
          '/settings/modules': moduleState(false),
          '/settings': {
            ...initial,
            leadsEnabled: true,
            opportunitiesEnabled: true,
            outboundEmailContentRetentionDays: 730,
            outboundEmailRetentionPolicyRevision: 1,
          },
          '/pipelines': [
            {
              id: initial.defaultPipelineId,
              nameEn: 'Default sales',
              nameAr: 'المبيعات الافتراضية',
              isDefault: true,
            },
          ],
        };
        stub = new CrmHttpStub(fixtures);
        dispose = bindCrmHttpForTest(stub);
        coreRead
          .mockReset()
          .mockImplementation((path: string) =>
            Promise.resolve(
              path.endsWith('/servers')
                ? [{ id: 'one' }]
                : { allowed: 10, occupied: 3, available: 7, overAllowance: false },
            ),
          );
        refreshCalls.mockClear();
        staffAllows.mockClear().mockReturnValue(true);
        TestBed.configureTestingModule({
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
                prodMode: false,
              },
              loader: Loader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            {
              provide: ScopeState,
              useValue: { companies: signal([]), company: signal({ id: 'company' }) },
            },
            { provide: CoreHttp, useValue: { read: coreRead } },
            { provide: CrmCallSettings, useValue: { refresh: refreshCalls } },
            { provide: StaffReadAccess, useValue: { allows: staffAllows } },
          ],
        });
      });
      afterEach(() => {
        TestBed.resetTestingModule();
        dispose();
        vi.restoreAllMocks();
        if (originalDialog.showModal) dialog.showModal = originalDialog.showModal;
        else Reflect.deleteProperty(dialog, 'showModal');
        if (originalDialog.close) dialog.close = originalDialog.close;
        else Reflect.deleteProperty(dialog, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
      });
      async function render(): Promise<ComponentFixture<GeneralPage>> {
        await firstValueFrom(TestBed.inject(TranslocoService).load(lang));
        const fixture = TestBed.createComponent(GeneralPage);
        fixture.detectChanges();
        await settle(fixture);
        return fixture;
      }
      async function settle(fixture: ComponentFixture<GeneralPage>) {
        await fixture.whenStable();
        fixture.detectChanges();
      }
      function text(key: string) {
        return TestBed.inject(TranslocoService).translate(key);
      }
      function saveResponse(patch: Partial<CrmSettings>) {
        const next = { ...(fixtures['/settings'] as CrmSettings), ...patch };
        fixtures['/settings'] = next;
        return response(next);
      }
      function input(fixture: ComponentFixture<GeneralPage>, days: string) {
        const field = fixture.nativeElement.querySelector(
          'input[id$="-retention-days"]',
        ) as HTMLInputElement;
        field.value = days;
        field.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      }

      it('loads settings', async () => {
        const fixture = await render();
        expect(fixture.componentInstance['settings']()).toEqual(fixtures['/settings']);
        expect(fixture.nativeElement.textContent).toContain(text('general.sections.email.title'));
        expect(fixture.nativeElement.textContent).toContain(text('general.sections.phone.title'));
        expect(fixture.nativeElement.querySelector('input[id$="-default-pipeline"]').value).toBe(
          lang === 'ar' ? 'المبيعات الافتراضية' : 'Default sales',
        );
        expect(fixture.nativeElement.querySelector('input[id$="-analytics-tz"]')).toBeNull();
        expect(document.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
        expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
      });

      it('settings failure does not break the other cards', async () => {
        const read = vi.spyOn(stub, 'read').mockRejectedValue(
          new ApiError(503, 'CRM_SETTINGS_MISSING', undefined, {
            correlationId: 'general-proof',
          }),
        );
        const fixture = await render();
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain('general-proof');
        expect(fixture.componentInstance['phoneSummary']()).toMatchObject({
          servers: 1,
          allowed: 10,
        });
        expect(fixture.nativeElement.textContent).toContain(text('general.sections.phone.title'));
        read.mockRestore();
        fixture.componentInstance['reloadSettings']();
        await settle(fixture);
        expect(fixture.componentInstance['settings']()).not.toBeNull();
      });

      it('toggle saves and keeps the response', async () => {
        const fixture = await render();
        const server = saveResponse({
          logCallsAsActivities: false,
          requireQualifiedStageForConversion: true,
        });
        vi.spyOn(stub, 'write').mockResolvedValueOnce(server);
        await fixture.componentInstance['toggleLogCalls'](false);
        await settle(fixture);
        expect(fixture.componentInstance['settings']()).toEqual(server.data);
      });

      it('failed toggle rolls back', async () => {
        const fixture = await render();
        const before = fixture.componentInstance['settings']();
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(500, 'FAILED'));
        await fixture.componentInstance['toggleLogCalls'](!before!.logCallsAsActivities);
        await settle(fixture);
        expect(fixture.componentInstance['settings']()).toEqual(before);
        expect(TestBed.inject(Notify).toasts().at(-1)?.type).toBe('error');
      });

      it('default flip reloads modules', async () => {
        const fixture = await render();
        vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
        const modules = TestBed.inject(CrmModules);
        const reload = vi.spyOn(modules, 'reload');
        vi.spyOn(stub, 'write').mockImplementationOnce(async () => {
          fixtures['/settings/modules'] = {
            ...moduleState(false),
            defaults: { leadsEnabled: false, opportunitiesEnabled: true },
          };
          return saveResponse({ leadsEnabled: false });
        });
        await fixture.componentInstance['toggleModuleDefault']('leads', false);
        await settle(fixture);
        expect(reload).toHaveBeenCalledOnce();
        expect(modules.leadsAnywhere()).toBe(false);
        expect(modules.state()?.revision).toBe(4);
      });

      it('overrides section', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        expect(fixture.nativeElement.querySelector('[role="table"]')).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain(text('general.modules.companiesTitle'));
        expect(fixture.nativeElement.textContent).toContain('Company One');
        expect(fixture.nativeElement.textContent).toContain(text('general.modules.fromDefault'));
        for (const module of ['leads', 'opportunities']) {
          const hint = fixture.nativeElement.querySelector(`[id$="-col-${module}-hint"]`);
          expect(hint.textContent.trim()).toBe(text('general.modules.colHint'));
          expect(
            fixture.nativeElement.querySelector(`[role="cell"][aria-describedby="${hint.id}"]`),
          ).not.toBeNull();
        }
        const next = moduleState();
        next.revision = 5;
        next.companies[0].override.leadsEnabled = true;
        vi.spyOn(stub, 'write').mockResolvedValueOnce(response(next));
        await fixture.componentInstance['onCompanyModuleSelected'](
          moduleState().companies[0],
          'leads',
          'on',
        );
        await settle(fixture);
        expect(TestBed.inject(CrmModules).state()?.revision).toBe(5);
      });

      it('override errors', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const company = moduleState().companies[0];
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(409, 'CRM_MODULE_SETTINGS_STALE'));
        fixtures['/settings/modules'] = { ...moduleState(), revision: 7 };
        await fixture.componentInstance['onCompanyModuleSelected'](company, 'leads', 'on');
        await settle(fixture);
        expect(fixture.nativeElement.querySelector('ui-modal dialog').open).toBe(true);
        expect(write).toHaveBeenCalledOnce();
        expect(TestBed.inject(CrmModules).state()?.revision).toBe(7);
        await fixture.componentInstance['reloadModulesConflict']();
        expect(fixture.componentInstance['pendingModuleConflict']()).toBeNull();
        expect(write).toHaveBeenCalledOnce();

        write.mockRejectedValueOnce(new ApiError(404, 'CRM_COMPANY_NOT_FOUND'));
        fixtures['/settings/modules'] = moduleState(false);
        await fixture.componentInstance['onCompanyModuleSelected'](company, 'leads', 'on');
        await settle(fixture);
        expect(TestBed.inject(CrmModules).state()?.companies).toEqual([]);
        expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(
          text('general.errors.CRM_COMPANY_NOT_FOUND'),
        );
        expect(write).toHaveBeenCalledTimes(2);
      });

      it('keeps the override on the fresh revision only after the user chooses it', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(409, 'CRM_MODULE_SETTINGS_STALE'));
        await fixture.componentInstance['onCompanyModuleSelected'](
          moduleState().companies[0],
          'leads',
          'on',
        );
        fixtures['/settings/modules'] = { ...moduleState(), revision: 8 };
        const next = moduleState();
        next.revision = 9;
        next.companies[0].override.leadsEnabled = true;
        write.mockResolvedValueOnce(response(next));
        await fixture.componentInstance['keepCompanyModuleOverStale']();
        await settle(fixture);
        expect(write.mock.calls[1][2]).toEqual({ expectedRevision: 8, leadsEnabled: true });
        expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
        expect(fixture.componentInstance['pendingModuleConflict']()).toBeNull();
        expect(TestBed.inject(CrmModules).state()?.revision).toBe(9);
      });

      it('failed conflict reload keeps the edit without writing on a stale revision', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(409, 'CRM_MODULE_SETTINGS_STALE'));
        await fixture.componentInstance['onCompanyModuleSelected'](
          moduleState().companies[0],
          'leads',
          'on',
        );
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'CRM_SETTINGS_MISSING'));
        await fixture.componentInstance['keepCompanyModuleOverStale']();
        expect(write).toHaveBeenCalledOnce();
        expect(fixture.componentInstance['pendingModuleConflict']()?.value).toBe(true);
        expect(TestBed.inject(Notify).toasts().at(-1)?.type).toBe('error');
      });

      it('dismissing the conflict allows another company action', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const company = moduleState().companies[0];
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(409, 'CRM_MODULE_SETTINGS_STALE'));
        await fixture.componentInstance['onCompanyModuleSelected'](company, 'leads', 'on');
        fixture.componentInstance['modulesConflictModal']().close();
        await settle(fixture);
        expect(fixture.componentInstance['pendingModuleConflict']()).toBeNull();
        write.mockResolvedValueOnce(response(moduleState()));
        await fixture.componentInstance['onCompanyModuleSelected'](company, 'opportunities', 'on');
        expect(write).toHaveBeenCalledTimes(2);
      });

      it('a company removed during conflict recovery reloads and closes the modal', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(409, 'CRM_MODULE_SETTINGS_STALE'));
        await fixture.componentInstance['onCompanyModuleSelected'](
          moduleState().companies[0],
          'leads',
          'on',
        );
        fixtures['/settings/modules'] = { ...moduleState(false), revision: 8 };
        write.mockRejectedValueOnce(new ApiError(404, 'CRM_COMPANY_NOT_FOUND'));
        await fixture.componentInstance['keepCompanyModuleOverStale']();
        await settle(fixture);
        expect(fixture.componentInstance['pendingModuleConflict']()).toBeNull();
        expect(fixture.nativeElement.querySelector('ui-modal dialog').open).toBe(false);
        expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(
          text('general.errors.CRM_COMPANY_NOT_FOUND'),
        );
      });

      it('serializes override writes using the revision returned by the previous write', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const company = moduleState().companies[0];
        const write = vi
          .spyOn(stub, 'write')
          .mockResolvedValueOnce(response({ ...moduleState(), revision: 5 }))
          .mockResolvedValueOnce(response({ ...moduleState(), revision: 6 }));
        await Promise.all([
          fixture.componentInstance['onCompanyModuleSelected'](company, 'leads', 'on'),
          fixture.componentInstance['onCompanyModuleSelected'](company, 'opportunities', 'on'),
        ]);
        expect(write.mock.calls.map((call) => call[2])).toEqual([
          { expectedRevision: 4, leadsEnabled: true },
          { expectedRevision: 5, opportunitiesEnabled: true },
        ]);
        expect(fixture.componentInstance['savingCells']().size).toBe(0);
      });

      it('a read-only subscription stops queued company writes and removes their controls', async () => {
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        const company = moduleState().companies[0];
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
        await Promise.all([
          fixture.componentInstance['onCompanyModuleSelected'](company, 'leads', 'on'),
          fixture.componentInstance['onCompanyModuleSelected'](company, 'opportunities', 'on'),
        ]);
        await settle(fixture);
        expect(write).toHaveBeenCalledOnce();
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(fixture.componentInstance['savingCells']().size).toBe(0);
        expect(fixture.nativeElement.querySelector('[role="table"] ui-menu')).toBeNull();
        expect(fixture.nativeElement.querySelector('[role="table"]')).not.toBeNull();
      });

      for (const status of [0, 403, 503]) {
        it(`module read ${status} shows the existing full state and can retry`, async () => {
          const original = stub.read.bind(stub);
          const read = vi
            .spyOn(stub, 'read')
            .mockImplementation((path, query) =>
              path === '/settings/modules'
                ? Promise.reject(
                    new ApiError(
                      status,
                      status === 403 ? 'CRM_MODULE_DISABLED' : 'FAILED',
                      undefined,
                      { correlationId: 'module-proof' },
                    ),
                  )
                : original(path, query),
            );
          const fixture = await render();
          expect(fixture.componentInstance['modulesFailed']()).toBe(true);
          expect(fixture.componentInstance['modulesLoadError']().kind).toBe(
            status === 403 ? 'forbidden' : 'load-failure',
          );
          expect(fixture.nativeElement.textContent).toContain('module-proof');
          expect(fixture.componentInstance['settings']()).not.toBeNull();
          read.mockRestore();
          fixtures['/settings/modules'] = moduleState();
          await fixture.componentInstance['retryModules']();
          await settle(fixture);
          expect(fixture.componentInstance['modulesFailed']()).toBe(false);
          expect(fixture.nativeElement.querySelector('[role="table"]')).not.toBeNull();
        });
      }

      it('company overrides remain readable without tenant-wide manage', async () => {
        permissions([readKey]);
        fixtures['/settings/modules'] = moduleState();
        const fixture = await render();
        expect(fixture.nativeElement.querySelector('[role="table"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('[role="table"] ui-menu')).toBeNull();
        await fixture.componentInstance['onCompanyModuleSelected'](
          moduleState().companies[0],
          'leads',
          'on',
        );
        expect(stub.recordedWrites()).toEqual([]);
      });

      it('company overrides hidden without companies', async () => {
        const fixture = await render();
        expect(fixture.componentInstance['companies']()).toEqual([]);
        expect(
          Array.from(fixture.nativeElement.querySelectorAll('h3')).some(
            (heading) =>
              (heading as HTMLElement).textContent?.trim() ===
              text('general.modules.companiesTitle'),
          ),
        ).toBe(false);
        expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
      });

      it('lowering retention asks to confirm', async () => {
        const fixture = await render();
        input(fixture, '365');
        const open = vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(false);
        const write = vi.spyOn(stub, 'write');
        await fixture.componentInstance['saveRetention']();
        expect(open).toHaveBeenCalledOnce();
        expect(write).not.toHaveBeenCalled();
        expect(fixture.componentInstance['retentionConfirmText']()).toContain('730');
        expect(fixture.componentInstance['retentionConfirmText']()).toContain('365');
        expect(
          fixture.nativeElement.querySelector('ui-confirm-dialog[tone="danger"]'),
        ).not.toBeNull();
      });

      it('lowering retention writes only after confirmation', async () => {
        const fixture = await render();
        input(fixture, '365');
        const open = vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
        const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(
          saveResponse({
            outboundEmailContentRetentionDays: 365,
            outboundEmailRetentionPolicyRevision: 2,
          }),
        );
        await fixture.componentInstance['saveRetention']();
        await settle(fixture);
        expect(open).toHaveBeenCalledOnce();
        expect(write.mock.calls[0][2]).toEqual({
          outboundEmailContentRetentionDays: 365,
          expectedOutboundEmailRetentionPolicyRevision: 1,
        });
      });

      it('raising retention saves without confirm', async () => {
        const fixture = await render();
        input(fixture, '900');
        const open = vi.spyOn(ConfirmDialog.prototype, 'open');
        const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(
          saveResponse({
            outboundEmailContentRetentionDays: 900,
            outboundEmailRetentionPolicyRevision: 2,
          }),
        );
        await fixture.componentInstance['saveRetention']();
        await settle(fixture);
        expect(open).not.toHaveBeenCalled();
        expect(write.mock.calls[0][2]).toEqual({
          outboundEmailContentRetentionDays: 900,
          expectedOutboundEmailRetentionPolicyRevision: 1,
        });
      });

      it('retention 409 opens the conflict modal', async () => {
        const fixture = await render();
        input(fixture, '900');
        const write = vi
          .spyOn(stub, 'write')
          .mockRejectedValueOnce(new ApiError(409, 'CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE'));
        await fixture.componentInstance['saveRetention']();
        await settle(fixture);
        expect(fixture.componentInstance['retentionConflictOpen']()).toBe(true);
        expect(fixture.nativeElement.querySelector('ui-conflict-dialog dialog').open).toBe(true);
        fixtures['/settings'] = {
          ...(fixtures['/settings'] as CrmSettings),
          outboundEmailRetentionPolicyRevision: 7,
        };
        await fixture.componentInstance['saveRetentionOverStale']();
        await settle(fixture);
        expect(write).toHaveBeenCalledOnce();
        expect(fixture.componentInstance['retentionInput']()).toBe('900');
        write.mockResolvedValueOnce(
          saveResponse({
            outboundEmailContentRetentionDays: 900,
            outboundEmailRetentionPolicyRevision: 8,
          }),
        );
        await fixture.componentInstance['saveRetention']();
        await settle(fixture);
        expect(write.mock.calls[1][2]).toEqual({
          outboundEmailContentRetentionDays: 900,
          expectedOutboundEmailRetentionPolicyRevision: 7,
        });
      });

      it('retention Reload discards the draft', async () => {
        const fixture = await render();
        input(fixture, '900');
        fixtures['/settings'] = {
          ...(fixtures['/settings'] as CrmSettings),
          outboundEmailContentRetentionDays: 400,
          outboundEmailRetentionPolicyRevision: 7,
        };
        fixture.componentInstance['retentionConflictOpen'].set(true);
        await fixture.componentInstance['reloadRetention']();
        await settle(fixture);
        expect(fixture.componentInstance['retentionInput']()).toBe('400');
        expect(fixture.componentInstance['retentionConflictOpen']()).toBe(false);
      });

      for (const [code, key] of [
        ['WEBPHONE_PROVISIONING_PENDING', 'provisioning'],
        ['WEBPHONE_MODULE_NOT_PURCHASED', 'notSubscribed'],
      ] as const) {
        it(key === 'provisioning' ? 'phone being set up' : 'phone not subscribed', async () => {
          coreRead.mockRejectedValue(new ApiError(key === 'provisioning' ? 409 : 403, code));
          const fixture = await render();
          expect(fixture.nativeElement.textContent).toContain(text(`general.telephony.${key}`));
          expect(fixture.componentInstance['phoneSummaryFailed']()).toBe(false);
          expect(fixture.componentInstance['settings']()).not.toBeNull();
        });
      }

      it('phone card hidden without permission', async () => {
        permissions([readKey, manageKey]);
        const fixture = await render();
        expect(coreRead).not.toHaveBeenCalled();
        expect(fixture.nativeElement.textContent).not.toContain(
          text('general.sections.phone.title'),
        );
      });

      it('phone failure can retry without disturbing settings', async () => {
        coreRead.mockRejectedValue(new ApiError(500, 'FAILED'));
        const fixture = await render();
        expect(fixture.componentInstance['settings']()).not.toBeNull();
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        coreRead.mockImplementation((path: string) =>
          Promise.resolve(
            path.endsWith('/servers')
              ? []
              : { allowed: 0, occupied: 0, available: 0, overAllowance: false },
          ),
        );
        await fixture.componentInstance['retryPhoneSummary']();
        await settle(fixture);
        expect(fixture.componentInstance['phoneSummary']()).toMatchObject({ servers: 0 });
      });

      it('default pipeline label hidden when unreadable', async () => {
        permissions([readKey, manageKey]);
        const read = vi.spyOn(stub, 'read');
        const fixture = await render();
        expect(read.mock.calls.every(([path]) => path !== '/pipelines')).toBe(true);
        expect(fixture.nativeElement.querySelector('input[id$="-default-pipeline"]')).toBeNull();
      });

      it('default pipeline label hidden on failure', async () => {
        const original = stub.read.bind(stub);
        vi.spyOn(stub, 'read').mockImplementation((path, query) =>
          path === '/pipelines'
            ? Promise.reject(new ApiError(403, 'CRM_PERMISSION_DENIED'))
            : original(path, query),
        );
        const fixture = await render();
        expect(fixture.nativeElement.querySelector('input[id$="-default-pipeline"]')).toBeNull();
        expect(fixture.componentInstance['settings']()).not.toBeNull();
      });

      it('read-only plan switches to read-only', async () => {
        const fixture = await render();
        vi.spyOn(stub, 'write').mockRejectedValueOnce(
          new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'),
        );
        await fixture.componentInstance['toggleLogCalls'](false);
        await settle(fixture);
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(fixture.nativeElement.querySelector('ui-switch')).toBeNull();
        expect(fixture.nativeElement.querySelector('input[id$="-retention-days"]').readOnly).toBe(
          true,
        );
        expect(TestBed.inject(Notify).toasts().at(-1)?.type).toBe('error');
      });

      it('read-only render', async () => {
        permissions([readKey]);
        const fixture = await render();
        expect(fixture.nativeElement.querySelector('ui-switch')).toBeNull();
        expect(fixture.nativeElement.querySelector('input[id$="-leads-default"]').readOnly).toBe(
          true,
        );
        expect(fixture.nativeElement.querySelector('input[id$="-retention-days"]').readOnly).toBe(
          true,
        );
        expect(
          Array.from(fixture.nativeElement.querySelectorAll('button')).some(
            (button) =>
              !(button as HTMLElement).closest('dialog') &&
              (button as HTMLElement).textContent?.trim() === text('settings.common.save'),
          ),
        ).toBe(false);
        await fixture.componentInstance['toggleClickToCall'](false);
        expect(stub.recordedWrites()).toEqual([]);
      });

      it('branch-only manage remains read-only', async () => {
        me.update((current) => ({
          ...current!,
          permissionScopes: {
            ...current!.permissionScopes,
            [manageKey]: { tenantWide: false, companyIds: [], branchIds: ['one'] },
          },
        }));
        const fixture = await render();
        expect(fixture.componentInstance['canManage']()).toBe(false);
      });

      it('every visible field keeps its hint linked to the real control', async () => {
        const fixture = await render();
        for (const field of Array.from(
          fixture.nativeElement.querySelectorAll('ui-field'),
        ) as HTMLElement[]) {
          const control = field.querySelector('input, [role="switch"]');
          if (!control) continue;
          const id = control.id;
          expect(id).toBeTruthy();
          expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(`${id}-hint`);
          expect(field.querySelector(`[id="${id}-hint"]`)?.textContent?.trim()).toBeTruthy();
        }
      });

      it('read-only fields keep their hints linked', async () => {
        permissions([readKey]);
        const fixture = await render();
        for (const control of Array.from(
          fixture.nativeElement.querySelectorAll('ui-field input'),
        ) as HTMLInputElement[]) {
          expect(control.readOnly).toBe(true);
          expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(
            `${control.id}-hint`,
          );
          expect(
            fixture.nativeElement.querySelector(`[id="${control.id}-hint"]`)?.textContent?.trim(),
          ).toBeTruthy();
        }
      });

      it('retention validation uses the field message and preserves the draft', async () => {
        const fixture = await render();
        input(fixture, '900');
        vi.spyOn(stub, 'write').mockRejectedValueOnce(
          new ApiError(400, 'CRM_VALIDATION_FAILED', {
            outboundEmailContentRetentionDays: ['Server message'],
          }),
        );
        await fixture.componentInstance['saveRetention']();
        await settle(fixture);
        expect(fixture.nativeElement.textContent).toContain('Server message');
        expect(fixture.componentInstance['retentionInput']()).toBe('900');
      });

      it('401 keeps the values and reports not saved', async () => {
        const fixture = await render();
        input(fixture, '900');
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED'));
        await fixture.componentInstance['saveRetention']();
        await settle(fixture);
        expect(fixture.componentInstance['retentionInput']()).toBe('900');
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(text('general.errors.notSaved'));
      });

      it('staff link follows StaffReadAccess', async () => {
        staffAllows.mockReturnValue(false);
        const fixture = await render();
        expect(staffAllows).toHaveBeenCalledWith('users');
        expect(fixture.nativeElement.querySelector('a[href="/workspace/staff/users"]')).toBeNull();
      });
    });
  }
