"use client";
import { useCallback } from "react";
import type { ColumnDef, SortState } from "./types";

export function useDataTableSort<T>(columns: ColumnDef<T>[], onChange: (next: SortState) => void, current?: SortState) {
  const select = useCallback((value: string) => {
    const [id, direction] = value.split(":");
    if ((direction === "asc" || direction === "desc") &&
      columns.some(column => column.sortable && (column.sortField ?? column.id) === id)) onChange({ id, direction });
  }, [onChange, columns]);
  const sortable = columns.filter(column => column.sortable);
  const selected = current && sortable.some(column => (column.sortField ?? column.id) === current.id)
    ? `${current.id}:${current.direction}` : "";
  return { sortable, select, selected };
}
