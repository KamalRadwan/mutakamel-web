import { Injectable, signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arReasons from '../../../../../../public/i18n/settings-reasons/ar.json';
import enReasons from '../../../../../../public/i18n/settings-reasons/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { ReasonModal } from './reason-modal/reason-modal';
import { ReasonsPage } from './reasons-page';
import { REASON_KINDS, type Reason } from './reasons.model';

const row: Reason = { id: 'reason-one', reasonKind: 'LOSS', code: 'PRICE', nameEn: 'Price', nameAr: 'السعر',
  definitionEn: null, definitionAr: null, polarity: null, activityType: null, isSystem: false, isActive: true, sortOrder: 10, revision: 1 };
const readKey = 'crm.settings.read';
const manageKey = 'crm.settings.manage';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const translations: Record<string, Translation> = {
  en: { ...en, settings: enSettings, reasons: enReasons, recordPage: enRecord },
  ar: { ...ar, settings: arSettings, reasons: arReasons, recordPage: arRecord },
  'settings/en': enSettings, 'settings/ar': arSettings,
  'settings-reasons/en': enReasons, 'settings-reasons/ar': arReasons,
  'record-page/en': enRecord, 'record-page/ar': arRecord,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}
const response = (data: unknown) => ({ data, status: 200, etag: null, location: null });

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`${lang} ${theme}`, () => {
    const me = signal<TenantMe | null>(null);
    const leadsAnywhere = signal(true);
    const opportunitiesAnywhere = signal(true);
    let stub: CrmHttpStub;
    let dispose: () => void;
    let fixtures: Record<string, unknown>;
    let previousTheme: string | null;
    let previousDir: string;
    const dialog = HTMLDialogElement.prototype;
    const originalDialog = { showModal: dialog.showModal, close: dialog.close };

    beforeEach(() => {
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      dialog.showModal = function () { this.open = true; };
      dialog.close = function () {
        if (!this.open) return;
        this.open = false;
        queueMicrotask(() => this.dispatchEvent(new Event('close')));
      };
      previousTheme = document.documentElement.getAttribute('data-theme');
      previousDir = document.documentElement.dir;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      leadsAnywhere.set(true);
      opportunitiesAnywhere.set(true);
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [readKey, manageKey], permissionScopes: {
        [readKey]: { tenantWide: true, companyIds: [], branchIds: [] },
        [manageKey]: { tenantWide: true, companyIds: [], branchIds: [] },
      } });
      fixtures = { '/settings/reasons': { items: [structuredClone(row)] } };
      stub = new CrmHttpStub(fixtures);
      dispose = bindCrmHttpForTest(stub);
      TestBed.configureTestingModule({ providers: [provideRouter([]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false }, loader: Loader }),
        { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal(lang) } },
        { provide: CrmModules, useValue: { leadsAnywhere, opportunitiesAnywhere, ensureLoaded: () => Promise.resolve() } },
      ] });
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

    async function render<T>(type: Type<T>): Promise<ComponentFixture<T>> {
      await firstValueFrom(TestBed.inject(TranslocoService).load(lang));
      const fixture = TestBed.createComponent(type);
      if (fixture.componentInstance instanceof ReasonModal) fixture.componentRef.setInput('canManage', true);
      fixture.detectChanges();
      if (fixture.componentInstance instanceof ReasonsPage) {
        const page = fixture.componentInstance;
        await vi.waitFor(() => expect(page['loading']()).toBe(false));
      }
      await settle(fixture);
      return fixture;
    }
    async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
      await fixture.whenStable();
      fixture.detectChanges();
    }
    function text(key: string): string { return TestBed.inject(TranslocoService).translate(key); }
    function fill(modal: ReasonModal): void {
      modal['form'].update((value) => ({ ...value, code: 'PRICE_NEW', nameEn: 'New price', nameAr: 'سعر جديد' }));
    }
    function reasonModal(fixture: ComponentFixture<ReasonsPage>): ReasonModal { return fixture.componentInstance['reasonModal'](); }

    describe('ReasonsPage', () => {
      it('stale keep my changes', async () => {
        const fixture = await render(ReasonsPage);
        fixture.componentInstance['openEdit'](row);
        const modal = reasonModal(fixture);
        modal['form'].update((value) => ({ ...value, nameEn: 'My name' }));
        const fresh = { ...row, nameAr: 'اسم جديد من الخادم', revision: 8 };
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_REASON_REVISION_STALE'))
          .mockResolvedValueOnce(response({ ...fresh, nameEn: 'My name', revision: 9 }));
        await modal['save']();
        await settle(fixture);
        expect(modal['conflictOpen']()).toBe(true);
        expect(fixture.nativeElement.querySelector('ui-conflict-dialog dialog').open).toBe(true);
        fixtures['/settings/reasons'] = { items: [fresh] };
        const button = fixture.nativeElement.querySelector('ui-conflict-dialog button:nth-child(2)') as HTMLButtonElement;
        button.click();
        await settle(fixture);
        expect(write.mock.calls[1][2]).toEqual({ revision: 8, nameEn: 'My name' });
        expect(write.mock.calls[1][3].ifMatch).toBe('"8"');
        expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
        expect(fixture.componentInstance['reasons']()[0]).toMatchObject({ nameEn: 'My name', nameAr: fresh.nameAr, revision: 9 });
      });

      it('revision mismatch reloads', async () => {
        const fixture = await render(ReasonsPage);
        fixture.componentInstance['openEdit'](row);
        const modal = reasonModal(fixture);
        modal['form'].update((value) => ({ ...value, nameEn: 'My draft' }));
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_DASHBOARD_REVISION_MISMATCH'));
        await modal['save']();
        await settle(fixture);
        expect(modal['conflictOpen']()).toBe(true);
        fixtures['/settings/reasons'] = { items: [{ ...row, nameEn: 'Server version', revision: 4 }] };
        (fixture.nativeElement.querySelector('ui-conflict-dialog button') as HTMLButtonElement).click();
        await settle(fixture);
        expect(modal['form']().nameEn).toBe('Server version');
        expect(fixture.componentInstance['reasons']()[0].revision).toBe(4);
        expect(write).toHaveBeenCalledTimes(1);
      });

      it('row activation handles either stale code', async () => {
        const fixture = await render(ReasonsPage);
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_DASHBOARD_REVISION_MISMATCH'))
          .mockResolvedValueOnce(response({ ...row, isActive: false, revision: 6 }));
        await fixture.componentInstance['handleAction'](row, { id: 'deactivate' });
        expect(reasonModal(fixture)['conflictOpen']()).toBe(true);
        fixtures['/settings/reasons'] = { items: [{ ...row, revision: 5 }] };
        await reasonModal(fixture)['saveMineOverStale']();
        expect(write.mock.calls[1][2]).toEqual({ isActive: false, revision: 5 });
        expect(fixture.componentInstance['reasons']()[0].isActive).toBe(false);
      });

      it('tabs follow modules', async () => {
        const fixture = await render(ReasonsPage);
        expect(fixture.nativeElement.querySelectorAll('[role="tab"]').length).toBe(5);
        opportunitiesAnywhere.set(false);
        leadsAnywhere.set(false);
        await settle(fixture);
        expect(fixture.componentInstance['visibleKinds']()).toEqual(['ACTIVITY_OUTCOME', 'CONTACT_ROLE']);
        expect(fixture.componentInstance['activeKind']()).toBe('ACTIVITY_OUTCOME');
        expect(fixture.nativeElement.querySelectorAll('[role="tab"]').length).toBe(2);
      });

      it('read-only render', async () => {
        me.update((value) => ({ ...value!, permissions: [readKey] }));
        const fixture = await render(ReasonsPage);
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-settings-frame').textContent).not.toContain(text('reasons.new'));
        fixture.componentInstance['openCreate']();
        expect(fixture.nativeElement.querySelector('app-reason-modal dialog').open).toBe(false);
        fixture.componentInstance['openEdit'](row);
        await settle(fixture);
        const control = fixture.nativeElement.querySelector('input[id$="-name-en"]') as HTMLInputElement;
        expect(control.readOnly).toBe(true);
        expect(fixture.nativeElement.querySelector('app-reason-modal ui-modal button[variant="primary"]')).toBeNull();
        expect(control.getAttribute('aria-describedby')).toContain('-hint');
        await fixture.componentInstance['handleAction'](row, { id: 'deactivate' });
        expect(stub.recordedWrites()).toEqual([]);
      });

      it('tenant-wide read is required and branch-only manage stays read-only', async () => {
        me.update((value) => ({ ...value!, permissionScopes: {
          [readKey]: { tenantWide: false, companyIds: [], branchIds: ['one'] },
          [manageKey]: { tenantWide: false, companyIds: [], branchIds: ['one'] },
        } }));
        const read = vi.spyOn(stub, 'read');
        const fixture = await render(ReasonsPage);
        expect(read).not.toHaveBeenCalled();
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        me.update((value) => ({ ...value!, permissionScopes: { ...value!.permissionScopes,
          [readKey]: { tenantWide: true, companyIds: [], branchIds: [] },
        } }));
        await fixture.componentInstance['load']();
        await settle(fixture);
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(fixture.componentInstance['reasons']()).toEqual([row]);
      });

      it.each([0, 503, 403])('load failure %s uses shared state, correlation and retry', async (status) => {
        vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(status, status === 403 ? 'CRM_MODULE_DISABLED' : 'ENTITLEMENT_UNAVAILABLE', undefined, { correlationId: 'reason-reference' }));
        const fixture = await render(ReasonsPage);
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        expect(fixture.componentInstance['failure']()?.kind).toBe(status === 403 ? 'forbidden' : 'load-failure');
        expect(fixture.nativeElement.textContent).toContain('reason-reference');
        expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
        if (status !== 403) {
          await fixture.componentInstance['load']();
          await settle(fixture);
          expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
        }
      });

      it('read-only write removes page actions and Save, keeping values', async () => {
        const fixture = await render(ReasonsPage);
        fixture.componentInstance['openEdit'](row);
        const modal = reasonModal(fixture);
        modal['form'].update((value) => ({ ...value, nameEn: 'Draft' }));
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, 'SEAT_OVER_CAPACITY_READ_ONLY'));
        await modal['save']();
        await settle(fixture);
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(modal['canEdit']()).toBe(false);
        expect(modal['form']().nameEn).toBe('Draft');
        expect(fixture.nativeElement.querySelector('ui-actions-menu')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-reason-modal ui-modal button[variant="primary"]')).toBeNull();
      });

      it('missing reason reloads the list without resending', async () => {
        const fixture = await render(ReasonsPage);
        fixtures['/settings/reasons'] = { items: [] };
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(404, 'CRM_REASON_NOT_FOUND'));
        await fixture.componentInstance['handleAction'](row, { id: 'deactivate' });
        expect(fixture.componentInstance['reasons']()).toEqual([]);
        expect(write).toHaveBeenCalledTimes(1);
      });
    });

    describe('ReasonModal', () => {
      it('code taken', async () => {
        const fixture = await render(ReasonModal);
        const modal = fixture.componentInstance;
        modal.openCreate('LOSS', 10);
        fill(modal);
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_REASON_CODE_TAKEN'));
        await modal['save']();
        await settle(fixture);
        expect(modal['errorText']('code')).toBe(text('reasons.errors.CRM_REASON_CODE_TAKEN'));
        expect(fixture.nativeElement.querySelector('input[id$="-code"]').getAttribute('aria-invalid')).toBe('true');
        expect(fixture.nativeElement.textContent).toContain(text('reasons.errors.CRM_REASON_CODE_TAKEN'));
      });

      it.each([0, 503, 401, 409])('create keeps draft, body and key after %s, changes key when body changes', async (status) => {
        const fixture = await render(ReasonModal);
        const modal = fixture.componentInstance;
        modal.openCreate('LOSS', 10);
        fill(modal);
        const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'NETWORK_ERROR'));
        await modal['save']();
        expect(write).toHaveBeenCalledTimes(1);
        await modal['save']();
        expect(write.mock.calls[1][3].key).toBe(write.mock.calls[0][3].key);
        expect(write.mock.calls[1][2]).toEqual(write.mock.calls[0][2]);
        expect(write.mock.calls[0][3].key).toMatch(uuid);
        if (status === 401) expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(text('settings.errors.notSaved'));
        modal['form'].update((value) => ({ ...value, nameEn: 'Changed' }));
        await modal['save']();
        expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
        expect(modal['form']().code).toBe('PRICE_NEW');
      });

      it('create sends each kind without nulls and keeps all hints', async () => {
        const fixture = await render(ReasonModal);
        const modal = fixture.componentInstance;
        const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(422, 'CRM_REASON_KIND_MISMATCH'));
        for (const kind of REASON_KINDS) {
          modal.openCreate(kind, 10);
          fill(modal);
          if (kind === 'ACTIVITY_OUTCOME') modal['setPolarity']('NEUTRAL');
          await modal['save']();
          await settle(fixture);
          const body = write.mock.calls.at(-1)![2] as Record<string, unknown>;
          expect(body['reasonKind']).toBe(kind);
          expect(Object.values(body)).not.toContain(null);
          expect(body['activityType']).toBeUndefined();
          expect(body['polarity']).toBe(kind === 'ACTIVITY_OUTCOME' ? 'NEUTRAL' : undefined);
          for (const field of fixture.nativeElement.querySelectorAll('ui-field')) {
            const hint = field.querySelector('[role="tooltip"]');
            expect(hint, field.textContent).not.toBeNull();
          }
        }
      });

      it('server validation messages stay on their fields and editing clears them', async () => {
        const fixture = await render(ReasonModal);
        const modal = fixture.componentInstance;
        modal.openCreate('LOSS', 10);
        fill(modal);
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { nameEn: ['Server field message'] }));
        await modal['save']();
        expect(modal['errorText']('nameEn')).toBe('Server field message');
        const target = document.createElement('input');
        target.value = 'Corrected';
        modal['onFieldInput']('nameEn', { target } as unknown as Event);
        expect(modal['errorText']('nameEn')).toBeNull();
        expect(TestBed.inject(Notify).toasts()).toEqual([]);
      });

      it('nonretryable create errors use a fresh key on the next explicit save', async () => {
        const fixture = await render(ReasonModal);
        const modal = fixture.componentInstance;
        modal.openCreate('LOSS', 10);
        fill(modal);
        const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(422, 'CRM_REASON_KIND_MISMATCH'));
        await modal['save']();
        expect(write).toHaveBeenCalledTimes(1);
        await modal['save']();
        expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
      });

      it('rate limit shows retry-after and system reasons never deactivate', async () => {
        const fixture = await render(ReasonModal);
        const modal = fixture.componentInstance;
        modal.openEdit({ ...row, isSystem: true });
        modal['setActive'](false);
        expect(modal['editPatch']()).toEqual({});
        modal.showWriteError(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }));
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toContain('12');
      });
    });
  });
}
