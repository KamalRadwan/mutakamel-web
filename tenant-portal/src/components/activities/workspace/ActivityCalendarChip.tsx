"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { Activity } from "../activity-contract";
import { primaryActivityTarget } from "../activity-presentation";
import { ActivityTypeIcon } from "../ActivityTypeIcon";
import { formatActivityTime } from "./activity-calendar-item";

export interface ActivityCalendarChipProps {
  activity: Activity;
  layout: "month" | "timed";
}

/**
 * The content of one calendar item: type glyph, time, subject and related
 * record. A picture only — CalendarView owns the surface and names it with
 * `activityCalendarLabel`, which says all of this, the state included, in words.
 */
export function ActivityCalendarChip({ activity, layout }: ActivityCalendarChipProps) {
  const { lang } = useI18n();
  const record = primaryActivityTarget(activity)?.label;
  // "In progress" is ink plus motion, never a hue — docs/design/tokens.md.
  const pending = activity.status === "IN_PROGRESS" && (
    <span className="dot-pending size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
  );

  if (layout === "month") {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {pending}
        <ActivityTypeIcon type={activity.type} size="xs" className="text-muted-foreground" />
        <span className="shrink-0 tabular-nums text-muted-foreground">{formatActivityTime(activity.dueAt, lang)}</span>
        <span className="min-w-0 truncate">
          <bdi>{activity.subject}</bdi>
          {record && <span className="text-muted-foreground"> · <bdi>{record}</bdi></span>}
        </span>
      </span>
    );
  }

  // The subject shares the first line with the start time: a 30-minute block is
  // one line tall, and a block that showed only its time would say nothing
  // about what it is. Its height already draws the duration.
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1">
        {pending}
        <ActivityTypeIcon type={activity.type} size="xs" className="text-muted-foreground" />
        <span className="shrink-0 tabular-nums text-muted-foreground">{formatActivityTime(activity.dueAt, lang)}</span>
        <bdi className="min-w-0 truncate font-medium">{activity.subject}</bdi>
      </span>
      {record && <bdi className="truncate text-muted-foreground">{record}</bdi>}
    </span>
  );
}
