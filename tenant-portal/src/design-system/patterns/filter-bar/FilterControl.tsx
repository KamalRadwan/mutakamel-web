"use client";

import { cn } from "../../lib/cn";
import { DateRangePicker } from "../../primitives/DateRangePicker";
import { Input } from "../../primitives/Input";
import { Label } from "../../primitives/Label";
import { MultiSelect } from "../../primitives/MultiSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select";
import { Switch } from "../../primitives/Switch";
import { normalizeFilterValue, type FilterDef, type FilterValue } from "./filter-types";

interface FilterControlProps {
  filter: FilterDef;
  value: FilterValue | undefined;
  onValueChange: (next: FilterValue | undefined) => void;
  className?: string;
}

// A date range is stored as an ISO string so it survives the URL round-trip,
// and DateRangePicker works in Date objects. These two functions are the only
// place the conversion happens.
function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIso(date: Date | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

/** One filter control, chosen by `filter.kind`. Renders nothing of its own chrome. */
export function FilterControl({ filter, value, onValueChange, className }: FilterControlProps) {
  function commit(next: FilterValue | undefined) {
    onValueChange(normalizeFilterValue(next));
  }

  switch (filter.kind) {
    case "select":
      return (
        <Select
          value={value?.kind === "select" ? value.value : ""}
          onValueChange={(next) => commit(next ? { kind: "select", value: next } : undefined)}
        >
          <SelectTrigger size="sm" className={cn("w-40", className)} aria-label={filter.label}>
            <SelectValue placeholder={filter.placeholder ?? filter.label} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiSelect":
      return (
        <MultiSelect
          size="sm"
          className={cn("w-56", className)}
          values={value?.kind === "multiSelect" ? value.values : []}
          onValuesChange={(next) => commit({ kind: "multiSelect", values: next })}
          options={filter.options}
          placeholder={filter.label}
          {...filter.labels}
        />
      );

    case "dateRange":
      return (
        <DateRangePicker
          size="sm"
          className={cn("w-56", className)}
          placeholder={filter.label}
          presetLabels={filter.presetLabels}
          clearLabel={filter.clearLabel}
          value={
            value?.kind === "dateRange"
              ? { from: toDate(value.from), to: toDate(value.to) }
              : undefined
          }
          onValueChange={(next) =>
            commit(next ? { kind: "dateRange", from: toIso(next.from), to: toIso(next.to) } : undefined)
          }
        />
      );

    case "numericRange": {
      const current = value?.kind === "numericRange" ? value : undefined;
      return (
        // Two inputs, not a Slider: a bound the user must type exactly (an
        // invoice total, a seat count) cannot be reached reliably by dragging,
        // and the value is a decimal string that a slider would coerce.
        <div className={cn("flex items-center gap-1", className)}>
          <Input
            size="sm"
            type="number"
            inputMode="decimal"
            step={filter.step}
            aria-label={filter.minLabel}
            placeholder={filter.minLabel}
            value={current?.min ?? ""}
            onChange={(event) =>
              commit({ kind: "numericRange", min: event.target.value || undefined, max: current?.max })
            }
            className="w-24"
          />
          <span aria-hidden="true" className="text-xs text-muted-foreground">
            –
          </span>
          <Input
            size="sm"
            type="number"
            inputMode="decimal"
            step={filter.step}
            aria-label={filter.maxLabel}
            placeholder={filter.maxLabel}
            value={current?.max ?? ""}
            onChange={(event) =>
              commit({ kind: "numericRange", min: current?.min, max: event.target.value || undefined })
            }
            className="w-24"
          />
        </div>
      );
    }

    case "boolean": {
      const checked = value?.kind === "boolean" ? value.value : false;
      const id = `filter-${filter.id}`;
      return (
        <div className={cn("flex h-(--size-control-sm) items-center gap-2", className)}>
          <Switch
            id={id}
            checked={checked}
            onCheckedChange={(next) => commit(next ? { kind: "boolean", value: true } : undefined)}
          />
          <Label htmlFor={id} className="cursor-pointer text-xs font-normal whitespace-nowrap">
            {checked ? filter.trueLabel : filter.label}
          </Label>
        </div>
      );
    }
  }
}
