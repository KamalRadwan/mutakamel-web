"use client";

import { Badge, EmptyState, Skeleton, type BadgeProps } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { LeadPlannedActivity } from "../../lead-activity-contract";

// Urgency, as a hue that never travels alone: the priority word is rendered
// inside the badge, so the four levels are still four levels in a screenshot
// printed in grey. LOW and NORMAL share `neutral` on purpose — "not urgent" is
// not an outcome, and the outcome roles are reserved for ones that are.
const PRIORITY_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  URGENT: "negative",
  HIGH: "caution",
  NORMAL: "neutral",
  LOW: "neutral",
};

export interface LeadActivityListProps {
  activities: LeadPlannedActivity[];
  isLoading: boolean;
  error: string | null;
}

/**
 * The dialog's leading half: what is already booked on this lead.
 *
 * Planned work only — the list is filtered to `status=PLANNED` on the wire, so
 * a completed or cancelled activity never reaches it. Read-only by design:
 * rescheduling, completing and cancelling all need the row's `ETag` and its
 * own confirmations, which is the activities screen's job, not a card
 * dialog's.
 */
export function LeadActivityList({ activities, isLoading, error }: LeadActivityListProps) {
  const { t, lang } = useI18n();
  const copy = t.crmLeads.activities;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`lead-activity-skeleton-${index}`} className="h-14 rounded-sm" />
        ))}
      </div>
    );
  }

  // A failed list is stated where the list would have been, and leaves the
  // form half beside it working: not being able to READ this lead's activities
  // is no reason to stop someone booking one.
  if (error) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {error}
      </p>
    );
  }

  if (activities.length === 0) {
    return <EmptyState title={copy.empty} className="py-8" />;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="flex flex-col gap-1 rounded-sm border border-border bg-card p-2"
        >
          <div className="flex items-start justify-between gap-2">
            {/* Wrapped rather than truncated: a subject is the row's whole
                identity, and recovering it from a hover-only `title` is no
                recovery for a touch or keyboard user. */}
            <span className="min-w-0 break-words text-sm font-medium text-foreground">
              {activity.subject}
            </span>
            <Badge tone={PRIORITY_TONE[activity.priority] ?? "neutral"} className="shrink-0">
              {copy.priorities[activity.priority] ?? activity.priority}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{copy.types[activity.type] ?? activity.type}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={activity.dueAt}>{formatDateTime(activity.dueAt, lang)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
