"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { useLanguage, type Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { cn } from "../lib/cn";
import { type ControlSizeProps } from "../lib/variants";
import { Button } from "./Button";
import { Calendar } from "./Calendar";
import { DATE_TIME_OPTIONS } from "./DateTime";
import { useFieldControlContext } from "./field-control";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

export interface DatePickerProps extends ControlSizeProps {
  value?: Date;
  onValueChange: (next: Date | undefined) => void;
  /** Shown when nothing is selected. Already translated — a primitive never reads the dictionary. */
  placeholder: string;
  /** Accessible name for the clear affordance. Omit it to hide clearing entirely. */
  clearLabel?: string;
  /** Earliest month the navigation may reach. */
  startMonth?: Date;
  /** Latest month the navigation may reach. */
  endMonth?: Date;
  disabled?: boolean;
  /** The value matters, it is just not editable here — full contrast, unlike `disabled`. */
  readOnly?: boolean;
  invalid?: boolean;
  /** Fired when the trigger loses focus, so a form validates on blur, never per keystroke. */
  onBlur?: () => void;
  language?: Language;
  id?: string;
  className?: string;
}

export function DatePicker({
  value,
  onValueChange,
  placeholder,
  clearLabel,
  startMonth,
  endMonth,
  disabled,
  readOnly,
  invalid,
  onBlur,
  language,
  id,
  size = "sm",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const activeLanguage = useLanguage();
  const lang = language ?? activeLanguage;
  const field = useFieldControlContext();
  const controlId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid;
  const isReadOnly = readOnly ?? field?.readOnly;
  const editable = !disabled && !isReadOnly;
  const clearable = Boolean(clearLabel) && value !== undefined && editable;

  const label = value
    ? new Intl.DateTimeFormat(INTL_LOCALE[lang], DATE_TIME_OPTIONS.date).format(value)
    : placeholder;

  return (
    // The clear affordance is a SIBLING of the trigger, never a child: a button
    // inside a button is invalid markup and the inner one stops being reachable.
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
              !value && "text-muted-foreground",
              isInvalid && "border-destructive",
              isReadOnly && "cursor-default bg-muted text-foreground",
              clearable && "pe-8",
            )}
          >
            <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            language={language}
            selected={value}
            defaultMonth={value}
            startMonth={startMonth}
            endMonth={endMonth}
            autoFocus
            onSelect={(next) => {
              onValueChange(next);
              setOpen(false);
            }}
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
