"use client";

import type { CSSProperties, Ref } from "react";
import type {
  DraggableProvidedDraggableProps,
  DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { Checkbox } from "../../primitives/Checkbox";
import { TableCell, TableRow } from "../../primitives/Table";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/variants";
import { iconSize } from "../../lib/icons";
import type { ColumnDef, DataTableLabels } from "./types";

/** Everything the handle cell of one reorderable row needs, already resolved. */
interface RowHandle {
  /** `null` whenever this row cannot be dragged — a pinned row, or a pending write. */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  gripLabel: string;
}

export interface DataTableRowProps<T> {
  row: T;
  id: string;
  columns: ColumnDef<T>[];
  labels: DataTableLabels;
  /** Omitted when the caller turned the ordinal column off. */
  rowNumber?: number;
  hasSelection: boolean;
  isSelected: boolean;
  onToggleRow: (id: string) => void;
  onRowClick?: (row: T) => void;
  hasStickyStart: boolean;
  hasStickyEnd: boolean;
  handle?: RowHandle;
  rowRef?: Ref<HTMLTableRowElement>;
  draggableProps?: DraggableProvidedDraggableProps;
  /**
   * Cell widths captured at lift, in render order.
   *
   * A lifted `<tr>` is `position: fixed`: it keeps its own width but loses the
   * table that distributed that width across its cells, so every column
   * re-sizes to its content mid-drag unless the widths are pinned back on.
   */
  cellWidths?: number[];
}

/**
 * One body row, split out of `DataTable` when row reordering arrived — the same
 * seam `DataTableHeader` was cut on, and for the same reason: a `<Draggable>`
 * wraps its child in a render prop, and inlining that around this much markup
 * put the file over the ~300-line rule twice over.
 */
export function DataTableRow<T>({
  row,
  id,
  columns,
  labels,
  rowNumber,
  hasSelection,
  isSelected,
  onToggleRow,
  onRowClick,
  hasStickyStart,
  hasStickyEnd,
  handle,
  rowRef,
  draggableProps,
  cellWidths,
}: DataTableRowProps<T>) {
  const leadingCells = (handle ? 1 : 0) + (hasSelection ? 1 : 0) + (rowNumber === undefined ? 0 : 1);
  const lockedWidth = (index: number): CSSProperties | undefined => {
    const width = cellWidths?.[index];
    return width ? { width, minWidth: width, maxWidth: width } : undefined;
  };

  return (
    <TableRow
      ref={rowRef}
      data-row-id={id}
      data-state={isSelected ? "selected" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={() => onRowClick?.(row)}
      onKeyDown={(event) => {
        if (onRowClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onRowClick(row);
        }
      }}
      {...draggableProps}
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
      {handle && (
        <TableCell
          style={lockedWidth(0)}
          className="px-2 py-0"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center">
            {/* The grip carries both pointer and keyboard dragging — the
                library's keyboard path (space to lift, arrows to move, space to
                drop) rides on `dragHandleProps`, so it must stay on the
                activation surface. A row that cannot be dragged keeps a dimmed,
                inert grip rather than an empty cell: the column has to stay the
                same width, and a control that is gone reads as a rendering bug
                where a disabled one reads as a rule. */}
            {handle.dragHandleProps ? (
              <span
                {...handle.dragHandleProps}
                aria-label={handle.gripLabel}
                className={cn(
                  "inline-flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground",
                  focusRing,
                )}
              >
                <GripVertical className={iconSize({ size: "lg" })} aria-hidden="true" />
              </span>
            ) : (
              <span className="inline-flex size-6 items-center justify-center text-muted-foreground opacity-50">
                <GripVertical className={iconSize({ size: "lg" })} aria-hidden="true" />
              </span>
            )}
          </div>
        </TableCell>
      )}
      {hasSelection && (
        <TableCell
          style={lockedWidth(handle ? 1 : 0)}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleRow(id)}
            aria-label={labels.selectRow}
          />
        </TableCell>
      )}
      {rowNumber !== undefined && (
        <TableCell
          style={lockedWidth(leadingCells - 1)}
          className="text-xs tabular-nums text-muted-foreground"
        >
          {rowNumber}
        </TableCell>
      )}
      {columns.map((column, index) => (
        <TableCell
          key={column.id}
          style={lockedWidth(leadingCells + index)}
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
}
