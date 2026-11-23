import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TRANSLOCO_LOADER, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi, type MockInstance } from 'vitest';
import readinessEn from '../../../../../../public/i18n/settings-data-readiness/en.json';
import readinessAr from '../../../../../../public/i18n/settings-data-readiness/ar.json';
import analyticsEn from '../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../public/i18n/analytics/ar.json';
import settingsEn from '../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../public/i18n/settings/ar.json';
import globalEn from '../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../public/i18n/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState, type Language } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { DataReadinessPage } from './data-readiness-page';
import type { ReadinessDetail } from './readiness.api';
import { ReadinessModal } from './readiness-modal/readiness-modal';

const SOURCE: ReadinessDetail = {
  sourceKey: 'crm.leads', sourceFamily: 'CRM_CURRENT', ownerModule: 'crm', status: 'NOT_READY',
  reasonCode: 'CAPTURE_NOT_DEPLOYED', uiState: 'NOT_CONNECTED', lagSeconds: null,
  freshnessSloSeconds: null, stale: false, watermarkAt: null, coverageStartedAt: null,
  backfillFloorAt: null, lastCheckedAt: null, statusChangedAt: '2026-11-23T00:00:00Z',
  revision: 1, affectedReportCount: 2, captureSourceKey: null, lastConfirmedAt: null,
  watermarkPinned: null, affected: [{ kind: 'REPORT', id: 'report-1', name: 'First report' }],
  pageInfo: { limit: 20, hasMore: true, nextCursor: 'cursor_1' },
};

const VIEWS = [
  ['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark'],
] as const;
const dialogMethods = { showModal: HTMLDialogElement.prototype.showModal, close: HTMLDialogElement.prototype.close };

