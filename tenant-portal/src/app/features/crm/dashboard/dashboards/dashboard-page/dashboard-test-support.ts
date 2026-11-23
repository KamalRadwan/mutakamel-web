import { Injectable, signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import ar from '../../../../../../../public/i18n/ar.json';
import pageEn from '../../../../../../../public/i18n/crm-dash-page/en.json';
import pageAr from '../../../../../../../public/i18n/crm-dash-page/ar.json';
import filtersEn from '../../../../../../../public/i18n/crm-dash-filters/en.json';
import filtersAr from '../../../../../../../public/i18n/crm-dash-filters/ar.json';
import analyticsEn from '../../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../../public/i18n/analytics/ar.json';
import chartEn from '../../../../../../../public/i18n/chart/en.json';
import chartAr from '../../../../../../../public/i18n/chart/ar.json';
import widgetsEn from '../../../../../../../public/i18n/dashboard-widgets/en.json';
import widgetsAr from '../../../../../../../public/i18n/dashboard-widgets/ar.json';
import editEn from '../../../../../../../public/i18n/crm-dash-edit/en.json';
import editAr from '../../../../../../../public/i18n/crm-dash-edit/ar.json';
import shareEn from '../../../../../../../public/i18n/crm-dash-share/en.json';
import shareAr from '../../../../../../../public/i18n/crm-dash-share/ar.json';
import recordEn from '../../../../../../../public/i18n/record-page/en.json';
import recordAr from '../../../../../../../public/i18n/record-page/ar.json';
import dateEn from '../../../../../../../public/i18n/date-range/en.json';
import dateAr from '../../../../../../../public/i18n/date-range/ar.json';
import paginationEn from '../../../../../../../public/i18n/ui-pagination/en.json';
import paginationAr from '../../../../../../../public/i18n/ui-pagination/ar.json';
import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../../../core/api/core-http';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { Catalog, DashboardRun, PanelState, Receipt, WidgetExecution } from '../../../../../shared/widgets/dashboard/analytics.model';
import { bindAnalyticsPermissions } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries, type CrmReadOptions, type CrmWriteOptions } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import type { DashboardDetail } from '../dashboards.model';

export const dashboardId = '019a9d10-0000-7000-8000-000000000001';
export const widgetId = '019a9d10-0000-7000-8000-000000000010';
export const actorId = '019a9d10-0000-7000-8000-000000000099';
export const receiptId = '019a9d10-0000-7000-8000-000000000080';
export const generatedAt = '2026-11-23T10:00:00Z';
const translations = {
  'crm-dash-page': [pageEn, pageAr], 'crm-dash-filters': [filtersEn, filtersAr],
  analytics: [analyticsEn, analyticsAr], chart: [chartEn, chartAr],
  'dashboard-widgets': [widgetsEn, widgetsAr], 'crm-dash-edit': [editEn, editAr], 'date-range': [dateEn, dateAr],
  'ui-pagination': [paginationEn, paginationAr],
  'crm-dash-share': [shareEn, shareAr], 'record-page': [recordEn, recordAr],
};

@Injectable()
class DashboardLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const [scope, lang] = path.split('/');
    const pair = translations[scope as keyof typeof translations];
    return of(pair ? pair[lang === 'ar' ? 1 : 0] : path.endsWith('ar') ? ar : en);
  }
}

export function dashboardDetail(count = 2): DashboardDetail {
  const placements = Array.from({ length: count }, (_, index) => {
    const id = index === 0 ? widgetId : `019a9d10-0000-7000-8000-${String(index + 10).padStart(12, '0')}`;
    return {
      id: `019a9d10-0000-7000-8000-${String(index + 30).padStart(12, '0')}`, dashboardId, widgetId: id,
      sortOrder: index, versionPolicy: 'FOLLOW_ACTIVE' as const, pinnedVersionNumber: null,
      widget: { id, name: `Metric ${index + 1}`, ownerUserId: actorId, ownerName: 'Owner',
        visualizationType: 'METRIC_CARD' as const, querySpec: { series: [{ metricKey: 'crm.leads.count' }] },
        displaySpec: {}, schemaVersion: 2, revision: 3, updatedAt: generatedAt, versionNumber: 2 },
    };
  });
  return { id: dashboardId, name: 'Sales', ownerUserId: actorId, ownerName: 'Owner', kind: 'DASHBOARD',
    description: null, defaultFilters: {}, sourceTemplateKey: null, schemaVersion: 2, revision: 7,
    createdAt: generatedAt, updatedAt: generatedAt, accessLevel: 'OWNER', isShared: false, isDefault: false,
    isFavorite: false, blueprintKey: null, blueprintRevision: null, templateVersionPolicy: null,
    layoutCollisionMode: 'PUSH', isLayoutLocked: false, breakpoints: [],
    layouts: { desktop: { origin: 'MATERIALIZED', items: placements.map((p, index) => ({
      placementId: p.id, x: index * 16, y: 0, w: 16, h: 12, zIndex: 0, isHidden: false, origin: 'MANUAL',
    })) } }, placements, unavailablePlacements: [], widgets: placements.map((p) => p.widget) };
}

