import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TRANSLOCO_LOADER, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fieldsEn from '../../../../../../public/i18n/settings-custom-fields/en.json';
import fieldsAr from '../../../../../../public/i18n/settings-custom-fields/ar.json';
import settingsEn from '../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../public/i18n/settings/ar.json';
import globalEn from '../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../public/i18n/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CustomFieldModal } from './custom-field-modal/custom-field-modal';
import { CustomFieldsPage } from './custom-fields-page';
import { CustomField, FieldOption } from './custom-fields.model';
import { RequirementsModal } from './requirements-modal/requirements-modal';
import { OptionsEditor } from './options-editor/options-editor';

const FIELD: CustomField = {
  id: 'f1', ownerType: 'PARTY', fieldKey: 'category', nameAr: 'التصنيف', nameEn: 'Category', type: 'TEXT',
  placeholderAr: null, placeholderEn: null, sortOrder: 100, isActive: true, options: [],
  requirements: [{ operation: 'CREATE', entityScope: null, isRequired: true }], createdAt: '', updatedAt: '',
};
const option = (key: string): FieldOption => ({ key, nameAr: 'خيار', nameEn: key, sortOrder: 1, isActive: true });
const { requirements: _requirements, ...DEFINITION } = FIELD;
const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;

describe.each(VIEWS)('Custom fields in %s / %s', (language, theme) => {
  let fixture: ComponentFixture<CustomFieldsPage>;
  let stub: CrmHttpStub;
  let dispose: () => void = () => {};
  let dialogMethods: Record<string, PropertyDescriptor | undefined>;
  let me: ReturnType<typeof signal<TenantMe>>;
  let original: { lang: string; dir: string; theme: string | null };
  const modules = { leadsAnywhere: signal(true), opportunitiesAnywhere: signal(true), ensureLoaded: () => Promise.resolve() };
  const words = language === 'ar' ? fieldsAr : fieldsEn;

  beforeEach(() => {
    original = { lang: document.documentElement.lang, dir: document.documentElement.dir, theme: document.documentElement.getAttribute('data-theme') };
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    dialogMethods = Object.fromEntries(['showModal', 'close'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)]));
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    modules.leadsAnywhere.set(true); modules.opportunitiesAnywhere.set(true);
    const keys = ['crm.custom_fields.read', 'crm.custom_fields.manage'];
    me = signal({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: keys,
      permissionScopes: Object.fromEntries(keys.map(key => [key, { tenantWide: true, companyIds: [], branchIds: [] }])) });
    const translations: Record<string, Translation> = {
      en: globalEn, ar: globalAr, 'settings/en': settingsEn, 'settings/ar': settingsAr,
      'settings-custom-fields/en': fieldsEn, 'settings-custom-fields/ar': fieldsAr,
    };
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true, prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: (path: string) => of(translations[path] ?? {}) } },
      { provide: TenantScopeState, useValue: { me } },
      { provide: LanguageState, useValue: { current: signal(language) } },
      { provide: CrmModules, useValue: modules },
    ] });
    const transloco = TestBed.inject(TranslocoService);
    for (const lang of ['en', 'ar']) transloco.setTranslation({ ...translations[lang], settings: translations[`settings/${lang}`], customFields: translations[`settings-custom-fields/${lang}`] }, lang);
    transloco.setActiveLang(language);
    stub = new CrmHttpStub({ '/custom-fields': [FIELD] });
    dispose = bindCrmHttpForTest(stub);
  });

  afterEach(() => {
    TestBed.resetTestingModule(); dispose(); vi.restoreAllMocks();
    for (const [key, descriptor] of Object.entries(dialogMethods)) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    }
    document.documentElement.lang = original.lang; document.documentElement.dir = original.dir;
    if (original.theme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', original.theme);
  });

  async function settle() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }
  async function start() { fixture = TestBed.createComponent(CustomFieldsPage); await fixture.componentInstance['loadFields'](); await settle(); return fixture.componentInstance; }
  function modal() { return fixture.debugElement.query(By.directive(CustomFieldModal)).componentInstance as CustomFieldModal; }
  function requirements() { return fixture.debugElement.query(By.directive(RequirementsModal)).componentInstance as RequirementsModal; }
  function element() { return fixture.nativeElement as HTMLElement; }
  function response(data: unknown, status = 200) { return { status, data, etag: null, location: null }; }
  function fillCreate() {
    const form = modal(); form.openCreate(); form['onNameArInput']('حقل'); form['onNameEnInput']('New field'); return form;
  }

  describe('CustomFieldsPage', () => {
    it('loads and shows the empty state', async () => {
      const read = vi.spyOn(stub, 'read').mockResolvedValue([]);
      await start();
      expect(read).toHaveBeenCalledExactlyOnceWith('/custom-fields');
      expect(element().textContent).toContain(words.table.empty);
      expect(element().textContent).toContain(words.add);
      expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
    });

    it('load failure', async () => {
      vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'ref-123' }));
      await start();
      const state = fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState;
      expect(state.kind()).toBe('load-failure'); expect(state.text()).toContain('ref-123');
      vi.mocked(stub.read).mockResolvedValue([]); state.action.emit(); await fixture.componentInstance['loadFields'](); await settle();
      expect(fixture.debugElement.query(By.directive(FullState))).toBeNull();
    });

    it('create adds the field', async () => {
      vi.spyOn(stub, 'read').mockResolvedValue([]);
      vi.spyOn(stub, 'write').mockResolvedValue(response({ ...DEFINITION, id: 'new', fieldKey: 'new_field' }, 201));
      const page = await start(); const form = fillCreate(); await settle(); await form['save'](); await settle();
      expect(page['fields']()).toEqual([{ ...DEFINITION, id: 'new', fieldKey: 'new_field', requirements: [] }]);
    });

    it('edit keeps requirements', async () => {
      vi.spyOn(stub, 'write').mockResolvedValue(response({ ...DEFINITION, nameEn: 'Edited' }));
      const page = await start(); const form = modal(); form.openEdit(FIELD); form['onNameEnInput']('Edited');
      await form['save'](); await settle();
      expect(page['fields']()[0].requirements).toEqual(FIELD.requirements);
      expect(page['fields']()[0].nameEn).toBe('Edited');
    });

    it('has no values tab', async () => {
      await start(); expect(element().querySelector('[role="tablist"]')).toBeNull();
      expect(element().querySelector('app-record-values')).toBeNull();
    });

    it('read-only render', async () => {
      me.update(value => ({ ...value, permissions: ['crm.custom_fields.read'] }));
      const page = await start(); expect(page['canManage']()).toBe(false);
      expect(element().querySelector('ui-actions-menu')).toBeNull();
      expect(element().textContent).not.toContain(words.add);
      modal().openEdit(FIELD); await settle();
      const inputs = element().querySelectorAll<HTMLInputElement>('app-custom-field-modal input');
      expect([...inputs].every(input => input.readOnly)).toBe(true);
      const save = language === 'ar' ? settingsAr.common.save : settingsEn.common.save;
      expect([...element().querySelectorAll('app-custom-field-modal button')].some(button => button.textContent?.trim() === save)).toBe(false);
    });

    it.each(['CRM_SUBSCRIPTION_BLOCKED', 'CRM_MODULE_DISABLED', 'CRM_MODULE_SEAT_REQUIRED', 'CRM_FEATURE_DISABLED', 'CRM_PERMISSION_DENIED'])('shows forbidden for $code', async code => {
      vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(403, code)); await start();
      expect((fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState).kind()).toBe('forbidden');
    });

    it('denies branch-only read grants without a request', async () => {
      me.update(value => ({ ...value, permissionScopes: { 'crm.custom_fields.read': { tenantWide: false, companyIds: [], branchIds: ['b1'] } } }));
      const read = vi.spyOn(stub, 'read'); await start(); expect(read).not.toHaveBeenCalled();
      expect((fixture.debugElement.query(By.directive(FullState)).componentInstance as FullState).kind()).toBe('forbidden');
    });

    it('asks before archiving and keeps requirements on retire', async () => {
      const page = await start();
      const confirm = page['archiveDialog']();
      const confirmation = vi.spyOn(confirm, 'open').mockResolvedValue(false);
      const write = vi.spyOn(stub, 'write').mockResolvedValue(response({ ...DEFINITION, isActive: false }));
      await page['toggleActive'](FIELD); expect(write).not.toHaveBeenCalled();
      confirmation.mockResolvedValue(true); await page['toggleActive'](FIELD); await settle();
      expect(write.mock.calls[0].slice(0, 3)).toEqual(['PATCH', '/custom-fields/f1', { isActive: false }]);
      expect(page['fields']()[0].requirements).toEqual(FIELD.requirements);
    });
  });

  describe('CustomFieldModal', () => {
    it.each(['CUSTOM_FIELD_KEY_TAKEN', 'CUSTOM_FIELD_KEY_INVALID'] as const)('key errors show on the key field: %s', async code => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(code.endsWith('TAKEN') ? 409 : 422, code));
      await start(); const form = fillCreate(); await form['save'](); await settle();
      expect(form['keyError']()).toBe(words.errors[code]);
      const key = element().querySelector<HTMLInputElement>('app-custom-field-modal input[id$="-key"]')!;
      expect(key.getAttribute('aria-invalid')).toBe('true');
      expect(element().querySelector(`#${key.id}-error`)?.textContent).toContain(words.errors[code]);
    });

    it.each(['CUSTOM_FIELD_OPTIONS_REQUIRED', 'CUSTOM_FIELD_OPTIONS_INVALID'] as const)('options errors show in the editor: %s', async code => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(422, code));
      await start(); const form = fillCreate(); form['selectFieldType']('SELECT');
      form['draftOptions'].set([{ ...option('a'), uid: 'a', isSaved: false }]);
      await form['save'](); await settle();
      const editor = fixture.debugElement.query(By.directive(OptionsEditor)).componentInstance as OptionsEditor;
      expect(editor.error()).toBe(words.errors[code]);
      expect(element().querySelector('app-options-editor')?.textContent).toContain(words.errors[code]);
    });

    it.each(['CRM_LEADS_DISABLED', 'CRM_OPPORTUNITIES_DISABLED'] as const)('module off explains why: %s', async code => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(403, code));
      await start(); const form = fillCreate(); await form['save']();
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(words.errors[code]);
      expect(form['draft']().nameEn).toBe('New field');
    });

    it('option in use marks the removed options', async () => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(409, 'CUSTOM_FIELD_OPTION_IN_USE'));
      await start(); const form = modal(); form.openEdit({ ...FIELD, type: 'SELECT', options: [option('a'), option('b')] });
      form['draftOptions'].update(options => [{ ...options[0], isActive: false }]);
      await form['save'](); await settle();
      expect(form['inUseOptionKeys']()).toEqual(['a', 'b']);
      const editor = fixture.debugElement.query(By.directive(OptionsEditor)).componentInstance as OptionsEditor;
      expect(editor['errorsFor'](editor.options()[0], 0).key).toBe(words.options.inUseNotice);
      expect(editor['removedKeys']()).toEqual(['b']);
      form['restoreRemovedOptions'](); expect(form['draftOptions']().map(option => [option.key, option.isActive])).toEqual([['a', true], ['b', true]]);
    });

    it('owner types follow modules', async () => {
      modules.leadsAnywhere.set(false); modules.opportunitiesAnywhere.set(false);
      await start(); const form = fillCreate();
      expect(form['ownerTypeOptions']().map(option => option.value)).toEqual(['PARTY', 'CUSTOMER_PROFILE']);
      expect(form['draft']().ownerType).toBe('PARTY');
    });

    it('locks the key on edit and never sends it in the patch', async () => {
      const write = vi.spyOn(stub, 'write').mockResolvedValue(response(DEFINITION));
      await start(); const form = modal(); form.openEdit(FIELD); form['onKeyInput']('changed'); form['onNameEnInput']('Edited');
      await settle(); expect(element().querySelector<HTMLInputElement>('app-custom-field-modal input[id$="-key"]')!.readOnly).toBe(true);
      await form['save'](); expect(write.mock.calls[0][2]).toEqual({ nameEn: 'Edited' });
    });

    it('routes real validation property paths to their fields', async () => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(400, 'CRM_VALIDATION_FAILED', { nameAr: ['Arabic name is too long'], 'options.0.nameEn': ['Name is required'] }));
      await start(); const form = fillCreate(); form['selectFieldType']('SELECT'); form['draftOptions'].set([{ ...option('a'), uid: 'a', isSaved: false }]);
      await form['save'](); await settle();
      expect(Object.keys(form['serverErrors']())).toEqual(['nameAr', 'options.0.nameEn']);
      expect(form['nameArError']()).toBeTruthy();
      const editor = fixture.debugElement.query(By.directive(OptionsEditor)).componentInstance as OptionsEditor;
      expect(editor['errorsFor'](editor.options()[0], 0).nameEn).toBeTruthy();
    });

    it.each(['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])('switches the page to read-only on %s', async code => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(403, code));
      const page = await start(); const form = fillCreate(); await form['save'](); await settle();
      expect(page['canManage']()).toBe(false); expect(form.canManage()).toBe(false); expect(form['draft']().nameEn).toBe('New field');
    });

    it('reloads definitions after a missing field without losing edits', async () => {
      const read = vi.spyOn(stub, 'read'); vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(404, 'CUSTOM_FIELD_NOT_FOUND'));
      await start(); const form = modal(); form.openEdit(FIELD); form['onNameEnInput']('Edited'); await form['save'](); await settle();
      expect(read).toHaveBeenCalledTimes(2); expect(form['draft']().nameEn).toBe('Edited');
    });

    it.each([
      { status: 401, code: 'COMMON.GENERIC.UNAUTHORIZED', key: 'session' },
      { status: 409, code: 'GW.IDEM.IN_FLIGHT', key: 'GW.IDEM.IN_FLIGHT' },
      { status: 409, code: 'GW.IDEM.MISMATCH', key: 'GW.IDEM.MISMATCH' },
      { status: 429, code: 'GW.RATE.LIMIT_EXCEEDED', key: 'rateLimitedIn' },
      { status: 0, code: 'NETWORK_ERROR', key: 'network' },
      { status: 503, code: 'SERVER_ERROR', key: 'generic' },
    ])('keeps the form and shows shared feedback for $code', async ({ status, code, key }) => {
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(status, code, status === 429 ? { retryAfterSeconds: ['9'] } : undefined));
      await start(); const form = fillCreate(); await form['save'](); await settle();
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(TestBed.inject(TranslocoService).translate(`settings.errors.${key}`, { seconds: '9' }));
      expect(form['draft']().nameEn).toBe('New field');
    });

    it('keeps hints linked to the actual controls', async () => {
      await start(); const form = fillCreate(); form['selectFieldType']('SELECT'); form['draftOptions'].set([{ ...option('a'), uid: 'a', isSaved: false }]); await settle();
      const labels = element().querySelectorAll('app-custom-field-modal ui-field');
      expect(labels.length).toBeGreaterThan(6);
      for (const field of labels) expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
      for (const input of element().querySelectorAll('app-custom-field-modal input[aria-describedby], app-custom-field-modal [role="switch"]')) {
        const ids = input.getAttribute('aria-describedby')?.split(' ') ?? [];
        expect(ids.length).toBeGreaterThan(0); for (const id of ids) expect(element().querySelector(`[id="${id}"]`)).not.toBeNull();
      }
    });
  });

  describe('RequirementsModal', () => {
    it('no convert for opportunity fields', async () => {
      await start(); const form = requirements(); form.open({ ...FIELD, ownerType: 'OPPORTUNITY' }); await settle();
      expect(form['showConvert']()).toBe(false); expect(element().querySelector('#req-convert')).toBeNull();
      const write = vi.spyOn(stub, 'write'); await form['toggleRequirement']('CONVERT', true); expect(write).not.toHaveBeenCalled();
    });

    it('inactive field cannot get requirements', async () => {
      await start(); const form = requirements(); form.open({ ...FIELD, isActive: false }); await settle();
      expect([...element().querySelectorAll<HTMLButtonElement>('app-requirements-modal [role="switch"]')].every(button => button.disabled)).toBe(true);
      const write = vi.spyOn(stub, 'write'); await form['toggleRequirement']('UPDATE', true); expect(write).not.toHaveBeenCalled();
    });

    it('merges the saved row and keeps the loaded definition', async () => {
      vi.spyOn(stub, 'write').mockResolvedValue(response({ id: 'r2', fieldDefinitionId: FIELD.id, operation: 'UPDATE', entityScope: null, isRequired: true }, 201));
      const page = await start(); const form = requirements(); form.open(FIELD); await form['toggleRequirement']('UPDATE', true); await settle();
      expect(page['fields']()[0].requirements).toHaveLength(2); expect(page['fields']()[0].nameEn).toBe(FIELD.nameEn);
    });
  });
});
