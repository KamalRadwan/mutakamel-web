import type { CorePath } from "@/lib/api/envelope";
import {
  invalidCoreResponse,
  nullableText,
  record,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";

// Activities are **cross-app**: an activity targets a CRM, Core or Trade
// record and the service authorises against that target as well as against the
// activity, so a user who may read activities can still be refused a specific
// one. Source: core-app/src/tenant/activities/activities.controller.ts,
// dto/activity.dto.ts, packages/common/src/enums/activity.enum.ts.

export const ACTIVITIES_PATH = "/api/tenant/core/v1/activities";
const ACTIVITY_ASSIGNEES_PATH = "/api/tenant/core/v1/activities/assignees";
export const ACTIVITY_TYPES_PATH = "/api/tenant/core/v1/activity-types";

export const ACTIVITY_READ_PERMISSION = "activities.read";
export const ACTIVITY_CREATE_PERMISSION = "activities.create";
export const ACTIVITY_UPDATE_PERMISSION = "activities.update";
export const ACTIVITY_COMPLETE_PERMISSION = "activities.complete";
export const ACTIVITY_CANCEL_PERMISSION = "activities.cancel";
export const ACTIVITY_ASSIGN_PERMISSION = "activities.assign";

export const ACTIVITY_TYPE_KEYS = [
  "TODO",
  "CALL",
  "MEETING",
  "EMAIL",
  "VISIT",
  "FOLLOW_UP",
  "OTHER",
] as const;
export const ACTIVITY_STATUSES = ["PLANNED", "DONE", "CANCELLED"] as const;
export const ACTIVITY_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const ACTIVITY_DIRECTIONS = ["INBOUND", "OUTBOUND", "INTERNAL"] as const;
export const ACTIVITY_TARGET_APPS = ["CRM", "CORE", "TRADE"] as const;

/** `ACTIVITY_TARGET_TYPES` — the resolver rejects anything outside this map. */
export const ACTIVITY_TARGET_TYPES: Record<ActivityTargetApp, readonly string[]> = {
  CRM: ["LEAD", "CUSTOMER_PROFILE", "OPPORTUNITY"],
  CORE: ["PARTY"],
  TRADE: ["QUOTATION", "SALES_ORDER"],
};

export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];
export type ActivityDirection = (typeof ACTIVITY_DIRECTIONS)[number];
export type ActivityTargetApp = (typeof ACTIVITY_TARGET_APPS)[number];

export const ACTIVITY_SUBJECT_MAX = 180;
export const ACTIVITY_DESCRIPTION_MAX = 4000;
const ACTIVITY_OUTCOME_MAX = 2000;
const ACTIVITY_TARGET_TYPE_MAX = 40;

// `activity.errors.ts` raises ACTIVITY_NOT_FOUND, ACTIVITY_ACCESS_DENIED,
// ACTIVITY_INVALID, ACTIVITY_TARGET_RESOLVER_UNAVAILABLE and — uniquely —
// ACTIVITY_VERSION_REQUIRED at **428**, not 412. All five are translated in
// `t.coreOperations.errors`; none is branched on in code.

interface ActivityTarget {
  id: string;
  role: string;
  targetApp: string;
  targetType: string;
  targetId: string;
  label: string;
}

export interface Activity {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  direction: string | null;
  priority: string;
  status: string;
  dueAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  outcome: string | null;
  assigneeUserId: string;
  branchId: string;
  /** Optimistic-concurrency counter; the `If-Match` value is `"<version>"`. */
  version: number;
  updatedAt: string;
  targets: ActivityTarget[];
}

export interface ActivityPage {
  items: Activity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ActivityTypeOption {
  key: string;
  label: string;
  defaultPriority: string;
}

export interface ActivityAssignee {
  id: string;
  name: string;
}

export interface ActivityFilters {
  status?: ActivityStatus;
  assigneeUserId?: string;
  branchId?: string;
  targetApp?: ActivityTargetApp;
  targetType?: string;
  targetId?: string;
}

export const ACTIVITY_PAGE_SIZE = 25;

export function activitiesListPath(
  page: number,
  search: string,
  sortDir: "ASC" | "DESC",
  filters: ActivityFilters,
): CorePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(ACTIVITY_PAGE_SIZE),
    // `ActivityListQueryDto` overrides `sortBy` to `@IsIn(['dueAt'])` — any
    // other value is a 422, so it is never taken from a column header.
    sortBy: "dueAt",
    sortDir,
  });
  if (search) query.set("search", search.slice(0, 200));
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  return `${ACTIVITIES_PATH}?${query.toString()}`;
}

