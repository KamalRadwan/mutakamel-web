import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery } from '../../../core/api/core-http';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { fakeList, fakeSummary } from './activities.fake';
import type {
  Activity, ActivityAssigneesParams, ActivityCalendarParams, ActivityCalendarResponse,
  ActivityListParams, ActivityPage, ActivitySummary, ActivitySummaryScope, ActivityTargetOption,
  ActivityTargetsParams, ActivityTypeDefinition, Assignee, CreateActivity, UpdateActivity,
} from './activities.model';

export { ACTIVITY_TARGET_TYPES } from './activities.model';
export type {
  ActivityAssigneesParams, ActivityCalendarParams, ActivityCalendarResponse, ActivityListParams,
  ActivityScopeFilter, ActivityStatusSummary, ActivitySummaryScope, ActivityTargetOption,
  ActivityTargetSelector, ActivityTargetsParams, ActivityTypeDefinition,
} from './activities.model';

// FAKE-ONLY for CRM callers until their call sites move to ActivitiesApi (controller item; files outside OPS-ACT).
export function listActivities(params: ActivityListParams = {}): Promise<ActivityPage> {
  return fakeList(params);
}

// FAKE-ONLY for CRM callers until their call sites move to ActivitiesApi (controller item; files outside OPS-ACT).
export function activitySummary(scope: ActivitySummaryScope = {}, dayStart?: string, dayEnd?: string): Promise<ActivitySummary> {
  return fakeSummary(scope, dayStart, dayEnd);
}

const CORE_PATH = '/api/tenant/core/v1';
const ACTIVITIES_QUERY_KEY = 'activities';

@Service()
export class ActivitiesApi {
  private readonly http = inject(CoreHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  listActivities(params: ActivityListParams = {}): Promise<ActivityPage> {
    return this.read('list', { ...params }, () => this.http.readPage<Activity>(`${CORE_PATH}/activities`, { ...params }));
  }

  activitySummary(scope: ActivitySummaryScope = {}, dayStart?: string, dayEnd?: string): Promise<ActivitySummary> {
    const query: CoreQuery = {
      branchId: scope.branchId, assigneeUserId: scope.assigneeUserId,
      targetApp: scope.targetApp ?? scope.app, targetType: scope.targetType ?? scope.type,
      targetId: scope.targetId ?? scope.id, types: scope.types, priorities: scope.priorities,
      search: scope.search, dueFrom: scope.dueFrom, dueTo: scope.dueTo, dayStart, dayEnd,
    };
    return this.readData('summary', `${CORE_PATH}/activities/summary`, query);
  }

  listActivityCalendar(params: ActivityCalendarParams): Promise<ActivityCalendarResponse> {
    const { dueFrom: _dueFrom, dueTo: _dueTo, ...query } = params;
    return this.readData('calendar', `${CORE_PATH}/activities/calendar`, query);
  }

  listActivityTargets(params: ActivityTargetsParams): Promise<ActivityTargetOption[]> {
    return this.readData('targets', `${CORE_PATH}/activities/targets`, { ...params });
  }

  listActivityTypes(): Promise<ActivityTypeDefinition[]> {
    return this.readData('types', `${CORE_PATH}/activity-types`);
  }

  getActivity(id: string): Promise<Activity> {
    return this.read('get', { id }, async () =>
      (await this.http.readWithEtag<Activity>(`${CORE_PATH}/activities/${encodeURIComponent(id)}`)).data);
  }

  listAssignees(params: ActivityAssigneesParams): Promise<Assignee[]> {
    return this.readData('assignees', `${CORE_PATH}/activities/assignees`, { ...params });
  }

  createActivity(body: CreateActivity, key = newIdempotencyKey()): Promise<Activity> {
    return this.write('POST', '/activities', body, key);
  }

  updateActivity(id: string, version: number, body: UpdateActivity, key = newIdempotencyKey()): Promise<Activity> {
    return this.write('PATCH', `/activities/${encodeURIComponent(id)}`, body, key, version);
  }

  setActivityStatus(id: string, version: number, status: 'PLANNED' | 'IN_PROGRESS', key = newIdempotencyKey()): Promise<Activity> {
    return this.write('POST', `/activities/${encodeURIComponent(id)}/status`, { status }, key, version);
  }

  completeActivity(id: string, version: number, outcome?: string | null, key = newIdempotencyKey()): Promise<Activity> {
    return this.write('POST', `/activities/${encodeURIComponent(id)}/complete`, { outcome }, key, version);
  }

  cancelActivity(id: string, version: number, reason?: string | null, key = newIdempotencyKey()): Promise<Activity> {
    return this.write('POST', `/activities/${encodeURIComponent(id)}/cancel`, { reason }, key, version);
  }

  private readData<T>(method: string, path: string, query: CoreQuery = {}): Promise<T> {
    return this.read(method, query, () => this.http.read<T>(path, query));
  }

  private read<T>(method: string, query: CoreQuery, queryFn: () => Promise<T>): Promise<T> {
    const me = this.scope.me();
    // TenantScopeState has no revision counter; include its permission and organization projection.
    const revision = [me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes,
      me?.accessibleCompanies, me?.accessibleBranches, this.scope.selection()];
    return this.queries.fetchQuery({ queryKey: [ACTIVITIES_QUERY_KEY, revision, method, query], queryFn });
  }

  private async write(method: 'POST' | 'PATCH', path: string, body: unknown, key: string, version?: number): Promise<Activity> {
    const result = await this.http.write<Activity>(method, `${CORE_PATH}${path}`, body, {
      key, ...(version === undefined ? {} : { ifMatch: `"${version}"` }),
    });
    await this.queries.cancelQueries({ queryKey: [ACTIVITIES_QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY], refetchType: 'none' });
    return result.data;
  }
}
