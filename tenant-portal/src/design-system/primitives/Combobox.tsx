"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";
import { textEntrySize, type ControlSizeProps } from "../lib/variants";
import { Button } from "./Button";
import { FieldControlBoundary, useFieldControlContext } from "./field-control";
import { Input } from "./Input";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second line under the label — a code, a branch name, a disambiguator. */
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps extends ControlSizeProps {
  value?: string;
  /**
   * Label for the current value. A remote list only holds the page that was
   * last fetched, so the selected row is usually absent from `options` and the
   * trigger would otherwise render a bare id.
   */
  selectedLabel?: string;
  onValueChange: (next: string | undefined) => void;
  options: ComboboxOption[];
  /** Called with the typed query after `debounceMs` of quiet, and once on open. */
  onSearch: (query: string) => void;
  loading?: boolean;
  debounceMs?: number;
  placeholder: string;
  searchPlaceholder: string;
  loadingLabel: string;
  emptyLabel: string;
  clearLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
  id?: string;
  className?: string;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Single-select type-ahead over a **remote** list.
 *
 * This is not a `Select` with a filter box bolted on — primitives.md rules that
 * out explicitly. The list is whatever the server last returned for the query,
 * so filtering never happens in the browser and the control has real loading
 * and empty states rather than an empty dropdown.
 */
export function Combobox({
  value,
  selectedLabel,
  onValueChange,
  options,
  onSearch,
  loading,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  placeholder,
  searchPlaceholder,
  loadingLabel,
  emptyLabel,
  clearLabel,
  disabled,
  readOnly,
  invalid,
  onBlur,
  id,
  size = "sm",
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  // A composite reads the field rather than spreading it: `invalid` and
  // `readOnly` are behaviour here (whether the popover may open, how the
  // trigger paints), not only ARIA.
  const field = useFieldControlContext();
  const controlId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid;
  const isReadOnly = readOnly ?? field?.readOnly;
  const editable = !disabled && !isReadOnly;
  const clearable = Boolean(clearLabel) && value !== undefined && editable;

  // Latest-ref, so a parent that re-creates onSearch every render does not
  // restart the debounce on every render and fire a request per keystroke.
  const searchRef = useRef(onSearch);
  useEffect(() => {
    searchRef.current = onSearch;
  });

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => searchRef.current(query), debounceMs);
    return () => clearTimeout(timer);
  }, [open, query, debounceMs]);

  // A fresh result set invalidates the highlighted row's index. Adjusted
  // during render rather than in an effect, so there is no cascading second
  // render — https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedOptions, setSyncedOptions] = useState(options);
  if (options !== syncedOptions) {
    setSyncedOptions(options);
    setActiveIndex(0);
  }

  const activeOptionId = options.length > 0 ? `${listId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    // Optional call, not an assumption: scrollIntoView is absent in jsdom and
    // in any non-browser renderer, and keyboard navigation must not throw
    // there.
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeOptionId]);

  function commit(option: ComboboxOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + options.length) % options.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) commit(option);
    }
  }

  return (
    // The trigger has already taken the field above; everything below is inside
    // the boundary so the popover's own search box cannot claim the same id.
    <FieldControlBoundary>
      <div className={cn("relative flex w-full items-center", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(editable && next);
          if (!next) setQuery("");
        }}
      >
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
              "w-full cursor-pointer justify-between gap-1.5 bg-card font-normal",
              !value && "text-muted-foreground",
              isInvalid && "border-destructive",
              isReadOnly && "cursor-default bg-muted text-foreground",
              clearable && "pe-8",
            )}
          >
            <span className="truncate">{value ? (selectedLabel ?? value) : placeholder}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <div className="border-b border-border p-1.5">
            <Input
              // ARIA 1.2 puts role="combobox" on the text field, not on the
              // element that opened it, so the listbox relationship is
              // announced from where the user is actually typing.
              role="combobox"
              size="sm"
              value={query}
              autoFocus
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              className={textEntrySize({ size: "sm" })}
            />
          </div>

          <ul id={listId} role="listbox" aria-label={placeholder} className="max-h-64 overflow-y-auto p-1">
            {loading && (
              <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground" role="presentation">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {loadingLabel}
              </li>
            )}
            {!loading && options.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground" role="presentation">
                {emptyLabel}
              </li>
            )}
            {!loading &&
              options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                    index === activeIndex && "bg-accent text-accent-foreground",
                    option.disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <Check
                    className={cn("mt-0.5 size-3.5 shrink-0", option.value !== value && "invisible")}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-muted-foreground">{option.description}</span>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </PopoverContent>
      </Popover>

      {clearable && clearLabel && (
        <Button
          variant="ghost"
          size="xs"
          aria-label={clearLabel}
          onClick={() => onValueChange(undefined)}
          className="absolute end-1 size-5 shrink-0 cursor-pointer rounded-md p-0!"
        >
          <X className="size-3" aria-hidden="true" />
        </Button>
      )}
      </div>
    </FieldControlBoundary>
  );
}
