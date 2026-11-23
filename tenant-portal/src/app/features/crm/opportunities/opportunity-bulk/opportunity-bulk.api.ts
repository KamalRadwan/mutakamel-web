import { listAssignableOwners } from '../../shared/lookups/assignable-owners';
import type { OwnerOption } from '../opportunities.model';

/** BRANCH_REQUIRED: XR-LK owns the session headers and query cache for each catalogue page. */
export async function listBulkOpportunityOwners(branchId: string): Promise<OwnerOption[]> {
  const owners: OwnerOption[] = [];
  let cursor: string | undefined;
  do {
    const page = await listAssignableOwners(branchId, 'opportunities', 'update', { cursor });
    owners.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return owners;
}
