import { addDays } from "date-fns";
import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { CalendarMode, CalendarRange } from "./calendar-range";

export interface CalendarFormat {
  // "September 2026" · "Sep 21 – 27, 2026" · "Thursday, September 24, 2026"
  title: (mode: CalendarMode, anchor: Date, range: CalendarRange) => string;
  weekday: (day: Date) => string;
  weekdayLong: (day: Date) => string;
  // Only the number. A date control's accessible name is the whole date, and
  // what it shows has to be contained in that name (WCAG 2.5.3) — "Oct 1" is
  // not in "October 1", so the month is a caption beside it, not its text.
  dayNumber: (day: Date) => string;
  monthShort: (day: Date) => string;
  // The day in full — the accessible name of anything that stands for a day.
  dayLabel: (day: Date) => string;
  hour: (time: Date) => string;
}

// Every date the calendar draws goes through INTL_LOCALE, so Arabic keeps its
// month and weekday names with Western digits — docs/design/typography.md.
// Built once per language: an Intl.DateTimeFormat is costly to construct and
// a week draws hundreds of labels.
export function calendarFormat(language: Language): CalendarFormat {
  const locale = INTL_LOCALE[language];
  const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const span = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  const full = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const monthShort = new Intl.DateTimeFormat(locale, { month: "short" });
  const hour = new Intl.DateTimeFormat(locale, { hour: "numeric" });

  return {
    title: (mode, anchor, range) => {
      if (mode === "month") return month.format(anchor);
      // formatRange drops what the two ends share, which is what turns a week
      // into "Sep 21 – 27, 2026" and still writes both months or years out
      // when the week crosses one.
      if (mode === "week") return span.formatRange(range.start, addDays(range.end, -1));
      return full.format(range.start);
    },
    weekday: (day) => weekday.format(day),
    weekdayLong: (day) => weekdayLong.format(day),
    dayNumber: (day) => dayOfMonth.format(day),
    monthShort: (day) => monthShort.format(day),
    dayLabel: (day) => full.format(day),
    hour: (time) => hour.format(time),
  };
}
