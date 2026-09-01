"use client";

import type { ReactNode } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import { Checkbox } from "../../primitives/Checkbox";
import { Table, TableBody, TableCell, TableRow } from "../../primitives/Table";
import { cn } from "../../lib/cn";
import { useVirtualWindow } from "../../views/useVirtualWindow";
import { EmptyState } from "../empty-state/EmptyState";
import { ErrorState } from "../error-state/ErrorState";
import { Pagination } from "../pagination/Pagination";
import type { ColumnLayoutLabels } from "./ColumnHeaderControls";
import { applyColumnLayout, resolveColumnLayout, type ColumnLayoutState } from "./column-layout";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableSkeleton } from "./DataTableSkeleton";
import type { ColumnDef, DataTableLabels, PageInfo, SelectionState, SortState } from "./types";

// Above this many rows the body renders a window plus two spacer rows instead
// of the whole page — task 2.9. Rows are uniform by construction, so the
// window is exact. The estimate is --size-row at the DEFAULT --ui-scale —
// density is user-selectable, so this constant is right for standard and wrong
// for the other two; one laid-out row replaces it immediately either way.
//
// 44, not 32. It tracked the old compact default (2.25rem x 0.9 = 32.4px) and
// went stale when the admin geometry port made standard the default and the row
// 2.75rem. It then matched no density at all — compact 39.6, standard 44,
// comfortable 48.4 — and was short by 37%, which is a visible scroll-height
// jump on the first frame of a 100+ row table rather than a rounding error.
const VIRTUALIZE_ABOVE = 100;
const ESTIMATED_ROW_PX = 44;

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selection?: SelectionState;
  emptyState?: ReactNode;
  labels: DataTableLabels;
  /**
   * Column order and widths, owned by the caller so they can be persisted per
   * user. Omit and the table renders its declared columns, unchanged.
   */
  columnLayout?: ColumnLayoutState;
  /** Required whenever `columnLayout` is passed; the controls are unusable unnamed. */
  layoutLabels?: ColumnLayoutLabels;
  /**
   * Leading ordinal column. Numbering is continuous across pages — row 1 of
   * page 2 at a limit of 20 reads 21 — so the value identifies a record within
   * the whole result set, not just the visible page. Opt out for nested or
   * detail tables where an ordinal carries no meaning.
   */
  showRowNumbers?: boolean;
  className?: string;
}

