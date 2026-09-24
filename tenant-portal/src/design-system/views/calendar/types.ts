import type { ReactNode } from "react";
import type { Day } from "date-fns";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CalendarMode } from "./calendar-range";

// Every string the calendar draws, already translated: like the other views,
// it never reads the dictionary. Dates and times are formatted by the view
// itself through Intl, which is formatting rather than copy.
export interface CalendarViewLabels {
  today: string;
  previous: string;
  next: string;
  month: string;
  week: string;
  day: string;
  // The "+N more" under a month day that holds more than it can show. It opens
  // that day, where every item is laid out.
  moreItems: (count: number) => string;
  emptyTitle: string;
  errorTitle: string;
  retry: string;
  // The accessible name of the Month / Week / Day control.
  modeLabel: string;
  // The accessible name of an empty half-hour a user can create in. Paired
  // with `onSlotActivate` — supply both or neither: without a name there is no
  // target to offer, so the calendar offers no create affordance at all.
  slotLabel?: (start: Date) => string;
}

// A time-based view. It shares the workspace rules of the other three — it
// never fetches, never reads the dictionary, never knows which entity it
// renders — but not their contract: a calendar's range IS its paging and its
// order is time, so it takes no page, sort or selection. See
// docs/design/views.md#calendar-view.
export interface CalendarViewProps<T> {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  // Any instant inside the period on show; the range is derived from it with
  // `calendarRange`, which is also what the screen fetches for.
  //
  // Opening a day ("+N more", a date) calls `onAnchorChange` and then
  // `onModeChange` in the same event. A screen that keeps both in the URL must
  // build each write from the current query, not from one read at render, or
  // the second write drops the first.
  anchor: Date;
  onAnchorChange: (anchor: Date) => void;
  weekStartsOn: Day;
  items: T[];
  itemKey: (item: T) => string;
  itemStart: (item: T) => Date;
  // `null` is a point in time. The time grid still draws it half an hour tall,
  // because anything shorter falls under the 24px target floor.
  itemEnd: (item: T) => Date | null;
  // The item's content only. The view owns the surface it sits on — that
  // surface is the focusable, activatable control.
  renderItem: (item: T, layout: "month" | "timed") => ReactNode;
  // The surface's accessible name. The view says WHEN by position, and a
  // position is not a name, so this carries the time and the state in words.
  itemLabel: (item: T) => string;
  // Surface tone — semantic token classes only, never geometry: a block's size
  // is its duration.
  itemClassName?: (item: T) => string | undefined;
  onItemActivate?: (item: T) => void;
  // Omitted, the calendar offers no create affordance.
  onSlotActivate?: (start: Date) => void;
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  // Shown over the grid when the range holds nothing — see CalendarView.
  emptyState?: ReactNode;
  // Rendered at the toolbar's inline end, before the mode control.
  toolbarEnd?: ReactNode;
  labels: CalendarViewLabels;
  className?: string;
}