export function activityPath(id: string): CorePath {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) invalidCoreResponse();
  return `/api/tenant/core/v1/activities/${encodeURIComponent(id)}`;
}

export function activityCompletePath(id: string): CorePath {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) invalidCoreResponse();
  return `/api/tenant/core/v1/activities/${encodeURIComponent(id)}/complete`;
}

export function activityCancelPath(id: string): CorePath {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) invalidCoreResponse();
  return `/api/tenant/core/v1/activities/${encodeURIComponent(id)}/cancel`;
}

/** `targetApp`, `targetType` and `targetId` are all required — this is not a user picker. */
export function activityAssigneesPath(
  targetApp: string,
  targetType: string,
  targetId: string,
  search: string,
): CorePath {
  const query = new URLSearchParams({ targetApp, targetType, targetId });
  if (search) query.set("search", search.slice(0, 100));
  return `${ACTIVITY_ASSIGNEES_PATH}?${query.toString()}`;
}

function parseTarget(payload: unknown): ActivityTarget {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "id"),
    role: requiredText(row, "role", 32),
    targetApp: requiredText(row, "targetApp", 16),
    targetType: requiredText(row, "targetType", ACTIVITY_TARGET_TYPE_MAX),
    targetId: requiredUuidV7(row, "targetId"),
    label: requiredText(row, "label", 400),
  };
}

export function parseActivity(payload: unknown): Activity {
  const row = record(payload);
  if (!row || !Array.isArray(row.targets)) invalidCoreResponse();
  const version = row.version;
  if (!Number.isSafeInteger(version) || (version as number) < 1) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "id"),
    // Unknown enum values stay recoverable: a new activity type must not take
    // the whole list down, so these are strings with a labelled fallback.
    type: requiredText(row, "type", 32),
    subject: requiredText(row, "subject", ACTIVITY_SUBJECT_MAX),
    description: nullableText(row, "description", ACTIVITY_DESCRIPTION_MAX),
    direction: nullableText(row, "direction", 16),
    priority: requiredText(row, "priority", 16),
    status: requiredText(row, "status", 16),
    dueAt: requiredTimestamp(row, "dueAt"),
    completedAt: nullableTimestamp(row, "completedAt"),
    cancelledAt: nullableTimestamp(row, "cancelledAt"),
    outcome: nullableText(row, "outcome", ACTIVITY_OUTCOME_MAX),
    assigneeUserId: requiredUuidV7(row, "assigneeUserId"),
    branchId: requiredUuidV7(row, "branchId"),
    version: version as number,
    updatedAt: requiredTimestamp(row, "updatedAt"),
    targets: row.targets.map(parseTarget),
  };
}

function nullableTimestamp(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  return requiredTimestamp(source, key);
}

function safeCount(source: Record<string, unknown>, key: string, minimum: number): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum) invalidCoreResponse();
  return value as number;
}

/**
 * `ActivitiesService.list` returns `hasNext` but **no** `hasPrev`, so the
 * envelope interceptor does not recognise it as a paginated result and emits no
 * `meta`. Both flags are re-derived here so the pager cannot disagree with the
 * page it is rendering.
 */
export function parseActivityPage(payload: unknown): ActivityPage {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidCoreResponse();
  const items = body.items.map(parseActivity);
  const page = safeCount(body, "page", 1);
  const limit = safeCount(body, "limit", 1);
  const total = safeCount(body, "total", 0);
  const totalPages = safeCount(body, "totalPages", 0);
  if (items.length > limit || items.length > total) invalidCoreResponse();
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages && total > page * limit,
    hasPrev: page > 1,
  };
}

export function parseActivityTypes(payload: unknown): ActivityTypeOption[] {
  if (!Array.isArray(payload)) invalidCoreResponse();
  return payload.map((entry) => {
    const row = record(entry);
    if (!row) invalidCoreResponse();
    return {
      key: requiredText(row, "key", 32),
      label: requiredText(row, "label", 80),
      defaultPriority: requiredText(row, "defaultPriority", 16),
    };
  });
}

export function parseActivityAssignees(payload: unknown): ActivityAssignee[] {
  if (!Array.isArray(payload)) invalidCoreResponse();
  return payload.map((entry) => {
    const row = record(entry);
    if (!row) invalidCoreResponse();
    return {
      id: requiredUuidV7(row, "id"),
      // `concat_ws` can produce an empty string when a user has no names.
      name: nullableText(row, "name", 240) ?? requiredUuidV7(row, "id"),
    };
  });
}
