import type { CorePageMeta } from '../../../../workspace/settings/core-response.model';

/**
 * Core wraps ActivityPageDto in its envelope: the list arrives as { data: items, meta }, and
 * meta carries hasNext (page < totalPages).
 */
export function hasNextPage(page: { meta: Pick<CorePageMeta, 'hasNext'> }): boolean {
  return page.meta.hasNext;
}
