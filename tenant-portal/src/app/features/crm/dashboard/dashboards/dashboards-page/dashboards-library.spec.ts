import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import ar from '../../../../../../../public/i18n/ar.json';
import enLibrary from '../../../../../../../public/i18n/crm-dash-library/en.json';
import arLibrary from '../../../../../../../public/i18n/crm-dash-library/ar.json';
import enAnalytics from '../../../../../../../public/i18n/analytics/en.json';
import arAnalytics from '../../../../../../../public/i18n/analytics/ar.json';
import enShare from '../../../../../../../public/i18n/crm-dash-share/en.json';
import arShare from '../../../../../../../public/i18n/crm-dash-share/ar.json';
import enRecord from '../../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../../shared/ui/field/field';
import { bindAnalyticsPermissions } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';
import { bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import { CreateDashboardModal } from '../create-dashboard-modal/create-dashboard-modal';
import type { BlueprintItem, DashboardDetail, DashboardSummary } from '../dashboards.model';
import { DashboardsPage } from './dashboards-page';

@Injectable()
class LibraryLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('crm-dash-library/')) return of(arabic ? arLibrary : enLibrary);
    if (path.startsWith('analytics/')) return of(arabic ? arAnalytics : enAnalytics);
    if (path.startsWith('crm-dash-share/')) return of(arabic ? arShare : enShare);
    if (path.startsWith('record-page/')) return of(arabic ? arRecord : enRecord);
    return of(arabic ? ar : en);
  }
}

