import { startOfDay, startOfMonth, startOfWeek, type Day } from "date-fns";
import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";

export type CalendarMode = "month" | "week" | "day";

/** The days a mode shows: `[start, end)`, both the local starts of their days. */
export interface CalendarRange {
  start: Date;
  end: Date;
}

// The month is always six whole weeks, so the grid keeps one height from
// February to August and nothing under it moves on "next" — and the range a
// screen fetches is the range the grid draws, trailing days included.
const DAYS_SHOWN: Record<CalendarMode, number> = { month: 42, week: 7, day: 1 };

export function calendarRange(mode: CalendarMode, anchor: Date, weekStartsOn: Day): CalendarRange {
  const start =
    mode === "month"
      ? startOfWeek(startOfMonth(anchor), { weekStartsOn })
      : mode === "week"
        ? startOfWeek(anchor, { weekStartsOn })
        : startOfDay(anchor);
  return { start, end: calendarDayStart(start, DAYS_SHOWN[mode]) };
}

/**
 * Where the day `offset` calendar days after `day`'s begins, local time.
 *
 * Built from the date's parts rather than moved from `day` (date-fns `addDays`
 * keeps the time of day): where daylight saving starts at midnight — Cairo's
 * last Friday of April — that day begins at 01:00, and every day stepped from
 * it would begin at 01:00 too, handing each night's first hour to the day
 * before.
 */
export function calendarDayStart(day: Date, offset: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset);
}

// CLDR's own answer for the two locales this portal ships — Egypt starts the
// week on Saturday, the United States on Sunday — for a browser that exposes no
// week data at all.
const FALLBACK_WEEK_START: Record<Language, Day> = { ar: 6, en: 0 };

const WEEKDAYS: readonly Day[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * The first day of the week in the language's locale, `0` = Sunday.
 *
 * Read from the locale's week data rather than from date-fns, whose `ar-EG`
 * says Sunday where CLDR says Saturday.
 */
export function calendarWeekStart(language: Language): Day {
  return localeFirstDay(new Intl.Locale(INTL_LOCALE[language])) ?? FALLBACK_WEEK_START[language];
}

// `getWeekInfo()` is the standard spelling and `weekInfo` the accessor Chrome
// and Safari shipped first. Neither is in TypeScript's lib yet, so both are
// read as unknown and checked.
function localeFirstDay(locale: Intl.Locale): Day | undefined {
  const info: unknown =
    "getWeekInfo" in locale && typeof locale.getWeekInfo === "function"
      ? locale.getWeekInfo()
      : "weekInfo" in locale
        ? locale.weekInfo
        : undefined;
  if (typeof info !== "object" || info === null || !("firstDay" in info)) return undefined;
  const { firstDay } = info;
  if (typeof firstDay !== "number") return undefined;
  // Intl counts Monday = 1 … Sunday = 7; date-fns counts Sunday = 0 … Saturday = 6.
  return WEEKDAYS.find((day) => day === firstDay % 7);
}
