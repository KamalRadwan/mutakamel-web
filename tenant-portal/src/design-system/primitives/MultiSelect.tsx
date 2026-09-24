"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../lib/cn";
import { focusRing, textEntrySize, type ControlSizeProps } from "../lib/variants";
import { Badge } from "./Badge";
import { Button } from "./Button";
import type { ComboboxOption } from "./Combobox";
import { FieldControlBoundary, useFieldControlContext } from "./field-control";
import { Input } from "./Input";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { TagChip } from "./TagChip";
import type { TagColor } from "./tag-color";

/** An option that is a tag may carry its colour; its chip then draws it. */
export interface MultiSelectOption extends ComboboxOption {
  tagColor?: TagColor | null;
}

export interface MultiSelectProps extends ControlSizeProps {
  values: string[];
  onValuesChange: (next: string[]) => void;
  options: MultiSelectOption[];
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
  /** Callback when user chooses to create an option for the current search query */
  onCreate?: (query: string) => void;
  /** Template or string for the create option in the list. e.g. "Create tag \"{name}\"" */
  createLabel?: string;
}

const DEFAULT_MAX_VISIBLE = 3;

const multiSelectSizeConfig: Record<
  NonNullable<ControlSizeProps["size"]>,
  { container: string; text: string }
> = {
  xs: {
    container: "min-h-(--size-control-xs) px-2 py-0.5 rounded-sm",
    text: "text-xs",
  },
  sm: {
    container: "min-h-(--size-control-sm) px-2.5 py-0.5 rounded-md",
    text: "text-xs",
  },
  md: {
    container: "min-h-(--size-control-md) px-3 py-1 rounded-md",
    text: "text-sm",
  },
  lg: {
    container: "min-h-(--size-control-lg) px-3.5 py-1 rounded-md",
    text: "text-sm",
  },
  xl: {
    container: "min-h-(--size-control-xl) px-4 py-1.5 rounded-md",
    text: "text-base",
  },
};

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
  size = "sm",
  className,
  onCreate,
  createLabel,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const optionRefs = useRef(new Map<string, HTMLLIElement>());
  const createOptionRef = useRef<HTMLLIElement | null>(null);
  const listId = useId();
  const overflowHeadingId = useId();
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
  const enabledOptions = filtered.filter((option) => !option.disabled);
  const tabStopValue = enabledOptions.some((option) => option.value === activeValue)
    ? activeValue
    : enabledOptions[0]?.value;

  const hasExactMatch = needle.length > 0 && options.some((option) => option.label.trim().toLowerCase() === needle);
  const showCreateOption = Boolean(onCreate) && needle.length > 0 && !hasExactMatch;

  function triggerCreate() {
    if (!onCreate || !needle) return;
    onCreate(query.trim());
    setOpen(false);
    setQuery("");
  }

  function toggle(value: string) {
    onValuesChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function toggleOption(option: MultiSelectOption) {
    if (option.disabled) return;
    toggle(option.value);
  }

  function focusEnabledOption(index: number) {
    const option = enabledOptions[index];
    if (!option) return;
    setActiveValue(option.value);
    optionRefs.current.get(option.value)?.focus();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && filtered.length === 0 && showCreateOption) {
      event.preventDefault();
      triggerCreate();
      return;
    }
    if (enabledOptions.length === 0) {
      if (event.key === "ArrowDown" && showCreateOption) {
        event.preventDefault();
        createOptionRef.current?.focus();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusEnabledOption(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (showCreateOption) {
        createOptionRef.current?.focus();
      } else {
        focusEnabledOption(enabledOptions.length - 1);
      }
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLLIElement>, option: MultiSelectOption) {
    const currentIndex = enabledOptions.findIndex((item) => item.value === option.value);
    if (currentIndex === -1) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (currentIndex === enabledOptions.length - 1 && showCreateOption) {
        createOptionRef.current?.focus();
      } else {
        focusEnabledOption((currentIndex + 1) % enabledOptions.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (currentIndex === 0 && showCreateOption) {
        createOptionRef.current?.focus();
      } else {
        focusEnabledOption((currentIndex - 1 + enabledOptions.length) % enabledOptions.length);
      }
    } else if (event.key === "Home") {
      event.preventDefault();
      focusEnabledOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      if (showCreateOption) {
        createOptionRef.current?.focus();
      } else {
        focusEnabledOption(enabledOptions.length - 1);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleOption(option);
    }
  }

  function handleCreateOptionKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      triggerCreate();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (enabledOptions.length > 0) {
        focusEnabledOption(enabledOptions.length - 1);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (enabledOptions.length > 0) {
        focusEnabledOption(0);
      }
    }
  }

  function renderChip(option: Pick<MultiSelectOption, "value" | "label" | "tagColor">) {
    const remove = editable && (
      <Button
        variant="ghost"
        size="xs"
        aria-label={formatTemplate(removeLabel, { label: option.label })}
        onClick={() => toggle(option.value)}
        // On a coloured chip the neutral hover fill would be a grey patch on
        // the tenant's colour; the icon takes the chip's own text colour.
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded-xs p-0!",
          option.tagColor && "text-current hover:bg-transparent hover:opacity-75",
        )}
      >
        <X className="size-3" aria-hidden="true" />
      </Button>
    );
    if (option.tagColor) {
      return (
        <TagChip
          key={option.value}
          label={option.label}
          backgroundColor={option.tagColor.backgroundColor}
          textColor={option.tagColor.textColor}
          className="max-w-40 gap-0.5 pe-0.5"
        >
          {remove}
        </TagChip>
      );
    }
    return (
      <Badge key={option.value} tone="neutral" className="max-w-40 gap-0.5 pe-0.5">
        <bdi dir="auto" className="truncate">{option.label}</bdi>
        {remove}
      </Badge>
    );
  }

  const sizeConfig = multiSelectSizeConfig[size ?? "sm"] ?? multiSelectSizeConfig.sm;

  return (
    // The trigger below has already claimed the field; the search box in the
    // popover must not claim it a second time.
    <FieldControlBoundary>
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-1 border border-input bg-card",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        sizeConfig.container,
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
            <Button
              variant="outline"
              size="xs"
              aria-label={`${overflowLabel} (${overflow.length})`}
              className="h-5 cursor-pointer rounded-sm px-1.5 text-xs"
            >
              {formatTemplate(moreLabel, { count: overflow.length })}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-labelledby={overflowHeadingId}
            className="w-64 p-2"
          >
            <p id={overflowHeadingId} className="pb-1.5 text-xs text-muted-foreground">
              {overflowLabel}
            </p>
            <div className="flex flex-wrap gap-1">{overflow.map(renderChip)}</div>
          </PopoverContent>
        </Popover>
      )}

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(editable && next);
          if (!next) {
            setQuery("");
            setActiveValue(null);
          }
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
              "h-auto min-h-0 p-0 hover:bg-transparent shadow-none border-none",
              sizeConfig.text,
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
                dir="auto"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
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
                ref={(node) => {
                  if (node) optionRefs.current.set(option.value, node);
                  else optionRefs.current.delete(option.value);
                }}
                role="option"
                tabIndex={!option.disabled && option.value === tabStopValue ? 0 : -1}
                aria-selected={values.includes(option.value)}
                aria-disabled={option.disabled || undefined}
                onFocus={() => setActiveValue(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, option)}
                onClick={() => toggleOption(option)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm hover:bg-accent",
                  focusRing,
                  option.disabled && "pointer-events-none opacity-50",
                )}
              >
                <Check
                  className={cn("size-3.5 shrink-0", !values.includes(option.value) && "invisible")}
                  aria-hidden="true"
                />
                {option.tagColor ? (
                  <TagChip
                    label={option.label}
                    backgroundColor={option.tagColor.backgroundColor}
                    textColor={option.tagColor.textColor}
                  />
                ) : (
                  <bdi dir="auto" className="truncate">{option.label}</bdi>
                )}
              </li>
            ))}
            {showCreateOption && (
              <li
                ref={createOptionRef}
                role="option"
                tabIndex={enabledOptions.length === 0 ? 0 : -1}
                aria-selected={false}
                onKeyDown={handleCreateOptionKeyDown}
                onClick={triggerCreate}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent",
                  focusRing,
                )}
              >
                <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {createLabel
                    ? formatTemplate(createLabel, { name: query.trim() })
                    : `Create "${query.trim()}"`}
                </span>
              </li>
            )}
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