export const catalog: Catalog = {
  grid: { columns: 48, rowHeightPx: 8, maxWidgets: 20, maxPointsPerWidget: 1000, timeZone: 'UTC' },
  metrics: [{ key: 'crm.leads.count', labelEn: 'Leads', labelAr: 'العملاء المحتملون', unit: 'COUNT', shape: 'SCALAR',
    availability: 'AVAILABLE', dimensions: [], requiredResource: 'leads', supportsPeriodComparison: true,
    timeModel: 'EVENT', dateField: 'CREATED_AT', formulaKey: 'COUNT', supportedFilters: ['branchIds'],
    comparisonTypes: ['NONE'], currencyPolicy: 'NOT_APPLICABLE', accessResources: ['leads'], emptyValuePolicy: 'ZERO',
    readiness: { basis: 'CURRENT', sources: [] }, drilldown: { dimensionKey: 'none', requiresCurrency: false } }],
  visualizations: [{ key: 'METRIC_CARD', shapes: ['SCALAR'], minSeries: 1, maxSeries: 10,
    supportsDualAxis: false, supportsMixedUnits: false, supportsReferences: false, supportedTransforms: [],
    requiresTarget: false, supportsPeriodComparison: true, minSize: { w: 12, h: 8 }, defaultSize: { w: 16, h: 12 } }],
  dimensions: [], widgetRecipes: [], templates: [],
};

export function dashboardRun(states: PanelState[] = ['READY', 'READY']): DashboardRun {
  const detail = dashboardDetail(states.length);
  const widgets: Record<string, WidgetExecution> = {};
  detail.placements.forEach((p, index) => { widgets[p.widgetId] = {
    widgetId: p.widgetId, widgetRevision: 3, versionNumber: 2,
    state: states[index] === 'UNAVAILABLE' ? 'UNAVAILABLE' : states[index] === 'ERROR' ? 'FAILED' : 'READY',
    shape: 'SCALAR', value: 42, series: [], meta: { unit: 'COUNT', generatedAt, warnings: [] },
  }; });
  return { dashboardId, revision: 7, filters: {}, generatedAt, scope: [], widgets, unavailablePlacements: [],
    populationScope: { state: 'READY', teamIds: [], ownerUserIds: [], teams: [], owners: [] },
    organizationScope: { companyId: null, branchId: null, companies: [], branches: [], partialAccess: false },
    panels: detail.placements.map((p, index) => ({ panelKey: p.widgetId, metricKeys: ['crm.leads.count'], state: states[index],
      shape: 'SCALAR', cached: false, computedAt: generatedAt, durationMs: 1, receiptId,
      ...(states[index] === 'UNAVAILABLE' ? { unavailable: { reasonCode: 'SOURCE_NOT_READY:core.team_membership_history' } } : {}) })),
    receipts: { runId: 'run', receiptIds: [receiptId] } };
}

export const receipt: Receipt = {
  id: receiptId, runId: 'run', executionKind: 'DASHBOARD', metricKey: 'crm.leads.count', reportKey: null,
  panelKey: widgetId, dashboardId, widgetId, executedAt: generatedAt, asOf: generatedAt,
  period: { from: '2026-11-01', to: '2026-11-23' }, filters: {}, resultStatus: 'OK', unavailableReasonCode: null,
  coverage: { coverageStartedAt: null, historyIncomplete: false },
  result: { value: '42', numerator: null, denominator: null, unit: 'COUNT', currencyCode: null, rowCount: 42 }, durationMs: 1,
};

