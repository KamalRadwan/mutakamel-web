import type { BoardColumnSegment } from "@/design-system";

export type CrmActivityState = "OVERDUE" | "TODAY" | "FUTURE" | "NONE";

export const CRM_ACTIVITY_STATES = ["OVERDUE", "TODAY", "FUTURE", "NONE"] as const;

export const CRM_ACTIVITY_TONE: Record<CrmActivityState, BoardColumnSegment["tone"]> = {
  OVERDUE: "negative",
  TODAY: "caution",
  FUTURE: "positive",
  NONE: "neutral",
};

export const CRM_ACTIVITY_MARK: Record<CrmActivityState, string> = {
  OVERDUE: "text-destructive-vivid",
  TODAY: "text-warning-vivid",
  FUTURE: "text-success-vivid",
  NONE: "text-muted-foreground/70",
};

export interface CrmNextActivitySummary {
  activityAt?: string | null;
  bucket?: string | null;
}

export function crmActivityState(
  nextActivity: CrmNextActivitySummary | null | undefined,
): CrmActivityState {
  if (!nextActivity) return "NONE";
  if (nextActivity.bucket === "OVERDUE" || nextActivity.bucket === "TODAY" || nextActivity.bucket === "FUTURE") {
    return nextActivity.bucket;
  }
  if (!nextActivity.activityAt) return "NONE";
  const due = new Date(nextActivity.activityAt).getTime();
  const now = Date.now();
  if (due < now) return "OVERDUE";
  const startOfTomorrow = new Date();
  startOfTomorrow.setHours(24, 0, 0, 0);
  if (due < startOfTomorrow.getTime()) return "TODAY";
  return "FUTURE";
}

/**
 * Derives column activity segments from loaded card items on screen.
 */
export function crmActivitySegments(
  records: readonly { nextActivity?: CrmNextActivitySummary | null; activityState?: string | null }[],
  labels: Record<CrmActivityState, string>,
): BoardColumnSegment[] {
  const counts: Record<CrmActivityState, number> = {
    OVERDUE: 0,
    TODAY: 0,
    FUTURE: 0,
    NONE: 0,
  };

  for (const record of records) {
    const state = record.activityState && record.activityState in counts
      ? (record.activityState as CrmActivityState)
      : crmActivityState(record.nextActivity);
    counts[state] += 1;
  }

  return CRM_ACTIVITY_STATES.map((state) => ({
    id: state,
    label: labels[state],
    value: counts[state],
    tone: CRM_ACTIVITY_TONE[state],
  }));
}

/**
 * Builds column activity segments directly from Opportunity Board lane activity summary.
 */
export function opportunityActivitySegments(
  summary: {
    totalCount: number;
    noOpenCount: number;
    overdueCount: number;
    todayCount: number;
    futureCount: number;
  },
  labels: Record<CrmActivityState, string>,
): BoardColumnSegment[] {
  return [
    { id: "OVERDUE", label: labels.OVERDUE, value: summary.overdueCount, tone: "negative" },
    { id: "TODAY", label: labels.TODAY, value: summary.todayCount, tone: "caution" },
    { id: "FUTURE", label: labels.FUTURE, value: summary.futureCount, tone: "positive" },
    { id: "NONE", label: labels.NONE, value: summary.noOpenCount, tone: "neutral" },
  ];
}
