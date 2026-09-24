// How one activity reads inside the calendar: its tone, its times, and the
// accessible name of the surface it sits on.

import { DATE_TIME_OPTIONS } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { Activity } from "../activity-contract";
import { activityDueState, activityLabel, primaryActivityTarget } from "../activity-presentation";

export function formatActivityTime(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], DATE_TIME_OPTIONS.time).format(new Date(iso));
}

/**
 * Start to end as one phrase, date included — "Sep 24, 2026, 4:30 – 5:30 PM" —
 * or the start alone. `formatRange` keeps the date once for a same-day range
 * and repeats it across midnight, so a range never reads as one morning.
 */
function formatActivityWhen(activity: Pick<Activity, "dueAt" | "endsAt">, lang: Language): string {
  const format = new Intl.DateTimeFormat(INTL_LOCALE[lang], DATE_TIME_OPTIONS.datetime);
  const start = new Date(activity.dueAt);
  return activity.endsAt ? format.formatRange(start, new Date(activity.endsAt)) : format.format(start);
}

/**
 * The surface's tone — semantic tokens only, and never geometry: a block's
 * size is its duration. Colour carries the due or outcome state and never the
 * type (docs/design/tokens.md#activity-due-state--derived-not-an-enum): a
 * coloured leading edge for overdue, due today and completed; cancelled is
 * muted and struck through. The words for each are in the accessible name.
 */
export function activityCalendarTone(activity: Activity): string | undefined {
  if (activity.status === "CANCELLED") return "text-muted-foreground line-through";
  if (activity.status === "DONE") return "border-s-2 border-s-success-vivid text-muted-foreground";
  const dueState = activityDueState(activity);
  if (dueState === "OVERDUE") return "border-s-2 border-s-destructive-vivid";
  if (dueState === "TODAY") return "border-s-2 border-s-warning-vivid";
  return undefined;
}

/**
 * The item's accessible name. The grid says WHEN by position alone, and a
 * position is not a name, so this spells out the time and the state in words.
 */
export function activityCalendarLabel(activity: Activity, copy: Dictionary["activities"], lang: Language): string {
  const dueState = activityDueState(activity);
  return [
    activity.subject,
    activityLabel(copy, "types", activity.type),
    formatActivityWhen(activity, lang),
    activityLabel(copy, "statuses", activity.status),
    dueState === "OVERDUE" || dueState === "TODAY" ? copy.dueStates[dueState] : null,
    primaryActivityTarget(activity)?.label,
  ].filter(Boolean).join(" · ");
}
