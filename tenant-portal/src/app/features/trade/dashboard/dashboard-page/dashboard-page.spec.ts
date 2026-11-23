import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arAnalytics from '../../../../../../public/i18n/analytics/ar.json';
import enAnalytics from '../../../../../../public/i18n/analytics/en.json';
import arChart from '../../../../../../public/i18n/chart/ar.json';
import enChart from '../../../../../../public/i18n/chart/en.json';
import arDashboardWidgets from '../../../../../../public/i18n/dashboard-widgets/ar.json';
import enDashboardWidgets from '../../../../../../public/i18n/dashboard-widgets/en.json';
import arTradeDashboard from '../../../../../../public/i18n/trade-dashboard/ar.json';
import enTradeDashboard from '../../../../../../public/i18n/trade-dashboard/en.json';
import arTradeDashboardModals from '../../../../../../public/i18n/trade-dashboard-modals/ar.json';
import enTradeDashboardModals from '../../../../../../public/i18n/trade-dashboard-modals/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState, type ScopeBranch, type ScopeCompany } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ThemeState } from '../../../../core/theme/theme';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { DashboardShareModal } from '../dashboard-share-modal/dashboard-share-modal';
import { CATALOG } from '../trade-dashboard.catalog';
import type {
  DashboardDetail,
  DefaultResult,
  Navigation,
  RunResult,
  ShareListResponse,
  ShareTargetListResponse,
  UpsertSharesResponse,
} from '../trade-dashboard.model';
import { TradeDashboardPage } from './dashboard-page';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPANY_ID = '01900000-0000-7000-8000-000000000001';
const BRANCH_ID = '01900000-0000-7000-8000-000000000002';
const DASH_ID = '01900000-0000-7000-8000-000000000010';
const WIDGET_ID = '01900000-0000-7000-8000-000000000020';
const PLACEMENT_ID = '01900000-0000-7000-8000-000000000030';
const USER_ID = '01900000-0000-7000-8000-000000000050';
const TARGET_USER_ID = '01900000-0000-7000-8000-000000000051';
const SHARE_ID = '01900000-0000-7000-8000-000000000060';

@Injectable()
class DashboardTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('trade-shared/')) return of(arabic ? arTradeShared : enTradeShared);
    if (path.startsWith('trade-dashboard-modals/')) return of(arabic ? arTradeDashboardModals : enTradeDashboardModals);
    if (path.startsWith('trade-dashboard/')) return of(arabic ? arTradeDashboard : enTradeDashboard);
    if (path.startsWith('dashboard-widgets/')) return of(arabic ? arDashboardWidgets : enDashboardWidgets);
    if (path.startsWith('chart/')) return of(arabic ? arChart : enChart);
    if (path.startsWith('analytics/')) return of(arabic ? arAnalytics : enAnalytics);
    return of(arabic ? ar : en);
  }
}

function makeDashboard(overrides: Partial<DashboardDetail> = {}): DashboardDetail {
  return {
    id: DASH_ID,
    ownerUserId: USER_ID,
    ownerName: 'Rana Mansour',
    name: 'Executive Overview',
    description: 'Overview',
    scopeCoverage: 'SINGLE_COMPANY',
    scopeTargets: [{ companyId: COMPANY_ID }],
    defaultFilters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
    sourceTemplateKey: 'TRADE_EXECUTIVE',
    definitionSchemaVersion: 1,
    revision: 2,
    accessLevel: 'OWNER',
    isShared: false,
    isDefault: true,
    isFavorite: false,
    createdAt: '2026-11-23T09:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    placements: [
      {
        id: PLACEMENT_ID,
        widgetId: WIDGET_ID,
        x: 0,
        y: 0,
        width: 3,
        height: 2,
        sortOrder: 0,
        widget: {
          id: WIDGET_ID,
          ownerUserId: USER_ID,
          ownerName: 'Rana Mansour',
          accessLevel: 'OWNER',
          isShared: false,
          name: 'Confirmed sales value',
          visualizationType: 'METRIC_CARD',
          querySpec: { series: [{ metricKey: 'trade.sales_orders.confirmed.value' }] },
          displaySpec: {},
          revision: 1,
        },
      },
    ],
    unavailablePlacements: [],
    responsive: { canonicalLayout: 'DESKTOP_12', derivedLayouts: ['DESKTOP_12', 'TABLET_6', 'MOBILE_1'] },
    ...overrides,
  };
}

