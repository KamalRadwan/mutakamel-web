"use client";

import { useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "@/i18n/useLanguage";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Badge } from "../../primitives/Badge";
import { Button } from "../../primitives/Button";
import { DATE_TIME_OPTIONS } from "../../primitives/DateTime";
import { Input } from "../../primitives/Input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/Popover";
import { INTL_LOCALE } from "@/lib/format/locale";
import { FilterControl } from "./FilterControl";
import { PageActions } from "../../shell/PageActions";
import { describeFilters, type FilterChipDescriptor, type FilterDef, type FilterValues } from "./filter-types";

export * from "./filter-types";

export interface FilterBarProps {
  filters: FilterDef[];
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  onReset: () => void;
  searchValue: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filtersLabel?: string;
  clearAllLabel?: string;
  /** Template for the chip-overflow trigger, e.g. `"+{count}"`. */
  moreChipsLabel?: string;
  /** Accessible name for the popover holding the overflowed chips. */
  overflowChipsLabel?: string;
  /** Template for a chip's remove control, e.g. `"Remove {label}"`. */
  removeChipLabel?: string;
  /**
   * Chips shown inline before the rest collapse behind the overflow button.
   *
   * A **count**, not a row count. `patterns.md` originally said "past two
   * rows"; a row count cannot be known without measuring every chip's
   * `offsetTop` after layout, which means all the chips paint first and then
   * visibly collapse on every filter change and every resize. Six is roughly
   * two rows at the widths this bar renders at, and it is deterministic.
   */
  maxVisibleChips?: number;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_MAX_VISIBLE_CHIPS = 6;
const RANGE_SEPARATOR = " – ";

// Filter state lives in the URL — this component only calls back; the
// workspace hook owns writing to it. Search debounces here so the URL isn't
// touched on every keystroke — docs/design/patterns.md#filterbar.
export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filtersLabel,
  clearAllLabel,
  moreChipsLabel = "+{count}",
  overflowChipsLabel,
  removeChipLabel = "{label}",
  maxVisibleChips = DEFAULT_MAX_VISIBLE_CHIPS,
  className,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  // Tracks the prop so an external reset (e.g. "Clear all") can resync the
  // input during render, without the setState-in-effect anti-pattern — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [syncedSearchValue, setSyncedSearchValue] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Formatting, not copy — the same allowance Calendar, Money and DateTime
  // take. No dictionary is read here.
  const lang = useLanguage();

  if (searchValue !== syncedSearchValue) {
    setSyncedSearchValue(searchValue);
    setLocalSearch(searchValue);
  }

  function handleSearchInput(next: string) {
    setLocalSearch(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(next), SEARCH_DEBOUNCE_MS);
  }

  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALE[lang], DATE_TIME_OPTIONS.date);
  const chips = describeFilters(filters, values, {
    dateRange: (from, to) =>
      [from, to]
        .filter((value): value is string => Boolean(value))
        .map((value) => {
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
        })
        .join(RANGE_SEPARATOR),
    numericRange: (min, max) =>
      [min, max]
        .filter((value): value is string => Boolean(value))
        .map((value) => formatDecimalString(value, lang))
        .join(RANGE_SEPARATOR),
  });

  const visibleChips = chips.slice(0, maxVisibleChips);
  const overflowChips = chips.slice(maxVisibleChips);

  function applyChipRemoval(chip: FilterChipDescriptor) {
    onChange({ ...values, [chip.filterId]: chip.nextValue });
  }

  function renderChip(chip: FilterChipDescriptor) {
    return (
      <Badge key={chip.key} tone="neutral" className="max-w-64 gap-0.5 pe-0.5">
        {/* Chips wrap before they shrink and never truncate their label — a
            "Acquisition so…" chip tells the user nothing about what is
            filtering their data. See docs/design/patterns.md#filterbar. */}
        <span>{chip.text}</span>
        <Button
          variant="ghost"
          size="xs"
          aria-label={formatTemplate(removeChipLabel, { label: chip.text })}
          onClick={() => applyChipRemoval(chip)}
          className="size-4 shrink-0 cursor-pointer rounded-xs p-0!"
        >
          <X className={iconSize({ size: "xs" })} aria-hidden="true" />
        </Button>
      </Badge>
    );
  }

  function renderFilterControl(filter: FilterDef) {
    return (
      <FilterControl
        key={filter.id}
        filter={filter}
        value={values[filter.id]}
        onValueChange={(next) => onChange({ ...values, [filter.id]: next })}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* The controls go up into the page action bar; the chips stay here.
          That is the split the bar makes natural: the bar is where you ASK a
          question of the data, the body is where the answer's current
          conditions are listed and removed. Chips also wrap onto a second line
          by design, which a 45px bar has nowhere to put. */}
      <PageActions slot="search">
        <div className="relative w-60">
          <Search
            className={cn(
              iconSize({ size: "md" }),
              "pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <Input
            size="sm"
            value={localSearch}
            onChange={(event) => handleSearchInput(event.target.value)}
            placeholder={searchPlaceholder}
            className="ps-8"
          />
        </div>

        {/* One shape at every width now. The filters used to render inline
            from `lg` up and collapse into this popover below it, which made the
            toolbar a different width on every screen and every viewport — fine
            when it owned a full row of its own, unworkable in a bar it shares
            with the screen's actions and its view switcher. The popover also
            gives the filters a 288px column instead of a squeezed row. */}
        {filters.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <SlidersHorizontal className={iconSize({ size: "md" })} aria-hidden="true" />
                {filtersLabel}
                {chips.length > 0 && (
                  <Badge tone="brand" className="ms-1">
                    {chips.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-72 flex-col gap-2">
              {filters.map(renderFilterControl)}
            </PopoverContent>
          </Popover>
        )}
      </PageActions>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleChips.map(renderChip)}

          {/* The overflow is a BUTTON opening a popover of still-removable
              chips, never a static "+3". A static count hides filter state the
              user is entitled to change. */}
          {overflowChips.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="xs" className="cursor-pointer rounded-sm">
                  {formatTemplate(moreChipsLabel, { count: overflowChips.length })}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-2">
                {overflowChipsLabel && (
                  <p className="pb-1.5 text-xs text-muted-foreground">{overflowChipsLabel}</p>
                )}
                <div className="flex flex-wrap gap-1">{overflowChips.map(renderChip)}</div>
              </PopoverContent>
            </Popover>
          )}

          <Button variant="link" size="sm" onClick={onReset} className="cursor-pointer text-xs">
            {clearAllLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