const branchId = '019a9c30-1234-7000-8000-000000000001';
const dashboardId = '019a9c30-1234-7000-8000-000000000002';
const row: DashboardSummary = {
  id: dashboardId, name: 'Sales', description: null, kind: 'DASHBOARD', ownerUserId: 'owner', ownerName: 'Owner',
  defaultFilters: {}, sourceTemplateKey: null, blueprintKey: null, schemaVersion: 2, revision: 1,
  createdAt: '2026-11-23T10:00:00Z', updatedAt: '2026-11-23T10:00:00Z', accessLevel: 'OWNER',
  isDefault: false, isFavorite: false, isShared: false, lastOpenedAt: null,
};
const detail: DashboardDetail = {
  ...row, blueprintRevision: null, templateVersionPolicy: null, layoutCollisionMode: 'PUSH', isLayoutLocked: false,
  layouts: {}, breakpoints: [], placements: [], unavailablePlacements: [], widgets: [],
};
const blueprint: BlueprintItem = {
  key: 'team', definitionRevision: 4, audience: 'USER', name: 'Team dashboard', nameAr: 'لوحة الفريق',
  description: 'Team progress', descriptionAr: 'تقدم الفريق', widgetCount: 1,
  branchSelectionRequired: true, targets: [], adoption: { state: 'AVAILABLE' },
};
const allPermissions = [
  'crm.dashboards.read.team', 'crm.dashboards.create', 'crm.widgets.create', 'crm.analytics.readiness.view',
];
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`${language} ${theme}`, () => {
    let fixture: ComponentFixture<DashboardsPage | CreateDashboardModal> | undefined;
    let stub: CrmHttpStub;
    let dispose: () => void;
    let permissions: string[];
    let oldAttributes: { lang: string; dir: string; theme: string | null };
    const originalShow = HTMLDialogElement.prototype.showModal;
    const originalClose = HTMLDialogElement.prototype.close;

    beforeEach(() => {
      oldAttributes = { lang: document.documentElement.lang, dir: document.documentElement.dir,
        theme: document.documentElement.getAttribute('data-theme') };
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-theme', theme);
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
      permissions = [...allPermissions];
      bindAnalyticsPermissions(() => permissions);
      stub = new CrmHttpStub({ '/dashboards': { items: [], nextCursor: null }, '/dashboards/blueprints': { items: [blueprint] } });
      crmQueries().clear();
      dispose = bindCrmHttpForTest(stub);
      TestBed.configureTestingModule({ providers: [
        provideRouter([]), provideTransloco({ config: {
          availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true,
        }, loader: LibraryLoader }),
        { provide: LanguageState, useValue: { current: signal(language) } },
        { provide: TenantScopeState, useValue: { selection: signal({ companyId: 'company', branchId }), me: signal(null) } },
        { provide: OrgApi, useValue: { listGrantedBranches: vi.fn().mockResolvedValue([
          { id: branchId, companyId: 'company', name: { en: 'Main branch', ar: 'الفرع الرئيسي' } },
        ]) } },
      ] });
      TestBed.inject(TranslocoService).setTranslation({ ...(language === 'ar' ? ar : en),
        dashLibrary: language === 'ar' ? arLibrary : enLibrary,
        analytics: language === 'ar' ? arAnalytics : enAnalytics,
        share: language === 'ar' ? arShare : enShare,
        recordPage: language === 'ar' ? arRecord : enRecord,
      }, language);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    });

    afterEach(() => {
      fixture?.destroy();
      fixture = undefined;
      HTMLDialogElement.prototype.showModal = originalShow;
      HTMLDialogElement.prototype.close = originalClose;
      crmQueries().clear();
      dispose();
      bindAnalyticsPermissions(() => []);
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
      document.documentElement.lang = oldAttributes.lang;
      document.documentElement.dir = oldAttributes.dir;
      if (oldAttributes.theme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', oldAttributes.theme);
    });

    const t = (key: string) => TestBed.inject(TranslocoService).translate(key);
    async function stable() { await fixture!.whenStable(); fixture!.detectChanges(); }
    async function renderPage() {
      const pageFixture = TestBed.createComponent(DashboardsPage);
      fixture = pageFixture;
      pageFixture.detectChanges();
      if (pageFixture.componentInstance['canRead']) {
        await vi.waitFor(() => expect(pageFixture.componentInstance['loadingDashboards']()).toBe(false));
      }
      await stable();
      return pageFixture.componentInstance;
    }
    async function renderModal() {
      const modalFixture = TestBed.createComponent(CreateDashboardModal);
      fixture = modalFixture;
      modalFixture.detectChanges();
      const modal = modalFixture.componentInstance;
      const result = modal.open();
      await vi.waitFor(() => expect(modal['loadingBlueprints']()).toBe(false));
      await stable();
      modal['onNameInput']('Sales');
      return { modal, result };
    }
    function checkHints() {
      for (const field of fixture!.debugElement.queryAll(By.directive(Field))) {
        expect(field.componentInstance.hint().trim()).not.toBe('');
      }
      const name = fixture!.nativeElement.querySelector('#create-dash-name') as HTMLInputElement;
      expect(name.getAttribute('aria-describedby')).toContain('create-dash-name-hint');
      expect(fixture!.nativeElement.textContent).not.toMatch(/dashLibrary\.|analytics\.(common|error)\./);
    }

    describe('DashboardsPage', () => {
      it('pages by cursor', async () => {
        const read = vi.spyOn(stub, 'read').mockImplementation(async (path, query) => {
          if (path === '/dashboards/blueprints') return { items: [] };
          return query?.['cursor']
            ? { items: [{ ...row, id: 'shared', accessLevel: 'VIEW', isShared: true }, row], nextCursor: null }
            : { items: [{ ...row, id: 'shared', accessLevel: 'VIEW', isShared: true }], nextCursor: 'second-page' };
        });
        const page = await renderPage();
        expect(page['visibleDashboards']()).toEqual([]);
        expect(fixture!.nativeElement.textContent).toContain(t('dashLibrary.loadMore'));
        await page['loadMore']();
        await stable();
        expect(page['dashboards']().map((item) => item.id)).toEqual(['shared', dashboardId]);
        expect(page['visibleDashboards']()).toEqual([row]);
        expect(page['nextCursor']()).toBeNull();
        expect(read).toHaveBeenCalledWith('/dashboards', expect.objectContaining({ kind: 'DASHBOARD', cursor: 'second-page', limit: 50 }));
      });

      it('keeps favourite and default retry keys and makes disabled writes read-only', async () => {
        const page = await renderPage();
        page['dashboards'].set([row]);
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'))
          .mockResolvedValueOnce({ status: 200, data: { ...detail, isFavorite: true }, etag: null, location: null });
        await page['toggleFavorite'](row);
        await page['toggleFavorite'](row);
        expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
        expect(write.mock.calls[0][3].scope).toBeUndefined();
        write.mockRejectedValueOnce(new ApiError(401, 'GW.AUTH.SESSION_EXPIRED'));
        await page['setAsDefault'](row);
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(t('dashLibrary.errors.notSaved'));
        const defaultKey = write.mock.calls.at(-1)![3].key;
        write.mockResolvedValueOnce({ status: 200, data: { ...detail, isDefault: true }, etag: null, location: null });
        await page['setAsDefault'](row);
        expect(write.mock.calls.at(-1)![3].key).toBe(defaultKey);
        write.mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
        await page['toggleFavorite']({ ...row, isFavorite: true });
        expect(page['readOnly']()).toBe(true);
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(t('dashLibrary.errors.subscriptionReadOnly'));
        const calls = write.mock.calls.length;
        await page['toggleFavorite'](row);
        expect(write).toHaveBeenCalledTimes(calls);
      });

      it('shows load failures with correlation ids and gates requests', async () => {
        const page = await renderPage();
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE', undefined, { correlationId: 'reference-1' }));
        await page['loadDashboards'](true);
        await stable();
        expect(page['dashboardsError']()?.kind).toBe('load-failure');
        expect(fixture!.nativeElement.textContent).toContain('reference-1');
        fixture!.destroy();
        fixture = undefined;
        permissions = [];
        const read = vi.spyOn(stub, 'read');
        read.mockClear();
        const forbidden = await renderPage();
        expect(forbidden['canRead']).toBe(false);
        expect(read).not.toHaveBeenCalled();
      });

      it('maps read denial, missing resources, offline and retry-after without losing the state', async () => {
        const page = await renderPage();
        const read = vi.spyOn(stub, 'read');
        for (const [status, code, kind] of [
          [0, 'NETWORK_ERROR', 'load-failure'],
          [403, 'CRM_SCOPED_PERMISSION_DENIED', 'forbidden'],
          [403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED', 'forbidden'],
          [404, 'CRM_DASHBOARD_NOT_FOUND', 'not-found'],
          [429, 'GW.RATE.LIMIT_EXCEEDED', 'load-failure'],
        ] as const) {
          read.mockRejectedValueOnce(new ApiError(status, code, { retryAfterSeconds: ['12'] }));
          await page['loadDashboards'](true);
          await stable();
          expect(page['dashboardsError']()?.kind).toBe(kind);
          if (code === 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED') {
            expect(fixture!.nativeElement.textContent).toContain(t('dashLibrary.requestAccess'));
          }
          if (status === 429) expect(page['dashboardsError']()?.message).toContain('12');
        }
      });
    });

    describe('CreateDashboardModal', () => {
      it('create outcomes', async () => {
        const { modal, result } = await renderModal();
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_DASHBOARD_NAME_CONFLICT'));
        await modal['submit']();
        expect(modal['nameError']()).toBe(t('dashLibrary.errors.CRM_DASHBOARD_NAME_CONFLICT'));
        modal['onNameInput']('Sales two');
        write.mockRejectedValueOnce(new ApiError(409, 'CRM_DASHBOARD_OWNER_LIMIT'));
        await modal['submit']();
        await stable();
        expect(modal['nameError']()).toBeNull();
        expect(modal['ownerLimitMessage']()).toBe(t('dashLibrary.errors.CRM_DASHBOARD_OWNER_LIMIT'));
        expect(fixture!.nativeElement.querySelectorAll('dialog[open]').length).toBe(2);
        modal['ownerLimitModal']().close();
        write.mockResolvedValueOnce({ status: 201, data: detail, etag: null, location: null });
        await modal['submit']();
        await expect(result).resolves.toBe(dashboardId);
        expect(write.mock.calls.every((call) => uuidV7.test(call[3].key) && call[3].scope === undefined)).toBe(true);
      });

      it('blueprints not ready', async () => {
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'CRM_DASHBOARD_BLUEPRINTS_NOT_READY'));
        const { modal } = await renderModal();
        expect(modal['blueprintsFailure']()?.kind).toBe('provisioning');
        const state = fixture!.debugElement.query(By.directive(FullState)).componentInstance as FullState;
        expect(state.kind()).toBe('provisioning');
        expect(fixture!.nativeElement.querySelector('a[href="/crm/settings/data-readiness"]')).not.toBeNull();
        expect(modal['startOptions']().map((option) => option.key)).toEqual([null]);
        checkHints();
      });

      it('retains transient and session keys, rotates changed bodies and blocks mismatched replay', async () => {
        const { modal } = await renderModal();
        const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'));
        await modal['submit']();
        await modal['submit']();
        const originalKey = write.mock.calls[0][3].key;
        expect(write.mock.calls[1][3].key).toBe(originalKey);
        write.mockRejectedValueOnce(new ApiError(401, 'GW.AUTH.SESSION_EXPIRED'));
        await modal['submit']();
        expect(write.mock.calls[2][3].key).toBe(originalKey);
        expect(modal['name']()).toBe('Sales');
        modal['onNameInput']('Changed');
        write.mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.IN_FLIGHT'));
        await modal['submit']();
        const changedKey = write.mock.calls[3][3].key;
        expect(changedKey).not.toBe(originalKey);
        write.mockRejectedValueOnce(new ApiError(422, 'GW.IDEM.MISMATCH'));
        await modal['submit']();
        expect(write.mock.calls[4][3].key).toBe(changedKey);
        expect(modal['reloadRequired']()).toBe(true);
        await modal['submit']();
        expect(write).toHaveBeenCalledTimes(5);
        await modal['reloadPicker']();
        modal['onNameInput']('Changed');
        await modal['submit']();
        expect(write.mock.calls[5][3].key).not.toBe(changedKey);
      });

      it('uses real branch options, validates fields and keeps edits while refreshing a stale blueprint', async () => {
        const { modal } = await renderModal();
        checkHints();
        modal['selectSource'](blueprint.key);
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED'));
        await modal['submit']();
        expect(write.mock.calls[0][2]).toEqual({ definitionRevision: 4, name: 'Sales', branchId });
        expect(modal['conflictOpen']()).toBe(true);
        vi.spyOn(stub, 'read').mockResolvedValue({ items: [{ ...blueprint, definitionRevision: 5 }] });
        await modal['reloadAfterConflict'](true);
        expect(modal['name']()).toBe('Sales');
        expect(modal['selectedBlueprint']()?.definitionRevision).toBe(5);
        write.mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { name: ['name_error'], branchId: ['branch_error'] }));
        await modal['submit']();
        expect(modal['nameError']()).toBe('name_error');
        expect(modal['branchError']()).toBe('branch_error');
        expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
        vi.spyOn(stub, 'read').mockResolvedValue({ items: [{ ...blueprint, adoption: { state: 'ADOPTED', dashboardId, definitionRevision: 5 } }] });
        await modal['reloadAfterConflict'](true);
        expect(modal['selectedSource']()).toBe(blueprint.key);
        expect(modal['canSubmit']()).toBe(false);
        expect(modal['sourceError']()).toBe(t('dashLibrary.createModal.sourceUnavailable'));
      });

      it('hides templates without widget create while preserving blank creation', async () => {
        permissions = ['crm.dashboards.read.own', 'crm.dashboards.create'];
        const read = vi.spyOn(stub, 'read');
        const { modal } = await renderModal();
        expect(modal['canSubmit']()).toBe(true);
        expect(modal['startOptions']().map((option) => option.key)).toEqual([null]);
        expect(read).not.toHaveBeenCalled();
        modal['selectSource'](blueprint.key);
        expect(modal['selectedSource']()).toBeNull();
      });

      it('locks module-disabled writes and hides readiness links without access', async () => {
        permissions = allPermissions.filter((key) => key !== 'crm.analytics.readiness.view');
        vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(503, 'CRM_DASHBOARD_BLUEPRINTS_NOT_READY'));
        const { modal } = await renderModal();
        expect(fixture!.nativeElement.querySelector('a[href="/crm/settings/data-readiness"]')).toBeNull();
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, 'CRM_MODULE_DISABLED'));
        await modal['submit']();
        await stable();
        expect(modal['readOnly']()).toBe(true);
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(t('dashLibrary.errors.moduleDisabled'));
        expect((fixture!.nativeElement.querySelector('#create-dash-name') as HTMLInputElement).readOnly).toBe(true);
        expect(modal['name']()).toBe('Sales');
      });
    });
  });
}
