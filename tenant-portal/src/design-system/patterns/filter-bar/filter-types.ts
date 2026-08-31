import type { DateRangePresetLabels } from "../../primitives/DateRangePicker";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Filter state, shaped so it round-trips through the URL without loss.
 *
 * Every leaf is a **string**, not a `Date` or a `number`. Filter state lives in
 * the query string (docs/design/patterns.md#filterbar), a decimal bound must
 * not be `Number()`d, and an ISO date must survive a copy-pasted link exactly
 * as it was written.
 */
export type FilterValue =
  | { kind: "select"; value: string }
  | { kind: "multiSelect"; values: string[] }
  /** ISO 8601 date-times, preserved verbatim. */
  | { kind: "dateRange"; from?: string; to?: string }
  /** Decimal strings, preserved verbatim. */
  | { kind: "numericRange"; min?: string; max?: string }
  | { kind: "boolean"; value: boolean };

export type FilterValues = Record<string, FilterValue | undefined>;

interface FilterDefBase {
  id: string;
  /** Already translated. */
  label: string;
}

export interface SelectFilterDef extends FilterDefBase {
  kind: "select";
  options: FilterOption[];
  placeholder?: string;
}

export interface MultiSelectFilterDef extends FilterDefBase {
  kind: "multiSelect";
  options: FilterOption[];
  labels: {
    emptyLabel: string;
    searchPlaceholder?: string;
    /** Template, e.g. `"+{count}"`. */
    moreLabel: string;
    /** Template, e.g. `"Remove {label}"`. */
    removeLabel: string;
    overflowLabel: string;
    clearAllLabel?: string;
  };
}

export interface DateRangeFilterDef extends FilterDefBase {
  kind: "dateRange";
  presetLabels: DateRangePresetLabels;
  clearLabel?: string;
}

export interface NumericRangeFilterDef extends FilterDefBase {
  kind: "numericRange";
  minLabel: string;
  maxLabel: string;
  /** Passed to the inputs; a currency filter wants `"0.01"`, a count wants `"1"`. */
  step?: string;
}

export interface BooleanFilterDef extends FilterDefBase {
  kind: "boolean";
  trueLabel: string;
  falseLabel: string;
}

export type FilterDef =
  | SelectFilterDef
  | MultiSelectFilterDef
  | DateRangeFilterDef
  | NumericRangeFilterDef
  | BooleanFilterDef;

/** One removable chip. A multi-select contributes one chip **per value**. */
export interface FilterChipDescriptor {
  key: string;
  filterId: string;
  /** Already composed as `"{label}: {value}"`. */
  text: string;
  /** What this filter becomes once the chip is removed; `undefined` clears it. */
  nextValue: FilterValue | undefined;
}

export interface ChipFormatters {
  /** Both bounds already formatted through `Intl` by the caller. */
  dateRange: (from?: string, to?: string) => string;
  numericRange: (min?: string, max?: string) => string;
}

function optionLabel(options: FilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * Projects filter state into chips.
 *
 * Pure and formatter-injected so it is testable without a locale, and so the
 * component never has to decide how a date or a decimal is written.
 */
export function describeFilters(
  filters: FilterDef[],
  values: FilterValues,
  format: ChipFormatters,
): FilterChipDescriptor[] {
  const chips: FilterChipDescriptor[] = [];

  for (const filter of filters) {
    const value = values[filter.id];
    if (!value || value.kind !== filter.kind) continue;

    switch (value.kind) {
      case "select": {
        if (!value.value) break;
        chips.push({
          key: filter.id,
          filterId: filter.id,
          text: `${filter.label}: ${optionLabel((filter as SelectFilterDef).options, value.value)}`,
          nextValue: undefined,
        });
        break;
      }
      case "multiSelect": {
        // One chip per selected value. A single chip listing five stages can
        // only be removed as a block, which is not what the user is asking to
        // do when they click the X on "Qualified".
        for (const selected of value.values) {
          chips.push({
            key: `${filter.id}:${selected}`,
            filterId: filter.id,
            text: `${filter.label}: ${optionLabel((filter as MultiSelectFilterDef).options, selected)}`,
            nextValue: {
              kind: "multiSelect",
              values: value.values.filter((candidate) => candidate !== selected),
            },
          });
        }
        break;
      }
      case "dateRange": {
        if (!value.from && !value.to) break;
        chips.push({
          key: filter.id,
          filterId: filter.id,
          text: `${filter.label}: ${format.dateRange(value.from, value.to)}`,
          nextValue: undefined,
        });
        break;
      }
      case "numericRange": {
        if (!value.min && !value.max) break;
        chips.push({
          key: filter.id,
          filterId: filter.id,
          text: `${filter.label}: ${format.numericRange(value.min, value.max)}`,
          nextValue: undefined,
        });
        break;
      }
      case "boolean": {
        const def = filter as BooleanFilterDef;
        chips.push({
          key: filter.id,
          filterId: filter.id,
          text: `${filter.label}: ${value.value ? def.trueLabel : def.falseLabel}`,
          nextValue: undefined,
        });
        break;
      }
    }
  }

  return chips;
}

/** A multi-select whose last value was just removed clears rather than lingering as an empty chip-less filter. */
export function normalizeFilterValue(value: FilterValue | undefined): FilterValue | undefined {
  if (!value) return undefined;
  if (value.kind === "multiSelect" && value.values.length === 0) return undefined;
  if (value.kind === "select" && !value.value) return undefined;
  if (value.kind === "dateRange" && !value.from && !value.to) return undefined;
  if (value.kind === "numericRange" && !value.min && !value.max) return undefined;
  return value;
}
