// Exact contract from docs/components/data-table.md — DataTable implements
// this verbatim; do not add fields here without updating that spec first.
export interface ColumnDef<T> {
  key: string;
  headerEn: string;
  headerAr: string;
  sortable?: boolean;
  align?: "start" | "center" | "end";
  width?: string;
  cell: (row: T) => React.ReactNode;
}

export interface DataTablePaginationProps {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

interface DataTableSortProps {
  sortBy: string;
  sortDir: "ASC" | "DESC";
  onSortChange: (sortBy: string, sortDir: "ASC" | "DESC") => void;
}

interface DataTableEmptyState {
  titleEn: string;
  titleAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  action?: React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  pagination: DataTablePaginationProps;
  sort?: DataTableSortProps;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: T) => string;
  emptyState?: DataTableEmptyState;
}
