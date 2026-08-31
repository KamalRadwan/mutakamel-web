import { Skeleton } from "../../primitives/Skeleton";
import { TableRow, TableCell } from "../../primitives/Table";

/** 5 shimmer rows during isLoading, preserving container height (data-table.md). */
export function DataTableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent dark:hover:bg-transparent">
          {Array.from({ length: columnCount }, (_, colIndex) => (
            <TableCell key={colIndex} className="h-11 py-2.5">
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
