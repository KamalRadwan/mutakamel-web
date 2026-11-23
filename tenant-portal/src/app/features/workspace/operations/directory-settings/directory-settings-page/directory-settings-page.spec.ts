import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/ws-directory-settings/en.json';
import ar from '../../../../../../../public/i18n/ws-directory-settings/ar.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../../public/i18n/settings/ar.json';
import enGlobal from '../../../../../../../public/i18n/en.json';
import arGlobal from '../../../../../../../public/i18n/ar.json';
import enRecord from '../../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { DirectorySettingsApi } from '../directory-settings.api';
import { DirectorySettings, DirectorySettingsResult, DuplicateScope } from '../directory-settings.model';
import { DirectorySettingsPage } from './directory-settings-page';

const initial: DirectorySettings = {
  id: 'settings', version: 1, duplicateScope: 'TENANT',
  preventDuplicateEmail: true, preventDuplicatePhone: true, preventDuplicateWhatsapp: true,
  maxContactMethodsPerParty: 20, maxAddressesPerParty: 20,
  createdAt: '2026-01-10T09:00:00.000Z', updatedAt: '2026-01-10T09:00:00.000Z',
};
function result(patch: Partial<DirectorySettings> = {}): DirectorySettingsResult {
  const settings = { ...initial, ...patch };
  return { settings, etag: `"${settings.version}"` };
}
const translations: Record<string, Translation> = {
  en: enGlobal, ar: arGlobal, 'settings/en': enSettings, 'settings/ar': arSettings,
  'ws-directory-settings/en': en, 'ws-directory-settings/ar': ar,
  'record-page/en': enRecord, 'record-page/ar': arRecord,
};
class TestLoader {
  getTranslation(path: string) { return of(translations[path] ?? {}); }
}
interface Actor {
  isTenantOwner: boolean;
  permissions: string[];
  permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
}

