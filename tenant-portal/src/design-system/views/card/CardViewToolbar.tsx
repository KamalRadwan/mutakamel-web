"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "../../primitives/Button";
import { iconSize } from "../../lib/icons";
import { Checkbox } from "../../primitives/Checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select";
import type { SortState } from "../../patterns/data-table/types";
import type { SortOption, WorkspaceViewLabels } from "../types";

export interface CardViewToolbarProps {
  sortOptions: SortOption[];
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll?: () => void;
  labels: WorkspaceViewLabels & { sortBy: string };
}

// The card view is the sortable view, and it has no column headers to click —
// so the sort control is a pair of toolbar controls instead: which field, and
// which direction. The board has no sort axis at all and the table sorts from
// its headers, so this appears in exactly one view and is never duplicated.
// See docs/design/views.md#card-view.
export function CardViewToolbar({
  sortOptions,
  sort,
  onSortChange,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  labels,
}: CardViewToolbarProps) {
  const canSort = onSortChange !== undefined && sortOptions.length > 0;
  if (!canSort && !onToggleSelectAll) return null;

  const activeSortId = sort?.id ?? sortOptions[0]?.id;
  const isAscending = sort?.direction === "asc";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {onToggleSelectAll ? (
        <Checkbox
          checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label={labels.selectAll}
        />
      ) : (
        <span />
      )}

      {canSort && (
        <div className="flex items-center gap-1.5">
          <Select
            value={activeSortId}
            onValueChange={(id) => onSortChange({ id, direction: sort?.direction ?? "asc" })}
          >
            <SelectTrigger size="sm" className="w-44" aria-label={labels.sortBy}>
              <SelectValue placeholder={labels.sortBy} />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              activeSortId !== undefined &&
              onSortChange({ id: activeSortId, direction: isAscending ? "desc" : "asc" })
            }
            aria-label={isAscending ? labels.sortDescending : labels.sortAscending}
          >
            {isAscending ? (
              <ArrowUp className={iconSize({ size: "sm" })} aria-hidden="true" />
            ) : (
              <ArrowDown className={iconSize({ size: "sm" })} aria-hidden="true" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
