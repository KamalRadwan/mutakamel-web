"use client";

import { useRef, useState, type ReactNode } from "react";
import { DragDropContext, type DragStart, type DropResult } from "@hello-pangea/dnd";
import type { NormalizedApiError } from "@/lib/api/errors";
import { Table, TableBody, TableCell, TableRow } from "../../primitives/Table";
import { cn } from "../../lib/cn";
import { useVirtualWindow } from "../../views/useVirtualWindow";
import { EmptyState } from "../empty-state/EmptyState";
import { ErrorState } from "../error-state/ErrorState";
import { Pagination } from "../pagination/Pagination";
import type { ColumnLayoutLabels } from "./ColumnHeaderControls";
import { applyColumnLayout, resolveColumnLayout, type ColumnLayoutState } from "./column-layout";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableReorderBody } from "./DataTableReorderBody";
import { DataTableRow } from "./DataTableRow";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { captureCellWidths, moveRowKey } from "./row-reorder";
import type {
  ColumnDef,
  DataTableLabels,
  PageInfo,
  RowReorderState,
  SelectionState,
  SortState,
} from "./types";

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
  /**
   * Row drag reordering plus its earlier/later controls. Off unless passed.
   * `rows` must be the **unfiltered** list while it is on: `onReorder` reports
   * the whole order, and a searched view is not the order being written.
   */
  rowReorder?: RowReorderState<T>;
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
  rowReorder,
  className,
}: DataTableProps<T>) {
  // Resolved every render rather than stored: the declared column set is the
  // source of truth, and a layout persisted before a column existed must not
  // hide it.
  const layout = columnLayout ? resolveColumnLayout(columns, columnLayout.layout) : undefined;
  const orderedColumns = layout ? applyColumnLayout(columns, layout) : columns;
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const [draggingWidths, setDraggingWidths] = useState<number[] | null>(null);

  const { scrollRef, itemRef, range } = useVirtualWindow({
    count: rows.length,
    // A windowed body renders a slice, so a `<Draggable>` index would not be
    // the row's index in the order being written. Reordering renders the whole
    // body instead — virtualized dragging is the board's problem, solved there
    // with react-window (D9).
    threshold: rowReorder ? Number.POSITIVE_INFINITY : VIRTUALIZE_ABOVE,
    estimatedRowSize: ESTIMATED_ROW_PX,
  });

  const selectedCount = selection ? rows.filter((row) => selection.selectedIds.has(rowKey(row))).length : 0;
  const allSelected = selection !== undefined && rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const hasStickyStart = selection !== undefined || columns.some((column) => column.sticky === "start");
  const hasStickyEnd = columns.some((column) => column.sticky === "end");
  const cellCount =
    orderedColumns.length + (selection ? 1 : 0) + (showRowNumbers ? 1 : 0) + (rowReorder ? 1 : 0);
  const rowIds = rows.map(rowKey);

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

  function handleBeforeDragStart(start: DragStart) {
    setDraggingWidths(captureCellWidths(bodyRef.current, start.draggableId));
  }

  function handleDragEnd(result: DropResult) {
    setDraggingWidths(null);
    if (!rowReorder || !result.destination) return;
    // A drop onto a pinned row's index resolves to null and is dropped here,
    // rather than travelling to a server that answers 422 for it.
    const ordered = moveRowKey(
      rowIds,
      result.source.index,
      result.destination.index,
      rowReorder.isPinned,
    );
    if (ordered) rowReorder.onReorder(ordered);
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

  const sharedRowProps = (row: T, index: number) => {
    const id = rowKey(row);
    return {
      row,
      id,
      columns: orderedColumns,
      labels,
      rowNumber: showRowNumbers ? rowNumber(index) : undefined,
      hasSelection: selection !== undefined,
      isSelected: selection?.selectedIds.has(id) ?? false,
      onToggleRow: toggleRow,
      onRowClick,
      hasStickyStart,
      hasStickyEnd,
    };
  };

  const body = rowReorder ? (
    <DataTableReorderBody
      rows={rows}
      rowKey={rowKey}
      reorder={rowReorder}
      rowProps={sharedRowProps}
      draggingWidths={draggingWidths}
      bodyRef={bodyRef}
      cellCount={cellCount}
    />
  ) : (
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
      {visibleRows.map((row, index) => (
        <DataTableRow
          key={rowKey(row)}
          {...sharedRowProps(row, index)}
          rowRef={index === 0 ? itemRef : undefined}
        />
      ))}
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
  );

  const grid = (
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
            reorderLabel={rowReorder?.dragHandleLabel}
          />
          {body}
        </Table>
      </div>
      {page && onPageChange && (
        <Pagination page={page} onPageChange={onPageChange} labels={labels.pagination} />
      )}
    </div>
  );

  // DragDropContext renders no element of its own, so wrapping the whole grid
  // keeps the table markup legal — and it exists only when a caller asked for
  // reordering, so every other screen renders exactly the tree it always did.
  if (!rowReorder) return grid;

  return (
    <DragDropContext onBeforeDragStart={handleBeforeDragStart} onDragEnd={handleDragEnd}>
      {grid}
    </DragDropContext>
  );
}
