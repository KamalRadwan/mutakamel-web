import { ApiError } from '../../settings/shared/settings-api';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { listAssignableOwners } from '../../shared/lookups/assignable-owners';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { fakeSearchCustomers } from '../customers.fake';
import { CustomerRow, CustomerSearchBody, OwnerOption } from '../customers.model';
import {
  CUSTOMER_SELECTION_LIMIT,
  CustomerBulkSort,
  CustomerSelectionResult,
  SelectedCustomerRow,
} from './customer-bulk.model';

function toSelectedFromRow(row: CustomerRow): SelectedCustomerRow {
  return {
    id: row.id,
    displayName: row.displayName,
    ownerUserId: row.ownerUserId,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

/**
 * Selection preview over `customers.fake.ts` search/filter logic.
 * Throws `CUSTOMER_PROFILE_SELECTION_TOO_LARGE` when `limit > 10_000`.
 */
export async function fakeSelectCustomers(
  body: CustomerSearchBody,
  sort: CustomerBulkSort | undefined,
  limit = CUSTOMER_SELECTION_LIMIT,
): Promise<CustomerSelectionResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > CUSTOMER_SELECTION_LIMIT) {
    throw new ApiError(400, 'CUSTOMER_PROFILE_SELECTION_TOO_LARGE');
  }

  const effectiveSort = sort ?? body.sort ?? 'createdAt:DESC';
  const searchBody: CustomerSearchBody = {
    ...body,
    sort: effectiveSort,
  };

  const page = await fakeSearchCustomers(searchBody, 1, limit);
  return {
    items: page.items.map(toSelectedFromRow),
    total: page.total,
    truncated: page.total > limit,
  };
}

/** BRANCH_REQUIRED: selection is a read-only POST with both session scope headers. */
export function selectCustomers(
  body: CustomerSearchBody,
  sort: CustomerBulkSort | undefined,
  limit = CUSTOMER_SELECTION_LIMIT,
): Promise<CustomerSelectionResult> {
  const scope = sessionBranch();
  if (!scope || scope.branchId !== body.branchId) {
    return Promise.reject(new ApiError(403, 'BRANCH_CONTEXT_REQUIRED'));
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > CUSTOMER_SELECTION_LIMIT) {
    return Promise.reject(new ApiError(400, 'CUSTOMER_PROFILE_SELECTION_TOO_LARGE'));
  }
  const { branchId, search, searchField, filter, filterTree, tagIds, status } = body;
  const request = { branchId, search, searchField, filter, filterTree, tagIds, status,
    sort: sort ?? body.sort ?? 'createdAt:DESC', limit };
  return crmQueries().fetchQuery({
    queryKey: ['crm-customers', 'selection', scope, request],
    queryFn: async () => (await crmHttp().write<CustomerSelectionResult>(
      'POST', '/customer-profiles/selection', request, { key: newIdempotencyKey(), scope },
    )).data,
  });
}

/** BRANCH_REQUIRED: XR-LK supplies scoped, cursor-paged assignable owners. */
export async function listCustomerBulkOwners(branchId: string): Promise<OwnerOption[]> {
  const owners: OwnerOption[] = [];
  let cursor: string | undefined;
  do {
    const page = await listAssignableOwners(branchId, 'customer_profiles', 'update', { cursor, limit: 200 });
    owners.push(...page.items.map(({ id, displayName, avatarUrl }) => ({ userId: id, name: displayName, avatarUrl })));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return owners;
}
