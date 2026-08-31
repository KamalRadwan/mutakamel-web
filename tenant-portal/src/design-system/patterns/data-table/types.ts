import type { ReactNode } from "react";

// Server pagination — DataTable never slices a client array. page is
// 1-indexed to match the CRM PaginationQueryDto contract.
export interface PageInfo {
  page: number;
  limit: number;
  total: number;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  id: string;
  direction: SortDirection;
}

export interface SelectionState {
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

// Every string the table needs, already translated — DataTable never touches
// the dictionary. This is also the shared view label set, re-exported as
// WorkspaceViewLabels from src/design-system/views/types.ts: the table was
// the only view that already owned pagination, sorting and selection, so its
// vocabulary became the shared one rather than a parallel copy.
export interface DataTableLabels {
  retry: string;
  errorTitle: string;
  emptyTitle: string;
  selectAll: string;
  // One key for "select this one thing", used by all three views: a row in
  // the table, a card in the other two. The name predates the shared contract
  // and is kept because five screens outside this contract pass it.
  selectRow: string;
  sortAscending: string;
  sortDescending: string;
  notSorted: string;
  /** Ordinal column header; `N` and its tooltip fall back to English when absent. */
  rowNumberShort?: string;
  rowNumber?: string;
  pagination: {
    previous: string;
    next: string;
    summary: (from: number, to: number, total: number) => string;
    first?: string;
    last?: string;
    page?: (n: number) => string;
  };
}

export interface ColumnDef<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  width?: string;
  sortable?: boolean;
  numeric?: boolean;
  sticky?: "start" | "end";
}
