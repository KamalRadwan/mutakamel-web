import { readCorePage } from "@/lib/api/envelope";
import {
  LEAD_ACTIVITIES_PATH, LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES,
  leadPlannedActivitiesQuery, parseLeadPlannedActivitiesPage, type LeadPlannedActivity,
} from "../lead-activity-contract";

/** No partial success: if any page fails, the caller shows a retryable error. */
export async function readAllLeadActivities(leadId: string, signal: AbortSignal) {
  const activities: LeadPlannedActivity[] = [];
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const { data } = await readCorePage(LEAD_ACTIVITIES_PATH, leadPlannedActivitiesQuery(leadId, page), {
      signal, cache: "no-store", maxResponseBytes: LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES,
    });
    signal.throwIfAborted();
    const result = parseLeadPlannedActivitiesPage(data, page);
    for (const activity of result.items) {
      if (ids.has(activity.id)) throw new Error("Activity pagination changed during read.");
      ids.add(activity.id);
      activities.push(activity);
    }
    if (!result.hasNext) return activities;
  }
}
