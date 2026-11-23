import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TRANSLOCO_LOADER, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi, type MockInstance } from 'vitest';
import staticEn from '../../../../../../public/i18n/settings-static-data/en.json';
import staticAr from '../../../../../../public/i18n/settings-static-data/ar.json';
import settingsEn from '../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../public/i18n/settings/ar.json';
import globalEn from '../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../public/i18n/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { LanguageState, type Language } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { GroupDetailsModal } from './group-details-modal/group-details-modal';
import { StaticDataPage } from './static-data-page';
import { getCrmStaticData } from './static-data.api';
import type { CrmStaticData, Opt } from './static-data.model';

const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;
const dialogMethods = { showModal: HTMLDialogElement.prototype.showModal, close: HTMLDialogElement.prototype.close };
const NEW_ENUM_OPTIONS: Record<string, Opt[]> = {
  stageCategories: [{ value: 'OPEN', label: { en: 'Open', ar: 'مفتوحة' } }],
  pipelineAccessModes: [{ value: 'ALL', label: { en: 'All', ar: 'الكل' } }],
  activityDirections: [{ value: 'INBOUND', label: { en: 'Inbound', ar: 'وارد' } }],
  priorities: [{ value: 'HIGH', label: { en: 'High', ar: 'عالية' } }],
  leadCardColors: [{ value: 'RED', label: { en: 'Red', ar: 'أحمر' } }],
};

describe.each(VIEWS)('StaticDataPage in %s / %s', (language, theme) => {
  let dispose: () => void;
  let read: MockInstance<CrmHttpStub['read']>;
  let fixture: ComponentFixture<StaticDataPage>;
  let originalAttributes: { lang: string; dir: string; theme: string | null };

  beforeEach(() => {
    originalAttributes = { lang: document.documentElement.lang, dir: document.documentElement.dir,
      theme: document.documentElement.getAttribute('data-theme') };
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const translations: Record<string, Translation> = {
      en: globalEn, ar: globalAr,
      'settings/en': settingsEn, 'settings/ar': settingsAr,
      'settings-static-data/en': staticEn, 'settings-static-data/ar': staticAr,
    };
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language,
        reRenderOnLangChange: true, prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: (path: string) => of(translations[path] ?? {}) } },
      { provide: LanguageState, useValue: { current: signal<Language>(language) } },
    ] });
    const transloco = TestBed.inject(TranslocoService);
    for (const lang of ['en', 'ar']) {
      transloco.setTranslation({ ...translations[lang], settings: translations[`settings/${lang}`],
        staticData: translations[`settings-static-data/${lang}`] }, lang);
    }
    transloco.setActiveLang(language);
    const data = structuredClone(CRM_SETTINGS_FIXTURES['/static-data']) as CrmStaticData;
    for (const [key, options] of Object.entries(NEW_ENUM_OPTIONS)) {
      data.enums[key] = options.map(option => option.value);
      data.enumOptions[key] = options;
    }
    const stub = new CrmHttpStub({ '/static-data': data });
    read = vi.spyOn(stub, 'read');
    dispose = bindCrmHttpForTest(stub);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    dispose();
    vi.restoreAllMocks();
    HTMLDialogElement.prototype.showModal = dialogMethods.showModal;
    HTMLDialogElement.prototype.close = dialogMethods.close;
    document.documentElement.lang = originalAttributes.lang;
    document.documentElement.dir = originalAttributes.dir;
    if (originalAttributes.theme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', originalAttributes.theme);
  });

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function start() {
    fixture = TestBed.createComponent(StaticDataPage);
    await settle();
  }

  async function reload() {
    fixture.debugElement.query(By.directive(SettingsFrame)).componentInstance.reload.emit();
    await settle();
  }

  function state(): FullState | undefined {
    return fixture.debugElement.query(By.directive(FullState))?.componentInstance;
  }

  it('reload forces a request', async () => {
    await start();
    expect(read).toHaveBeenCalledExactlyOnceWith('/static-data');
    await reload();
    expect(read).toHaveBeenCalledTimes(2);
    await getCrmStaticData();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('failed reload keeps the catalogue', async () => {
    await start();
    const before = fixture.nativeElement.querySelector('[role="table"]').textContent;
    read.mockRejectedValueOnce(new ApiError(503, 'ENTITLEMENT_UNAVAILABLE'));
    await reload();
    expect(fixture.nativeElement.querySelector('[role="table"]').textContent).toBe(before);
    expect(state()).toBeUndefined();
    expect(TestBed.inject(Notify).toasts()).toEqual([
      expect.objectContaining({ type: 'error', title: language === 'ar' ? staticAr.stale : staticEn.stale }),
    ]);
    await reload();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('renders the newer groups', async () => {
    await start();
    const messages = language === 'ar' ? staticAr : staticEn;
    const titles = Array.from(fixture.nativeElement.querySelectorAll('[role="cell"] button'))
      .map(button => (button as HTMLButtonElement).textContent?.trim());
    for (const key of ['stageCategories', 'pipelineAccessModes', 'activityDirections', 'priorities', 'leadCardColors'] as const) {
      expect(titles).toContain(messages.groups[key]);
    }
    expect(fixture.componentInstance['groups']().some(group => group.key === 'pagination')).toBe(false);
    expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });

  it('uses the session catalogue when the page opens again', async () => {
    await getCrmStaticData();
    await start();
    fixture.destroy();
    await start();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each([0, 503])('shows a retryable full state with a reference for status %s', async status => {
    read.mockRejectedValueOnce(new ApiError(status, status === 0 ? 'NETWORK_ERROR' : 'ENTITLEMENT_UNAVAILABLE',
      undefined, { correlationId: 'static-data-reference' }));
    await start();
    expect(state()?.kind()).toBe('load-failure');
    expect(state()?.actionLabel()).toBe(language === 'ar' ? staticAr.retry : staticEn.retry);
    expect(state()?.text()).toContain('static-data-reference');
    expect(TestBed.inject(Notify).toasts()).toHaveLength(0);
    state()!.action.emit();
    await settle();
    expect(state()).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(['CRM_SUBSCRIPTION_BLOCKED', 'CRM_MODULE_DISABLED', 'CRM_MODULE_SEAT_REQUIRED',
    'CRM_FEATURE_DISABLED', 'CRM_PERMISSION_DENIED', 'BRANCH_ACCESS_DENIED'])(
    'shows the forbidden full state for %s', async code => {
      read.mockRejectedValueOnce(new ApiError(403, code));
      await start();
      expect(state()?.kind()).toBe('forbidden');
      expect(state()?.actionLabel()).toBe('');
      expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
    });

  it('keeps the details search hint linked to its input', async () => {
    await start();
    const details = fixture.debugElement.query(By.directive(GroupDetailsModal)).componentInstance as GroupDetailsModal;
    const permissions = fixture.componentInstance['groups']().find(group => group.key === 'permissions')!;
    details.open(permissions);
    await settle();
    const input = fixture.nativeElement.querySelector('app-group-details-modal input') as HTMLInputElement;
    const hintId = input.getAttribute('aria-describedby');
    expect(hintId).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`[id="${hintId}"]`).textContent)
      .toContain(language === 'ar' ? staticAr.details.searchHint : staticEn.details.searchHint);
  });
});
