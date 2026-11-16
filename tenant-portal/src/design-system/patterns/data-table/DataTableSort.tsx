"use client";
import { ArrowDownUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/Select";
import type { ColumnDef, SortState } from "./types";
import { useDataTableSort } from "./useDataTableSort";

export function DataTableSort<T>({ columns, value, onChange, labels }: {
  columns: ColumnDef<T>[];
  value: SortState;
  onChange: (next: SortState) => void;
  labels: { label: string; ascending: string; descending: string };
}) {
  const { sortable, select, selected } = useDataTableSort(columns, onChange, value);
  return <Select value={selected} onValueChange={select}>
    <SelectTrigger size="sm" className="w-full sm:w-56" aria-label={labels.label}>
      <ArrowDownUp className="size-4 shrink-0" aria-hidden="true" /><SelectValue placeholder={labels.label} />
    </SelectTrigger>
    <SelectContent>{sortable.flatMap(column => ["asc", "desc"].map(direction =>
      <SelectItem key={`${column.id}:${direction}`} value={`${column.sortField ?? column.id}:${direction}`}>
        {column.header} · {direction === "asc" ? labels.ascending : labels.descending}
      </SelectItem>,
    ))}</SelectContent>
  </Select>;
}