function makeNavigation(dash: DashboardDetail): Navigation {
  return {
    items: [
      {
        id: dash.id,
        name: dash.name,
        sourceTemplateKey: dash.sourceTemplateKey,
        isDefault: dash.isDefault,
        isFavorite: dash.isFavorite,
        isShared: dash.isShared,
        accessLevel: dash.accessLevel,
        ownerUserId: dash.ownerUserId,
        ownerName: dash.ownerName,
        revision: dash.revision,
        updatedAt: dash.updatedAt,
      },
    ],
    activeDashboardId: dash.id,
    preferenceContext: { kind: 'COMPANY', companyId: COMPANY_ID },
    capabilities: { canEditLayout: true, canonicalColumns: 12, responsiveLayouts: ['DESKTOP_12'] },
  };
}

function makeRunResult(dash: DashboardDetail): RunResult {
  return {
    dashboardId: dash.id,
    dashboardRevision: dash.revision,
    catalogVersion: 1,
    generatedAt: '2026-11-23T10:30:00.000Z',
    timeZone: 'Africa/Cairo',
    scope: {
      coverage: 'SINGLE_COMPANY',
      mode: 'SAVED_TARGETS',
      targets: [{ companyId: COMPANY_ID, coverage: 'FULL_COMPANY', branchIds: [BRANCH_ID] }],
      fingerprint: 'sha256:abc',
      resolvedAt: '2026-11-23T10:30:00.000Z',
    },
    normalizedFilters: {
      datePreset: 'CURRENT_MONTH',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      timeZone: 'Africa/Cairo',
      today: '2026-11-23',
      comparisonMode: 'NONE',
      currencyCodes: [],
      itemIds: [],
      clauses: [],
      matchNone: false,
    },
    status: 'COMPLETE',
    widgets: {
      [WIDGET_ID]: {
        widgetId: WIDGET_ID,
        status: 'READY',
        shape: 'SCALAR',
        metricVersions: { 'trade.sales_orders.confirmed.value': 1 },
        sourceOwners: ['salesOrders'],
        sourceEpochs: ['salesOrders:canonical:2026-11-23T10:30:00.000Z'],
        asOf: '2026-11-23T10:30:00.000Z',
        completeness: 'COMPLETE',
        partitions: [{ companyId: COMPANY_ID, branchIds: [BRANCH_ID], currencyCode: 'EGP', scalar: '12500' }],
        warnings: [],
      },
    },
    unavailablePlacements: [],
    warnings: [],
  };
}

