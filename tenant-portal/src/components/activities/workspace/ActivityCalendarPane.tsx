"use client";

import type { ReactNode } from "react";
import type { Day } from "date-fns";
import { Info } from "lucide-react";
import { CalendarView, DATE_TIME_OPTIONS, iconSize, type CalendarMode } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { ACTIVITY_CALENDAR_CAP, type Activity, type ActivityCalendarWindow } from "../activity-contract";
import { activityCalendarLabel, activityCalendarTone } from "./activity-calendar-item";
import { ActivityCalendarChip } from "./ActivityCalendarChip";
import type { ActivityWorkspaceRead } from "./hooks/useActivityWorkspaceRead";

// Stable accessors: CalendarView derives its entries from them once per list.
const activityKey = (activity: Activity) => activity.id;
const activityStart = (activity: Activity) => new Date(activity.dueAt);
const activityEnd = (activity: Activity) => (activity.endsAt ? new Date(activity.endsAt) : null);
const renderChip = (activity: Activity, layout: "month" | "timed") => <ActivityCalendarChip activity={activity} layout={layout} />;

export interface ActivityCalendarPaneProps {
  data: ActivityWorkspaceRead<ActivityCalendarWindow>;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  anchor: Date;
  onAnchorChange: (anchor: Date) => void;
  weekStartsOn: Day;
  onOpen: (activity: Activity) => void;
  /** Absent without the right to create: the calendar then offers no create target at all. */
  onCreateAt?: (start: Date) => void;
  /** Floated over the grid when the period holds nothing. */
  emptyState: ReactNode;
}

/** Month, week and day over `GET activities/calendar`, for exactly the range the grid draws. */
export function ActivityCalendarPane(props: ActivityCalendarPaneProps) {
  const { data, onCreateAt } = props;
  const { t, lang } = useI18n();
  const copy = t.activities;
  const calendar = copy.workspace.calendar;
  const slotTime = new Intl.DateTimeFormat(INTL_LOCALE[lang], DATE_TIME_OPTIONS.datetime);

  return (
    <CalendarView<Activity>
      mode={props.mode}
      onModeChange={props.onModeChange}
      anchor={props.anchor}
      onAnchorChange={props.onAnchorChange}
      weekStartsOn={props.weekStartsOn}
      items={data.data?.items ?? []}
      itemKey={activityKey}
      itemStart={activityStart}
      itemEnd={activityEnd}
      renderItem={renderChip}
      itemLabel={(activity) => activityCalendarLabel(activity, copy, lang)}
      itemClassName={activityCalendarTone}
      onItemActivate={props.onOpen}
      onSlotActivate={onCreateAt}
      isLoading={data.isLoading}
      error={data.error}
      onRetry={data.reload}
      emptyState={props.emptyState}
      // Core stops at 500 and says so; the notice says so to the reader.
      toolbarEnd={data.data?.truncated ? (
        <span role="status" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Info className={iconSize({ size: "sm" })} aria-hidden="true" />
          {formatTemplate(calendar.truncated, { count: formatNumber(ACTIVITY_CALENDAR_CAP, lang) })}
        </span>
      ) : undefined}
      labels={{
        today: calendar.today,
        previous: calendar.previous,
        next: calendar.next,
        month: calendar.month,
        week: calendar.week,
        day: calendar.day,
        moreItems: (count) => formatTemplate(calendar.moreItems, { count: formatNumber(count, lang) }),
        emptyTitle: copy.workspace.empty.title,
        errorTitle: copy.workspace.loadFailed,
        retry: t.common.retry,
        modeLabel: calendar.mode,
        // Paired with onSlotActivate: no create target is offered without a name for it.
        slotLabel: onCreateAt ? (start) => formatTemplate(calendar.newAt, { time: slotTime.format(start) }) : undefined,
      }}
    />
  );
}
