import type { ReactNode } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { DataTableLabels, PageInfo, SelectionState, SortState } from "../patterns/data-table/types";

// The label set every view needs. It is DataTable's set, not a parallel copy:
// the table was the only view that already owned pagination, sorting and
// selection, so its vocabulary is the shared one and the other two views
// extend it rather than restate it. See docs/design/views.md#the-shared-contract.
export type WorkspaceViewLabels = DataTableLabels;

// A field the card view can sort by. The board and the table do not use it —
// the table sorts from its column headers, and the board's order is its
// grouping axis.
export interface SortOption {
  id: string;
  label: string;
}

// One contract, three implementations. Before this existed the three views
// took `cardsByColumn`/`items`/`rows`, `itemKey`/`itemKey`/`rowKey` and
// `onCardClick`/`onItemClick`/`onRowClick`, so a workspace wired three
// different prop sets by hand and switching view silently dropped pagination,
// sorting and selection — V1 and V2 in docs/build/MASTER-PLAN.md#05-the-three-views--board--card--table.
//
// Rules that hold for every implementation:
// - A view never fetches, never reads the dictionary, and never knows which
//   entity it renders. Every string arrives translated in `labels`.
// - Pagination and sorting are SERVER state. A view reports the change and
//   renders whatever it is given next; it never slices or reorders `items`.
// - `labels.emptyTitle` and `labels.errorTitle` are required, so a blank
//   heading cannot compile.
export interface WorkspaceViewProps<T> {
  items: T[];
  itemKey: (item: T) => string;
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  // Replaces the default empty state when "no rows" means something more
  // specific than "no results" — an unmet precondition, for instance.
  emptyState?: ReactNode;
  // Optional because not every list is page-numbered: the opportunity board
  // and card endpoints are cursor-paginated, and a page control there would
  // be a lie about the data. Supply both or neither — a view renders the
  // Pagination control only when it has somewhere to send the change.
  page?: PageInfo;
  onPageChange?: (page: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selection?: SelectionState;
  // Opening the item's detail route. Named for the interaction, not the
  // device: click, Enter, and a card view's keyboard path all reach it.
  onActivate?: (item: T) => void;
  labels: WorkspaceViewLabels;
  className?: string;
}
