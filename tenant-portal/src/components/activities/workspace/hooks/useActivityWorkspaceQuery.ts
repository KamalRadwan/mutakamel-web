"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { CalendarMode } from "@/design-system";
import type { ActivityScope } from "../../activity-contract";
import { toLocalDate } from "../../activity-form";
import {
  ACTIVITY_QUERY,
  DEFAULT_CALENDAR_MODE,
  filtersClearedUpdates,
  readActivityCalendarState,
  readActivityWorkspaceFilters,
  relatedClearedUpdates,
  writeActivityWorkspaceQuery,
  type ActivityQueryUpdates,
} from "../activity-workspace-url";

// The writes read nothing from a render: each builds on the address bar as it
// is when the event fires (activity-workspace-url.ts says why), so they are
// plain functions and keep one identity for the page's lifetime.
const writers = {
  setSearch: (search: string) =>
    writeActivityWorkspaceQuery({ [ACTIVITY_QUERY.search]: search || null, [ACTIVITY_QUERY.page]: null }),
  /** A new result set, so the table goes back to its first page. */
  applyFilters: (updates: ActivityQueryUpdates) =>
    writeActivityWorkspaceQuery({ ...updates, [ACTIVITY_QUERY.page]: null }),
  clearFilters: () => writeActivityWorkspaceQuery(filtersClearedUpdates()),
  clearRelated: () => writeActivityWorkspaceQuery(relatedClearedUpdates()),
  setCalendarMode: (mode: CalendarMode) =>
    writeActivityWorkspaceQuery({ [ACTIVITY_QUERY.calendarMode]: mode === DEFAULT_CALENDAR_MODE ? null : mode }),
  // Today is the default anchor, so paging back to it leaves a link that keeps
  // meaning "today" tomorrow.
  setCalendarAnchor: (anchor: Date) => {
    const day = toLocalDate(anchor);
    writeActivityWorkspaceQuery({ [ACTIVITY_QUERY.calendarDate]: day === toLocalDate(new Date()) ? null : day });
  },
};

/** The workspace's filters and calendar position, read from the URL, and the writes that change them. */
export function useActivityWorkspaceQuery(scope: ActivityScope) {
  const params = useSearchParams();
  const filters = useMemo(() => readActivityWorkspaceFilters(params, scope), [params, scope]);
  const calendar = useMemo(() => readActivityCalendarState(params), [params]);
  return { filters, calendar, ...writers };
}
