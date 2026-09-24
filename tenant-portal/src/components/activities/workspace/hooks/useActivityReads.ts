"use client";

import { readCoreData } from "@/lib/api/envelope";
import {
  ACTIVITY_CALENDAR_RESPONSE_BYTES,
  ACTIVITY_LIST_RESPONSE_BYTES,
  ACTIVITY_ROW_RESPONSE_BYTES,
  activityCalendarPath,
  activityListPath,
  activitySummaryPath,
  type ActivityCalendarQuery,
  type ActivityCalendarWindow,
  type ActivityListQuery,
  type ActivityPage,
  type ActivitySummary,
  type ActivitySummaryQuery,
} from "../../activity-contract";
import { parseActivityCalendarWindow, parseActivityPage, parseActivitySummary } from "../../activity-parsers";
import { useActivityWorkspaceRead, type ActivityWorkspaceRead } from "./useActivityWorkspaceRead";

// Every path is built inside the async reader, so a query this client refuses
// to send (activity-contract.ts throws on one) fails the read like any other
// failure — an ErrorState with a retry — instead of throwing out of render.

/** The KPI strip's counts for the viewer's local day. */
export function useActivitySummary(query: ActivitySummaryQuery | null): ActivityWorkspaceRead<ActivitySummary> {
  return useActivityWorkspaceRead(query && {
    key: JSON.stringify(query),
    read: async (signal) => parseActivitySummary(await readCoreData(activitySummaryPath(query), {
      signal,
      cache: "no-store",
      maxResponseBytes: ACTIVITY_ROW_RESPONSE_BYTES,
    })),
  });
}

/** Every activity overlapping the calendar's range, up to Core's cap of 500. */
export function useActivityCalendarWindow(query: ActivityCalendarQuery | null): ActivityWorkspaceRead<ActivityCalendarWindow> {
  return useActivityWorkspaceRead(query && {
    key: JSON.stringify(query),
    read: async (signal) => parseActivityCalendarWindow(await readCoreData(activityCalendarPath(query), {
      signal,
      cache: "no-store",
      maxResponseBytes: ACTIVITY_CALENDAR_RESPONSE_BYTES,
    })),
  });
}

/** One page of the table. */
export function useActivityTablePage(query: ActivityListQuery | null): ActivityWorkspaceRead<ActivityPage> {
  return useActivityWorkspaceRead(query && {
    key: JSON.stringify(query),
    read: async (signal) => parseActivityPage(await readCoreData(activityListPath(query), {
      signal,
      cache: "no-store",
      maxResponseBytes: ACTIVITY_LIST_RESPONSE_BYTES,
    })),
  });
}
