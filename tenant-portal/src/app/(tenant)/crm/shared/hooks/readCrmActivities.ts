import { readCorePage } from "@/lib/api/envelope";
import {
  CRM_ACTIVITIES_PATH,
  CRM_ACTIVITY_RESPONSE_LIMIT_BYTES,
  crmPlannedActivitiesQuery,
  parseCrmPlannedActivitiesPage,
  type CrmPlannedActivity,
  type CrmTargetType,
} from "../crm-activity-contract";

export async function readAllCrmActivities(
  targetId: string,
  targetType: CrmTargetType,
  signal: AbortSignal,
): Promise<CrmPlannedActivity[]> {
  const activities: CrmPlannedActivity[] = [];
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const { data } = await readCorePage(
      CRM_ACTIVITIES_PATH,
      crmPlannedActivitiesQuery(targetId, targetType, page),
      {
        signal,
        cache: "no-store",
        maxResponseBytes: CRM_ACTIVITY_RESPONSE_LIMIT_BYTES,
      },
    );
    signal.throwIfAborted();
    const result = parseCrmPlannedActivitiesPage(data, page);
    for (const activity of result.items) {
      if (ids.has(activity.id)) throw new Error("Activity pagination changed during read.");
      ids.add(activity.id);
      activities.push(activity);
    }
    if (!result.hasNext) return activities;
  }
}
