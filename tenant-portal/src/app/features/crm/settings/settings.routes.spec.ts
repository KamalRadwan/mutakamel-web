import { RealtimeClient } from '../../../core/realtime/realtime-client';
import { NotificationsFeed } from '../../../core/realtime/notifications-feed';
import { CrmEvents } from '../../../core/realtime/crm-events';
import { ApplicationInitStatus, Component, EnvironmentInjector, signal } from '@angular/core';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { CrmModules } from '../shared/crm-modules/crm-modules';
import { settingsRoutes } from './settings.routes';
import { appConfig } from '../../../app.config';
import { AuthSession } from '../../../core/auth/auth-session';
import { LanguageState } from '../../../core/i18n/language';
import { ThemeState } from '../../../core/theme/theme';
import { ViewScale } from '../../../core/view/view-scale';
import { TabLeader } from '../../../core/tabs/tab-leader';
import { CrmHttp, crmHttp } from '../shared/crm-http';
import { bindCrmInjector } from '../shared/crm-runtime';
import { CRM_SETTINGS_FIXTURES } from '../shared/testing/crm-settings-fixtures';
import { listPageSizes } from '../shared/lookups/page-sizes';
import { bindAnalyticsPermissions } from '../../../shared/widgets/dashboard/analytics-permissions';

@Component({ template: '' })
class SettingsRouteTestPage {}

const gatedPages = [
  { page: 'lead-stages', key: 'crm.lead_stages.read', tenantOnly: true },
  { page: 'pipelines', key: 'crm.pipelines.manage', tenantOnly: true },
  { page: 'pipelines/:id', key: 'crm.pipelines.manage', tenantOnly: true },
  { page: 'opportunity-stages', key: 'crm.pipelines.manage', tenantOnly: true },
  { page: 'lead-sources', key: 'crm.acquisition_sources.read', tenantOnly: false },
  { page: 'tags', key: 'crm.tags.read', tenantOnly: true },
  { page: 'custom-fields', key: 'crm.custom_fields.read', tenantOnly: true },
  { page: 'reasons', key: 'crm.settings.read', tenantOnly: true },
  { page: 'outbound-emails', key: 'crm.activities.read', tenantOnly: false },
  { page: 'general', key: 'crm.settings.read', tenantOnly: true },
  { page: 'targets', key: 'crm.targets.read', tenantOnly: false },
  { page: 'sla', key: 'crm.sla.manage', tenantOnly: false },
  { page: 'calendars', key: 'crm.sla.manage', tenantOnly: false },
  { page: 'data-readiness', key: 'crm.analytics.readiness.view', tenantOnly: true },
];

