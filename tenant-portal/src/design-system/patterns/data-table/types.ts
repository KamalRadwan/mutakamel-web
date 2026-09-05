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
  /** Ordinal column header. Absent, both resolve from `t.common.*`. */
  rowNumberShort?: string;
  rowNumber?: string;
  pagination: {
    previous: string;
    next: string;
    summary: (from: number, to: number, total: number) => string;
    /** Absent, these resolve from `t.common.*` — never an English literal. */
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
  /**
   * Field name sent to the API as `sortBy`, when it differs from `id`.
   *
   * `id` names the column for the UI ("next", "period"); the server accepts
   * only the fields on that endpoint's whitelist ("nextValue",
   * "currentPeriodEnd") and answers 400 for anything else. `id` is used when
   * this is omitted.
   */
  sortField?: string;
  numeric?: boolean;
  sticky?: "start" | "end";
}

/**
 * Optional row reordering, off unless a caller passes it — the drag handle
 * column catalogue screens get in DESIGN-SYSTEM.md#75-catalogue-screens.
 *
 * `onReorder` hands back **every** row key in its new order rather than a pair
 * of indices, because that is what the endpoints behind it take: a catalogue's
 * `reorder` route replaces the whole dense order in one write, and a per-row
 * PATCH of rank races. It follows that the caller must pass the unfiltered
 * list — a searched view is not the order being written.
 *
 * Drag is the only path here, which is a known WCAG 2.2 AA
 * `dragging-alternative` gap — see DEFECTS.md D24. The keyboard half is
 * covered: `@hello-pangea/dnd`'s own sensor rides on the grip.
 */
export interface RowReorderState<T> {
  onReorder: (orderedIds: string[]) => void;
  /** Rows that keep their index. A move that would displace one is refused. */
  isPinned?: (id: string) => boolean;
  /** Dragging is off while a reorder write is in flight. */
  isPending?: boolean;
  /**
   * Names the row in its grip's accessible name. A column of identically
   * labelled grips tells a screen-reader user nothing about which row they
   * are on.
   */
  rowLabel: (row: T) => string;
  /** Names every grip, and the handle column they sit in. Already translated. */
  dragHandleLabel: string;
}