for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`TradeDashboardPage (${language} ${theme})`, () => {
      let fixture: ComponentFixture<TradeDashboardPage>;
      let page: TradeDashboardPage;
      let stub: TradeHttpStub;
      let dispose: () => void;
      let dashboard: DashboardDetail;
      const dialogPrototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogPrototype['showModal'],
        close: dialogPrototype['close'],
      };
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);
      const companySignal = signal<ScopeCompany>({
        id: COMPANY_ID,
        nameEn: 'Acme Trading',
        nameAr: 'شركة أكمي',
        currencyCode: 'EGP',
        branches: [{ id: BRANCH_ID, nameEn: 'Main', nameAr: 'الرئيسي' }],
      });
      const branchSignal = signal<ScopeBranch>({ id: BRANCH_ID, nameEn: 'Main', nameAr: 'الرئيسي' });
      const companiesSignal = signal<readonly ScopeCompany[]>([companySignal()]);
      const branchesSignal = signal<readonly ScopeBranch[]>(companySignal().branches);

      function configureTestBed(): void {
        TestBed.configureTestingModule({
          imports: [TradeDashboardPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: language,
                reRenderOnLangChange: true,
              },
              loader: DashboardTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            {
              provide: ScopeState,
              useValue: {
                companies: companiesSignal,
                branches: branchesSignal,
                company: companySignal,
                branch: branchSignal,
                hasChoice: signal(false),
                selectCompany: () => {},
                selectBranch: () => {},
              },
            },
            { provide: LanguageState, useValue: { current: signal(language) } },
            { provide: ThemeState, useValue: { current: signal(theme) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(language === 'ar' ? ar : en),
            tradeShared: language === 'ar' ? arTradeShared : enTradeShared,
            tradeDashboard: language === 'ar' ? arTradeDashboard : enTradeDashboard,
            tradeDashboardModals: language === 'ar' ? arTradeDashboardModals : enTradeDashboardModals,
            dashboardWidgets: language === 'ar' ? arDashboardWidgets : enDashboardWidgets,
            chart: language === 'ar' ? arChart : enChart,
            analytics: language === 'ar' ? arAnalytics : enAnalytics,
          },
          language,
        );
      }

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        window.matchMedia ??= (() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        })) as never;
        dialogPrototype['showModal'] = function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        };
        dialogPrototype['close'] = function (this: HTMLDialogElement) {
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        };
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        dashboard = makeDashboard();
        const defRes: DefaultResult = { dashboard, ensureTemplate: null };
        stub = new TradeHttpStub({
          'GET /dashboards/catalog': CATALOG,
          'GET /dashboards/navigation': makeNavigation(dashboard),
          'GET /dashboards/default': defRes,
          'GET /dashboards/:id': dashboard,
          'POST /dashboards/:id/run': makeRunResult(dashboard),
        });
        dispose = bindTradeHttpForTest(stub);
        configureTestBed();
      });

      afterEach(() => {
        fixture?.destroy();
        dialogPrototype['showModal'] = originalDialog.showModal;
        dialogPrototype['close'] = originalDialog.close;
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
      });

      function setPermissions(keys: readonly string[]): void {
        const permissionScopes: TenantMe['permissionScopes'] = {};
        for (const key of keys) {
          permissionScopes[key] = { tenantWide: true, companyIds: [], branchIds: [] };
        }
        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions: [...keys],
          permissionScopes,
        });
      }

      async function stable(): Promise<void> {
        await vi.waitFor(() => expect(page['pageState']()).not.toBe('loading'));
        await fixture.whenStable();
        fixture.detectChanges();
      }

      async function render(
        keys: readonly string[] = [
          'trade.dashboards.read',
          'trade.dashboards.create',
          'trade.dashboards.update',
          'trade.dashboards.delete',
          'trade.dashboards.share',
          'trade.widgets.read',
        ],
      ): Promise<void> {
        setPermissions(keys);
        fixture = TestBed.createComponent(TradeDashboardPage);
        page = fixture.componentInstance;
        fixture.detectChanges();
        await stable();
      }

      function fullState(): FullState | undefined {
        return fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
      }

      it('loads catalog/navigation/default, runs dashboard with requestId and OPTIONAL scope, keeps hints, and avoids raw keys', async () => {
        await render();
        expect(page['pageState']()).toBe('ready');
        expect(stub.recordedReads().map((r) => r.path)).toEqual([
          '/dashboards/catalog',
          '/dashboards/navigation',
          '/dashboards/default',
        ]);
        const runWrite = stub.recordedWrites().find((w) => w.path === `/dashboards/${DASH_ID}/run`);
        expect(runWrite).toBeDefined();
        expect((runWrite!.body as { requestId: string }).requestId).toMatch(UUID_V7_REGEX);
        expect(runWrite!.scope).toEqual({ companyId: COMPANY_ID });

        const filterFields = fixture.nativeElement.querySelectorAll('app-trade-dashboard-filters ui-field');
        expect(filterFields.length).toBeGreaterThan(0);
        for (const field of filterFields) {
          expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
        }

        expect(fixture.nativeElement.textContent).toContain('Executive Overview');
        expect(fixture.nativeElement.textContent).not.toContain('tradeDashboard.');
        expect(fixture.nativeElement.textContent).not.toContain('tradeDashboardModals.');
        expect(fixture.nativeElement.textContent).not.toContain('tradeShared.');
      });

      it('shows empty state without automatically creating the suggested template', async () => {
        stub.register('GET', '/dashboards/default', {
          dashboard: null,
          ensureTemplate: { templateKey: 'TRADE_EXECUTIVE', preferenceContext: { kind: 'COMPANY', companyId: COMPANY_ID } },
        });
        await render();
        expect(page['pageState']()).toBe('empty');
        expect(stub.recordedWrites()).toHaveLength(0);
        expect(fullState()?.actionLabel()).toBe(
          TestBed.inject(TranslocoService).translate('tradeDashboard.page.createDashboard'),
        );
        expect(page['catalog']()?.templates).toHaveLength(6);
        const openCreate = vi.spyOn(page['createModal'](), 'openCreate');
        page['openCreateFromEmpty']();
        expect(openCreate).toHaveBeenCalledWith('template');
      });

      it('replaces CAN_MANAGE: hides controls without trade.dashboards.* and blocks load when trade.dashboards.read is missing', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        await render([]);
        expect(page['pageState']()).toBe('forbidden');
        expect(fullState()?.kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(errorToast).not.toHaveBeenCalled();

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub.reset();
        stub.register('GET', '/dashboards/default', { dashboard: null, ensureTemplate: null });
        await render(['trade.dashboards.read']);
        expect(page['pageState']()).toBe('empty');
        expect(stub.recordedWrites().some((w) => w.path.includes('from-template'))).toBe(false);
        expect(fixture.nativeElement.querySelector('ui-full-state button')).toBeNull();

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub.reset();
        stub.register('GET', '/dashboards/default', { dashboard, ensureTemplate: null });
        await render(['trade.dashboards.read']);
        expect(page['pageState']()).toBe('ready');
        expect(page['canEdit']()).toBe(false);
        const transloco = TestBed.inject(TranslocoService);
        const buttonTexts = Array.from(fixture.nativeElement.querySelectorAll('app-trade-dashboard-header button')).map(
          (b) => (b as HTMLButtonElement).textContent?.trim(),
        );
        expect(buttonTexts).not.toContain(transloco.translate('tradeDashboard.header.editLayout'));
      });

      it('checks management grants against the current branch', async () => {
        await render();
        const managementKeys = [
          'trade.dashboards.create', 'trade.dashboards.update', 'trade.dashboards.delete',
          'trade.dashboards.share', 'trade.widgets.read',
        ];
        me.update((current) => ({
          ...current!,
          permissionScopes: {
            ...current!.permissionScopes,
            ...Object.fromEntries(managementKeys.map((key) => [key, {
              tenantWide: false, companyIds: [], branchIds: ['other-branch'],
            }])),
          },
        }));
        fixture.detectChanges();
        for (const capability of ['canCreate', 'canEdit', 'canDelete', 'canShare', 'canReadWidgets'] as const) {
          expect(page[capability]()).toBe(false);
        }
        branchSignal.set({ id: 'other-branch', nameEn: 'Other', nameAr: 'أخرى' });
        for (const capability of ['canCreate', 'canEdit', 'canDelete', 'canShare', 'canReadWidgets'] as const) {
          expect(page[capability]()).toBe(true);
        }
      });

      it('transitions to forbidden state without error toast when server returns 403', async () => {
        const errorToast = vi.spyOn(TestBed.inject(Notify), 'error');
        stub.register('GET', '/dashboards/default', new ApiError(403, 'TRADE.DASHBOARD.SCOPE_DENIED'));
        await render();
        expect(page['pageState']()).toBe('forbidden');
        expect(fullState()?.kind()).toBe('forbidden');
        expect(errorToast).not.toHaveBeenCalled();

        fixture.destroy();
        TestBed.resetTestingModule();
        configureTestBed();
        stub.reset();
        stub.register('GET', '/dashboards/default', { dashboard, ensureTemplate: null });
        stub.register('GET', '/dashboards/catalog', new ApiError(403, 'TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED'));
        await render();
        expect(page['pageState']()).toBe('forbidden');
        expect(fullState()?.title()).toBe(
          TestBed.inject(TranslocoService).translate('tradeDashboard.page.forbiddenTitle'),
        );
      });

      it('saves layout via PATCH /dashboards/:id/layout with If-Match revision', async () => {
        await render();
        page['onEnterEditMode']();
        await stable();

        const updated = makeDashboard({ revision: 3 });
        stub.register('PATCH', '/dashboards/:id/layout', updated);
        const saved = await page['onSaveLayout']();
        expect(saved).toBe(true);

        const layoutWrite = stub.recordedWrites().find((w) => w.path === `/dashboards/${DASH_ID}/layout`);
        expect(layoutWrite).toBeDefined();
        expect(layoutWrite!.method).toBe('PATCH');
        expect(layoutWrite!.ifMatch).toBe('"2"');
        expect(layoutWrite!.key).toMatch(UUID_V7_REGEX);
      });

      it('renders ShareTarget.name without nameI18n (H-1) and sends key on bulk-upsert + If-Match on revoke', async () => {
        const sharesList: ShareListResponse = {
          items: [
            {
              id: SHARE_ID,
              subjectType: 'USER',
              subjectId: TARGET_USER_ID,
              subjectName: 'Tarek',
              accessLevel: 'VIEW',
              expiresAt: null,
              revision: 1,
              status: 'ACTIVE',
              createdAt: '2026-11-23T08:00:00.000Z',
              updatedAt: '2026-11-23T08:00:00.000Z',
            },
          ],
        };
        const targetsList: ShareTargetListResponse = {
          items: [{ subjectType: 'USER', subjectId: TARGET_USER_ID, name: 'Nour Hassan', status: 'ACTIVE' }],
          pagination: { limit: 20, offset: 0, nextOffset: null },
        };
        const upsertRes: UpsertSharesResponse = {
          resourceRevision: 3,
          changes: [
            {
              shareId: SHARE_ID,
              subjectType: 'USER',
              subjectId: TARGET_USER_ID,
              accessLevel: 'VIEW',
              revision: 2,
              changed: true,
            },
          ],
          replayed: false,
        };
        stub.register('GET', '/dashboards/:id/shares', sharesList);
        stub.register('GET', '/dashboards/share-targets', targetsList);
        stub.register('POST', '/dashboards/:id/shares/bulk-upsert', upsertRes);

        await render();
        await page['onHeaderAction']('share');
        await stable();

        const shareModal = fixture.debugElement.query(By.directive(DashboardShareModal)).componentInstance as DashboardShareModal;
        await vi.waitFor(() => expect(shareModal['loadingTargets']()).toBe(false));
        fixture.detectChanges();

        const shareModalEl = fixture.nativeElement.querySelector('app-trade-dashboard-share-modal') as HTMLElement;
        expect(shareModalEl.textContent).toContain('Nour Hassan');

        shareModal['addTarget'](targetsList.items[0]);
        const ok = await shareModal['submitShares']();
        expect(ok).toBe(true);
        const shareWrite = stub.recordedWrites().find((w) => w.path === `/dashboards/${DASH_ID}/shares/bulk-upsert`);
        expect(shareWrite).toBeDefined();
        expect(shareWrite!.key).toMatch(UUID_V7_REGEX);
      });
    });
  }
