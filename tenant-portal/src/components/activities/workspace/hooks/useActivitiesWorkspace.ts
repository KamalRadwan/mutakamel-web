"use client";

import { useEffect, useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  calendarRange,
  calendarWeekStart,
  useRealtimeResync,
  useToast,
  useWorkspaceState,
  type SortState,
} from "@/design-system";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { ACTIVITY_STATUSES, type ActivityScope } from "../../activity-contract";
import { fromLocalDate, toLocalDate } from "../../activity-form";
import {
  activityCalendarQuery,
  activityReadFilters,
  activitySummaryQuery,
  activityTableQuery,
} from "../activity-workspace-queries";
import { hasActivityFilters } from "../activity-workspace-url";
import { useActivityBoardLanes } from "./useActivityBoardLanes";
import { useActivityCalendarWindow, useActivitySummary, useActivityTablePage } from "./useActivityReads";
import { useActivityWorkspaceQuery } from "./useActivityWorkspaceQuery";
import { useActivityWorkspaceWrites } from "./useActivityWorkspaceWrites";

export const ACTIVITY_VIEWS = ["calendar", "board", "table"] as const;
// The table's one sortable column. A constant, so the workspace state's
// memoised sort does not change identity on every render.
const DUE_SORT: SortState = { id: "dueAt", direction: "asc" };

// One Date per anchor day, so the calendar does not lay its grid out again on
// every render of the workspace. No day in the URL is today.
function useCalendarAnchor(day: string | null, today: string): Date {
  const key = day ?? today;
  return useMemo(() => fromLocalDate(key) ?? new Date(), [key]);
}

/**
 * The Activities workspace's state: the view and its filters (all in the URL),
 * the KPI counts, the read behind whichever view is on screen, and the writes.
 * Only the view on screen reads; switching view reads the new one fresh.
 */
export function useActivitiesWorkspace(scope: ActivityScope) {
  const { user } = useTenantAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const workspace = useWorkspaceState(`activities-${scope}`, {
    views: ACTIVITY_VIEWS,
    defaultView: "calendar",
    defaultSort: DUE_SORT,
  });
  const { view } = workspace;
  // Optional here, unlike the CRM record screens: no branch is every branch
  // the viewer can see, and it is where the workspace opens — a record's
  // "view all" link must find that record whichever branch it sits in. A
  // chosen branch narrows the lists and the record picker.
  const branch = useTenantBranchSelection(user, { optional: true });
  const query = useActivityWorkspaceQuery(scope);
  // The calendar's navigation owns its range, so the due-date filter is neither offered nor applied there.
  const withDueRange = view !== "calendar";
  const filters = activityReadFilters(
    query.filters,
    { scope, branchId: branch.branchId, actorId: user?.id ?? null },
    withDueRange,
  );

  const today = toLocalDate(new Date());
  const summary = useActivitySummary(activitySummaryQuery(filters, today));

  const weekStartsOn = useMemo(() => calendarWeekStart(lang), [lang]);
  const anchor = useCalendarAnchor(query.calendar.date, today);
  const calendar = useActivityCalendarWindow(
    view === "calendar" ? activityCalendarQuery(filters, calendarRange(query.calendar.mode, anchor, weekStartsOn)) : null,
  );

  // The status filter narrows the board's lanes as well as its cards.
  const statuses = query.filters.statuses.length > 0 ? query.filters.statuses : ACTIVITY_STATUSES;
  const board = useActivityBoardLanes(view === "board" ? { filters, statuses } : null, (error) => {
    // A 403 has already been toasted by the transport.
    if (error.status !== 403) toast.error(t.activities.workspace.loadFailed);
  });

  const sortDir = workspace.sort?.id === DUE_SORT.id && workspace.sort.direction === "desc" ? "DESC" : "ASC";
  const table = useActivityTablePage(view === "table" ? activityTableQuery(filters, workspace.page, sortDir) : null);

  const onScreen = view === "calendar" ? calendar : view === "board" ? board : table;
  function refresh() {
    summary.reload();
    onScreen.reload();
  }
  // Nothing pushes activity changes to the browser; a reconnect or a return
  // from offline is the only signal that what is on screen may be stale.
  useRealtimeResync(refresh);

  const writes = useActivityWorkspaceWrites({
    refresh,
    refreshSummary: summary.reload,
    board: view === "board" ? { statuses, items: board.items, place: board.place } : null,
  });

  // A page past the end — its last rows completed or filtered away — goes to
  // the last page there is rather than claiming nothing matches.
  const lastPage = table.data && table.data.page > table.data.totalPages ? table.data.totalPages : null;
  const { setPage } = workspace;
  useEffect(() => {
    if (lastPage !== null) setPage(lastPage);
  }, [lastPage, setPage]);

  return {
    view,
    setView: workspace.setView,
    tableSort: { id: DUE_SORT.id, direction: sortDir === "DESC" ? "desc" : "asc" } satisfies SortState,
    setTableSort: workspace.setSort,
    setTablePage: setPage,
    branch,
    query,
    withDueRange,
    filtered: hasActivityFilters(query.filters, withDueRange),
    summary,
    calendar: { data: calendar, anchor, weekStartsOn },
    board,
    statuses,
    table,
    /** Core refused the view's read: the whole workspace is access-denied, not empty. */
    denied: onScreen.denied,
    writes,
    /** After any write the template modal makes. */
    refresh,
  };
}
