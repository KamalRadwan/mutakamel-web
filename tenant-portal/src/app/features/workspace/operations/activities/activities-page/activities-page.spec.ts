import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ActivitiesApi } from '../../../../../shared/widgets/activities/activities.api';
import type { Activity, ActivityScopeFilter } from '../../../../../shared/widgets/activities/activities.model';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceApp } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { ActivitiesPage } from './activities-page';

const emptyPage = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
const summary = { overdue: 0, today: 0, upcoming: 0, completedToday: 0, byStatus: [] };
const primary = { role: 'PRIMARY', targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-1', label: 'Lead' };
const activity = { id: 'act-1', targets: [primary] } as Activity;
const app = (moduleKey: string, group: WorkspaceApp['group'], myAccessState: WorkspaceApp['myAccessState']): WorkspaceApp =>
  ({ moduleKey, group, myAccessState, nameI18n: { en: moduleKey, ar: moduleKey }, iconKey: null, isAddon: false, seats: null });

describe('ActivitiesPage', () => {
  const me = signal({ id: 'user-1', isTenantOwner: false, permissions: ['activities.read', 'activities.create'], permissionScopes: {} });
  const params = new BehaviorSubject(convertToParamMap({}));
  const api = {
    listActivities: vi.fn(), activitySummary: vi.fn(), listActivityCalendar: vi.fn(),
    listActivityTypes: vi.fn(), getActivity: vi.fn(),
  };
  const lookups = { allBranches: vi.fn(), appsOverview: vi.fn() };
  const notify = { error: vi.fn(), warning: vi.fn(), success: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  let fixture: ComponentFixture<ActivitiesPage>;
  let page: ActivitiesPage;
  const open = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    me.set({ id: 'user-1', isTenantOwner: false, permissions: ['activities.read', 'activities.create'], permissionScopes: {} });
    params.next(convertToParamMap({}));
    api.listActivities.mockResolvedValue(emptyPage);
    api.activitySummary.mockResolvedValue(summary);
    api.listActivityCalendar.mockResolvedValue({ items: [], truncated: false });
    api.listActivityTypes.mockResolvedValue([]);
    api.getActivity.mockResolvedValue(activity);
    lookups.allBranches.mockResolvedValue([]);
    lookups.appsOverview.mockResolvedValue([]);
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: TenantScopeState, useValue: { me } },
      { provide: AuthSession, useValue: { status: signal('signed-in'), ensureLoaded: vi.fn().mockResolvedValue('signed-in') } },
      { provide: ActivitiesApi, useValue: api }, { provide: WorkspaceLookups, useValue: lookups },
      { provide: Notify, useValue: notify }, { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
    ] });
    // Isolate controller behavior from the CRM callers and child modal renderers.
    TestBed.overrideComponent(ActivitiesPage, { set: { template: '', imports: [] } });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key) => {
      const text: Record<string, string> = {
        'activities.errors.ACTIVITY_NOT_FOUND': 'No longer available to you',
        'wsActivities.errors.ACTIVITY_INVALID': 'Check the activity details and try again',
        'apiErrors.rateLimitedIn': 'Too many requests, try again in 9 s',
      };
      return text[String(key)] ?? String(key);
    });
    fixture = TestBed.createComponent(ActivitiesPage);
    page = fixture.componentInstance;
    Object.defineProperty(page, 'recordActivities', { value: () => ({ open }) });
  });

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function load() {
    await page['loadData']({ meId: me().id, view: page['view'](), filters: page['filters'](),
      page: 1, pageSize: 20, calendarMonth: new Date(2026, 10, 1) });
  }

  it('record type filter is sent to the server', async () => {
    await render();
    page['filters'].update((value) => ({ ...value, recordType: 'CRM:LEAD' }));
    for (const view of ['list', 'board', 'calendar'] as const) {
      page['view'].set(view);
      await load();
    }
    expect(api.listActivities).toHaveBeenCalledWith(expect.objectContaining({ targetApp: 'CRM', targetType: 'LEAD' }));
    expect(api.activitySummary).toHaveBeenCalledWith(expect.objectContaining({ targetApp: 'CRM', targetType: 'LEAD' }), expect.any(String), expect.any(String));
    expect(api.listActivityCalendar).toHaveBeenCalledWith(expect.objectContaining({ targetApp: 'CRM', targetType: 'LEAD' }));
    const serverRow = { ...activity, targets: [] };
    page['rawListItems'].set([serverRow]);
    expect(page['listItems']()).toEqual([serverRow]);
  });

  it('a 403 shows the forbidden state', async () => {
    await render();
    api.listActivities.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await load();
    expect(page['forbiddenError']()).toBe(true);
    expect(page['loadError']()).toBe(false);
  });

  it('ACTIVITY_INVALID on a read shows a toast', async () => {
    await render();
    api.listActivities.mockRejectedValue(new ApiError(422, 'ACTIVITY_INVALID'));
    await load();
    expect(notify.error).toHaveBeenCalledWith('Check the activity details and try again');
    expect(page['forbiddenError']()).toBe(false);
  });

  it('a 503 shows load failure with Retry', async () => {
    await render();
    for (const code of ['ACCESS_POLICY_UNAVAILABLE', 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE']) {
      api.listActivities.mockRejectedValue(new ApiError(503, code, undefined, { correlationId: 'reference' }));
      await load();
      expect(page['loadError']()).toBe(true);
      expect(page['errorCorrelationId']()).toBe('reference');
    }
    api.listActivities.mockResolvedValue(emptyPage);
    page['reload']();
    await render();
    expect(page['loadError']()).toBe(false);
  });

  it('lost connection shows load failure', async () => {
    await render();
    api.listActivities.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await load();
    expect(page['loadError']()).toBe(true);
    page['rawBoardLanes'].update((lanes) => lanes.map((lane) => ({ ...lane, hasNext: true })));
    await page['loadMoreLane']('PLANNED');
    expect(notify.error).toHaveBeenCalled();
    expect(page['rawBoardLanes']()[0].loadingMore).toBe(false);
  });

  it('first-use and filtered empty states', async () => {
    await render();
    expect(page['isFirstUseEmpty']()).toBe(true);
    page['filters'].update((value) => ({ ...value, search: 'missing' }));
    expect(page['isFirstUseEmpty']()).toBe(false);
    expect(page['isFilteredEmpty']()).toBe(true);
  });

  it('calendar never sends due dates', async () => {
    await render();
    page['view'].set('calendar');
    page['filters'].update((value) => ({ ...value, dueRange: { from: '2026-11-01', to: '2026-11-30', preset: null } }));
    await load();
    const query = api.listActivityCalendar.mock.lastCall?.[0] as ActivityScopeFilter;
    expect(query.dueFrom).toBeUndefined();
    expect(query.dueTo).toBeUndefined();
    expect(query).toMatchObject({ from: expect.any(String), to: expect.any(String) });
  });

  it('calendar truncated shows the toast once', async () => {
    await render();
    page['view'].set('calendar');
    api.listActivityCalendar.mockResolvedValue({ items: [], truncated: true });
    await load();
    await load();
    expect(notify.warning).toHaveBeenCalledTimes(1);
  });

  it('an activity without a primary target shows a toast', async () => {
    page['openActivityWindow']({ ...activity, targets: [{ ...primary, role: 'CONTEXT' }] } as Activity);
    expect(notify.error).toHaveBeenCalledWith('activities.errors.generic');
    expect(open).not.toHaveBeenCalled();
  });

  it('activityId in the URL opens the window and is removed', async () => {
    params.next(convertToParamMap({ activityId: 'act-1', page: '2' }));
    await render();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-1' }), { screen: 'edit', activityId: 'act-1' });
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { activityId: null }, queryParamsHandling: 'merge', replaceUrl: true,
    }));
  });

  it('unknown activityId says no longer available', async () => {
    api.getActivity.mockRejectedValue(new ApiError(404, 'ACTIVITY_NOT_FOUND'));
    params.next(convertToParamMap({ activityId: 'missing' }));
    await render();
    expect(notify.error).toHaveBeenCalledWith('No longer available to you');
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { activityId: null } }));
  });

  it('app list comes from the apps overview', async () => {
    lookups.appsOverview.mockResolvedValue([app('crm', 'SUBSCRIBED', 'ACTIVE'), app('trade', 'AVAILABLE', null)]);
    await render();
    await page['loadLookups']();
    expect(page['availableApps']()).toEqual(['CRM', 'CORE']);
  });

  it('owner gets every subscribed app', async () => {
    me.update((value) => ({ ...value, isTenantOwner: true }));
    lookups.appsOverview.mockResolvedValue([app('crm', 'SUBSCRIBED', null)]);
    await render();
    await page['loadLookups']();
    expect(page['availableApps']()).toEqual(['CRM', 'CORE']);
  });

  it('overview failure offers CORE only', async () => {
    lookups.appsOverview.mockRejectedValue(new ApiError(503, 'UNAVAILABLE'));
    await render();
    await page['loadLookups']();
    expect(page['availableApps']()).toEqual(['CORE']);
  });

  it('a 429 shows the rate-limit message', async () => {
    await render();
    api.listActivities.mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['9'] }));
    await load();
    expect(notify.error).toHaveBeenCalledWith('Too many requests, try again in 9 s');
  });

  it('maintenance is a toast and never a forbidden state', async () => {
    await render();
    api.listActivities.mockRejectedValue(new ApiError(403, 'TENANT_MAINTENANCE_ACTIVE'));
    await load();
    expect(page['forbiddenError']()).toBe(false);
    expect(notify.error).toHaveBeenCalled();
  });
});
