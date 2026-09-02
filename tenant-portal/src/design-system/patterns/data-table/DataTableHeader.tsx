"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useDictionary } from "@/i18n/useLanguage";
import { cn } from "../../lib/cn";
import { Checkbox } from "../../primitives/Checkbox";
import { TableHead, TableHeader, TableRow } from "../../primitives/Table";
import { ColumnHeaderControls, type ColumnLayoutLabels } from "./ColumnHeaderControls";
import {
  columnWidth,
  moveColumn,
  setColumnWidth,
  type ColumnLayout,
  type ColumnLayoutState,
} from "./column-layout";
import type { ColumnDef, DataTableLabels, SortState } from "./types";

/** Width a resize handle reports before the column has ever been sized. */
const FALLBACK_COLUMN_WIDTH = 160;

interface DataTableHeaderProps<T> {
  columns: ColumnDef<T>[];
  sort?: SortState;
  onSort: (column: ColumnDef<T>) => void;
  selectAllState: boolean | "indeterminate";
  onToggleSelectAll?: () => void;
  hasSelection: boolean;
  showRowNumbers?: boolean;
  layout?: ColumnLayout;
  columnLayout?: ColumnLayoutState;
  layoutLabels?: ColumnLayoutLabels;
  labels: DataTableLabels;
}

/**
 * The sticky header row, split out of `DataTable` when column resize and
 * reorder (task 1.49) pushed that file past the ~300-line rule.
 *
 * It is the natural seam: everything here is about the header — sorting,
 * select-all, sticky offsets, and the layout controls — and nothing here knows
 * about rows, pagination or the empty states.
 */
export function DataTableHeader<T>({
  columns,
  sort,
  onSort,
  selectAllState,
  onToggleSelectAll,
  hasSelection,
  showRowNumbers = false,
  layout,
  columnLayout,
  layoutLabels,
  labels,
}: DataTableHeaderProps<T>) {
  const t = useDictionary();

  return (
    <TableHeader className="sticky top-0 z-(--z-sticky-header)">
      <TableRow className="odd:bg-transparent hover:bg-transparent">
        {hasSelection && (
          <TableHead className="w-8">
            <Checkbox
              checked={selectAllState}
              onCheckedChange={onToggleSelectAll}
              aria-label={labels.selectAll}
            />
          </TableHead>
        )}
        {showRowNumbers && (
          <TableHead
            scope="col"
            className="w-10 text-muted-foreground"
            // Defaulted through the dictionary, never through English: about 70
            // Table and DataTable views pass neither key.
            title={labels.rowNumber ?? t.common.rowNumber}
          >
            {labels.rowNumberShort ?? t.common.rowNumberShort}
          </TableHead>
        )}
        {columns.map((column) => {
          const isSorted = sort?.id === (column.sortField ?? column.id);
          const layoutIndex = layout ? layout.order.indexOf(column.id) : -1;
          const showLayoutControls = Boolean(columnLayout && layoutLabels && layoutIndex >= 0);
          const SortIcon = isSorted ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
          const sortAriaLabel = isSorted
            ? sort!.direction === "asc"
              ? labels.sortDescending
              : labels.sortAscending
            : labels.notSorted;

          return (
            <TableHead
              key={column.id}
              style={{ width: layout ? columnWidth(column, layout) : column.width }}
              // aria-sort is the only signal a screen-reader user gets about
              // which column is sorted and which way — the arrow is purely
              // visual. Exactly one column ever carries a value other than
              // "none".
              aria-sort={
                column.sortable
                  ? isSorted
                    ? sort!.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined
              }
              className={cn(
                column.align === "end" && "text-end",
                column.sticky === "start" && "sticky start-0 z-(--z-sticky-header) bg-card",
                column.sticky === "end" && "sticky end-0 z-(--z-sticky-header) bg-card",
              )}
            >
              {column.sortable ? (
                <button
                  type="button"
                  onClick={() => onSort(column)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  aria-label={`${column.header} — ${sortAriaLabel}`}
                >
                  {column.header}
                  <SortIcon className="size-3" aria-hidden="true" />
                </button>
              ) : (
                column.header
              )}
              {showLayoutControls && columnLayout && layout && layoutLabels && (
                <ColumnHeaderControls
                  header={column.header}
                  width={layout.widths[column.id] ?? FALLBACK_COLUMN_WIDTH}
                  canMoveEarlier={layoutIndex > 0}
                  canMoveLater={layoutIndex < layout.order.length - 1}
                  onMove={(delta) =>
                    columnLayout.onLayoutChange({
                      ...layout,
                      order: moveColumn(layout.order, column.id, delta),
                    })
                  }
                  onResize={(width) =>
                    columnLayout.onLayoutChange({
                      ...layout,
                      widths: setColumnWidth(layout.widths, column.id, width),
                    })
                  }
                  labels={layoutLabels}
                />
              )}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}
