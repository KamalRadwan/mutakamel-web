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
