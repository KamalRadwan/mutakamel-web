export type DataTableSortDirection = "ASC" | "DESC";

export interface ColumnDef<T> {
  key: string;
  headerEn: string;
  headerAr: string;
  sortable?: boolean;
  align?: "start" | "center" | "end";
  width?: string;
  priority?: "essential" | "supporting" | "detail";
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

export interface DataTableSortProps {
  sortBy: string;
  sortDir: DataTableSortDirection;
  onSortChange: (sortBy: string, sortDir: DataTableSortDirection) => void;
}

export interface DataTableEmptyState {
  titleEn: string;
  titleAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  action?: React.ReactNode;
}

interface SelectionBehavior<T> {
  /**
   * A query identity lets the table clear a selection that no longer belongs
   * to the active filter/sort scope. It must be supplied by the data owner;
   * the table never invents a fingerprint from client state.
   */
  queryFingerprint?: string;
  isRowSelectable?: (row: T) => boolean;
  actions?: React.ReactNode;
}

export interface ExplicitIdSelection<T> extends SelectionBehavior<T> {
  kind: "EXPLICIT_IDS";
  selectedIds: readonly string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

/**
 * Query-scoped selection is deliberately a different type from explicit IDs.
 * It is valid only when the domain supplies an authoritative fingerprint,
 * total, and exclusions model. No mutation behavior lives in DataTable, so it
 * cannot fan out row-level requests to simulate a bulk API.
 */
export interface AllMatchingSelection<T> extends SelectionBehavior<T> {
  kind: "ALL_MATCHING";
  queryFingerprint: string;
  totalMatching: number;
  excludedIds: readonly string[];
  onExcludedIdsChange: (excludedIds: string[]) => void;
  onClearSelection: () => void;
}

export type DataTableSelection<T> = ExplicitIdSelection<T> | AllMatchingSelection<T>;

interface DataTableBaseProps<T> {
  /** Localized region name. Optional temporarily for legacy call sites. */
  labelEn?: string;
  labelAr?: string;
  columns: ColumnDef<T>[];
  data: T[];
  /** Initial load. Existing rows remain mounted when data is already present. */
  isLoading?: boolean;
  /** Background work never replaces rows, pagination, scroll, or focus. */
  isRefreshing?: boolean;
  pagination: DataTablePaginationProps;
  sort?: DataTableSortProps;
  getRowId?: (row: T) => string;
  getRowLabel?: (row: T) => string;
  responsiveMode?: "priority-columns" | "horizontal-scroll" | "record-cards";
  emptyState?: DataTableEmptyState;
}

interface DataTableWithoutSelection<T> {
  selection?: undefined;
  selectedIds?: undefined;
  onSelectionChange?: undefined;
  getRowId?: (row: T) => string;
}

interface DataTableWithSelection<T> {
  selection: DataTableSelection<T>;
  selectedIds?: never;
  onSelectionChange?: never;
  getRowId: (row: T) => string;
}

/**
 * Compatibility bridge for the original selectedIds/onSelectionChange API.
 * It now requires stable row identity, just like the preferred selection prop.
 */
interface DataTableWithLegacySelection<T> {
  selection?: undefined;
  selectedIds: readonly string[];
  onSelectionChange: (selectedIds: string[]) => void;
  getRowId: (row: T) => string;
}

export type DataTableProps<T> = DataTableBaseProps<T> &
  (DataTableWithoutSelection<T> | DataTableWithSelection<T> | DataTableWithLegacySelection<T>);
