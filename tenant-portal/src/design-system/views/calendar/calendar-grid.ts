import { addDays, addMonths, addWeeks, isSameDay } from "date-fns";
import type { CalendarFormat } from "./calendar-format";
import { calendarDayStart, type CalendarMode, type CalendarRange } from "./calendar-range";
import type { CalendarViewProps } from "./types";

// One item with its accessors already applied, so the grids never call the
// caller's functions per day and never disagree about an item's times.
export interface CalendarEntry<T> {
  item: T;
  key: string;
  start: Date;
  end: Date | null;
}

// The create affordance exists only as a pair: the handler, and the name its
// targets are announced by.
export interface SlotCreation {
  activate: (start: Date) => void;
  label: (start: Date) => string;
}

// What both grids take from CalendarView: the caller's props plus what the
// view derived from them once.
export interface CalendarGridProps<T> {
  view: CalendarViewProps<T>;
  days: readonly Date[];
  entries: readonly CalendarEntry<T>[];
  // Null until the client has a clock — see useNow.
  now: Date | null;
  format: CalendarFormat;
  titleId: string;
  create: SlotCreation | undefined;
  onOpenDay: (day: Date) => void;
}

export function rangeDays(range: CalendarRange): Date[] {
  const days: Date[] = [];
  for (let offset = 0; ; offset += 1) {
    const day = calendarDayStart(range.start, offset);
    if (day >= range.end) return days;
    days.push(day);
  }
}

export function shiftAnchor(mode: CalendarMode, anchor: Date, step: 1 | -1): Date {
  if (mode === "month") return addMonths(anchor, step);
  return mode === "week" ? addWeeks(anchor, step) : addDays(anchor, step);
}

// Stable across renders and unique within a range; used for React keys and
// for the focus stops, so a stop survives a data reload but not a move to
// another period.
export function dayKey(day: Date): string {
  return `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
}

// The local constructor, not `startOfDay + minutes`: on a daylight-saving day
// elapsed minutes and wall-clock minutes differ by an hour, and a slot is a
// wall-clock time.
export function atMinute(day: Date, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
}

export function isToday(day: Date, now: Date | null): boolean {
  return now !== null && isSameDay(day, now);
}