describe('settings routes', () => {
  const me = signal<TenantMe | null>(null);
  const leadsEnabled = signal(true);
  const opportunitiesEnabled = signal(true);
  let harness: RouterTestingHarness;
  let router: Router;

  function grant(key: string, tenantWide = true): void {
    me.update((current) => ({
      ...current!,
      permissions: [...current!.permissions, key],
      permissionScopes: {
        ...current!.permissionScopes,
        [key]: { tenantWide, companyIds: [], branchIds: tenantWide ? [] : ['branch-a'] },
      },
    }));
  }

  async function navigate(page = ''): Promise<string> {
    await harness.navigateByUrl(`/crm/settings${page ? '/' + page.replace(':id', 'pipeline-a') : ''}`);
    return router.url;
  }

  beforeEach(async () => {
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [], permissionScopes: {} });
    leadsEnabled.set(true);
    opportunitiesEnabled.set(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: TenantScopeState, useValue: { me } },
        { provide: CrmModules, useValue: {
          ensureLoaded: () => Promise.resolve(),
          leadsAnywhere: leadsEnabled,
          opportunitiesAnywhere: opportunitiesEnabled,
        } },
        provideRouter([
          { path: 'crm/settings', children: settingsRoutes.map((route) => route.loadComponent
            ? { ...route, loadComponent: undefined, component: SettingsRouteTestPage }
            : route) },
          { path: 'crm/off/:module', component: SettingsRouteTestPage },
          { path: 'forbidden', component: SettingsRouteTestPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  for (const { page, key } of gatedPages) {
    it(`${page} opens with its key`, async () => {
      grant(key);
      expect(await navigate(page)).toBe(`/crm/settings/${page.replace(':id', 'pipeline-a')}`);
      expect(settingsRoutes.find((route) => route.path === page)?.loadComponent).toBeTypeOf('function');
    });

    it(`${page} without its key goes to 403`, async () => {
      expect(await navigate(page)).toBe('/forbidden');
    });
  }

  it('static-data opens with its key', async () => {
    // Static data needs no permission key beyond the signed-in CRM parent route.
    expect(await navigate('static-data')).toBe('/crm/settings/static-data');
  });

  it('static-data without its key goes to 403', async () => {
    me.set(null);
    expect(await navigate('static-data')).toBe('/forbidden');
  });

  it('a branch grant does not open a tenant-only page', async () => {
    for (const { page, key } of gatedPages.filter((entry) => entry.tenantOnly)) {
      grant(key, false);
      expect(await navigate(page)).toBe('/forbidden');
    }
  });

  it('a branch grant opens lead sources, outbound emails, sla, calendars, targets', async () => {
    grant('crm.acquisition_sources.read', false);
    grant('crm.activities.read.team', false);
    grant('crm.sla.manage', false);
    grant('crm.targets.read.own', false);
    for (const page of ['lead-sources', 'outbound-emails', 'sla', 'calendars', 'targets']) {
      expect(await navigate(page)).toBe(`/crm/settings/${page}`);
    }
  });

  it('accepts either SLA and calendar read key', async () => {
    grant('crm.dashboards.read.team', false);
    expect(await navigate('sla')).toBe('/crm/settings/sla');
    expect(await navigate('calendars')).toBe('/forbidden');
    grant('crm.targets.read.all', false);
    expect(await navigate('calendars')).toBe('/crm/settings/calendars');
  });

  it('the owner passes every read gate', async () => {
    me.update((current) => ({ ...current!, isTenantOwner: true }));
    for (const { page } of gatedPages) {
      expect(await navigate(page)).toBe(`/crm/settings/${page.replace(':id', 'pipeline-a')}`);
    }
  });

  it('keeps the leads and opportunities module gates', async () => {
    me.update((current) => ({ ...current!, isTenantOwner: true }));
    leadsEnabled.set(false);
    opportunitiesEnabled.set(false);
    expect(await navigate('lead-stages')).toBe('/crm/off/leads');
    for (const page of ['pipelines', 'pipelines/:id', 'opportunity-stages']) {
      expect(await navigate(page)).toBe('/crm/off/opportunities');
    }
  });

  it('duplicates is not routed in wave A', () => {
    expect(settingsRoutes.some((route) => route.path === 'duplicates')).toBe(false);
  });

  it('default redirect picks the first allowed page', async () => {
    grant('crm.pipelines.manage');
    grant('crm.acquisition_sources.read', false);
    expect(await navigate()).toBe('/crm/settings/pipelines');
    opportunitiesEnabled.set(false);
    expect(await navigate()).toBe('/crm/settings/lead-sources');
    grant('crm.lead_stages.read');
    expect(await navigate()).toBe('/crm/settings/lead-stages');
    leadsEnabled.set(false);
    expect(await navigate()).toBe('/crm/settings/lead-sources');
  });

  it('default redirect falls back to static data for a CRM user without read keys', async () => {
    expect(await navigate()).toBe('/crm/settings/static-data');
  });

  it('default redirect without any page goes to 403', async () => {
    me.set(null);
    expect(await navigate()).toBe('/forbidden');
  });
});

describe('app config', () => {
  it('binds CrmHttp at startup and resolves a settings route', async () => {
    TestBed.configureTestingModule({ providers: [
      ...appConfig.providers, provideHttpClientTesting(),
      { provide: AuthSession, useValue: { me: () => FAKE_TENANT_ME, status: () => 'signed-in', ensureLoaded: async () => 'signed-in', requestVersion: () => 0 } },
      { provide: LanguageState, useValue: { current: () => 'en' } },
      { provide: ThemeState, useValue: {} }, { provide: ViewScale, useValue: {} },
      { provide: TabLeader, useValue: { start: () => undefined } },
      { provide: RealtimeClient, useValue: {} },
      { provide: NotificationsFeed, useValue: {} },
      { provide: CrmEvents, useValue: { bind: () => undefined } },
      { provide: TitleStrategy, useValue: { updateTitle: () => undefined } },
    ] });
    try {
      const initializers = TestBed.inject(ApplicationInitStatus);
      await initializers.donePromise;
      expect(crmHttp()).toBe(TestBed.inject(CrmHttp));
      TestBed.inject(Router).resetConfig([{ path: 'crm/settings/static-data', component: SettingsRouteTestPage,
        resolve: { pagination: () => listPageSizes() } }]);
      const harness = await RouterTestingHarness.create();
      const navigation = harness.navigateByUrl('/crm/settings/static-data');
      const http = TestBed.inject(HttpTestingController);
      await vi.waitFor(() => http.expectOne('/api/tenant/crm/v1/static-data')
        .flush(CRM_SETTINGS_FIXTURES['/static-data'] as object));
      await navigation;
      expect(TestBed.inject(Router).url).toBe('/crm/settings/static-data');
      expect(harness.routeDebugElement?.injector.get(ActivatedRoute).snapshot.data['pagination'])
        .toEqual({ pageSizes: [20, 50, 100], defaultPageSize: 20 });
      http.verify();
    } finally {
      bindAnalyticsPermissions(() => []);
      bindCrmInjector(() => TestBed.inject(EnvironmentInjector));
      TestBed.resetTestingModule();
    }
  });
});