// The table view for all three CRM workspaces. Owns the row height, the
// sticky header, zebra rows, server pagination/sorting, selection, keyboard
// navigation and the loading/empty/error states — no screen re-implements any
// of these. Feature code reaches it through TableView, which adapts it to the
// shared view contract. See docs/design/patterns.md#datatable.
export function DataTable<T>({
  columns,
  rows,
  isLoading,
  error,
  onRetry,
  page,
  onPageChange,
  sort,
  onSortChange,
  rowKey,
  onRowClick,
  selection,
  emptyState,
  labels,
  columnLayout,
  layoutLabels,
  showRowNumbers = true,
  className,
}: DataTableProps<T>) {
  // Resolved every render rather than stored: the declared column set is the
  // source of truth, and a layout persisted before a column existed must not
  // hide it.
  const layout = columnLayout ? resolveColumnLayout(columns, columnLayout.layout) : undefined;
  const orderedColumns = layout ? applyColumnLayout(columns, layout) : columns;

  const { scrollRef, itemRef, range } = useVirtualWindow({
    count: rows.length,
    threshold: VIRTUALIZE_ABOVE,
    estimatedRowSize: ESTIMATED_ROW_PX,
  });

  const selectedCount = selection ? rows.filter((row) => selection.selectedIds.has(rowKey(row))).length : 0;
  const allSelected = selection !== undefined && rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const hasStickyStart = selection !== undefined || columns.some((column) => column.sticky === "start");
  const hasStickyEnd = columns.some((column) => column.sticky === "end");
  const cellCount = orderedColumns.length + (selection ? 1 : 0) + (showRowNumbers ? 1 : 0);

  // Continuous across pages, so the ordinal identifies a record in the whole
  // result set rather than repeating 1..limit on every page. The windowed body
  // renders a slice, so the absolute index carries the window offset too.
  const pageOffset = page ? (Math.max(1, page.page) - 1) * page.limit : 0;
  const rowNumber = (index: number) => pageOffset + (range ? range.start : 0) + index + 1;

  function toggleSelectAll() {
    if (!selection) return;
    if (allSelected) {
      selection.onSelectionChange(new Set());
    } else {
      selection.onSelectionChange(new Set(rows.map(rowKey)));
    }
  }

  function toggleRow(id: string) {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onSelectionChange(next);
  }

  function handleSort(column: ColumnDef<T>) {
    if (!column.sortable || !onSortChange) return;
    const field = column.sortField ?? column.id;
    const nextDirection = sort?.id === field && sort.direction === "asc" ? "desc" : "asc";
    onSortChange({ id: field, direction: nextDirection });
  }

  if (isLoading) {
    return (
      <div className={cn("overflow-x-auto", className)}>
        <DataTableSkeleton columns={orderedColumns} />
      </div>
    );
  }

  if (error) {
    return <ErrorState title={labels.errorTitle} onRetry={onRetry} retryLabel={labels.retry} className={className} />;
  }

  if (rows.length === 0) {
    return emptyState ?? <EmptyState title={labels.emptyTitle} className={className} />;
  }

  const visibleRows = range ? rows.slice(range.start, range.end) : rows;

  return (
    <div className={cn("flex flex-col gap-3", range && "h-full min-h-0", className)}>
      {/* Horizontal overflow lives inside this container — the page itself
          never scrolls sideways. When the body is windowed this container also
          owns the vertical scroll, which is what finally gives the sticky
          header something to stick to. */}
      <div
        ref={scrollRef}
        className={cn("overflow-x-auto rounded-md border border-border", range && "min-h-0 flex-1 overflow-y-auto")}
      >
        <Table>
          <DataTableHeader
            columns={orderedColumns}
            sort={sort}
            onSort={handleSort}
            hasSelection={selection !== undefined}
            showRowNumbers={showRowNumbers}
            selectAllState={allSelected ? true : someSelected ? "indeterminate" : false}
            onToggleSelectAll={toggleSelectAll}
            layout={layout}
            columnLayout={columnLayout}
            layoutLabels={layoutLabels}
            labels={labels}
          />
          <TableBody>
            {range && range.paddingStart > 0 && (
              <TableRow
                aria-hidden="true"
                className="border-b-0 odd:bg-transparent hover:bg-transparent"
                style={{ height: range.paddingStart }}
              >
                <TableCell colSpan={cellCount} className="p-0" />
              </TableRow>
            )}
            {visibleRows.map((row, index) => {
              const id = rowKey(row);
              const isSelected = selection?.selectedIds.has(id) ?? false;

              return (
                <TableRow
                  key={id}
                  ref={index === 0 ? itemRef : undefined}
                  data-state={isSelected ? "selected" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  // Four sticky layers overlap this grid. Without a scroll
                  // margin, tabbing into a row lands the focus ring behind the
                  // sticky header or a sticky column with no visual indication
                  // at all — WCAG 2.2 AA focus-not-obscured.
                  className={cn(
                    "scroll-mt-(--size-row)",
                    hasStickyStart && "scroll-ms-16",
                    hasStickyEnd && "scroll-me-16",
                    onRowClick &&
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  )}
                >
                  {selection && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label={labels.selectRow}
                      />
                    </TableCell>
                  )}
                  {showRowNumbers && (
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {rowNumber(index)}
                    </TableCell>
                  )}
                  {orderedColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        (column.numeric || column.align === "end") && "text-end tabular-nums font-mono",
                        column.sticky === "start" && "sticky start-0 z-(--z-sticky-cell) bg-inherit",
                        column.sticky === "end" && "sticky end-0 z-(--z-sticky-cell) bg-inherit",
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {range && range.paddingEnd > 0 && (
              <TableRow
                aria-hidden="true"
                className="border-b-0 odd:bg-transparent hover:bg-transparent"
                style={{ height: range.paddingEnd }}
              >
                <TableCell colSpan={cellCount} className="p-0" />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {page && onPageChange && (
        <Pagination page={page} onPageChange={onPageChange} labels={labels.pagination} />
      )}
    </div>
  );
}
