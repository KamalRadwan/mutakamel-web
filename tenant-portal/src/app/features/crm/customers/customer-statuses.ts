import { CustomerStatus, ManualCustomerStatus } from './customers.model';

export const CUSTOMER_STATUS_ORDER: CustomerStatus[] = [
  'PROSPECT',
  'ACTIVE_CUSTOMER',
  'INACTIVE',
  'BLACKLISTED',
];

export const CUSTOMER_STATUS_TONE: Record<CustomerStatus, 'brand' | 'success' | 'danger'> = {
  PROSPECT: 'brand',
  ACTIVE_CUSTOMER: 'success',
  INACTIVE: 'brand',
  BLACKLISTED: 'danger',
};

export const MANUAL_STATUSES = ['PROSPECT', 'INACTIVE', 'BLACKLISTED'] as const;

export function isManualStatus(s: CustomerStatus): s is ManualCustomerStatus {
  return s !== 'ACTIVE_CUSTOMER';
}
