"use client";

import { isSameDay } from "date-fns";
import { DateTime, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Activity } from "../activity-contract";
import { activityDueState } from "../activity-presentation";

// The dot is a non-text graphic beside its own words, so it takes the vivid
// step and the words take the text-contrast role. Upcoming says nothing.
const DUE_MARK = {
  OVERDUE: { dot: "bg-destructive-vivid", text: "text-destructive" },
  TODAY: { dot: "bg-warning-vivid", text: "text-warning" },
} as const;

/** When an activity starts (and ends), and how that stands against the clock. */
export function ActivityWhen({ activity, className }: { activity: Activity; className?: string }) {
  const { t } = useI18n();
  const dueState = activityDueState(activity);
  const marked = dueState === "OVERDUE" || dueState === "TODAY" ? dueState : null;
  const endsSameDay = activity.endsAt !== null && isSameDay(new Date(activity.endsAt), new Date(activity.dueAt));

  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      <span className="whitespace-nowrap">
        <DateTime value={activity.dueAt} />
        {activity.endsAt && (
          <>
            {" – "}
            <DateTime value={activity.endsAt} precision={endsSameDay ? "time" : "datetime"} />
          </>
        )}
      </span>
      {marked && (
        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", DUE_MARK[marked].text)}>
          <span className={cn("size-1.5 shrink-0 rounded-full", DUE_MARK[marked].dot)} aria-hidden="true" />
          {t.activities.dueStates[marked]}
        </span>
      )}
    </span>
  );
}
