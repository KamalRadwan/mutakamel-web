import type { BulkJobSelection } from '../../../../shared/bulk-jobs/bulk-jobs.model';

/** QUERY jobs must use the same branch in their search and scope, before Submit. */
export function selectionBranchMismatch(selection: BulkJobSelection, scopeBranchId: string): boolean {
  if (selection.kind === 'IDS') return false;
  const query = selection.query;
  if (!query || typeof query !== 'object' || !('search' in query)) return true;
  const search = query.search;
  return !search || typeof search !== 'object' || !('branchId' in search) || search.branchId !== scopeBranchId;
}
