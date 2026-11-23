
import type { CorePage, ListQuery } from './staff.model';


export { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
export { newIdempotencyKey } from '../../../../core/api/idempotency';

export { staffErrorMessage } from './staff-errors';


export async function listAllPages<T>(
  fetchPage: (q: ListQuery) => Promise<CorePage<T>>,
  query: ListQuery = {},
): Promise<T[]> {
  const limit = query.limit ?? 100;
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await fetchPage({ ...query, page, limit });
    all.push(...res.data);
    if (!res.meta.hasNext || res.data.length === 0 || page >= res.meta.totalPages) {
      break;
    }
    page++;
  }
  return all;
}
