import { Injectable, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import ar from '../../../../../../../public/i18n/ar.json';
import builderEn from '../../../../../../../public/i18n/crm-widget-builder/en.json';
import builderAr from '../../../../../../../public/i18n/crm-widget-builder/ar.json';
import builder2En from '../../../../../../../public/i18n/crm-widget-builder-2/en.json';
import builder2Ar from '../../../../../../../public/i18n/crm-widget-builder-2/ar.json';
import pageEn from '../../../../../../../public/i18n/crm-widget-page/en.json';
import pageAr from '../../../../../../../public/i18n/crm-widget-page/ar.json';
import analyticsEn from '../../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../../public/i18n/analytics/ar.json';
import chartEn from '../../../../../../../public/i18n/chart/en.json';
import chartAr from '../../../../../../../public/i18n/chart/ar.json';
import recordEn from '../../../../../../../public/i18n/record-page/en.json';
import recordAr from '../../../../../../../public/i18n/record-page/ar.json';
import accessEn from '../../../../../../../public/i18n/crm-access/en.json';
import accessAr from '../../../../../../../public/i18n/crm-access/ar.json';
import dateEn from '../../../../../../../public/i18n/date-range/en.json';
import dateAr from '../../../../../../../public/i18n/date-range/ar.json';
import dashboardWidgetsEn from '../../../../../../../public/i18n/dashboard-widgets/en.json';
import dashboardWidgetsAr from '../../../../../../../public/i18n/dashboard-widgets/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../../../core/api/core-http';
import { LanguageState } from '../../../../../core/i18n/language';
import { ThemeState } from '../../../../../core/theme/theme';
import { Notify } from '../../../../../core/notify/notify';
import type { Catalog, WidgetExecution } from '../../../../../shared/widgets/dashboard/analytics.model';
import { bindAnalyticsPermissions } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries, type CrmReadOptions, type CrmWriteOptions } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import type { DraftState, PublishImpact, WidgetDetail } from '../widgets.model';
import { BuilderState } from './builder-state';

export const widgetId = '019a9d10-0000-7000-8000-000000000010';
export const draftId = '019a9d10-0000-7000-8000-000000000020';
export const actorId = '019a9d10-0000-7000-8000-000000000099';
export const generatedAt = '2026-11-23T10:00:00Z';

export const widgetCatalog: Catalog = {
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

export function widgetDraft(): DraftState {
  return { widgetId, widgetRevision: 7, governanceRevision: 3, activeVersionNumber: 2,
    draft: { draftId, revision: 5, baseVersionNumber: 2, schemaVersion: 1, name: 'Leads',
      visualizationType: 'METRIC_CARD', querySpec: { series: [{ metricKey: 'crm.leads.count' }],
        filters: { datePreset: 'CURRENT_MONTH' }, comparison: { type: 'NONE' }, scopeBinding: { kind: 'VIEWER_RELATIVE' } },
      displaySpec: {}, description: null, internalNotes: null, changeSummary: null, restoredFromVersionNumber: null,
      createdAt: generatedAt, updatedAt: generatedAt, createdByUserId: actorId, updatedByUserId: actorId } };
}

export function widgetDetail(): WidgetDetail {
  const draft = widgetDraft().draft!;
  return { id: widgetId, ownerUserId: actorId, ownerName: 'Owner', name: draft.name,
    visualizationType: draft.visualizationType, querySpec: draft.querySpec, displaySpec: {},
    schemaVersion: 1, versionNumber: 2, revision: 7, governanceRevision: 3,
    updatedAt: generatedAt, createdAt: generatedAt, accessLevel: 'OWNER', status: 'PUBLISHED',
    hasDraft: true, draftRevision: 5, sourceResources: ['leads'], isShared: false,
    usage: { placementCount: 4, dashboardCount: 3, hiddenPlacementCount: 2, activeShareCount: 1,
      nextCursor: '019a9d10-0000-7000-8000-000000000031', placements: [{
        placementId: '019a9d10-0000-7000-8000-000000000031', dashboardId: 'dashboard-1',
        dashboardName: 'Sales', dashboardRevision: 8, x: 0, y: 0, w: 16, h: 12,
      }] } };
}

export function widgetImpact(): PublishImpact {
  return { impactId: '019a9d10-0000-7000-8000-000000000040', expiresAt: '2026-11-23T10:10:00Z',
    widgetId, widgetRevision: 7, governanceRevision: 3, draftId, draftRevision: 5, nextVersionNumber: 3,
    dashboards: [{ id: 'dashboard-1', name: 'Sales', revision: 8, affected: true }], layoutAdjustments: [],
    dependents: { alertRules: { count: 0, items: [] }, subscriptions: { count: 0, items: [] }, reports: { count: 0, items: [] } },
    suspendedAlertRules: { count: 0, items: [] } };
}

export function widgetPreview(value = 42) {
  const execution: WidgetExecution = { widgetId, widgetRevision: 7, versionNumber: 2, state: 'READY',
    shape: 'SCALAR', value, series: [], meta: { unit: 'COUNT', generatedAt, warnings: [] } };
  return { ...execution, panels: [], receipts: { runId: 'run', receiptIds: [] } };
}

export class WidgetHttpStub extends CrmHttpStub {
  detail = widgetDetail();
  draft = widgetDraft();
  readFailures = new Map<string, unknown>();
  respond: (path: string, body: unknown) => unknown | Promise<unknown> = (path) => {
    if (path.endsWith('/preview')) return widgetPreview();
    if (path.endsWith('/publish-impact')) return widgetImpact();
    if (path.endsWith('/publish')) return { widgetId, versionNumber: 3, widgetRevision: 8,
      sourceDraftId: draftId, sourceDraftRevision: 5, publishedAt: generatedAt, dashboardRevisions: {}, replayed: false };
    return structuredClone(this.draft);
  };

  constructor() {
    super({ '/widgets/catalog': widgetCatalog, [`/widgets/${widgetId}`]: widgetDetail(),
      [`/widgets/${widgetId}/draft`]: widgetDraft() });
  }

  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    await super.read(path, query, options);
    if (this.readFailures.has(path)) throw this.readFailures.get(path);
    if (path.endsWith('/draft')) return structuredClone(this.draft) as T;
    if (path === `/widgets/${widgetId}`) {
      const detail = structuredClone(this.detail);
      if (query?.['usageCursor']) {
        detail.usage.nextCursor = null;
        detail.usage.placements = [{ ...detail.usage.placements[0],
          placementId: '019a9d10-0000-7000-8000-000000000030', dashboardName: 'Pipeline' }];
      }
      return detail as T;
    }
    return structuredClone(widgetCatalog) as T;
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions): Promise<CoreWriteResult<T>> {
    await super.write(method, path, body, options);
    return { status: 200, data: await this.respond(path, body) as T, etag: null, location: null };
  }
}

