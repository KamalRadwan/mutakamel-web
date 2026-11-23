import { ApiError } from '../../../../core/api/api-errors';
import type { CustomerDetail, CustomerRow } from '../../customers/customers.model';
import { crmHttp, crmQueries } from '../crm-http';

export type CustomerOption = Pick<CustomerRow, 'id' | 'displayName' | 'profileType' | 'partyId'>;
export interface CustomerPickerDenied {
  kind: 'denied';
  error: ApiError;
}
export interface CustomerContactOption {
  partyId: string;
  displayName: string;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
  jobTitle: string | null;
  isCustomerParty: boolean;
}

/** No scope headers: the branch is a query parameter, not a BRANCH_REQUIRED gateway row. */
export async function customerOptions(
  branchId: string, search: string, limit: number,
): Promise<CustomerOption[] | CustomerPickerDenied> {
  if (!branchId) return [];
  try {
    const page = await crmQueries().fetchQuery({
      queryKey: ['crm-lookups', 'customer-options', branchId, search, limit],
      queryFn: () => crmHttp().read<{ items: CustomerRow[] }>('/customer-profiles', {
        branchId, search, searchField: 'customer', limit,
      }),
    });
    return page.items.map(({ id, displayName, profileType, partyId }) => ({ id, displayName, profileType, partyId }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return { kind: 'denied', error };
    throw error;
  }
}

/** No scope headers: record-branch authorization comes from the customer profile ID. */
export async function customerContacts(customerProfileId: string): Promise<CustomerContactOption[]> {
  const customer = await crmQueries().fetchQuery({
    queryKey: ['crm-lookups', 'customer-contacts', customerProfileId],
    queryFn: () => crmHttp().read<CustomerDetail>(`/customer-profiles/${encodeURIComponent(customerProfileId)}`),
  });
  const contacts = customer.contacts.map(({ partyId, displayName, isPrimary, email, phones, jobTitle }) => ({
    partyId, displayName, isPrimary, email, phones, jobTitle, isCustomerParty: false,
  }));
  if (customer.profileType === 'INDIVIDUAL') {
    contacts.unshift({
      partyId: customer.partyId, displayName: customer.displayName, isPrimary: true,
      email: customer.email, phones: customer.phones, jobTitle: null, isCustomerParty: true,
    });
  }
  return contacts;
}
