import { Injectable, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoService, provideTransloco, type TranslocoLoader, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enReport from '../../../../../../public/i18n/crm-rep-report/en.json';
import arReport from '../../../../../../public/i18n/crm-rep-report/ar.json';
import enCatalogue from '../../../../../../public/i18n/crm-rep-catalogue/en.json';
import arCatalogue from '../../../../../../public/i18n/crm-rep-catalogue/ar.json';
import enTabs from '../../../../../../public/i18n/crm-rep-tabs/en.json';
import arTabs from '../../../../../../public/i18n/crm-rep-tabs/ar.json';
import enAnalytics from '../../../../../../public/i18n/analytics/en.json';
import arAnalytics from '../../../../../../public/i18n/analytics/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import enChart from '../../../../../../public/i18n/chart/en.json';
import arChart from '../../../../../../public/i18n/chart/ar.json';
import enWidgets from '../../../../../../public/i18n/dashboard-widgets/en.json';
import arWidgets from '../../../../../../public/i18n/dashboard-widgets/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CataloguePage } from '../catalogue/catalogue-page/catalogue-page';
import { ReportCard } from '../catalogue/report-card/report-card';
import { FAKE_REPORTS } from '../catalogue/catalogue.fake';
import { PinModal } from './pin-modal/pin-modal';
import { RecordsTab } from './records-tab/records-tab';
import { ReportFilters } from './report-filters/report-filters';
import { ReportPage } from './report-page/report-page';
import { buildFakeManifest, buildFakePanelRows } from './report.fake';
import { getPanelRows, loadReportFilterLookups } from './report.api';
import { ReportState } from './report-state';
import { reportErrorMessage } from './report-errors';

const key = 'opportunities-by-stage';
const target = { id: '01934b10-0000-7000-8000-000000001001', name: 'Sales', revision: 3, accessLevel: 'OWNER', kind: 'DASHBOARD' };
const manifest = buildFakeManifest(key);
const page = (items: unknown[]) => ({ items, pageInfo: { limit: 100, hasMore: false, nextCursor: null } });
const result = (data: unknown) => ({ status: 200, data, etag: null, location: null });
const dictionaries: Record<string, Translation> = {
  en: { ...en, repReport: enReport, repCatalogue: enCatalogue, repTabs: enTabs, analytics: enAnalytics, recordPage: enRecord, chart: enChart, dashboardWidgets: enWidgets },
  ar: { ...ar, repReport: arReport, repCatalogue: arCatalogue, repTabs: arTabs, analytics: arAnalytics, recordPage: arRecord, chart: arChart, dashboardWidgets: arWidgets },
  'crm-rep-report/en': enReport, 'crm-rep-report/ar': arReport,
  'crm-rep-catalogue/en': enCatalogue, 'crm-rep-catalogue/ar': arCatalogue,
  'crm-rep-tabs/en': enTabs, 'crm-rep-tabs/ar': arTabs,
  'analytics/en': enAnalytics, 'analytics/ar': arAnalytics,
  'record-page/en': enRecord, 'record-page/ar': arRecord,
  'chart/en': enChart, 'chart/ar': arChart,
  'dashboard-widgets/en': enWidgets, 'dashboard-widgets/ar': arWidgets,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(dictionaries[path] ?? {})); }
}

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`RP-1 ${lang} ${theme}`, () => {
    let stub: CrmHttpStub;
    let dispose: () => void;
    let fixtures: Record<string, unknown>;
    let warn: ReturnType<typeof vi.spyOn>;
    const originalDialog = { showModal: HTMLDialogElement.prototype.showModal, close: HTMLDialogElement.prototype.close };
    beforeEach(async () => {
      HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      bindAnalyticsPermissions(() => ['crm.dashboards.read.own', 'crm.dashboards.update', 'crm.widgets.create', 'crm.analytics.readiness.view']);
      crmQueries().clear();
      fixtures = {
        '/dashboards/reports/catalogue': page([]),
        [`/dashboards/reports/${key}/manifest`]: manifest,
        '/dashboards/catalog': FAKE_CATALOG,
        '/dashboards': { items: [target, { ...target, id: 'view-only', accessLevel: 'VIEW' }], nextCursor: null },
        '/pipelines': [{ id: 'pipeline-1', nameEn: 'Sales', nameAr: 'المبيعات', isActive: true }],
        '/acquisition-sources': [{ id: 'source-1', nameEn: 'Web', nameAr: 'الويب', isActive: true, sortOrder: 1 }],
      };
      stub = new CrmHttpStub(fixtures);
      dispose = bindCrmHttpForTest(stub);
      warn = vi.spyOn(console, 'warn');
      TestBed.configureTestingModule({ providers: [provideRouter([]), ReportState,
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true }, loader: Loader }),
        { provide: LanguageState, useValue: { current: signal(lang) } },
        { provide: ScopeState, useValue: { company: signal({ currencyCode: 'EGP' }) } },
        { provide: TenantScopeState, useValue: { me: signal({ isTenantOwner: true }) } },
        { provide: CoreHttp, useValue: { readPage: vi.fn().mockResolvedValue({ data: [{ code: 'EGP', status: 'ACTIVE' }], meta: { hasNext: false } }) } },
        { provide: OrgApi, useValue: { branches: [], teams: [], users: [], listGrantedBranches: async () => [], listTeams: async () => [], listUsers: async () => [] } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ key, tab: 'records' })), queryParamMap: of(convertToParamMap({})) } },
      ] });
      await firstValueFrom(TestBed.inject(TranslocoService).load(lang));
    });
    afterEach(() => {
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Missing hint|Missing translation/i);
      TestBed.resetTestingModule(); dispose(); crmQueries().clear(); bindAnalyticsPermissions(() => []); vi.restoreAllMocks();
      HTMLDialogElement.prototype.showModal = originalDialog.showModal;
      HTMLDialogElement.prototype.close = originalDialog.close;
    });
    async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));
      await fixture.whenStable();
      fixture.detectChanges();
    }
    async function render<T>(type: Type<T>): Promise<ComponentFixture<T>> {
      const fixture = TestBed.createComponent(type);
      await settle(fixture); return fixture;
    }

    it('CataloguePage › empty catalogue', async () => {
      const fixture = await render(CataloguePage);
      expect(fixture.nativeElement.textContent).toContain(TestBed.inject(TranslocoService).translate('repCatalogue.empty'));
      expect(fixture.nativeElement.querySelector('app-report-card')).toBeNull();
      expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
    });

    it('CatalogueApi › unavailable report shows a reason chip and readiness link', async () => {
      const fixture = TestBed.createComponent(ReportCard);
      fixture.componentRef.setInput('report', { ...FAKE_REPORTS[0], readiness: 'UNAVAILABLE' });
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('ui-badge').textContent).toBeTruthy();
      expect(fixture.nativeElement.querySelector('article').getAttribute('aria-disabled')).toBe('true');
      expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/crm/settings/data-readiness');
      expect(fixture.nativeElement.textContent).toContain(TestBed.inject(TranslocoService).translate('repCatalogue.notConnected'));
    });

    it('ReportApi › first run schema', async () => {
      const write = vi.spyOn(stub, 'write').mockResolvedValue(result(manifest));
      const state = TestBed.inject(ReportState);
      await state.load(key);
      expect(write.mock.calls[0]).toEqual(['POST', `/dashboards/reports/${key}`, expect.objectContaining({ includeFilterSchema: true }), { key: expect.any(String) }]);
      expect(write.mock.calls[0][3]?.scope).toBeUndefined();
      expect(state.manifest()?.filters.schema.length).toBeGreaterThan(0);
    });

    it('ReportPage › rows', async () => {
      const panel = manifest.panels.find(panel => panel.pageable)!;
      const first = buildFakePanelRows(key, panel.panelKey, { limit: 25 });
      const second = { ...first, rows: [['next page']], pageInfo: { limit: 25, hasMore: false, nextCursor: null } };
      const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(result(manifest)).mockResolvedValueOnce(result(first)).mockResolvedValueOnce(result(second));
      const state = TestBed.inject(ReportState);
      await state.load(key);
      const fixture = await render(RecordsTab);
      expect(write.mock.calls[1][1]).toBe(`/dashboards/reports/${key}/panels/${panel.panelKey}/rows`);
      expect(write.mock.calls[1][3]?.scope).toBeUndefined();
      await getPanelRows(key, panel.panelKey, { cursor: first.pageInfo.nextCursor, limit: 25 });
      expect(write.mock.calls[2][2]).toEqual({ cursor: first.pageInfo.nextCursor, limit: 25 });
      write.mockRejectedValue(new ApiError(422, 'CRM_REPORT_PANEL_NOT_PAGEABLE'));
      fixture.componentInstance['retry'](); await settle(fixture);
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(TestBed.inject(TranslocoService).translate('analytics.error.CRM_REPORT_PANEL_NOT_PAGEABLE'));
    });

    it('ReportPage › pin', async () => {
      const fixture = await render(PinModal);
      const modal = fixture.componentInstance;
      modal.open(key, manifest.panels); await settle(fixture);
      expect(modal['targets']().map(row => row.id)).toEqual([target.id]);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE')).mockResolvedValueOnce(result({ widgetId: 'widget', placementId: 'placement', dashboardRevision: 4 }));
      await modal['submit'](); await modal['submit']();
      expect(write.mock.calls[0][3]).toEqual({ key: expect.any(String), ifMatch: '3' });
      expect(write.mock.calls[1][3]).toEqual(write.mock.calls[0][3]);
      expect(write.mock.calls[1][2]).toEqual({ dashboardId: target.id, revision: 3 });
      modal.open(key, manifest.panels); await settle(fixture);
      write.mockRejectedValueOnce(new ApiError(422, 'CRM_REPORT_PANEL_NOT_PINNABLE'));
      await modal['submit']();
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(TestBed.inject(TranslocoService).translate('analytics.error.CRM_REPORT_PANEL_NOT_PINNABLE'));
      for (const field of fixture.nativeElement.querySelectorAll('ui-field')) {
        expect(field.textContent).toBeTruthy();
      }
      expect(modal['panelError']()).toBeNull();
    });

    it('pin stale conflict reloads the revision and keeps the selection', async () => {
      const fixture = await render(PinModal);
      const modal = fixture.componentInstance;
      modal.open(key, manifest.panels); await settle(fixture);
      const selectedPanel = modal['selectedPanelKey']();
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_DASHBOARD_REVISION_CONFLICT')).mockResolvedValue(result({}));
      await modal['submit'](); fixture.detectChanges();
      expect(modal['conflictOpen']()).toBe(true);
      fixtures['/dashboards'] = { items: [{ ...target, revision: 4 }], nextCursor: null };
      await modal['resolveConflict'](true);
      expect(modal['selectedPanelKey']()).toBe(selectedPanel);
      await modal['submit']();
      expect(write.mock.calls[1][3]?.ifMatch).toBe('4');
      expect(write.mock.calls[1][3]?.key).not.toBe(write.mock.calls[0][3]?.key);
    });

    it('pin keeps the body and key on 401 and becomes read-only after subscription denial', async () => {
      const fixture = await render(PinModal);
      const modal = fixture.componentInstance;
      modal.open(key, manifest.panels); await settle(fixture);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'GW.AUTH.MISSING_SESSION'))
        .mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
      await modal['submit']();
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(TestBed.inject(TranslocoService).translate('repReport.notSaved'));
      await modal['submit']();
      expect(write.mock.calls[1][3]?.key).toBe(write.mock.calls[0][3]?.key);
      expect(write.mock.calls[1][2]).toEqual(write.mock.calls[0][2]);
      expect(modal['readOnly']()).toBe(true);
      await modal['submit']();
      expect(write).toHaveBeenCalledTimes(2);
    });

    it('pin mismatch reloads targets without an automatic replay', async () => {
      const fixture = await render(PinModal);
      const modal = fixture.componentInstance;
      modal.open(key, manifest.panels); await settle(fixture);
      const read = vi.spyOn(stub, 'read');
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH')).mockResolvedValue(result({}));
      await modal['submit']();
      expect(write).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith('/dashboards', { kind: 'DASHBOARD', cursor: null });
      await modal['submit']();
      expect(write.mock.calls[1][3]?.key).not.toBe(write.mock.calls[0][3]?.key);
    });

    it('pin needs both grants and maps validation paths to the existing fields', async () => {
      const fixture = await render(PinModal);
      const modal = fixture.componentInstance;
      bindAnalyticsPermissions(() => ['crm.dashboards.update']);
      modal.open(key, manifest.panels);
      expect(modal['targets']()).toEqual([]);
      bindAnalyticsPermissions(() => ['crm.dashboards.update', 'crm.widgets.create']);
      // Permission changes are a new page/session in the app; use a fresh modal instance.
      const second = await render(PinModal);
      second.componentInstance.open(key, manifest.panels); await settle(second);
      vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { dashboardId: ['Invalid dashboard'] }));
      await second.componentInstance['submit'](); second.detectChanges();
      expect(second.componentInstance['fieldErrors']()).toHaveProperty('dashboardId');
      expect(second.componentInstance['dashboardError']()).toBeTruthy();
      for (const control of second.nativeElement.querySelectorAll('[aria-describedby]')) {
        for (const id of (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)) {
          expect(second.nativeElement.querySelector(`[id="${id}"]`)).not.toBeNull();
        }
      }
    });

    it('ReportFilters › lookup degrades', async () => {
      const read = stub.read.bind(stub);
      vi.spyOn(stub, 'read').mockImplementation(async (path, query) => {
        if (path === '/pipelines') throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
        return read(path, query);
      });
      const lookups = await TestBed.runInInjectionContext(() => loadReportFilterLookups());
      expect(lookups.pipelines).toEqual([]);
      expect(lookups.sources[0].id).toBe('source-1');
      expect(lookups.currencies).toEqual(['EGP']);
      const write = vi.spyOn(stub, 'write').mockResolvedValue(result(manifest));
      await TestBed.inject(ReportState).load(key);
      const fixture = await render(ReportFilters);
      expect(fixture.componentInstance['lookups']().pipelines).toEqual([]);
      expect(fixture.nativeElement.querySelectorAll('ui-field').length).toBeGreaterThan(0);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('a superseded report run cannot replace the latest filter result', async () => {
      const write = vi.spyOn(stub, 'write').mockResolvedValue(result(manifest));
      const state = TestBed.inject(ReportState);
      await state.load(key);
      let finishSlow!: (value: ReturnType<typeof result>) => void;
      write.mockImplementationOnce(() => new Promise(resolve => { finishSlow = resolve; }))
        .mockResolvedValueOnce(result(manifest));
      const slow = state.run({ filters: { sourceId: 'slow' } });
      await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
      await state.run({ filters: { sourceId: 'latest' } });
      finishSlow(result(manifest));
      await slow;
      expect(state.request().filters?.['sourceId']).toBe('latest');
    });

    it('run validation preserves field paths for the filter controls', async () => {
      const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(result(manifest))
        .mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { 'filters.pipelineId': ['Server validation'], 'period.from': ['Server validation'] }));
      const state = TestBed.inject(ReportState);
      await state.load(key);
      await state.run({ filters: { pipelineId: 'invalid' } });
      expect(Object.keys(state.fieldErrors()).sort()).toEqual(['filters.pipelineId', 'period.from']);
      const fixture = await render(ReportFilters);
      expect(fixture.componentInstance['periodPartError']('from')).toBeTruthy();
      expect(write).toHaveBeenCalledTimes(2);
    });

    it.each([
      [404, 'CRM_REPORT_NOT_FOUND', 'not-found'], [403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED', 'forbidden'],
      [503, 'CRM_TARGET_SOURCE_NOT_READY', 'provisioning'], [503, 'GW.UPSTREAM.UNAVAILABLE', 'load-failure'], [0, 'NETWORK_ERROR', 'load-failure'],
    ])('load errors use the existing state (%s %s)', async (status, code, kind) => {
      vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(Number(status), String(code), undefined, { correlationId: 'correlation' }));
      const fixture = await render(ReportPage);
      const state = fixture.componentInstance['state'];
      expect(state.error()).toBe(kind);
      expect(state.errorMessage()).toContain('correlation');
      expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
    });

    it('429 is on demand and includes retry seconds', async () => {
      const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] }));
      await TestBed.inject(ReportState).load(key);
      expect(write).toHaveBeenCalledTimes(1);
      expect(reportErrorMessage(TestBed.inject(TranslocoService), new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] }), 'repReport')).toContain('17');
    });
  });
}
