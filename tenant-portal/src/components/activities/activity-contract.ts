// The activity hub on the wire — one contract for every surface that shows,
// books or changes an activity, whichever application owns its record.
//
// Activities belong to Core (core-app/src/tenant/activities): a call booked on
// a CRM lead is still a Core activity whose PRIMARY target is that lead. The
// CRM app's own activity routes are a log of finished work, not this hub.
//
// Sources: core-app/src/tenant/activities/activities.controller.ts,
// dto/activity.dto.ts, packages/common/src/enums/activity.enum.ts, and the
// Gateway routes in api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts.

import type { CorePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";

export const ACTIVITIES_PATH = "/api/tenant/core/v1/activities" satisfies CorePath;

/** `ACTIVITY_TYPES` in @mutakamel/core-app-common — `@IsIn` rejects anything else. */
export const ACTIVITY_TYPES = ["TODO", "CALL", "MEETING", "EMAIL", "VISIT", "FOLLOW_UP", "OTHER"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** `ActivityStatusEnum`. PLANNED and IN_PROGRESS are open; DONE and CANCELLED never change again. */
export const ACTIVITY_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export const OPEN_ACTIVITY_STATUSES = ["PLANNED", "IN_PROGRESS"] as const;

/** `CreateActivityDto.status` — DONE files an activity that already happened. */
export type ActivityCreateStatus = "PLANNED" | "IN_PROGRESS" | "DONE";

export const ACTIVITY_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];

export const ACTIVITY_DIRECTIONS = ["INBOUND", "OUTBOUND", "INTERNAL"] as const;

export const ACTIVITY_TARGET_APPS = ["CRM", "CORE", "TRADE"] as const;
export type ActivityTargetApp = (typeof ACTIVITY_TARGET_APPS)[number];

/** `ACTIVITY_TARGET_TYPES` — the resolver answers 422 for a type outside its app's list. */
export const ACTIVITY_TARGET_TYPES = {
  CRM: ["LEAD", "CUSTOMER_PROFILE", "OPPORTUNITY"],
  CORE: ["PARTY"],
  TRADE: ["QUOTATION", "SALES_ORDER"],
} as const satisfies Record<ActivityTargetApp, readonly string[]>;

/** Which records a surface offers: the CRM workspace stays inside CRM, Core's sees every app. */
export type ActivityScope = "CRM" | "ALL";

// `CreateActivityDto` / `UpdateActivityDto` / `CompleteActivityDto` column bounds,
// in characters: see `activityTextLength`.
export const ACTIVITY_SUBJECT_MAX = 180;
export const ACTIVITY_DESCRIPTION_MAX = 4000;
export const ACTIVITY_OUTCOME_MAX = 2000;
export const ACTIVITY_LOCATION_MAX = 180;
export const ACTIVITY_MEETING_URL_MAX = 2048;

/**
 * A text's length as Core bounds it. `@MaxLength` and PostgreSQL's `varchar(n)`
 * both count characters, where `String.length` counts UTF-16 units and so
 * counts an emoji twice: a subject Core stored at its limit would otherwise
 * fail to parse, or fail the form when only its time is edited.
 */
export function activityTextLength(value: string): number {
  return Array.from(value).length;
}
/** `ck_activities_window`: an end, when present, is at most 14 days after the start. */
export const ACTIVITY_MAX_DURATION_DAYS = 14;
/** A completed activity may be filed starting up to 5 minutes ahead of Core's clock (activity.rules.ts). */
export const ACTIVITY_DONE_START_GRACE_MS = 5 * 60_000;
export const ACTIVITY_PAGE_SIZE = 25;
/** `GET activities/calendar` returns at most this many rows and flags the rest as truncated. */
export const ACTIVITY_CALENDAR_CAP = 500;
// The summary accepts one viewer-local day (≤ 48 h) and the calendar a window
// of at most 62 days; anything wider is a 422, so it is refused before it is sent.
const ACTIVITY_CALENDAR_SPAN_MS = 62 * 24 * 60 * 60_000;
const ACTIVITY_SUMMARY_SPAN_MS = 48 * 60 * 60_000;
/** `PaginationQueryDto.search` is `@MaxLength(200)`; the record and assignee pickers' is 100. */
const ACTIVITY_LIST_SEARCH_MAX = 200;
const ACTIVITY_TARGET_SEARCH_MAX = 100;
/** `PAGINATION_DEFAULTS.MAX_LIMIT`. */
const ACTIVITY_MAX_PAGE_LIMIT = 100;

// Response byte bounds. One activity is at most ~16 KB of text (description,
// outcome, meeting link, targets), a page is 25 of them, a calendar window 500.
export const ACTIVITY_ROW_RESPONSE_BYTES = 64 * 1024;
export const ACTIVITY_LIST_RESPONSE_BYTES = 640 * 1024;
export const ACTIVITY_CALENDAR_RESPONSE_BYTES = 2_000_000;
export const ACTIVITY_PICKER_RESPONSE_BYTES = 128 * 1024;

/** One record an activity is booked against, as a picker or a record screen hands it over. */
export interface ActivityTargetSelection { app: ActivityTargetApp; type: string; id: string; label: string }

/**
 * A target as the activity view carries it. `route` and `targetVersion` are
 * on the wire and deliberately not read: the portal never follows a path it
 * did not build (activity-presentation.ts owns the route map).
 */
export interface ActivityTarget {
  id: string;
  /** `PRIMARY` or `CONTEXT`; a string so a new role cannot take the view down. */
  role: string;
  targetApp: string;
  targetType: string;
  targetId: string;
  label: string;
  /** Set once the owning application reports the record gone. */
  unavailableAt: string | null;
}

/**
 * Every activity response. Enum-valued fields stay `string`: a value this build
 * has never seen renders a labelled fallback instead of failing the screen.
 */
export interface Activity {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  direction: string | null;
  priority: string;
  status: string;
  dueAt: string;
  reminderOffsetMinutes: number | null;
  reminderSentAt: string | null;
  endsAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  /** The completion note, or the cancellation reason — Core stores both here. */
  outcome: string | null;
  assigneeUserId: string;
  assigneeName: string | null;
  createdByUserId: string;
  createdByName: string | null;
  branchId: string;
  companyId: string;
  /** Optimistic lock, sent back as `If-Match: "<version>"` by every row write. */
  version: number;
  createdAt: string;
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

export interface ActivityStatusSummary { status: string; total: number; overdue: number; today: number; upcoming: number }

/** Always all four statuses, in enum order; the top-level counts are sums over the open ones. */
export interface ActivitySummary {
  overdue: number;
  today: number;
  upcoming: number;
  completedToday: number;
  byStatus: ActivityStatusSummary[];
}

export interface ActivityCalendarWindow { items: Activity[]; truncated: boolean }

export interface ActivityTargetOption { targetApp: string; targetType: string; targetId: string; label: string; branchId: string }

export interface ActivityAssignee { id: string; name: string }

/** The list filters shared by `GET activities`, `/summary` and `/calendar`. */
export interface ActivityFilters {
  search?: string;
  branchId?: string | null;
  assigneeUserId?: string;
  targetApp?: ActivityTargetApp;
  targetType?: string;
  targetId?: string;
  statuses?: readonly ActivityStatus[];
  types?: readonly ActivityType[];
  priorities?: readonly ActivityPriority[];
  /** ISO instants; `dueFrom` must be before `dueTo`. */
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
}

export interface ActivityListQuery extends ActivityFilters {
  page: number;
  limit?: number;
  sortDir: "ASC" | "DESC";
}

export type ActivitySummaryQuery = Omit<ActivityFilters, "statuses" | "overdue"> & {
  /** The viewer's local day, as ISO instants. */
  dayStart: string;
  dayEnd: string;
};

export type ActivityCalendarQuery = Omit<ActivityFilters, "dueFrom" | "dueTo"> & {
  from: string;
  to: string;
};

function invalidRequest(): never {
  throw new Error("Invalid activities request.");
}

function uuidOrThrow(value: string): string {
  if (!isUUIDv7(value)) invalidRequest();
  return value;
}

function instantOrThrow(value: string): number {
  const time = Date.parse(value);
  if (Number.isNaN(time)) invalidRequest();
  return time;
}

export function activityPath(id: string): CorePath {
  return `${ACTIVITIES_PATH}/${uuidOrThrow(id)}`;
}

export function activityStatusPath(id: string): CorePath {
  return `${activityPath(id)}/status`;
}

export function activityCompletePath(id: string): CorePath {
  return `${activityPath(id)}/complete`;
}

export function activityCancelPath(id: string): CorePath {
  return `${activityPath(id)}/cancel`;
}

/** Multi-value filters travel comma-joined — the `@Transform` split of `audit-query.dto.ts`. */
function appendFilters(query: URLSearchParams, filters: ActivityFilters): void {
  // `targetFilterFrom` (activity.rules.ts) answers 422 for a type or id without
  // its app, and for an id without its type.
  if ((filters.targetType || filters.targetId) && !filters.targetApp) invalidRequest();
  if (filters.targetId && !filters.targetType) invalidRequest();
  const search = filters.search?.trim();
  if (search) query.set("search", search.slice(0, ACTIVITY_LIST_SEARCH_MAX));
  if (filters.branchId) query.set("branchId", uuidOrThrow(filters.branchId));
  if (filters.assigneeUserId) query.set("assigneeUserId", uuidOrThrow(filters.assigneeUserId));
  if (filters.targetApp) query.set("targetApp", filters.targetApp);
  if (filters.targetType) query.set("targetType", filters.targetType);
  if (filters.targetId) query.set("targetId", uuidOrThrow(filters.targetId));
  if (filters.statuses?.length) query.set("statuses", filters.statuses.join(","));
  if (filters.types?.length) query.set("types", filters.types.join(","));
  if (filters.priorities?.length) query.set("priorities", filters.priorities.join(","));
  if (filters.dueFrom && filters.dueTo && instantOrThrow(filters.dueFrom) >= instantOrThrow(filters.dueTo)) {
    invalidRequest();
  }
  if (filters.dueFrom) query.set("dueFrom", filters.dueFrom);
  if (filters.dueTo) query.set("dueTo", filters.dueTo);
  if (filters.overdue !== undefined) query.set("overdue", String(filters.overdue));
}

export function activityListPath({ page, limit = ACTIVITY_PAGE_SIZE, sortDir, ...filters }: ActivityListQuery): CorePath {
  if (!Number.isSafeInteger(page) || page < 1) invalidRequest();
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > ACTIVITY_MAX_PAGE_LIMIT) invalidRequest();
  // `ActivityListQueryDto` narrows `sortBy` to `@IsIn(['dueAt'])`, so the
  // column is a constant rather than a caller's choice.
  const query = new URLSearchParams({ page: String(page), limit: String(limit), sortBy: "dueAt", sortDir });
  appendFilters(query, filters);
  return `${ACTIVITIES_PATH}?${query.toString()}`;
}

export function activitySummaryPath({ dayStart, dayEnd, ...filters }: ActivitySummaryQuery): CorePath {
  const span = instantOrThrow(dayEnd) - instantOrThrow(dayStart);
  if (span <= 0 || span > ACTIVITY_SUMMARY_SPAN_MS) invalidRequest();
  const query = new URLSearchParams({ dayStart, dayEnd });
  appendFilters(query, filters);
  return `${ACTIVITIES_PATH}/summary?${query.toString()}`;
}

export function activityCalendarPath({ from, to, ...filters }: ActivityCalendarQuery): CorePath {
  const span = instantOrThrow(to) - instantOrThrow(from);
  if (span <= 0 || span > ACTIVITY_CALENDAR_SPAN_MS) invalidRequest();
  const query = new URLSearchParams({ from, to });
  appendFilters(query, filters);
  return `${ACTIVITIES_PATH}/calendar?${query.toString()}`;
}

/** The record picker: only records the actor could book an activity on right now. */
export function activityTargetsPath(options: {
  app: ActivityTargetApp;
  type: string;
  branchId?: string | null;
  search: string;
}): CorePath {
  if (!(ACTIVITY_TARGET_TYPES[options.app] as readonly string[]).includes(options.type)) invalidRequest();
  const query = new URLSearchParams({ targetApp: options.app, targetType: options.type });
  if (options.branchId) query.set("branchId", uuidOrThrow(options.branchId));
  const search = options.search.trim();
  if (search) query.set("search", search.slice(0, ACTIVITY_TARGET_SEARCH_MAX));
  return `${ACTIVITIES_PATH}/targets?${query.toString()}`;
}

/** Eligible assignees are a property of the TARGET's company and branch, so all three keys are required. */
export function activityAssigneesPath(target: Pick<ActivityTargetSelection, "app" | "type" | "id">, search: string): CorePath {
  const query = new URLSearchParams({ targetApp: target.app, targetType: target.type, targetId: uuidOrThrow(target.id) });
  const term = search.trim();
  if (term) query.set("search", term.slice(0, ACTIVITY_TARGET_SEARCH_MAX));
  return `${ACTIVITIES_PATH}/assignees?${query.toString()}`;
}
