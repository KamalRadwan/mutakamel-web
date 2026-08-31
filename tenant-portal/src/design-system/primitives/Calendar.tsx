"use client";

import { arEG } from "date-fns/locale/ar-EG";
import { enUS } from "date-fns/locale/en-US";
import type { Locale } from "date-fns";
import { DayFlag, DayPicker, SelectionState, UI, type ClassNames, type DayPickerProps } from "react-day-picker";
import { useDirection, useLanguage, type Language } from "@/i18n/useLanguage";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

// react-day-picker ships `react-day-picker/style.css`. Importing it is banned:
// DESIGN-SYSTEM.md#5 says the one stylesheet in this app declares tokens and
// styles nothing, and a vendored component stylesheet is the same violation
// arriving from a different direction. It would also land ~60 `.rdp-*` rules
// with their own radius, colours and spacing scale outside the token system.
//
// So every structural class the library would have taken from its own CSS is
// supplied here through `classNames`, using design-system utilities only. This
// is cheap because the library's markup is a native <table>: the seven-column
// grid, the RTL mirror and the arrow-key grid all come from table layout, not
// from CSS the stylesheet would have added.
//
// classNames MERGES over the library's defaults, so any key not listed keeps an
// inert `rdp-*` name that matches no rule — harmless, but it means a key that
// carries layout must be listed here or the calendar renders unstyled.
const CALENDAR_CLASS_NAMES: Partial<ClassNames> = {
  [UI.Root]: "w-fit text-foreground",
  [UI.Months]: "relative flex flex-col gap-4 sm:flex-row",
  [UI.Month]: "flex flex-col gap-2",
  [UI.Nav]: "absolute inset-x-0 top-0 flex items-center justify-between",
  [UI.PreviousMonthButton]: cn(
    "inline-flex size-(--size-control-sm) cursor-pointer items-center justify-center rounded-sm",
    "border border-border bg-transparent text-muted-foreground transition-colors hover:bg-accent",
    "aria-disabled:pointer-events-none aria-disabled:opacity-40",
    focusRing,
  ),
  [UI.NextMonthButton]: cn(
    "inline-flex size-(--size-control-sm) cursor-pointer items-center justify-center rounded-sm",
    "border border-border bg-transparent text-muted-foreground transition-colors hover:bg-accent",
    "aria-disabled:pointer-events-none aria-disabled:opacity-40",
    focusRing,
  ),
  // The library already picks the chevron's orientation from `dir`, so this
  // must NOT add a mirror of its own — it would cancel that out.
  [UI.Chevron]: "size-3.5 fill-current",
  [UI.MonthCaption]: "flex h-(--size-control-sm) items-center justify-center",
  [UI.CaptionLabel]: "text-sm font-medium",
  [UI.MonthGrid]: "w-full border-collapse",
  [UI.Weekdays]: "",
  [UI.Weekday]: "size-8 p-0 text-xs font-normal text-muted-foreground",
  [UI.Weeks]: "",
  [UI.Week]: "",
  [UI.Day]: "p-0 text-center align-middle",
  [UI.DayButton]: cn(
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-sm",
    "text-xs font-normal tabular-nums transition-colors hover:bg-accent",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
    focusRing,
  ),
  [UI.Footer]: "pt-2 text-xs text-muted-foreground",
  // Today is marked by weight and a hairline, never a hue — a date is an
  // identity, and only an outcome takes colour. See docs/design/README.md#1.
  [DayFlag.today]: "[&>button]:font-medium [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-border",
  [DayFlag.outside]: "[&>button]:text-muted-foreground [&>button]:opacity-60",
  [DayFlag.disabled]: "[&>button]:pointer-events-none [&>button]:opacity-40",
  [DayFlag.hidden]: "invisible",
  [SelectionState.selected]:
    "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
  // Logical rounding, so a range reads start-to-end in both directions.
  [SelectionState.range_start]: "bg-accent rounded-s-sm",
  [SelectionState.range_end]: "bg-accent rounded-e-sm",
  [SelectionState.range_middle]:
    "bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground [&>button]:hover:bg-accent",
};

const DATE_FNS_LOCALE: Record<Language, Locale> = { ar: arEG, en: enUS };

export type CalendarProps = DayPickerProps & {
  // Overrides the active language. Omitted, the calendar follows the app —
  // this is a formatting concern, not UI copy, so it reads the language store
  // the same way Sheet reads direction.
  language?: Language;
};

/**
 * The shared month grid behind `DatePicker` and `DateRangePicker`.
 *
 * Arabic renders Arabic month and weekday names with **Western digits**
 * (`numerals="latn"`), matching the `ar-EG-u-nu-latn` decision in
 * `src/lib/format/locale.ts` — settled in typography.md, not a fallback.
 */
export function Calendar({ language, ...props }: CalendarProps) {
  const activeLanguage = useLanguage();
  const dir = useDirection();
  const lang = language ?? activeLanguage;

  return (
    <DayPicker
      {...props}
      dir={dir}
      locale={DATE_FNS_LOCALE[lang]}
      numerals="latn"
      // Month-to-month sliding is not in the motion budget — docs/design/motion.md.
      animate={false}
      className={cn("p-3", props.className)}
      classNames={{ ...CALENDAR_CLASS_NAMES, ...props.classNames }}
    />
  );
}
