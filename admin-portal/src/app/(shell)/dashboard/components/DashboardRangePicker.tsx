"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { localeForLanguage } from "@/i18n/locale";
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/design-system";
import {
  addMonths,
  DATE_RANGE_PRESET_KEYS,
  isSameDay,
  matchPreset,
  monthGrid,
  orderRange,
  resolvePreset,
  startOfDay,
  toTimeValue,
  withTime,
  withTimeOf,
  type DateRange,
  type DateRangePresetKey,
} from "../utils/date-range-presets";

interface DashboardRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * The dashboard's reporting window: named ranges beside a calendar, with the
 * time of day underneath.
 *
 * Presets carry almost all the traffic — "today", "last month", "second
 * quarter" — so they lead. The calendar is for the window nobody named, and
 * the time inputs matter now that a single day buckets by the hour: an
 * operator narrowing to an incident wants 09:00 to 11:00, not the whole day.
 */
export function DashboardRangePicker({ value, onChange }: DashboardRangePickerProps) {
  const { lang, t, dir } = useI18n();
  const copy = t.dashboard.rangePicker;
  const locale = localeForLanguage(lang);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date>(() => startOfMonth(value.from));

  const now = useMemo(() => new Date(), []);
  // The trigger names the committed window; the list highlights what is
  // staged, so a chosen preset reads as selected before Apply commits it.
  const committedPreset = matchPreset(value, now);
  const draftPreset = matchPreset(draft, now);
  const weekStartsOn = lang === "ar" ? 6 : 0;
  const days = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);

  const dayName = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "narrow" }),
    [locale],
  );
  const dayNumber = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric" }),
    [locale],
  );
  const monthName = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );
  const summary = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  // Reopening shows the committed window, not an abandoned half-selection.
  // Done on the open event rather than in an effect: the draft is only ever
  // stale between a close and the next open, and nothing renders in between.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value);
      setAnchor(null);
      setMonth(startOfMonth(value.from));
    }
    setOpen(next);
  };

  // A preset stages a window rather than committing it: the reader may want
  // to narrow the hours, or pick a different one, before anything reloads.
  const stagePreset = (preset: DateRangePresetKey) => {
    const range = resolvePreset(preset, new Date());
    if (!range) return;
    setDraft(range);
    setAnchor(null);
    setMonth(startOfMonth(range.to));
  };

  const pickDay = (day: Date) => {
    if (!anchor) {
      setAnchor(day);
      setDraft({ ...orderRange(day, day) });
      return;
    }
    // Second click closes the range, keeping whatever times are set — carried
    // across whole, not read back out of the `HH:mm` inputs. That round trip
    // rounded the inclusive end of day down to 23:59:00, so a date-only
    // selection reported a minute less than the same window named as a preset.
    const ordered = orderRange(anchor, day);
    setAnchor(null);
    setDraft({
      from: withTimeOf(ordered.from, draft.from),
      to: withTimeOf(ordered.to, draft.to),
    });
  };

  const label =
    committedPreset === "custom"
      ? `${summary.format(value.from)} — ${summary.format(value.to)}`
      : copy.presets[committedPreset];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label={`${copy.triggerLabel}: ${label}`}
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto max-w-[min(92vw,44rem)] p-0" align="end">
        <div className="flex flex-col sm:flex-row-reverse">
          {/* Calendar first in the DOM so the reading order matches the
              visual order in both directions. */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={copy.previousMonth}
                onClick={() => setMonth(addMonths(month, -1))}
              >
                {dir === "rtl" ? (
                  <ChevronRight className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="size-4" aria-hidden="true" />
                )}
              </Button>
              <span aria-live="polite" className="text-sm font-semibold text-foreground">
                {monthName.format(month)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={copy.nextMonth}
                onClick={() => setMonth(addMonths(month, 1))}
              >
                {dir === "rtl" ? (
                  <ChevronLeft className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>

            <div role="grid" aria-label={copy.calendarLabel}>
              <div role="row" className="grid grid-cols-7">
                {days.slice(0, 7).map((day) => (
                  <span
                    key={`head-${day.getDay()}`}
                    role="columnheader"
                    className="py-1 text-center text-xs font-semibold text-muted-foreground"
                  >
                    {dayName.format(day)}
                  </span>
                ))}
              </div>
              {chunk(days).map((week) => (
                <div role="row" key={week[0].toISOString()} className="grid grid-cols-7">
                  {week.map((day) => (
                    <DayCell
                      key={day.toISOString()}
                      day={day}
                      month={month}
                      draft={draft}
                      today={now}
                      label={dayNumber.format(day)}
                      onPick={pickDay}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
              <TimeField
                id="dashboard-range-from"
                label={copy.fromTime}
                value={toTimeValue(draft.from)}
                onChange={(time) =>
                  setDraft((current) => ({ ...current, from: withTime(current.from, time) }))
                }
              />
              <TimeField
                id="dashboard-range-to"
                label={copy.toTime}
                value={toTimeValue(draft.to)}
                onChange={(time) =>
                  setDraft((current) => ({ ...current, to: withTime(current.to, time) }))
                }
              />
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {copy.cancel}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={draft.from.getTime() > draft.to.getTime()}
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                {copy.apply}
              </Button>
            </div>
          </div>

          <ul className="flex max-h-80 shrink-0 flex-col gap-0.5 overflow-y-auto border-border p-2 sm:w-44 sm:border-e">
            {DATE_RANGE_PRESET_KEYS.map((preset) => (
              <li key={preset}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={draftPreset === preset}
                  className={`w-full justify-start ${
                    draftPreset === preset ? "bg-selected text-selected-foreground" : ""
                  }`}
                  onClick={() => stagePreset(preset)}
                >
                  {copy.presets[preset]}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DayCell({
  day,
  month,
  draft,
  today,
  label,
  onPick,
}: {
  day: Date;
  month: Date;
  draft: DateRange;
  today: Date;
  label: string;
  onPick: (day: Date) => void;
}) {
  const outside = day.getMonth() !== month.getMonth();
  const start = isSameDay(day, draft.from);
  const end = isSameDay(day, draft.to);
  const inside =
    day.getTime() > startOfDay(draft.from).getTime() &&
    day.getTime() < startOfDay(draft.to).getTime();
  const selected = start || end;

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected || inside}
      aria-current={isSameDay(day, today) ? "date" : undefined}
      onClick={() => onPick(day)}
      className={[
        "h-9 text-sm tabular-nums transition-colors motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        outside ? "text-muted-foreground/60" : "text-foreground",
        inside ? "bg-selected/40" : "",
        selected ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent",
        start ? "rounded-s-md" : "",
        end ? "rounded-e-md" : "",
        // Today keeps a ring so it stays findable once something else is picked.
        isSameDay(day, today) && !selected ? "ring-1 ring-inset ring-primary/50" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function TimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function chunk(days: Date[]): Date[][] {
  return Array.from({ length: 6 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}
