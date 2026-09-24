// What each read of the workspace asks Core for, derived from the one filter
// state in the URL. The views differ only in what they add to it: the calendar
// its window, the board a status per lane, the table a page and a direction.

import { calendarDayStart, type CalendarRange } from "@/design-system";
import {
  ACTIVITY_PAGE_SIZE,
  type ActivityCalendarQuery,
  type ActivityFilters,
  type ActivityListQuery,
  type ActivityScope,
  type ActivityStatus,
  type ActivitySummaryQuery,
} from "../activity-contract";
import { fromLocalDate } from "../activity-form";
import { isOpenActivityStatus } from "../activity-presentation";
import type { ActivityWorkspaceFilters } from "./activity-workspace-url";

export interface ActivityReadContext {
  scope: ActivityScope;
  /** null = every branch the viewer can see. */
  branchId: string | null;
  /** The viewer, for "Assigned to me". */
  actorId: string | null;
}

/**
 * The filters every read shares, in the wire's vocabulary.
 *
 * The due range applies only where the view offers it: the calendar's own
 * navigation owns its range there, so a range set in the table does not
 * silently narrow the calendar's days.
 */
export function activityReadFilters(
  filters: ActivityWorkspaceFilters,
  context: ActivityReadContext,
  withDueRange: boolean,
): ActivityFilters {
  const { related } = filters;
  const from = withDueRange && filters.dueFrom ? fromLocalDate(filters.dueFrom) : undefined;
  const to = withDueRange && filters.dueTo ? fromLocalDate(filters.dueTo) : undefined;
  return {
    search: filters.search,
    branchId: context.branchId,
    assigneeUserId: filters.mine && context.actorId ? context.actorId : undefined,
    // The CRM workspace lists activities on CRM records and nothing else.
    targetApp: related?.app ?? (context.scope === "CRM" ? "CRM" : undefined),
    targetType: related?.type,
    targetId: related?.id ?? undefined,
    statuses: filters.statuses,
    types: filters.types,
    priorities: filters.priorities,
    dueFrom: from?.toISOString(),
    // Whole days: `dueTo` is exclusive, so the range ends where the day after
    // its last one begins.
    dueTo: to ? calendarDayStart(to, 1).toISOString() : undefined,
    overdue: filters.overdue || undefined,
  };
}

/**
 * `GET activities/summary` for the viewer's local day (`yyyy-MM-dd`), which
 * Core cannot know. It counts every status, so the status and overdue filters
 * are left off — the board's lanes read the counts they narrow themselves.
 */
export function activitySummaryQuery(filters: ActivityFilters, day: string): ActivitySummaryQuery | null {
  const start = fromLocalDate(day);
  if (!start) return null;
  const { statuses, overdue, ...shared } = filters;
  return { ...shared, dayStart: start.toISOString(), dayEnd: calendarDayStart(start, 1).toISOString() };
}

export function activityCalendarQuery(filters: ActivityFilters, range: CalendarRange): ActivityCalendarQuery {
  return { ...filters, from: range.start.toISOString(), to: range.end.toISOString() };
}

export function activityTableQuery(filters: ActivityFilters, page: number, sortDir: "ASC" | "DESC"): ActivityListQuery {
  return { ...filters, page, limit: ACTIVITY_PAGE_SIZE, sortDir };
}

/** Open lanes list what is due soonest first; finished lanes what was due most recently. */
export function activityLaneSortDir(status: ActivityStatus): "ASC" | "DESC" {
  return isOpenActivityStatus(status) ? "ASC" : "DESC";
}

export function activityLaneQuery(filters: ActivityFilters, status: ActivityStatus, page: number): ActivityListQuery {
  return { ...filters, statuses: [status], page, limit: ACTIVITY_PAGE_SIZE, sortDir: activityLaneSortDir(status) };
}
