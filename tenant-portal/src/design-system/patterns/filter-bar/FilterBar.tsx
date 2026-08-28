import { useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "../../primitives/Badge";
import { Button } from "../../primitives/Button";
import { Input } from "../../primitives/Input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  options: FilterOption[];
}

export interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string | undefined>;
  onChange: (next: Record<string, string | undefined>) => void;
  onReset: () => void;
  searchValue: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filtersLabel?: string;
  clearAllLabel?: string;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

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
  className,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  // Tracks the prop so an external reset (e.g. "Clear all") can resync the
  // input during render, without the setState-in-effect anti-pattern — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [syncedSearchValue, setSyncedSearchValue] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (searchValue !== syncedSearchValue) {
    setSyncedSearchValue(searchValue);
    setLocalSearch(searchValue);
  }

  function handleSearchInput(next: string) {
    setLocalSearch(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(next), SEARCH_DEBOUNCE_MS);
  }

  const activeFilters = filters
    .map((filter) => ({ filter, value: values[filter.id] }))
    .filter((entry): entry is { filter: FilterDef; value: string } => Boolean(entry.value));

  function clearFilter(id: string) {
    onChange({ ...values, [id]: undefined });
  }

  function renderFilterControl(filter: FilterDef) {
    return (
      <Select
        key={filter.id}
        value={values[filter.id] ?? ""}
        onValueChange={(next) => onChange({ ...values, [filter.id]: next || undefined })}
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder={filter.label} />
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
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-60">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
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

        {/* Inline at lg and above */}
        <div className="hidden items-center gap-2 lg:flex">{filters.map(renderFilterControl)}</div>

        {/* Collapsed behind a trigger below lg */}
        {filters.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                {filtersLabel}
                {activeFilters.length > 0 && (
                  <Badge tone="brand" className="ms-1">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-64 flex-col gap-2">
              {filters.map(renderFilterControl)}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map(({ filter, value }) => {
            const option = filter.options.find((candidate) => candidate.value === value);
            return (
              <Badge key={filter.id} tone="neutral" className="gap-1 pe-1">
                {filter.label}: {option?.label ?? value}
                <button
                  type="button"
                  onClick={() => clearFilter(filter.id)}
                  aria-label={`${filter.label}: ${option?.label ?? value}`}
                  className="rounded-xs hover:text-foreground"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            );
          })}
          <Button variant="link" size="sm" onClick={onReset} className="text-xs">
            {clearAllLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
