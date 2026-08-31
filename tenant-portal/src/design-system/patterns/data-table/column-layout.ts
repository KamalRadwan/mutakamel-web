import type { ColumnDef } from "./types";

export interface ColumnLayout {
  /**
   * Column ids in display order.
   *
   * Ids the caller no longer supplies are ignored, and columns missing from the
   * order are appended in their declared position. A stored layout therefore
   * survives a release that adds or removes a column, instead of hiding the new
   * one or crashing on the old one.
   */
  order: string[];
  /** Pixel widths by column id. A column with no entry keeps its declared width. */
  widths: Record<string, number>;
}

export interface ColumnLayoutState {
  layout: ColumnLayout;
  /** The caller owns persistence — localStorage, a user preference, or nothing. */
  onLayoutChange: (next: ColumnLayout) => void;
}

export const MIN_COLUMN_WIDTH = 64;
export const MAX_COLUMN_WIDTH = 720;
/** One keyboard press of a resize handle. Big enough to be useful, small enough to be precise. */
export const RESIZE_STEP = 16;

export const EMPTY_COLUMN_LAYOUT: ColumnLayout = { order: [], widths: {} };

/**
 * Applies a stored order to the declared columns.
 *
 * Sticky columns are **not** reorderable and are pinned back to their declared
 * edge: a sticky action column dragged into the middle would stick over the
 * data while the user scrolls, which is worse than not offering the move.
 */
export function applyColumnLayout<T>(columns: ColumnDef<T>[], layout: ColumnLayout): ColumnDef<T>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const ordered: ColumnDef<T>[] = [];

  for (const id of layout.order) {
    const column = byId.get(id);
    if (column && !column.sticky) {
      ordered.push(column);
      byId.delete(id);
    }
  }

  const startSticky = columns.filter((column) => column.sticky === "start");
  const endSticky = columns.filter((column) => column.sticky === "end");
  const remaining = columns.filter((column) => byId.has(column.id) && !column.sticky);

  return [...startSticky, ...ordered, ...remaining, ...endSticky];
}

export function isReorderable<T>(column: ColumnDef<T>): boolean {
  return !column.sticky;
}

/** Moves a column one position earlier or later **in reading order**. */
export function moveColumn(order: string[], id: string, delta: -1 | 1): string[] {
  const index = order.indexOf(id);
  if (index < 0) return order;
  const target = index + delta;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function setColumnWidth(
  widths: Record<string, number>,
  id: string,
  width: number,
): Record<string, number> {
  return {
    ...widths,
    [id]: Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width))),
  };
}

/**
 * Seeds an order from the declared columns.
 *
 * Called whenever the stored order does not cover the current column set, so
 * the first render after a column is added is correct rather than partial.
 */
export function initialOrder<T>(columns: ColumnDef<T>[]): string[] {
  return columns.filter(isReorderable).map((column) => column.id);
}

/** Resolves the width a header should render at — the stored one, else the declared one. */
export function columnWidth<T>(column: ColumnDef<T>, layout: ColumnLayout): string | undefined {
  const stored = layout.widths[column.id];
  return stored === undefined ? column.width : `${stored}px`;
}

/**
 * Fills a stored layout out against the columns actually declared.
 *
 * A layout persisted before a column was added would otherwise order only the
 * columns it knew about, and `moveColumn` would refuse to move the new one
 * because it is not in `order`.
 */
export function resolveColumnLayout<T>(columns: ColumnDef<T>[], layout: ColumnLayout): ColumnLayout {
  const declared = initialOrder(columns);
  const known = new Set(layout.order);
  const missing = declared.filter((id) => !known.has(id));
  const kept = layout.order.filter((id) => declared.includes(id));
  return { order: [...kept, ...missing], widths: layout.widths };
}
