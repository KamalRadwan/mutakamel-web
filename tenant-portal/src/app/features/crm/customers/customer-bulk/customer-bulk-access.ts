import { branchGrants } from '../../settings/shared/settings-access';
import { runInCrm } from '../../shared/crm-runtime';

export function canManageCustomerBulkStatus(branchId: string): boolean {
  if (!branchId) return false;
  const grants = runInCrm(() => branchGrants('crm.customer_profiles.status.manage'));
  return grants === 'ALL' || grants.has(branchId);
}
