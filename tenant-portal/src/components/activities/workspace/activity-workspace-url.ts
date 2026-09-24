// The Activities workspace's state in the address bar, so a filtered calendar
// or board survives a refresh and can be shared as a link —
// docs/design/views.md#activities--the-time-based-workspace.
//
// `view`, `page`, `sort` and `dir` belong to `useWorkspaceState`. Every other
// key here belongs to this workspace, and a write touches only the keys it
// names — `page` included, which a new result set sends back to the first page.

import { replaceSearchParams, type CalendarMode } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { isUUIDv7 } from "@/lib/uuid";
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  ACTIVITY_TARGET_APPS,
  ACTIVITY_TARGET_TYPES,
  ACTIVITY_TYPES,
  type ActivityPriority,
  type ActivityScope,
  type ActivityStatus,
  type ActivityTargetApp,
  type ActivityTargetSelection,
  type ActivityType,
} from "../activity-contract";
import { fromLocalDate } from "../activity-form";

export const ACTIVITY_QUERY = {
  search: "q",
  types: "types",
  statuses: "statuses",
  priorities: "priorities",
  mine: "mine",
  overdue: "overdue",
  dueFrom: "from",
  dueTo: "to",
  targetApp: "targetApp",
  targetType: "targetType",
  targetId: "targetId",
  calendarMode: "cal",
  calendarDate: "date",
  page: "page",
} as const;

type ActivityQueryKey = (typeof ACTIVITY_QUERY)[keyof typeof ACTIVITY_QUERY];

/** null removes the key. */
export type ActivityQueryUpdates = Partial<Record<ActivityQueryKey, string | null>>;

/** The records a list is narrowed to: every record of one type, or one record. */
export interface ActivityRelatedFilter {
  app: ActivityTargetApp;
  type: string;
  /** null = every record of the type. */
  id: string | null;
}

export interface ActivityWorkspaceFilters {
  search: string;
  types: ActivityType[];
  statuses: ActivityStatus[];
  priorities: ActivityPriority[];
  mine: boolean;
  overdue: boolean;
  /** Whole local days, inclusive, as `yyyy-MM-dd`. */
  dueFrom: string | null;
  dueTo: string | null;
  related: ActivityRelatedFilter | null;
}

export interface ActivityCalendarQueryState {
  mode: CalendarMode;
  /** The anchor day as `yyyy-MM-dd`; null is today. */
  date: string | null;
}

const CALENDAR_MODES: readonly CalendarMode[] = ["month", "week", "day"];
export const DEFAULT_CALENDAR_MODE: CalendarMode = "month";

type QueryReader = Pick<URLSearchParams, "get">;

// Enum order, each value once, anything unknown dropped: a stale or hand-edited
// link narrows by what it names correctly and ignores the rest.
function readList<T extends string>(params: QueryReader, key: ActivityQueryKey, allowed: readonly T[]): T[] {
  const requested = new Set((params.get(key) ?? "").split(","));
  return allowed.filter((value) => requested.has(value));
}

function readDay(params: QueryReader, key: ActivityQueryKey): string | null {
  const value = params.get(key);
  return value && fromLocalDate(value) ? value : null;
}

// A reversed range is a hand-edited link that Core would answer with a 422, so
// it is not applied at all rather than half-applied.
function readDueRange(params: QueryReader): Pick<ActivityWorkspaceFilters, "dueFrom" | "dueTo"> {
  const dueFrom = readDay(params, ACTIVITY_QUERY.dueFrom);
  const dueTo = readDay(params, ACTIVITY_QUERY.dueTo);
  return dueFrom && dueTo && dueFrom > dueTo ? { dueFrom: null, dueTo: null } : { dueFrom, dueTo };
}

// A record screen's deep link. The type must be one the page's scope offers —
// the CRM workspace lists CRM records only — and an id that is not a record id
// narrows to the type alone rather than failing the page.
function readRelated(params: QueryReader, scope: ActivityScope): ActivityRelatedFilter | null {
  const app = ACTIVITY_TARGET_APPS.find((candidate) => candidate === params.get(ACTIVITY_QUERY.targetApp));
  const type = params.get(ACTIVITY_QUERY.targetType);
  if (!app || !type || (scope === "CRM" && app !== "CRM")) return null;
  if (!(ACTIVITY_TARGET_TYPES[app] as readonly string[]).includes(type)) return null;
  const id = params.get(ACTIVITY_QUERY.targetId);
  return { app, type, id: isUUIDv7(id) ? id : null };
}

