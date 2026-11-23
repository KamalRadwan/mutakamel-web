import { NO_ERRORS_SCHEMA, type Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import type { DashboardRun } from '../../../../../shared/widgets/dashboard/analytics.model';
import type { PanelView } from '../../../../../shared/widgets/dashboard/panel-state';
import { DashboardFilters, type DashboardFilterValue } from '../dashboard-filters/dashboard-filters';
import { DashboardPage } from './dashboard-page';
import { DashboardHttpStub, dashboardDetail, dashboardId, dashboardRun, setupDashboardTest, widgetId } from './dashboard-test-support';

interface PageState {
  pageStatus: Signal<string>;
  panelViews: Signal<Record<string, PanelView>>;
  lastRun: Signal<DashboardRun | null>;
  filterValue: Signal<DashboardFilterValue>;
  canEdit: Signal<boolean>;
  canCustomize: Signal<boolean>;
  onFiltersChange(value: DashboardFilterValue): void;
  onRefresh(): void;
}

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`DashboardPage ${language} ${theme}`, () => {
    let fixture: ComponentFixture<DashboardPage> | undefined;
    let setup: ReturnType<typeof setupDashboardTest>;
    let stub: DashboardHttpStub;
    let page: PageState;
    beforeEach(() => { stub = new DashboardHttpStub(); setup = setupDashboardTest(language, theme, stub); });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });

    function create() {
      // Grid/layout/share editors have their own owners. Keep the actual view template and filter/full states.
      TestBed.overrideComponent(DashboardPage, { set: {
        imports: [TranslocoPipe, FullState, DashboardFilters], schemas: [NO_ERRORS_SCHEMA],
      } });
      fixture = setup.create(DashboardPage);
      page = fixture.componentInstance as unknown as PageState;
      fixture.detectChanges();
    }
    async function settle() {
      await vi.waitFor(() => {
        fixture!.detectChanges();
        expect(page.pageStatus()).not.toBe('loading');
        expect(Object.values(page.panelViews()).some((view) => view.status === 'loading')).toBe(false);
      });
      await fixture!.whenStable(); fixture!.detectChanges();
    }
    const runCalls = () => stub.recordedWrites().filter((call) => call.path.endsWith('/run'));
    const fullState = () => fixture!.debugElement.query(By.directive(FullState)).componentInstance as FullState;

    it('runs on demand only', async () => {
      create(); await settle();
      expect(page.pageStatus()).toBe('ready');
      expect(runCalls()).toHaveLength(1);
      expect(runCalls()[0].body).not.toHaveProperty('widgetIds');
      expect(runCalls()[0].body).toHaveProperty('includePopulationOptions', true);
      vi.useFakeTimers();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(runCalls()).toHaveLength(1);
      vi.useRealTimers();
      page.onFiltersChange({ ...page.filterValue(), compare: 'PREVIOUS_PERIOD' }); await settle();
      expect(runCalls()).toHaveLength(2);
      page.onRefresh(); await settle();
      expect(runCalls()).toHaveLength(3);
      expect(runCalls()[2].body).toHaveProperty('refresh', true);
      page.onFiltersChange(page.filterValue()); await settle();
      expect(runCalls()).toHaveLength(3);
    });

    it('keeps the latest run when an older response arrives last', async () => {
      const resolve: ((run: DashboardRun) => void)[] = [];
      stub.respond = () => new Promise<DashboardRun>((done) => resolve.push(done));
      create();
      await vi.waitFor(() => expect(resolve).toHaveLength(1));
      page.onFiltersChange({ ...page.filterValue(), compare: 'PREVIOUS_PERIOD' });
      await vi.waitFor(() => expect(resolve).toHaveLength(2));
      const latest = dashboardRun(); latest.widgets[widgetId].value = 99;
      resolve[1](latest); await settle();
      const old = dashboardRun(); old.widgets[widgetId].value = 1;
      resolve[0](old); await settle();
      expect(page.lastRun()?.widgets[widgetId].value).toBe(99);
    });

    it('targets source not ready', async () => {
      stub.respond = async () => { throw new ApiError(503, 'CRM_TARGET_SOURCE_NOT_READY'); };
      create(); await settle();
      expect(fullState().kind()).toBe('provisioning');
      expect(fullState().text()).toBe(setup.transloco.translate('analytics.error.CRM_TARGET_SOURCE_NOT_READY'));
      expect(fullState().actionLabel()).toBe(setup.transloco.translate('dashPage.openReadiness'));
      fullState().action.emit();
      expect(setup.navigate).toHaveBeenCalledWith(['/crm/settings/data-readiness']);
      expect(runCalls()).toHaveLength(1);
    });

    it('hides the readiness link without its static permission', async () => {
      setup.permissions.splice(1, 1);
      stub.respond = async () => { throw new ApiError(503, 'CRM_TEAM_SCOPE_NOT_READY'); };
      create(); await settle();
      expect(fullState().kind()).toBe('provisioning');
      expect(fullState().actionLabel()).toBe('');
    });

    it('panel states', async () => {
      stub = new DashboardHttpStub(dashboardDetail(3));
      setup.restore(); setup = setupDashboardTest(language, theme, stub);
      stub.respond = async () => dashboardRun(['PARTIAL', 'UNAVAILABLE', 'ERROR']);
      create(); await settle();
      const views = Object.values(page.panelViews());
      expect(views.map((view) => view.status)).toEqual(['PARTIAL', 'UNAVAILABLE', 'ERROR']);
      expect(views[1].sourceKey).toBe('core.team_membership_history');
      expect(page.pageStatus()).toBe('ready');
      expect(runCalls()).toHaveLength(1);
    });

    it('heavy run errors', async () => {
      stub.respond = async () => { throw new ApiError(429, 'CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED', { retryAfterSeconds: ['7'] }); };
      create(); await settle();
      expect(fullState().text()).toBe(setup.transloco.translate('dashPage.retryAfter', { seconds: 7 }));
      vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(20_000); vi.useRealTimers();
      expect(runCalls()).toHaveLength(1);
      stub.respond = async () => { throw new ApiError(408, 'CRM_DASHBOARD_STATEMENT_TIMEOUT'); };
      fullState().action.emit(); await settle();
      expect(fullState().kind()).toBe('load-failure');
      expect(fullState().text()).toContain(setup.transloco.translate('analytics.error.CRM_DASHBOARD_STATEMENT_TIMEOUT'));
      expect(runCalls()).toHaveLength(2);
      stub.respond = async () => dashboardRun();
      fullState().action.emit(); await settle();
      expect(page.pageStatus()).toBe('ready');
      expect(runCalls()).toHaveLength(3);
    });

    it('puts invalid runtime filters below the period field', async () => {
      stub.respond = async () => { throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID'); };
      create(); await settle();
      expect(page.pageStatus()).toBe('ready');
      const filters = fixture!.debugElement.query(By.directive(DashboardFilters)).componentInstance as DashboardFilters;
      expect(filters.error()).toBe(setup.transloco.translate('analytics.error.CRM_DASHBOARD_FILTER_INVALID'));
      expect(fixture!.nativeElement.querySelector('[id$="-period-error"]')?.textContent)
        .toContain(setup.transloco.translate('analytics.error.CRM_DASHBOARD_FILTER_INVALID'));
    });

    it('not found', async () => {
      stub.readFailures.set(`/dashboards/${dashboardId}`, new ApiError(404, 'CRM_DASHBOARD_NOT_FOUND'));
      create(); await settle();
      expect(fullState().kind()).toBe('not-found');
      expect(runCalls()).toHaveLength(0);
    });

    it('places DTO validation on the filter named by its path', async () => {
      const run = dashboardRun();
      run.organizationScope.branches = [dashboardId, widgetId].map((id) => ({
        id, name: id, companyId: dashboardId, companyName: 'Company',
      }));
      stub.respond = async () => run;
      create(); await settle();
      stub.respond = async () => { throw new ApiError(400, 'CRM_VALIDATION_FAILED', { 'filters.branchIds': ['is_uuid'] }); };
      page.onFiltersChange({ ...page.filterValue(), branchIds: [widgetId] }); await settle();
      expect(page.pageStatus()).toBe('ready');
      expect(fixture!.nativeElement.querySelector('[id$="-branches-error"]')?.textContent)
        .toContain(setup.transloco.translate('analytics.error.CRM_VALIDATION_FAILED'));
      expect(fixture!.nativeElement.querySelector('[id$="-period-error"]')).toBeNull();
    });

    it('offers Request access on definition access denial', async () => {
      stub.respond = async () => { throw new ApiError(403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED'); };
      create(); await settle();
      expect(fullState().kind()).toBe('forbidden');
      expect(fullState().actionLabel()).toBe(setup.transloco.translate('dashPage.requestAccess'));
    });

    it('shows read failures with the correlation id', async () => {
      stub.respond = async () => { throw new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE', undefined, { correlationId: 'db1b-read' }); };
      create(); await settle();
      expect(fullState().kind()).toBe('load-failure');
      expect(fullState().text()).toContain('db1b-read');
    });

    it('keeps VIEW shares and locked layouts read-only', async () => {
      const locked = dashboardDetail(); locked.isLayoutLocked = true;
      setup.restore(); stub = new DashboardHttpStub(locked); setup = setupDashboardTest(language, theme, stub);
      setup.permissions.push('crm.dashboards.update');
      create(); await settle();
      expect(page.canEdit()).toBe(false);
    });

    it('keeps separate money series without adding currencies', async () => {
      const run = dashboardRun();
      run.widgets[widgetId].series = ['EGP', 'USD'].map((currency, index) => ({
        key: currency, label: currency, unit: 'MONEY', axis: 'LEFT', currency,
        points: [{ key: 'value', label: currency, value: index ? 10 : 500 }],
      }));
      stub.respond = async () => run;
      create(); await settle();
      expect(page.panelViews()[widgetId].execution?.series).toEqual(run.widgets[widgetId].series);
    });
  });
}
