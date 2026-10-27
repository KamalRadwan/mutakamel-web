export type CrmActivityState = "OVERDUE" | "TODAY" | "FUTURE" | "NONE";

export interface CrmNextActivitySummary {
  activityAt?: string | null;
  bucket?: string | null;
}

export function crmActivityState(
  nextActivity: CrmNextActivitySummary | null | undefined,
  now = new Date(),
): CrmActivityState {
  if (!nextActivity) return "NONE";
  if (nextActivity.activityAt) {
    const due = new Date(nextActivity.activityAt).getTime();
    if (!Number.isNaN(due)) {
      const startOfToday = new Date(now.getTime());
      startOfToday.setHours(0, 0, 0, 0);
      if (due < startOfToday.getTime()) return "OVERDUE";
      return due <= now.getTime() ? "TODAY" : "FUTURE";
    }
  }
  if (nextActivity.bucket === "OVERDUE" || nextActivity.bucket === "TODAY" || nextActivity.bucket === "FUTURE") {
    return nextActivity.bucket;
  }
  return "NONE";
}
