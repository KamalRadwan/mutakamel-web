"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { NormalizedApiError } from "@/lib/api/errors";
import { Checkbox } from "../../primitives/Checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../primitives/Table";
import { cn } from "../../lib/cn";
import { EmptyState } from "../empty-state/EmptyState";
import { ErrorState } from "../error-state/ErrorState";
import { Pagination } from "../pagination/Pagination";
import { DataTableSkeleton } from "./DataTableSkeleton";
import type { ColumnDef, PageInfo, SelectionState, SortState } from "./types";

export interface DataTableLabels {
  retry: string;
  errorTitle: string;
  emptyTitle: string;
  selectAll: string;
  selectRow: string;
  sortAscending: string;
  sortDescending: string;
  notSorted: string;
  pagination: {
    previous: string;
    next: string;
    summary: (from: number, to: number, total: number) => string;
  };
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  page: PageInfo;
  onPageChange: (page: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selection?: SelectionState;
  emptyState?: React.ReactNode;
  labels: DataTableLabels;
  className?: string;
}

// The table view for all three CRM workspaces. Owns 36px rows, the sticky
// header, zebra rows, server pagination/sorting, selection, keyboard
// navigation and the loading/empty/error states — no screen re-implements
// any of these. See docs/design/patterns.md#datatable.
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
  className,
}: DataTableProps<T>) {
  const selectedCount = selection ? rows.filter((row) => selection.selectedIds.has(rowKey(row))).length : 0;
  const allSelected = selection !== undefined && rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && !allSelected;

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
    const nextDirection = sort?.id === column.id && sort.direction === "asc" ? "desc" : "asc";
    onSortChange({ id: column.id, direction: nextDirection });
  }

  if (isLoading) {
    return (
      <div className={cn("overflow-x-auto", className)}>
        <DataTableSkeleton columns={columns} />
      </div>
    );
  }

  if (error) {
    return <ErrorState title={labels.errorTitle} onRetry={onRetry} retryLabel={labels.retry} className={className} />;
  }

  if (rows.length === 0) {
    return emptyState ?? <EmptyState title={labels.emptyTitle} className={className} />;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Horizontal overflow lives inside this container — the page itself
          never scrolls sideways. */}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-(--z-sticky-header)">
            <TableRow className="odd:bg-transparent hover:bg-transparent">
              {selection && (
                <TableHead className="w-8">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label={labels.selectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => {
                const isSorted = sort?.id === column.id;
                const SortIcon = isSorted ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                const sortAriaLabel = isSorted
                  ? sort!.direction === "asc"
                    ? labels.sortDescending
                    : labels.sortAscending
                  : labels.notSorted;

                return (
                  <TableHead
                    key={column.id}
                    style={{ width: column.width }}
                    className={cn(
                      column.align === "end" && "text-end",
                      column.sticky === "start" && "sticky start-0 z-(--z-sticky-header) bg-card",
                      column.sticky === "end" && "sticky end-0 z-(--z-sticky-header) bg-card",
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        aria-label={`${column.header} — ${sortAriaLabel}`}
                      >
                        {column.header}
                        <SortIcon className="size-3" aria-hidden="true" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = rowKey(row);
              const isSelected = selection?.selectedIds.has(id) ?? false;

              return (
                <TableRow
                  key={id}
                  data-state={isSelected ? "selected" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  className={cn(onRowClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
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
                  {columns.map((column) => (
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
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} onPageChange={onPageChange} labels={labels.pagination} />
    </div>
  );
}
