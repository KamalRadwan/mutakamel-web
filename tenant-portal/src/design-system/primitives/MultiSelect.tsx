"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../lib/cn";
import { textEntrySize, type ControlSizeProps } from "../lib/variants";
import { Badge } from "./Badge";
import { Button } from "./Button";
import type { ComboboxOption } from "./Combobox";
import { FieldControlBoundary, useFieldControlContext } from "./field-control";
import { Input } from "./Input";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

export interface MultiSelectProps extends ControlSizeProps {
  values: string[];
  onValuesChange: (next: string[]) => void;
  options: ComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel: string;
  clearAllLabel?: string;
  /** Template for the overflow trigger, e.g. `"+{count}"`. */
  moreLabel: string;
  /** Template for a chip's remove control, e.g. `"Remove {label}"`. */
  removeLabel: string;
  /** Accessible name for the popover that holds the overflowed chips. */
  overflowLabel: string;
  /** Chips shown inline before the rest collapse behind the `+n` button. */
  maxVisible?: number;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
  id?: string;
  className?: string;
}

const DEFAULT_MAX_VISIBLE = 3;

export function MultiSelect({
  values,
  onValuesChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearAllLabel,
  moreLabel,
  removeLabel,
  overflowLabel,
  maxVisible = DEFAULT_MAX_VISIBLE,
  disabled,
  readOnly,
  invalid,
  onBlur,
  id,
  size = "lg",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const field = useFieldControlContext();
  const controlId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid;
  const isReadOnly = readOnly ?? field?.readOnly;
  const editable = !disabled && !isReadOnly;

  const selected = values.map(
    (value) => options.find((option) => option.value === value) ?? { value, label: value },
  );
  const visible = selected.slice(0, maxVisible);
  const overflow = selected.slice(maxVisible);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  function toggle(value: string) {
    onValuesChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function renderChip(option: Pick<ComboboxOption, "value" | "label">) {
    return (
      <Badge key={option.value} tone="neutral" className="max-w-40 gap-0.5 pe-0.5">
        <span className="truncate">{option.label}</span>
        {editable && (
          <Button
            variant="ghost"
            size="xs"
            aria-label={formatTemplate(removeLabel, { label: option.label })}
            onClick={() => toggle(option.value)}
            className="size-4 shrink-0 cursor-pointer rounded-xs p-0!"
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        )}
      </Badge>
    );
  }

  return (
    // The trigger below has already claimed the field; the search box in the
    // popover must not claim it a second time.
    <FieldControlBoundary>
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-1 rounded-sm border border-input bg-card p-1",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        "min-h-(--size-control-md)",
        isInvalid && "border-destructive",
        disabled && "cursor-not-allowed opacity-50",
        isReadOnly && "bg-muted",
        className,
      )}
      aria-readonly={isReadOnly || undefined}
    >
      {visible.map(renderChip)}

      {/* The overflow is a BUTTON that opens a popover of still-removable
          chips, never a static count. A static "+3" hides filter state the
          user is entitled to change — docs/design/patterns.md#filterbar, and
          MASTER-PLAN task 1.39 extends that rule to here. */}
      {overflow.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="xs" className="cursor-pointer rounded-sm">
              {formatTemplate(moreLabel, { count: overflow.length })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <p className="pb-1.5 text-xs text-muted-foreground">{overflowLabel}</p>
            <div className="flex flex-wrap gap-1">{overflow.map(renderChip)}</div>
          </PopoverContent>
        </Popover>
      )}

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(editable && next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size={size}
            id={controlId}
            disabled={disabled}
            onBlur={onBlur}
            aria-describedby={field?.describedBy}
            aria-invalid={isInvalid || undefined}
            aria-required={field?.required}
            // The chips sit beside this button, not inside it, so once anything
            // is selected the button has no text of its own. Standalone it takes
            // the placeholder; inside a Field the label names it, and an
            // aria-label here would OUTRANK that label and announce the
            // placeholder in its place.
            aria-label={field ? undefined : placeholder}
            className={cn(
              "min-w-24 flex-1 cursor-pointer justify-between gap-1.5 bg-transparent font-normal",
              isReadOnly && "cursor-default",
            )}
          >
            {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground ms-auto" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
          {searchPlaceholder && (
            <div className="border-b border-border p-1.5">
              <Input
                size="sm"
                value={query}
                autoFocus
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
                className={textEntrySize({ size: "sm" })}
              />
            </div>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable
            aria-label={placeholder}
            className="max-h-64 overflow-y-auto p-1"
          >
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground" role="presentation">
                {emptyLabel}
              </li>
            )}
            {filtered.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={values.includes(option.value)}
                aria-disabled={option.disabled || undefined}
                onClick={() => toggle(option.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm hover:bg-accent",
                  option.disabled && "pointer-events-none opacity-50",
                )}
              >
                <Check
                  className={cn("size-3.5 shrink-0", !values.includes(option.value) && "invisible")}
                  aria-hidden="true"
                />
                <span className="truncate">{option.label}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      {clearAllLabel && selected.length > 0 && editable && (
        <Button
          variant="ghost"
          size="xs"
          aria-label={clearAllLabel}
          onClick={() => onValuesChange([])}
          className="size-5 shrink-0 cursor-pointer rounded-xs p-0!"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
    </FieldControlBoundary>
  );
}
