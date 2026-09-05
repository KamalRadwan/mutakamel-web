"use client";

import type { MutableRefObject } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { TableBody, TableCell, TableRow } from "../../primitives/Table";
import { DataTableRow, type DataTableRowProps } from "./DataTableRow";
import type { RowReorderState } from "./types";

export interface DataTableReorderBodyProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  reorder: RowReorderState<T>;
  /** The props every body row takes, reorderable or not. */
  rowProps: (row: T, index: number) => Omit<DataTableRowProps<T>, "handle" | "rowRef" | "draggableProps" | "cellWidths">;
  /** Cell widths captured at lift, applied only to the row being dragged. */
  draggingWidths: number[] | null;
  bodyRef: MutableRefObject<HTMLTableSectionElement | null>;
  cellCount: number;
}

/**
 * The draggable body, kept apart from `DataTable` the way the header is.
 *
 * Everything drag lives here except the context itself, which stays outside the
 * table element in `DataTable`: `DragDropContext` renders no element of its
 * own today, but table markup that only stays legal because of that is a trap.
 */
export function DataTableReorderBody<T>({
  rows,
  rowKey,
  reorder,
  rowProps,
  draggingWidths,
  bodyRef,
  cellCount,
}: DataTableReorderBodyProps<T>) {
  return (
    <Droppable droppableId="data-table-rows">
      {(droppable) => (
        <TableBody
          ref={(node) => {
            bodyRef.current = node;
            droppable.innerRef(node);
          }}
          {...droppable.droppableProps}
        >
          {rows.map((row, index) => {
            const id = rowKey(row);
            const isFrozen = (reorder.isPinned?.(id) ?? false) || reorder.isPending === true;

            return (
              <Draggable key={id} draggableId={id} index={index} isDragDisabled={isFrozen}>
                {(draggable, snapshot) => (
                  <DataTableRow
                    {...rowProps(row, index)}
                    rowRef={draggable.innerRef}
                    draggableProps={draggable.draggableProps}
                    cellWidths={snapshot.isDragging ? (draggingWidths ?? undefined) : undefined}
                    handle={{
                      dragHandleProps: draggable.dragHandleProps,
                      gripLabel: `${reorder.dragHandleLabel}: ${reorder.rowLabel(row)}`,
                    }}
                  />
                )}
              </Draggable>
            );
          })}
          {/* The library's placeholder is a `<div>`, which is not a legal child
              of a `<tbody>`. It goes in a zero-height row of its own so the body
              still reserves the lifted row's height and the rows below it do not
              jump up mid-drag. */}
          <TableRow aria-hidden="true" className="h-0 border-b-0 odd:bg-transparent hover:bg-transparent">
            <TableCell colSpan={cellCount} className="p-0">
              {droppable.placeholder}
            </TableCell>
          </TableRow>
        </TableBody>
      )}
    </Droppable>
  );
}
