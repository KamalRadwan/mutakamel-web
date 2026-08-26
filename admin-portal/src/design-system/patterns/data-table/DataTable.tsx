"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../../lib/cn";
import { Checkbox } from "../../primitives/Checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../primitives/Table";
import { Pagination } from "../pagination/Pagination";
import { useDataTable } from "./useDataTable";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { DataTableToolbar } from "./DataTableToolbar";
import type { DataTableProps } from "./types";

const ALIGN_CLASS = { start: "text-start", center: "text-center", end: "text-end" } as const;

/**
 * Implements docs/components/data-table.md verbatim: 44px rows (py-2.5
 * px-4 text-sm), 5-row shimmer skeleton, logical header alignment, server
 * pagination/sorting via the props below (see useDataTable.ts for why this
 * isn't built on @tanstack/react-table).
 */
export function DataTable<T>({
  columns,
  data,
  isLoading,
  pagination,
  sort,
  selectedIds,
  onSelectionChange,
  getRowId,
  emptyState,
}: DataTableProps<T>) {
  const { lang } = useI18n();
  const { rows } = useDataTable({ data, getRowId });
  const selectable = !!onSelectionChange;
  const selectedSet = new Set(selectedIds ?? []);
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r.id));
  const someSelected = !allSelected && rows.some((r) => selectedSet.has(r.id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : rows.map((r) => r.id));
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(Array.from(next));
  };

  const handleSort = (key: string) => {
    if (!sort) return;
    const nextDir = sort.sortBy === key && sort.sortDir === "ASC" ? "DESC" : "ASC";
    sort.onSortChange(key, nextDir);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {selectable && (
        <DataTableToolbar selectedCount={selectedSet.size} onClearSelection={() => onSelectionChange?.([])} />
      )}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label={lang === "ar" ? "تحديد الكل" : "Select all"}
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(ALIGN_CLASS[col.align ?? "start"], col.sortable && "cursor-pointer select-none")}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={
                  sort?.sortBy === col.key ? (sort.sortDir === "ASC" ? "ascending" : "descending") : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {lang === "ar" ? col.headerAr : col.headerEn}
                  {col.sortable &&
                    (sort?.sortBy === col.key ? (
                      sort.sortDir === "ASC" ? (
                        <ArrowUp className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="size-3" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                    ))}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <DataTableSkeleton columnCount={columns.length + (selectable ? 1 : 0)} />
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-10 text-center">
                {emptyState ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">
                      {lang === "ar" ? emptyState.titleAr : emptyState.titleEn}
                    </p>
                    {(emptyState.descriptionAr || emptyState.descriptionEn) && (
                      <p className="text-sm text-muted-foreground">
                        {lang === "ar" ? emptyState.descriptionAr : emptyState.descriptionEn}
                      </p>
                    )}
                    {emptyState.action}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد بيانات" : "No data"}</p>
                )}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} data-state={selectedSet.has(row.id) ? "selected" : undefined}>
                {selectable && (
                  <TableCell className="h-11 py-2.5">
                    <Checkbox
                      checked={selectedSet.has(row.id)}
                      onCheckedChange={() => toggleRow(row.id)}
                      aria-label={lang === "ar" ? "تحديد الصف" : "Select row"}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn("h-11 py-2.5", ALIGN_CLASS[col.align ?? "start"])}>
                    {col.cell(row.original)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!isLoading && rows.length > 0 && <Pagination {...pagination} />}
    </div>
  );
}
