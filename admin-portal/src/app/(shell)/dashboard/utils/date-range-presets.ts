/**
 * The named windows the dashboard offers, and the arithmetic behind each.
 *
 * Kept free of React so the boundaries can be unit-tested against a fixed
 * "now" — a quarter that silently starts on the wrong month is the kind of
 * defect nobody notices until a report is already in a meeting.
 */

export type DateRangePresetKey =
  | "today"
  | "yesterday"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "maximum"
  | "custom";

export interface DateRange {
  /** Inclusive start, local midnight unless a time was chosen. */
  from: Date;
  /** Inclusive end. The request converts this to an exclusive bound. */
  to: Date;
}

export const DATE_RANGE_PRESET_KEYS: readonly DateRangePresetKey[] = [
  "today",
  "yesterday",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "lastYear",
  "q1",
  "q2",
  "q3",
  "q4",
  "maximum",
];

const QUARTER_START_MONTH: Record<"q1" | "q2" | "q3" | "q4", number> = {
  q1: 0,
  q2: 3,
  q3: 6,
  q4: 9,
};

/**
 * The earliest date the platform is asked to report from. Nothing predates
 * it, so "maximum" is everything without pretending to an open-ended query.
 */
export const EARLIEST_REPORTABLE_DATE = new Date(2000, 0, 1);

/**
 * Quarters are always of the current year, which is what an operator means by
 * "second quarter" in September. A future quarter still resolves — it simply
 * reports nothing yet, which is more honest than hiding the option.
 */
export function resolvePreset(preset: DateRangePresetKey, now: Date): DateRange | null {
  if (preset === "custom") return null;
  const year = now.getFullYear();

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const yesterday = addDays(startOfDay(now), -1);
      return { from: yesterday, to: endOfDay(yesterday) };
    }
    case "thisMonth":
      return {
        from: new Date(year, now.getMonth(), 1),
        to: endOfDay(new Date(year, now.getMonth() + 1, 0)),
      };
    case "lastMonth":
      return {
        from: new Date(year, now.getMonth() - 1, 1),
        to: endOfDay(new Date(year, now.getMonth(), 0)),
      };
    case "thisYear":
      return { from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
    case "lastYear":
      return {
        from: new Date(year - 1, 0, 1),
        to: endOfDay(new Date(year - 1, 11, 31)),
      };
    case "maximum":
      return { from: new Date(EARLIEST_REPORTABLE_DATE), to: endOfDay(now) };
    default: {
      const month = QUARTER_START_MONTH[preset];
      return {
        from: new Date(year, month, 1),
        to: endOfDay(new Date(year, month + 3, 0)),
      };
    }
  }
}

/** Which preset a range corresponds to, so a restored range shows as named. */
export function matchPreset(range: DateRange, now: Date): DateRangePresetKey {
  for (const key of DATE_RANGE_PRESET_KEYS) {
    const candidate = resolvePreset(key, now);
    if (!candidate) continue;
    if (
      candidate.from.getTime() === range.from.getTime() &&
      candidate.to.getTime() === range.to.getTime()
    ) {
      return key;
    }
  }
  return "custom";
}

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `HH:mm` for the time inputs. */
export function toTimeValue(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/**
 * Applies a `HH:mm` input to a date, ignoring a malformed value rather than
 * producing an Invalid Date the request would then reject.
 */
export function withTime(value: Date, time: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  const date = new Date(value);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Moves an endpoint onto a different date while keeping its time of day down
 * to the millisecond.
 *
 * `toTimeValue`/`withTime` exist for the `HH:mm` time inputs, and that format
 * cannot hold the `23:59:59.999` an inclusive end of day means. Round-tripping
 * an endpoint through the pair therefore truncated it to `23:59:00.000` and
 * silently dropped the last minute of the reporting window.
 */
export function withTimeOf(value: Date, source: Date): Date {
  const date = new Date(value);
  date.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );
  return date;
}

/**
 * The six weeks a month grid shows, starting on the given weekday so the
 * calendar matches the reader's locale rather than a hardcoded Sunday.
 */
export function monthGrid(month: Date, weekStartsOn: number): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

/** Orders a two-click selection so dragging backwards still works. */
export function orderRange(a: Date, b: Date): DateRange {
  return a.getTime() <= b.getTime()
    ? { from: startOfDay(a), to: endOfDay(b) }
    : { from: startOfDay(b), to: endOfDay(a) };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
