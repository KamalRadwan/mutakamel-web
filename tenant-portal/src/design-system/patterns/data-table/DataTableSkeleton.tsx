"use client";

import { Skeleton } from "../../primitives/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../primitives/Table";
import { cn } from "../../lib/cn";
import type { ColumnDef, DataTableDensity } from "./types";

export interface DataTableSkeletonProps<T> {
  columns: ColumnDef<T>[];
  rows?: number;
  density?: DataTableDensity;
}

// Matches the real column widths, not a grey rectangle — a skeleton that
// mirrors the real layout makes the load feel instant rather than broken.
export function DataTableSkeleton<T>({
  columns,
  rows = 8,
  density = "default",
}: DataTableSkeletonProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="odd:bg-transparent hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.id}
              style={{ width: column.width }}
              className={density === "compact" ? "h-8 px-2.5" : undefined}
            >
              <Skeleton className="h-3 w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow
            key={`skeleton-row-${rowIndex}`}
            className={cn("hover:bg-transparent", density === "compact" && "h-9")}
          >
            {columns.map((column) => (
              <TableCell
                key={column.id}
                style={{ width: column.width }}
                className={density === "compact" ? "px-2.5 py-1" : undefined}
              >
                <Skeleton className="h-3 w-full max-w-24" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