describe.each(VIEWS)('data readiness in %s / %s', (language, theme) => {
  const key = 'crm.analytics.readiness.view';
  let dispose: () => void;
  let stub: CrmHttpStub;
  let read: MockInstance<CrmHttpStub['read']>;
  let me: ReturnType<typeof signal<TenantMe>>;
  let harness: RouterTestingHarness;
  let page: DataReadinessPage;
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
    me = signal({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [key], permissionScopes: {
      [key]: { tenantWide: true, companyIds: [], branchIds: [] },
    } });
    const translations: Record<string, Translation> = {
      en: globalEn, ar: globalAr,
      'settings/en': settingsEn, 'settings/ar': settingsAr,
      'analytics/en': analyticsEn, 'analytics/ar': analyticsAr,
      'settings-data-readiness/en': readinessEn, 'settings-data-readiness/ar': readinessAr,
    };
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'crm/settings/data-readiness', component: DataReadinessPage }]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language,
        reRenderOnLangChange: true, prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: (path: string) => of(translations[path] ?? {}) } },
      { provide: TenantScopeState, useValue: { me } },
      { provide: LanguageState, useValue: { current: signal<Language>(language) } },
    ] });
    const transloco = TestBed.inject(TranslocoService);
    for (const lang of ['en', 'ar']) {
      transloco.setTranslation({ ...translations[lang], settings: translations[`settings/${lang}`],
        analytics: translations[`analytics/${lang}`], readiness: translations[`settings-data-readiness/${lang}`] }, lang);
    }
    transloco.setActiveLang(language);
    stub = new CrmHttpStub();
    read = vi.spyOn(stub, 'read').mockResolvedValue({ items: [SOURCE] });
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
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function start(query = '') {
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl(`/crm/settings/data-readiness${query}`, DataReadinessPage);
    await settle();
  }

  function state() {
    return harness.fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
  }

  function modal() {
    return harness.fixture.debugElement.query(By.directive(ReadinessModal)).componentInstance as ReadinessModal;
  }

  describe('DataReadinessPage', () => {
    it('loads the sources', async () => {
      await start();
      expect(read).toHaveBeenCalledExactlyOnceWith('/analytics/readiness');
      expect(harness.routeNativeElement!.textContent).toContain(SOURCE.sourceKey);
      expect(page['availableFamilies']()).toEqual(['CRM_CURRENT']);
      expect(harness.routeNativeElement!.textContent).toContain(
        (language === 'ar' ? readinessAr : readinessEn).reasons.CAPTURE_NOT_DEPLOYED);
      expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
      expect(harness.routeNativeElement!.querySelectorAll('ui-field [data-ui-hint]').length).toBe(2);
    });

    it('no request without the key', async () => {
      me.update(value => ({ ...value, permissions: [], permissionScopes: {} }));
      await start('?source=crm.leads');
      expect(read).not.toHaveBeenCalled();
      expect(state()!.kind()).toBe('forbidden');
      expect(harness.routeNativeElement!.querySelector('app-readiness-modal')).toBeNull();
    });

    it('no request with a branch-only grant', async () => {
      me.update(value => ({ ...value, permissionScopes: {
        [key]: { tenantWide: false, companyIds: [], branchIds: ['branch-1'] },
      } }));
      await start();
      expect(read).not.toHaveBeenCalled();
      expect(state()!.kind()).toBe('forbidden');
    });

    it('server 403 shows the no-access state', async () => {
      me.update(value => ({ ...value, isTenantOwner: true, permissions: [], permissionScopes: {} }));
      read.mockRejectedValueOnce(new ApiError(403, 'CRM_PERMISSION_DENIED'));
      await start();
      expect(state()!.kind()).toBe('forbidden');
      expect(page['loadError']()).toBe(false);
      read.mockRejectedValueOnce(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
      await page['reload']();
      await settle();
      expect(state()!.kind()).toBe('forbidden');
      expect(page['loadError']()).toBe(false);
    });

    it('first failure vs reload failure', async () => {
      read.mockRejectedValueOnce(new ApiError(503, 'INTERNAL_ERROR', undefined, { correlationId: 'reference-123' }));
      await start();
      expect(state()!.kind()).toBe('load-failure');
      expect(state()!.text()).toContain('reference-123');
      const notify = vi.spyOn(TestBed.inject(Notify), 'error');
      expect(notify).not.toHaveBeenCalled();
      const retry = harness.routeNativeElement!.querySelector('ui-full-state button') as HTMLButtonElement;
      retry.click();
      await settle();
      expect(state()).toBeUndefined();
      for (const status of [0, 503]) {
        read.mockRejectedValueOnce(new ApiError(status, status ? 'INTERNAL_ERROR' : 'NETWORK_ERROR'));
        await page['reload']();
        await settle();
        expect(state()).toBeUndefined();
        expect(harness.routeNativeElement!.textContent).toContain(SOURCE.sourceKey);
      }
      expect(notify).toHaveBeenCalledTimes(2);
    });

    it('unknown reason code falls back', async () => {
      read.mockResolvedValueOnce({ items: [{ ...SOURCE, reasonCode: 'FUTURE_REASON' }] });
      await start();
      expect(harness.routeNativeElement!.textContent).toContain(language === 'ar' ? 'غير متاح بعد' : 'Not available yet');
      expect(page['reasonText'](null)).toBe('—');
    });

    it('empty families hidden', async () => {
      read.mockResolvedValueOnce({ items: [SOURCE, { ...SOURCE, sourceKey: 'future.source', sourceFamily: 'FUTURE' }] });
      await start();
      expect(page['availableFamilies']()).toEqual(['CRM_CURRENT', 'OTHER']);
      expect(page['availableFamilies']()).not.toContain('PLATFORM');
      page['selectFamily']('OTHER');
      read.mockResolvedValueOnce({ items: [] });
      await page['reload']();
      await settle();
      expect(page['availableFamilies']()).toEqual([]);
      expect(page['selectedFamily']()).toBeNull();
      expect(harness.routeNativeElement!.textContent).toContain((language === 'ar' ? readinessAr : readinessEn).empty);
    });

    it('updates reason translations when the language changes', async () => {
      await start();
      const next = language === 'ar' ? 'en' : 'ar';
      TestBed.inject(LanguageState).current.set(next);
      TestBed.inject(TranslocoService).setActiveLang(next);
      await settle();
      expect(harness.routeNativeElement!.textContent).toContain(
        (next === 'ar' ? readinessAr : readinessEn).reasons.CAPTURE_NOT_DEPLOYED);
    });
  });

  describe('ReadinessModal', () => {
    it('loads more by cursor', async () => {
      read.mockResolvedValueOnce({ items: [SOURCE] }).mockResolvedValueOnce(SOURCE);
      await start('?source=crm.leads');
      expect(read).toHaveBeenLastCalledWith('/analytics/readiness/crm.leads', { cursor: null, limit: 20 });
      read.mockResolvedValueOnce({ ...SOURCE, affected: [{ kind: 'REPORT', id: 'report-2', name: 'Second report' }],
        pageInfo: { limit: 20, hasMore: false, nextCursor: null } });
      await modal()['loadMore']();
      await settle();
      expect(read).toHaveBeenLastCalledWith('/analytics/readiness/crm.leads', { cursor: 'cursor_1', limit: 20 });
      expect(modal()['affected']().map(row => row.id)).toEqual(['report-1', 'report-2']);
      expect(modal()['pageInfo']()!.hasMore).toBe(false);
      expect(harness.routeNativeElement!.textContent).toContain('Second report');
    });

    it('stale deep link clears the query', async () => {
      read.mockResolvedValueOnce({ items: [SOURCE] })
        .mockRejectedValueOnce(new ApiError(404, 'CRM_READINESS_SOURCE_UNKNOWN'));
      const notify = vi.spyOn(TestBed.inject(Notify), 'error');
      await start('?source=crm.missing&keep=yes');
      expect(notify).toHaveBeenCalledExactlyOnceWith(
        (language === 'ar' ? readinessAr : readinessEn).errors.CRM_READINESS_SOURCE_UNKNOWN);
      expect(TestBed.inject(Router).url).toBe('/crm/settings/data-readiness?keep=yes');
      expect(harness.routeNativeElement!.querySelector('dialog')!.open).toBe(false);
    });

    it('restarts from the first page after an invalid cursor', async () => {
      read.mockResolvedValueOnce({ items: [SOURCE] }).mockResolvedValueOnce(SOURCE);
      await start('?source=crm.leads');
      read.mockRejectedValueOnce(new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID'))
        .mockResolvedValueOnce({ ...SOURCE, affected: [], pageInfo: { limit: 20, hasMore: false, nextCursor: null } });
      await modal()['loadMore']();
      await settle();
      expect(read).toHaveBeenLastCalledWith('/analytics/readiness/crm.leads', { cursor: null, limit: 20 });
      expect(modal()['affected']()).toEqual([]);
      expect(harness.routeNativeElement!.querySelector('dialog')!.open).toBe(true);
    });
  });
});
