"use client";

import { useState } from "react";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  type Day,
} from "date-fns";
import { CalendarRange, X } from "lucide-react";
import { useLanguage, type Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { cn } from "../lib/cn";
import { type ControlSizeProps } from "../lib/variants";
import { Button } from "./Button";
import { Calendar } from "./Calendar";
import { DATE_TIME_OPTIONS } from "./DateTime";
import { useFieldControlContext } from "./field-control";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Separator } from "./Separator";

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

/** Every preset the picker can resolve. A caller offers a subset through `presets`. */
export type DateRangePresetId =
  | "today"
  | "thisWeek"
  | "next7Days"
  | "next30Days"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "thisMonth"
  | "thisQuarter";

/** Translated by the caller, one label per preset it offers. */
export type DateRangePresetLabels = Partial<Record<DateRangePresetId, string>>;

/**
 * What a picker offers when its caller names no `presets`: the six
 * backward-looking ranges every filter screen was built with, so adding the
 * forward ones changed nothing on those screens.
 */
export const DATE_RANGE_PRESET_IDS: readonly DateRangePresetId[] = [
  "today",
  "last7Days",
  "last30Days",
  "last90Days",
  "thisMonth",
  "thisQuarter",
];

/**
 * Resolves a preset against a reference "now", which is passed in rather than
 * read from the clock so the result is deterministic in tests and in CI.
 *
 * Ranges are inclusive and snap to day boundaries — a "last 7 days" filter that
 * starts mid-afternoon silently drops a day of results. The forward ranges
 * count today in, as the backward ones do: "next 7 days" is today and the six
 * after it. `weekStartsOn` (0 = Sunday … 6 = Saturday) places "this week".
 */
export function resolveDateRangePreset(id: DateRangePresetId, now: Date, weekStartsOn: Day = 0): DateRangeValue {
  const today = startOfDay(now);
  switch (id) {
    case "today":
      return { from: today, to: endOfDay(now) };
    case "thisWeek":
      return { from: startOfWeek(today, { weekStartsOn }), to: endOfWeek(today, { weekStartsOn }) };
    case "next7Days":
      return { from: today, to: endOfDay(addDays(today, 6)) };
    case "next30Days":
      return { from: today, to: endOfDay(addDays(today, 29)) };
    case "last7Days":
      return { from: subDays(today, 6), to: endOfDay(now) };
    case "last30Days":
      return { from: subDays(today, 29), to: endOfDay(now) };
    case "last90Days":
      return { from: subDays(today, 89), to: endOfDay(now) };
    case "thisMonth":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "thisQuarter":
      return { from: startOfQuarter(today), to: endOfQuarter(today) };
  }
}

export interface DateRangePickerProps extends ControlSizeProps {
  value?: DateRangeValue;
  onValueChange: (next: DateRangeValue | undefined) => void;
  placeholder: string;
  presetLabels: DateRangePresetLabels;
  /** The presets offered, in this order. Defaults to `DATE_RANGE_PRESET_IDS`. */
  presets?: readonly DateRangePresetId[];
  /**
   * First day of the week (0 = Sunday … 6 = Saturday), for the `thisWeek`
   * preset and the grid alike, so the two cannot disagree. Omitted, "this
   * week" starts on Sunday and the grid follows the locale.
   */
  weekStartsOn?: Day;
  clearLabel?: string;
  startMonth?: Date;
  endMonth?: Date;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
  language?: Language;
  /** Reference date the presets resolve against. Defaults to now. */
  now?: Date;
  id?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onValueChange,
  placeholder,
  presetLabels,
  presets = DATE_RANGE_PRESET_IDS,
  weekStartsOn,
  clearLabel,
  startMonth,
  endMonth,
  disabled,
  readOnly,
  invalid,
  onBlur,
  language,
  now,
  id,
  size = "sm",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const activeLanguage = useLanguage();
  const lang = language ?? activeLanguage;
  const field = useFieldControlContext();
  const controlId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid;
  const isReadOnly = readOnly ?? field?.readOnly;
  const editable = !disabled && !isReadOnly;
  const clearable = Boolean(clearLabel) && Boolean(value?.from) && editable;

  const formatter = new Intl.DateTimeFormat(INTL_LOCALE[lang], DATE_TIME_OPTIONS.date);
  const label = value?.from
    ? [formatter.format(value.from), value.to ? formatter.format(value.to) : undefined]
        .filter(Boolean)
        .join(" – ")
    : placeholder;

  // A preset the caller left unlabelled is not offered: a shortcut missing
  // from the list costs less than a button with no name.
  const offeredPresets = presets.flatMap((presetId) => {
    const presetLabel = presetLabels[presetId];
    return presetLabel ? [{ id: presetId, label: presetLabel }] : [];
  });

  function applyPreset(id: DateRangePresetId) {
    onValueChange(resolveDateRangePreset(id, now ?? new Date(), weekStartsOn));
    setOpen(false);
  }

  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <Popover open={open} onOpenChange={(next) => setOpen(editable && next)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={size}
            id={controlId}
            disabled={disabled}
            onBlur={onBlur}
            aria-describedby={field?.describedBy}
            aria-invalid={isInvalid || undefined}
            aria-required={field?.required}
            aria-readonly={isReadOnly || undefined}
            className={cn(
              "w-full cursor-pointer justify-start gap-1.5 bg-card font-normal",
              !value?.from && "text-muted-foreground",
              isInvalid && "border-destructive",
              isReadOnly && "cursor-default bg-muted text-foreground",
              clearable && "pe-8",
            )}
          >
            <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {/* The range is a bidi-neutral run of digits and separators; <bdi>
                stops it reordering inside Arabic copy. */}
            <bdi className="truncate">{label}</bdi>
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="flex w-auto flex-col gap-2 p-0 sm:flex-row">
          <div className="flex flex-row flex-wrap gap-1 p-2 sm:w-40 sm:flex-col sm:flex-nowrap">
            {offeredPresets.map((preset) => (
              <Button
                key={preset.id}
                variant="ghost"
                size="sm"
                onClick={() => applyPreset(preset.id)}
                className="cursor-pointer justify-start font-normal"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Separator orientation="vertical" className="hidden h-auto sm:block" />
          <Calendar
            mode="range"
            language={language}
            numberOfMonths={1}
            selected={value?.from ? { from: value.from, to: value.to } : undefined}
            defaultMonth={value?.from}
            weekStartsOn={weekStartsOn}
            startMonth={startMonth}
            endMonth={endMonth}
            autoFocus
            onSelect={(next) => onValueChange(next ? { from: next.from, to: next.to } : undefined)}
          />
        </PopoverContent>
      </Popover>

      {clearable && clearLabel && (
        <Button
          variant="ghost"
          size="xs"
          aria-label={clearLabel}
          onClick={() => onValueChange(undefined)}
          className="absolute end-1 size-5 shrink-0 cursor-pointer rounded-xs p-0!"
        >
          <X className="size-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