export class DashboardHttpStub extends CrmHttpStub {
  readonly readFailures = new Map<string, unknown>();
  respond: (path: string, body: unknown) => Promise<unknown> = async () => dashboardRun();
  constructor(detail = dashboardDetail()) {
    super({ [`/dashboards/${dashboardId}`]: detail, '/dashboards/catalog': catalog,
      '/dashboards/navigation': { items: [] }, [`/dashboards/receipts/${receiptId}`]: receipt,
      [`/dashboards/receipts/${receiptId}/explain`]: {
        receiptId, definition: { metricKey: 'crm.leads.count', formulaKey: 'COUNT', version: 1, unit: 'COUNT',
          timeModel: 'EVENT', dateField: 'CREATED_AT', currencyPolicy: 'NOT_APPLICABLE', emptyValuePolicy: 'ZERO', basis: 'CURRENT', sources: [] },
        filters: {}, scope: { fingerprint: 'scope', period: receipt.period, asOf: generatedAt }, coverage: receipt.coverage,
        numerator: null, denominator: null, value: { value: '42', labelKey: null, drillRef: null },
      } });
  }
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    const result = await super.read<T>(path, query, options);
    if (this.readFailures.has(path)) throw this.readFailures.get(path);
    return result;
  }
  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions): Promise<CoreWriteResult<T>> {
    await super.write(method, path, body, options);
    return { status: 200, data: await this.respond(path, body) as T, etag: null, location: null };
  }
}

export function setupDashboardTest(language: 'en' | 'ar', theme: string, stub = new DashboardHttpStub()) {
  const oldAttributes = ['lang', 'dir', 'data-theme'].map((name) => [name, document.documentElement.getAttribute(name)]);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('data-theme', theme);
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  const originalShow = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
  const permissions = ['crm.dashboards.read.all', 'crm.analytics.readiness.view'];
  bindAnalyticsPermissions(() => permissions);
  crmQueries().clear();
  const dispose = bindCrmHttpForTest(stub);
  const params = new BehaviorSubject(convertToParamMap({ id: dashboardId }));
  const query = new BehaviorSubject(convertToParamMap({ widget: widgetId, point: 'value' }));
  const route = { paramMap: params, queryParamMap: query, snapshot: { queryParamMap: query.value } };
  const me = signal({ id: actorId, isTenantOwner: false, permissions: [], permissionScopes: {} });
  TestBed.configureTestingModule({ providers: [
    provideRouter([]), { provide: ActivatedRoute, useValue: route },
    provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true }, loader: DashboardLoader }),
    { provide: LanguageState, useValue: { current: signal(language) } },
    { provide: TenantScopeState, useValue: { me, selection: signal(null), branchCompanies: signal(new Map()) } },
    { provide: Notify, useValue: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() } },
  ] });
  function initialize() {
    const transloco = TestBed.inject(TranslocoService);
    const index = language === 'ar' ? 1 : 0;
    transloco.setTranslation({ ...(language === 'ar' ? ar : en), dashPage: translations['crm-dash-page'][index],
      dashFilters: translations['crm-dash-filters'][index], analytics: translations.analytics[index], chart: translations.chart[index],
      dashboardWidgets: translations['dashboard-widgets'][index], dashEdit: translations['crm-dash-edit'][index],
      share: translations['crm-dash-share'][index], recordPage: translations['record-page'][index],
    }, language);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(async (commands, extras) => {
    if (commands.length === 0 && extras?.queryParams) {
      const next = Object.fromEntries(query.value.keys.map((key) => [key, query.value.get(key)]));
      for (const [key, value] of Object.entries(extras.queryParams)) {
        if (value === null) delete next[key]; else next[key] = String(value);
      }
      query.next(convertToParamMap(next));
      route.snapshot.queryParamMap = query.value;
    }
    return true;
    });
  }
  return { stub, permissions, me, params, query,
    get navigate() { return vi.mocked(TestBed.inject(Router).navigate); },
    get transloco() { return TestBed.inject(TranslocoService); },
    create<T>(component: Type<T>): ComponentFixture<T> { initialize(); return TestBed.createComponent(component); },
    restore() {
      crmQueries().clear(); dispose(); bindAnalyticsPermissions(() => []);
      TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks();
      HTMLDialogElement.prototype.showModal = originalShow; HTMLDialogElement.prototype.close = originalClose;
      for (const [name, value] of oldAttributes) {
        if (value === null) document.documentElement.removeAttribute(name!);
        else document.documentElement.setAttribute(name!, value!);
      }
    },
  };
}
