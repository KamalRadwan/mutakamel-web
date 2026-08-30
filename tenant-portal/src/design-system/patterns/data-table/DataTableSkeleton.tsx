"use client";

import { Skeleton } from "../../primitives/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../primitives/Table";
import type { ColumnDef } from "./types";

export interface DataTableSkeletonProps<T> {
  columns: ColumnDef<T>[];
  rows?: number;
}

// Matches the real column widths, not a grey rectangle — a skeleton that
// mirrors the real layout makes the load feel instant rather than broken.
export function DataTableSkeleton<T>({ columns, rows = 8 }: DataTableSkeletonProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="odd:bg-transparent hover:bg-transparent">
          {columns.map((column) => (
            <TableHead key={column.id} style={{ width: column.width }}>
              <Skeleton className="h-3 w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={`skeleton-row-${rowIndex}`} className="hover:bg-transparent">
            {columns.map((column) => (
              <TableCell key={column.id} style={{ width: column.width }}>
                <Skeleton className="h-3 w-full max-w-24" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