describe('DirectorySettingsPage', () => {
  for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
    describe(`${language}, ${theme}`, () => {
      let fixture: ComponentFixture<DirectorySettingsPage>;
      let page: DirectorySettingsPage;
      const me = signal<Actor>({ isTenantOwner: true, permissions: [], permissionScopes: {} });
      const api = { getDirectorySettings: vi.fn<() => Promise<DirectorySettingsResult>>(),
        updateDirectorySettings: vi.fn<DirectorySettingsApi['updateDirectorySettings']>() };
      const notify = { success: vi.fn(), error: vi.fn() };
      const oldShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
      const oldClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
      let oldTheme: string | null;

      beforeEach(() => {
        oldTheme = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', theme);
        me.set({ isTenantOwner: true, permissions: [], permissionScopes: {} });
        api.getDirectorySettings.mockReset().mockResolvedValue(result());
        api.updateDirectorySettings.mockReset().mockResolvedValue(result({ version: 2 }));
        notify.success.mockReset();
        notify.error.mockReset();
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true,
          value: function (this: HTMLDialogElement) { this.open = true; } });
        Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true,
          value: function (this: HTMLDialogElement) { this.open = false; } });
        TestBed.configureTestingModule({ imports: [DirectorySettingsPage], providers: [
          provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
          provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language,
            missingHandler: { logMissingKey: false } }, loader: TestLoader }),
          { provide: LanguageState, useValue: { current: signal(language) } },
          { provide: TenantScopeState, useValue: { me } },
          { provide: DirectorySettingsApi, useValue: api },
          { provide: Notify, useValue: notify },
        ] });
      });

      afterEach(() => {
        fixture?.destroy();
        TestBed.inject(HttpTestingController).verify();
        vi.restoreAllMocks();
        if (oldShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', oldShow);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
        if (oldClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', oldClose);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
        if (oldTheme === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', oldTheme);
      });

      async function settle() {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      }
      async function create() {
        fixture = TestBed.createComponent(DirectorySettingsPage);
        page = fixture.componentInstance;
        await settle();
      }
      function state() { return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined; }
      function resetDraft(patch: Partial<DirectorySettings> = {}) {
        page['saved'].set(result(patch).settings);
        page['undo']();
      }
      async function saveError(error: ApiError) {
        await create();
        page['maxAddressesInput'].set('5');
        api.updateDirectorySettings.mockRejectedValue(error);
        expect(await page['save']()).toBe(false);
        await settle();
      }

      it('non tenant-wide users see forbidden without a request', async () => {
        for (const permissions of [[], ['directory.settings.manage']]) {
          me.set({ isTenantOwner: false, permissions, permissionScopes: {
            'directory.settings.manage': { tenantWide: false, companyIds: [], branchIds: ['branch'] },
          } });
          await create();
          expect(state()?.kind()).toBe('forbidden');
          expect(api.getDirectorySettings).not.toHaveBeenCalled();
          fixture.destroy();
        }
      });

      it('tenant-wide permission holders and owners load the form', async () => {
        me.set({ isTenantOwner: false, permissions: ['directory.settings.manage'], permissionScopes: {
          'directory.settings.manage': { tenantWide: true, companyIds: [], branchIds: [] },
        } });
        await create();
        expect(page['saved']()).toEqual(initial);
        expect(page['etag']()).toBe('"1"');
        expect(page['dirty']()).toBe(false);
      });

      it('a 403 on load shows forbidden', async () => {
        for (const code of ['TENANT_WIDE_PERMISSION_REQUIRED', 'MISSING_REQUIRED_PERMISSIONS', 'PERMISSION_SCOPE_UNAVAILABLE']) {
          api.getDirectorySettings.mockRejectedValue(new ApiError(403, code));
          await create();
          expect(state()?.kind()).toBe('forbidden');
          fixture.destroy();
        }
      });

      it('a 5xx on load shows load failure', async () => {
        for (const status of [503, 0]) {
          api.getDirectorySettings.mockRejectedValue(new ApiError(status, 'SERVER_ERROR', undefined, { correlationId: 'support-123' }));
          await create();
          expect(state()?.kind()).toBe('load-failure');
          expect(state()?.text()).toContain('support-123');
          api.getDirectorySettings.mockResolvedValue(result());
          state()?.action.emit();
          await settle();
          expect(page['saved']()).toEqual(initial);
          fixture.destroy();
        }
      });

      it('save takes the response as the new baseline', async () => {
        await create();
        page['maxAddressesInput'].set('5');
        api.updateDirectorySettings.mockResolvedValue(result({ version: 2, maxAddressesPerParty: 6 }));
        expect(await page['save']()).toBe(true);
        expect(page['saved']()?.version).toBe(2);
        expect(page['etag']()).toBe('"2"');
        expect(page['maxAddressesInput']()).toBe('6');
        expect(page['dirty']()).toBe(false);
        expect(notify.success).toHaveBeenCalledWith(language === 'en' ? en.toast.saved : ar.toast.saved);
      });

      it('sends only changed fields and never an empty patch', async () => {
        await create();
        await page['save']();
        expect(api.updateDirectorySettings).not.toHaveBeenCalled();
        page['maxAddressesInput'].set('5');
        await page['save']();
        expect(api.updateDirectorySettings).toHaveBeenCalledExactlyOnceWith({ maxAddressesPerParty: 5 }, '"1"');
      });

      it('a 400 maps field errors', async () => {
        const details = { duplicateScope: ['is_enum'], preventDuplicatePhone: ['is_boolean'], maxAddressesPerParty: ['max'] };
        await saveError(new ApiError(400, 'CORE_VALIDATION_FAILED', details));
        expect(page['fieldErrors']()).toEqual(details);
        const invalid = language === 'en' ? en.validation.invalid : ar.validation.invalid;
        const fields = fixture.debugElement.queryAll(By.directive(Field)).map((field) => field.componentInstance as Field);
        expect(fields.filter((field) => field.error() === invalid)).toHaveLength(3);
        expect(notify.error).not.toHaveBeenCalled();
        page['onMaxAddressesInput']({ target: { value: '6' } } as unknown as Event);
        expect(page['maxAddressesError']()).toBeNull();
      });

      it('a 401 on save keeps the form dirty', async () => {
        await saveError(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
        expect(page['dirty']()).toBe(true);
        expect(page['maxAddressesInput']()).toBe('5');
        expect(notify.error).toHaveBeenCalledWith(language === 'en' ? enSettings.errors.notSaved : arSettings.errors.notSaved);
      });

      it('a 403 on save switches to forbidden', async () => {
        await saveError(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
        expect(state()?.kind()).toBe('forbidden');
        expect(page['canSave']()).toBe(false);
      });

      it('maintenance errors stay out of the forbidden state', async () => {
        await saveError(new ApiError(403, 'TENANT_MAINTENANCE_ACTIVE'));
        expect(page['forbidden']()).toBe(false);
        expect(page['dirty']()).toBe(true);
        expect(notify.error).toHaveBeenCalledWith(language === 'en' ? enGlobal.apiErrors.maintenance : arGlobal.apiErrors.maintenance);
      });

      it('a 409 opens the conflict modal', async () => {
        await saveError(new ApiError(409, 'DIRECTORY_SETTINGS_VERSION_CONFLICT'));
        const dialog = fixture.debugElement.query(By.directive(ConflictDialog)).componentInstance as ConflictDialog;
        expect(dialog.open()).toBe(true);
        expect(page['dirty']()).toBe(true);
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('reload discards the edits', async () => {
        await saveError(new ApiError(409, 'DIRECTORY_SETTINGS_VERSION_CONFLICT'));
        api.getDirectorySettings.mockResolvedValue(result({ version: 3, maxAddressesPerParty: 18 }));
        const dialog = fixture.debugElement.query(By.directive(ConflictDialog)).componentInstance as ConflictDialog;
        dialog.reload.emit();
        await settle();
        expect(api.getDirectorySettings).toHaveBeenCalledTimes(2);
        expect(page['maxAddressesInput']()).toBe('18');
        expect(page['etag']()).toBe('"3"');
        expect(page['dirty']()).toBe(false);
      });

      it('keep my changes refreshes only the version', async () => {
        await saveError(new ApiError(409, 'DIRECTORY_SETTINGS_VERSION_CONFLICT'));
        api.getDirectorySettings.mockResolvedValue(result({ version: 3, maxAddressesPerParty: 18, preventDuplicatePhone: false }));
        await page['keepMyChanges']();
        await settle();
        expect(page['saved']()).toEqual({ ...initial, version: 3 });
        expect(page['etag']()).toBe('"3"');
        expect(page['maxAddressesInput']()).toBe('5');
        expect(page['preventDuplicatePhone']()).toBe(true);
        expect(page['canSave']()).toBe(true);
        await page['save']();
        expect(api.updateDirectorySettings).toHaveBeenLastCalledWith({ maxAddressesPerParty: 5 }, '"3"');
      });

      it('a 428 shows a toast', async () => {
        await saveError(new ApiError(428, 'DIRECTORY_SETTINGS_VERSION_REQUIRED'));
        expect(notify.error).toHaveBeenCalledWith(language === 'en' ? en.errors.DIRECTORY_SETTINGS_VERSION_REQUIRED : ar.errors.DIRECTORY_SETTINGS_VERSION_REQUIRED);
        expect(page['dirty']()).toBe(true);
      });

      it('a 429 shows the rate-limit message', async () => {
        await saveError(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['9'] }));
        const text = language === 'en' ? enSettings.errors.rateLimitedIn : arSettings.errors.rateLimitedIn;
        expect(notify.error).toHaveBeenCalledWith(text.replace('{{seconds}}', '9'));
        expect(page['dirty']()).toBe(true);
      });

      it('a 5xx on save keeps the form dirty', async () => {
        await saveError(new ApiError(503, 'SERVER_ERROR'));
        expect(page['dirty']()).toBe(true);
        expect(page['maxAddressesInput']()).toBe('5');
        api.updateDirectorySettings.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
        await page['save']();
        expect(page['dirty']()).toBe(true);
        expect(notify.error).toHaveBeenCalledTimes(2);
      });

      it('stricter change shows the notice', async () => {
        await create();
        for (const field of ['preventDuplicateEmail', 'preventDuplicatePhone', 'preventDuplicateWhatsapp'] as const) {
          resetDraft({ [field]: false });
          page[field].set(true);
          expect(page['stricterChange']()).toBe(true);
        }
        for (const field of ['maxContactsInput', 'maxAddressesInput'] as const) {
          resetDraft();
          page[field].set('5');
          expect(page['stricterChange']()).toBe(true);
        }
        for (const [from, to] of [['BRANCH', 'TENANT'], ['PARTY_ROLE', 'TENANT'], ['BRANCH', 'PARTY_ROLE'], ['PARTY_ROLE', 'BRANCH']] as [DuplicateScope, DuplicateScope][]) {
          resetDraft({ duplicateScope: from });
          page['duplicateScope'].set(to);
          expect(page['stricterChange']()).toBe(true);
        }
        await settle();
        expect(fixture.nativeElement.querySelector('app-settings-notice')?.textContent)
          .toContain(language === 'en' ? en.notice.stricterChanges : ar.notice.stricterChanges);
      });

      it('looser or no change hides the notice', async () => {
        await create();
        expect(page['stricterChange']()).toBe(false);
        for (const field of ['preventDuplicateEmail', 'preventDuplicatePhone', 'preventDuplicateWhatsapp'] as const) {
          resetDraft();
          page[field].set(false);
          expect(page['stricterChange']()).toBe(false);
        }
        for (const field of ['maxContactsInput', 'maxAddressesInput'] as const) {
          resetDraft();
          page[field].set('30');
          expect(page['stricterChange']()).toBe(false);
        }
        for (const scope of ['BRANCH', 'PARTY_ROLE'] as const) {
          resetDraft();
          page['duplicateScope'].set(scope);
          expect(page['stricterChange']()).toBe(false);
        }
        await settle();
        expect(fixture.nativeElement.querySelector('app-settings-notice')).toBeNull();
      });

      it('phone label says phone and mobile are checked together', async () => {
        await create();
        const phone = fixture.debugElement.queryAll(By.directive(Field)).map((field) => field.componentInstance as Field)
          .find((field) => field.for().endsWith('-prevent-phone'));
        expect(phone?.label()).toBe(language === 'en' ? en.duplicates.phoneLabel : ar.duplicates.phoneLabel);
        expect(phone?.hint()).toBe(language === 'en' ? en.duplicates.phoneHint : ar.duplicates.phoneHint);
        const control = fixture.nativeElement.querySelector('button[role="switch"][id$="-prevent-phone"]') as HTMLElement;
        expect(control.getAttribute('aria-describedby')).toContain(`${phone?.for()}-hint`);
        expect(fixture.nativeElement.querySelector(`[id="${phone?.for()}-hint"]`)).not.toBeNull();
      });

      it('unsaved changes guard still blocks', async () => {
        await create();
        expect(await page.canDeactivate()).toBe(true);
        page['maxAddressesInput'].set('5');
        const dialog = fixture.debugElement.query(By.directive(UnsavedDialog)).componentInstance as UnsavedDialog;
        vi.spyOn(dialog, 'open').mockResolvedValue('cancel');
        expect(await page.canDeactivate()).toBe(false);
        const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
        page['onBeforeUnload'](event);
        expect(event.defaultPrevented).toBe(true);
        vi.mocked(dialog.open).mockResolvedValue('discard');
        expect(await page.canDeactivate()).toBe(true);
        expect(page['dirty']()).toBe(false);
      });
    });
  }
});