const scopes = {
  'crm-widget-builder': { alias: 'builder', en: builderEn, ar: builderAr },
  'crm-widget-builder-2': { alias: 'builder2', en: builder2En, ar: builder2Ar },
  'crm-widget-page': { alias: 'widgetPage', en: pageEn, ar: pageAr },
  analytics: { alias: 'analytics', en: analyticsEn, ar: analyticsAr },
  chart: { alias: 'chart', en: chartEn, ar: chartAr },
  'record-page': { alias: 'recordPage', en: recordEn, ar: recordAr },
  'crm-access': { alias: 'access', en: accessEn, ar: accessAr },
  'date-range': { alias: 'dateRange', en: dateEn, ar: dateAr },
  'dashboard-widgets': { alias: 'dashboardWidgets', en: dashboardWidgetsEn, ar: dashboardWidgetsAr },
};

@Injectable()
class WidgetLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const [scope, lang] = path.split('/');
    const entry = scopes[scope as keyof typeof scopes];
    return of(entry ? entry[lang === 'ar' ? 'ar' : 'en'] : path.endsWith('ar') ? ar : en);
  }
}

export function setupWidgetTest(language: 'en' | 'ar' = 'en', theme = 'light', stub = new WidgetHttpStub()) {
  const attributes = ['lang', 'dir', 'data-theme'].map((name) => [name, document.documentElement.getAttribute(name)]);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('data-theme', theme);
  const permissions = ['crm.widgets.read', 'crm.widgets.create', 'crm.widgets.update', 'crm.widgets.publish',
    'crm.dashboards.read.all', 'crm.analytics.readiness.view'];
  bindAnalyticsPermissions(() => permissions);
  crmQueries().clear();
  const dispose = bindCrmHttpForTest(stub);
  const params = new BehaviorSubject(convertToParamMap({ id: widgetId, tab: 'builder' }));
  const query = new BehaviorSubject(convertToParamMap({}));
  const notify = { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() };
  const originalShow = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  TestBed.configureTestingModule({ providers: [
    provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: query, snapshot: { queryParamMap: query.value } } },
    provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, reRenderOnLangChange: true }, loader: WidgetLoader }),
    { provide: LanguageState, useValue: { current: signal(language) } },
    { provide: ThemeState, useValue: { current: signal(theme) } },
    { provide: Notify, useValue: notify }, BuilderState,
  ] });
  let initialized = false;
  function initialize() {
    if (initialized) return;
    initialized = true;
    const transloco = TestBed.inject(TranslocoService);
    const translation: Translation = { ...(language === 'ar' ? ar : en) };
    for (const entry of Object.values(scopes)) translation[entry.alias] = entry[language];
    transloco.setTranslation(translation, language);
    transloco.setActiveLang(language);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }
  return { stub, permissions, notify, params, query, initialize,
    get state() { initialize(); return TestBed.inject(BuilderState); },
    get transloco() { initialize(); return TestBed.inject(TranslocoService); },
    create<T>(component: Type<T>) { initialize(); return TestBed.createComponent(component); },
    restore() {
      TestBed.resetTestingModule(); crmQueries().clear(); dispose(); bindAnalyticsPermissions(() => []);
      vi.useRealTimers(); vi.restoreAllMocks();
      HTMLDialogElement.prototype.showModal = originalShow;
      HTMLDialogElement.prototype.close = originalClose;
      for (const [name, value] of attributes) {
        if (value === null) document.documentElement.removeAttribute(name!);
        else document.documentElement.setAttribute(name!, value!);
      }
    },
  };
}

export const networkError = () => new ApiError(0, 'NETWORK_ERROR');
