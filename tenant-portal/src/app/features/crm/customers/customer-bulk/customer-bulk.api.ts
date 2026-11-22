import { ApiError } from '../../settings/shared/settings-api';
import { fakeSearchCustomers } from '../customers.fake';
import { CustomerRow, CustomerSearchBody } from '../customers.model';
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

/** POST /api/tenant/crm/v1/crm/customer-profiles/selection */
export function selectCustomers(
  body: CustomerSearchBody,
  sort: CustomerBulkSort | undefined,
  limit = CUSTOMER_SELECTION_LIMIT,
): Promise<CustomerSelectionResult> {
  return fakeSelectCustomers(body, sort, limit);
}
