"use client";

import { useId, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "./Button";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
  leading?: React.ReactNode;
  disabled?: boolean;
}

export interface ComboboxProps {
  id?: string;
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  /**
   * Keep the list below the trigger even when the viewport would rather flip
   * it upward. A long list near the bottom of a form otherwise opens over the
   * fields the user just filled in, which reads as the page jumping.
   */
  preferDownward?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Searchable single-select built on Radix focus management and cmdk keys. */
export function Combobox({
  id,
  value,
  options,
  onValueChange,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  className,
  contentClassName,
  preferDownward = false,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const generatedId = useId();
  const popupId = `${id ?? generatedId}-popup`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const setOpenAndReset = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpenAndReset}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="lg"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between gap-2 px-3 font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.leading}
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        id={popupId}
        align="start"
        side="bottom"
        avoidCollisions={!preferDownward}
        className={cn("w-[--radix-popover-trigger-width] min-w-56 max-w-[calc(100vw-2rem)] p-0", contentClassName)}
      >
        <Command label={searchPlaceholder} loop shouldFilter className="flex max-h-80 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              className={cn(
                "h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
                focusRing,
                "focus-visible:ring-inset focus-visible:ring-offset-0",
              )}
            />
          </div>
          <Command.List aria-label={label} className="overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </Command.Empty>
            {options.map((option) => {
              const isSelected = option.value === value;
              const searchableValue = [option.label, option.value, ...(option.keywords ?? [])].join(" ");
              return (
                <Command.Item
                  key={option.value}
                  value={searchableValue}
                  disabled={option.disabled}
                  aria-selected={isSelected}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpenAndReset(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors motion-reduce:transition-none",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                    "aria-selected:bg-selected aria-selected:text-selected-foreground",
                    "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                    focusRing,
                    hitArea,
                  )}
                >
                  {option.leading}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Check
                    className={cn("size-4 shrink-0 text-primary", !isSelected && "invisible")}
                    aria-hidden="true"
                  />
                </Command.Item>
              );
            })}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
