"use client";

import { DataTable } from "../../patterns/data-table/DataTable";
import type { ColumnDef } from "../../patterns/data-table/types";
import type { WorkspaceViewProps } from "../types";

export interface TableViewProps<T> extends WorkspaceViewProps<T> {
  columns: ColumnDef<T>[];
}

// The shared contract's table implementation. It adapts the contract's names
// to DataTable's — `items` / `itemKey` / `onActivate` in, `rows` / `rowKey` /
// `onRowClick` out — and changes nothing else: DataTable stays the engine and
// keeps owning the sticky header, column sizing, selection, server sorting
// and pagination, keyboard navigation, the row height, the zebra token and
// the loading / empty / error states. See docs/design/patterns.md#datatable.
//
// The adapter exists so a workspace wires ONE prop set for all three views
// (V1). Screens render TableView; DataTable is not for feature code.
export function TableView<T>({
  columns,
  items,
  itemKey,
  onActivate,
  isLoading,
  error,
  onRetry,
  emptyState,
  page,
  onPageChange,
  sort,
  onSortChange,
  selection,
  labels,
  className,
}: TableViewProps<T>) {
  return (
    <DataTable
      columns={columns}
      rows={items}
      rowKey={itemKey}
      onRowClick={onActivate}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      page={page}
      onPageChange={onPageChange}
      sort={sort}
      onSortChange={onSortChange}
      selection={selection}
      labels={labels}
      className={className}
    />
  );
}
