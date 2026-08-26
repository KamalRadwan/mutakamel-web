"use client";

import { useMemo } from "react";
import type { DataTableProps } from "./types";

export interface DataTableRow<T> {
  id: string;
  original: T;
}

/**
 * @tanstack/react-table v9 restructured its entire API (a new useTable()
 * replacing v8's useReactTable()/getCoreRowModel()) and its bundled v8
 * compat layer (@tanstack/react-table/legacy) has generic constraints that
 * don't resolve cleanly for a plain user-supplied row type here. None of
 * this pattern actually needs tanstack's row-model machinery — the spec
 * (docs/components/data-table.md) is just cell(row) rendering plus
 * externally-controlled pagination/sort — so this computes row identity
 * directly instead of fighting a dependency for features it never uses.
 */
export function useDataTable<T>({
  data,
  getRowId,
}: Pick<DataTableProps<T>, "data" | "getRowId">): { rows: DataTableRow<T>[] } {
  const rows = useMemo(
    () => data.map((original, index) => ({ id: getRowId ? getRowId(original) : String(index), original })),
    [data, getRowId],
  );
  return { rows };
}