export function readActivityWorkspaceFilters(params: QueryReader, scope: ActivityScope): ActivityWorkspaceFilters {
  return {
    search: params.get(ACTIVITY_QUERY.search) ?? "",
    types: readList(params, ACTIVITY_QUERY.types, ACTIVITY_TYPES),
    statuses: readList(params, ACTIVITY_QUERY.statuses, ACTIVITY_STATUSES),
    priorities: readList(params, ACTIVITY_QUERY.priorities, ACTIVITY_PRIORITIES),
    mine: params.get(ACTIVITY_QUERY.mine) === "true",
    overdue: params.get(ACTIVITY_QUERY.overdue) === "true",
    ...readDueRange(params),
    related: readRelated(params, scope),
  };
}

export function readActivityCalendarState(params: QueryReader): ActivityCalendarQueryState {
  return {
    mode: CALENDAR_MODES.find((mode) => mode === params.get(ACTIVITY_QUERY.calendarMode)) ?? DEFAULT_CALENDAR_MODE,
    date: readDay(params, ACTIVITY_QUERY.calendarDate),
  };
}

/** Whether anything narrows the list — what separates "nothing matches" from "nothing yet". */
export function hasActivityFilters(filters: ActivityWorkspaceFilters, withDueRange: boolean): boolean {
  return filters.search.trim() !== ""
    || filters.types.length > 0
    || filters.statuses.length > 0
    || filters.priorities.length > 0
    || filters.mine
    || filters.overdue
    || (withDueRange && (filters.dueFrom !== null || filters.dueTo !== null))
    || filters.related !== null;
}

/** Removing the related-record chip drops all three keys, whichever of them were set. */
export function relatedClearedUpdates(): ActivityQueryUpdates {
  return {
    [ACTIVITY_QUERY.targetApp]: null,
    [ACTIVITY_QUERY.targetType]: null,
    [ACTIVITY_QUERY.targetId]: null,
    [ACTIVITY_QUERY.page]: null,
  };
}

/** Every filter off, the search box included; the view, its calendar position and the sort stay. */
export function filtersClearedUpdates(): ActivityQueryUpdates {
  return {
    ...relatedClearedUpdates(),
    [ACTIVITY_QUERY.search]: null,
    [ACTIVITY_QUERY.types]: null,
    [ACTIVITY_QUERY.statuses]: null,
    [ACTIVITY_QUERY.priorities]: null,
    [ACTIVITY_QUERY.mine]: null,
    [ACTIVITY_QUERY.overdue]: null,
    [ACTIVITY_QUERY.dueFrom]: null,
    [ACTIVITY_QUERY.dueTo]: null,
  };
}

/**
 * Writes the workspace's keys into the address bar; a blank value removes one.
 *
 * Through the same live-query writer as the view, the page and the sort
 * (`replaceSearchParams`), so two writes in one event — the calendar's "+N
 * more" calls `onAnchorChange` and then `onModeChange` — each build on the
 * other instead of the second dropping the first.
 */
export function writeActivityWorkspaceQuery(updates: ActivityQueryUpdates): void {
  const writes: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) writes[key] = value || null;
  }
  replaceSearchParams(writes);
}

/** The workspace narrowed to every record of one type — the link a record list screen offers. */
export function activitiesWorkspaceTypeHref(
  scope: ActivityScope,
  target: Pick<ActivityTargetSelection, "app" | "type">,
): string {
  const base = scope === "CRM" ? TENANT_ROUTES.crmActivities : TENANT_ROUTES.coreActivities;
  const query = new URLSearchParams({
    [ACTIVITY_QUERY.targetApp]: target.app,
    [ACTIVITY_QUERY.targetType]: target.type,
  });
  return `${base}?${query.toString()}`;
}
