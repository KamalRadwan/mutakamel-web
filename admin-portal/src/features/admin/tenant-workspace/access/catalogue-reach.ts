import type { CatalogueQuery } from "./types";

/**
 * UI-019. The access selectors load one page and offer no way past it: roles
 * and branches at 50, departments and teams at 100. A currently assigned value
 * outside that page is preserved as a fallback option, so the form does not
 * lose what is already set - but no *other* later-page record can be chosen.
 * Once a tenant grows past those counts, an administrator simply cannot assign
 * the role or branch they are looking for, and nothing on screen says so.
 *
 * `CatalogueQuery` already carries `q`, and the API layer already serialises
 * it. Only the UI never offered it. Searching is the right answer rather than
 * raising the cap: it reaches the whole catalogue at a bounded page size.
 */

/** What a selector should tell the reader about what it is showing. */
export interface CatalogueReach {
  shown: number;
  total: number;
  /** The page is a subset, so the list on screen is not the whole catalogue. */
  truncated: boolean;
}

export function catalogueReach(
  // `PageResult` carries `total` at the top level, not under a `meta` object.
  // Reading the wrong one silently reports every list as complete, which is
  // the failure this helper exists to make visible.
  page: { items: readonly unknown[]; total?: number } | null,
): CatalogueReach {
  const shown = page?.items.length ?? 0;
  const total = typeof page?.total === "number" ? page.total : shown;
  return { shown, total, truncated: total > shown };
}

/**
 * The query a search box issues.
 *
 * Always page 1: a search is a new question, and carrying the previous page
 * number into it would skip the first matches. An empty term drops `q` rather
 * than sending an empty string, so clearing the box returns the plain first
 * page instead of asking the server to match nothing.
 */
export function catalogueSearchQuery<Extra extends object = object>(
  term: string,
  limit: number,
  extra?: Extra,
): CatalogueQuery & Extra {
  const q = term.trim();
  return {
    ...(extra ?? ({} as Extra)),
    ...(q ? { q } : {}),
    page: 1,
    limit,
  } as CatalogueQuery & Extra;
}
