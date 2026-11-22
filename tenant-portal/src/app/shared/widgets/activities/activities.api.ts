// Base: /api/tenant/core/v1/activities. Backend: core-app/src/tenant/activities (activities.controller.ts).
// Writes: `x-idempotency-key` (UUIDv7, required by Core: 422 ACTIVITY_IDEMPOTENCY_KEY_INVALID; the gateway route
// itself is idempotencyMode NONE) and `If-Match: <version>` on every write except create (428 ACTIVITY_VERSION_REQUIRED).
// Responses: Core envelope `{ success, data, correlationId, timestamp }`; the api returns `data`, and for the
// paged list `{ data: items, meta: { page, limit, total, totalPages, hasNext, hasPrev } }` (CorePage). Errors: `ActivityError.status` / `.code` / `.details`.
import { newIdempotencyKey } from '../../../core/api/idempotency';
import {
  fakeActivityTypes,
  fakeAssignees,
  fakeCalendar,
  fakeCancel,
  fakeComplete,
  fakeCount,
  fakeCreate,
  fakeGet,
  fakeList,
  fakeSetStatus,
  fakeSummary,
  fakeTargets,
  fakeUpdate,
} from './activities.fake';
import {
  Activity,
  ActivityAssigneesParams,
  ActivityCalendarParams,
  ActivityCalendarResponse,
  ActivityListParams,
  ActivityPage,
  ActivitySummary,
  ActivitySummaryScope,
  ActivityTargetOption,
  ActivityTargetSelector,
  ActivityTargetsParams,
  ActivityTypeDefinition,
  Assignee,
  CreateActivity,
  UpdateActivity,
} from './activities.model';

export { ACTIVITY_TARGET_TYPES } from './activities.model';
export type {
  ActivityAssigneesParams,
  ActivityCalendarParams,
  ActivityCalendarResponse,
  ActivityListParams,
  ActivityScopeFilter,
  ActivityStatusSummary,
  ActivitySummaryScope,
  ActivityTargetOption,
  ActivityTargetSelector,
  ActivityTargetsParams,
  ActivityTypeDefinition,
} from './activities.model';

/** GET /api/tenant/core/v1/activities -> CorePage<Activity> { data, meta } (Core envelope of ActivityPageDto) */
export function listActivities(params: ActivityListParams = {}): Promise<ActivityPage> {
  return fakeList(params);
}

/** GET /api/tenant/core/v1/activities/summary — dayStart and dayEnd are required in the real API (span <= 48h). */
export function activitySummary(
  scope: ActivitySummaryScope = {},
  dayStart?: string,
  dayEnd?: string,
): Promise<ActivitySummary> {
  return fakeSummary(scope, dayStart, dayEnd);
}

/** GET /api/tenant/core/v1/activities/calendar */
export function listActivityCalendar(params: ActivityCalendarParams): Promise<ActivityCalendarResponse> {
  return fakeCalendar(params);
}

/** GET /api/tenant/core/v1/activities/targets */
export function listActivityTargets(params: ActivityTargetsParams): Promise<ActivityTargetOption[]> {
  return fakeTargets(params);
}

/** GET /api/tenant/core/v1/activity-types */
export function listActivityTypes(): Promise<ActivityTypeDefinition[]> {
  return fakeActivityTypes();
}

/** @deprecated No backend route: use listActivities({ ...target, limit: 1 }).total. */
export function countActivities(target: ActivityTargetSelector): Promise<number> {
  return fakeCount(target);
}

/** GET /api/tenant/core/v1/activities/:id */
export function getActivity(id: string): Promise<Activity> {
  return fakeGet(id);
}

/** GET /api/tenant/core/v1/activities/assignees?targetApp&targetType&targetId&search (all but search required; permission activities.assign) */
export function listAssignees(target: ActivityAssigneesParams): Promise<Assignee[]> {
  return fakeAssignees(target);
}

/** POST /api/tenant/core/v1/activities (header: x-idempotency-key UUIDv7) */
export function createActivity(body: CreateActivity, idempotencyKey = newIdempotencyKey()): Promise<Activity> {
  return fakeCreate(body, idempotencyKey);
}

/** PATCH /api/tenant/core/v1/activities/:id (headers: If-Match, x-idempotency-key UUIDv7) */
export function updateActivity(
  id: string,
  version: number,
  changes: UpdateActivity,
  idempotencyKey = newIdempotencyKey(),
): Promise<Activity> {
  return fakeUpdate(id, version, changes, idempotencyKey);
}

/** POST /api/tenant/core/v1/activities/:id/status (headers: If-Match, x-idempotency-key UUIDv7) */
export function setActivityStatus(
  id: string,
  version: number,
  status: 'PLANNED' | 'IN_PROGRESS',
  idempotencyKey = newIdempotencyKey(),
): Promise<Activity> {
  return fakeSetStatus(id, version, status, idempotencyKey);
}

/** POST /api/tenant/core/v1/activities/:id/complete body { outcome? } (headers: If-Match, x-idempotency-key UUIDv7) */
export function completeActivity(
  id: string,
  version: number,
  outcome?: string | null,
  idempotencyKey = newIdempotencyKey(),
): Promise<Activity> {
  return fakeComplete(id, version, outcome, idempotencyKey);
}

/** POST /api/tenant/core/v1/activities/:id/cancel body { reason? } (headers: If-Match, x-idempotency-key UUIDv7) */
export function cancelActivity(
  id: string,
  version: number,
  reason?: string | null,
  idempotencyKey = newIdempotencyKey(),
): Promise<Activity> {
  return fakeCancel(id, version, reason, idempotencyKey);
}
