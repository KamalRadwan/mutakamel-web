// Bounded fetch-all for a client-side export — MASTER-PLAN 13.22.
//
// Exporting "the current page" and exporting "all 4,300 matching rows" are
// different promises, and a control that says "Export" while delivering 25 rows
// is a lie. This walks the server's own pagination so the second promise can be
// kept — but it is BOUNDED, because the alternative is a browser tab that
// allocates an unbounded list from a table nobody measured.
//
// Two bounds, both reported back rather than hidden: a row cap and a page cap.
// When either bites, `truncated` is true and the caller must say so in the UI.

/** One page as the caller's own validator already returned it. */
interface ExportPage<T> {
  items: T[];
  /** The server's total for the whole result set, not the page. */
  total: number;
}

export interface CollectPagesOptions<T> {
  /** 1-based. Rejects, or throws `AbortError`, exactly as the caller's reader does. */
  fetchPage: (page: number, signal: AbortSignal) => Promise<ExportPage<T>>;
  /** The server page size the caller asks for. Used to derive the page count. */
  pageSize: number;
  /** Hard row ceiling. Reaching it stops the walk and sets `truncated`. */
  maxRows: number;
  /** Hard request ceiling — the guard for a server whose `total` cannot be trusted. */
  maxPages: number;
  signal: AbortSignal;
  onProgress?: (progress: CollectProgress) => void;
}

interface CollectProgress {
  /** Rows collected so far. */
  loaded: number;
  /** What the walk expects to collect in total, already clamped by `maxRows`. */
  expected: number;
  /** Pages requested so far, including the one just settled. */
  pagesFetched: number;
}

export interface CollectResult<T> {
  rows: T[];
  /** The server's own total for the query, before any bound was applied. */
  total: number;
  /** True when a bound stopped the walk before the server's `total` was reached. */
  truncated: boolean;
}

/**
 * Walks pages until the result set is exhausted or a bound is reached.
 *
 * Sequential, not parallel, and deliberately so: the Gateway rate-limits
 * (S9), and firing forty concurrent reads at it to save a few seconds trades a
 * complete export for a `429` halfway through.
 *
 * A page that comes back short of `pageSize` ends the walk. That is the one
 * termination condition that does not depend on the server's `total` being
 * self-consistent, and CRM's `totalPages` is already known to be 0 rather than
 * 1 for an empty set (docs/api/README.md#crm--raw).
 */
export async function collectPages<T>(
  options: CollectPagesOptions<T>,
): Promise<CollectResult<T>> {
  const { fetchPage, pageSize, maxRows, maxPages, signal, onProgress } = options;
  const rows: T[] = [];
  let total = 0;
  let pagesFetched = 0;
  let truncated = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchPage(page, signal);
    pagesFetched += 1;
    total = result.total;

    for (const item of result.items) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(item);
    }

    onProgress?.({
      loaded: rows.length,
      expected: Math.min(total, maxRows),
      pagesFetched,
    });

    // A short page is the end of the result set, whatever `total` claims.
    if (truncated || result.items.length < pageSize) {
      if (rows.length < total) truncated = true;
      return { rows, total, truncated };
    }
  }

  // The page cap bit. Only a walk that did not reach the server's total is
  // truncated — a result set that happens to fill exactly `maxPages` is whole.
  return { rows, total, truncated: rows.length < total };
}
