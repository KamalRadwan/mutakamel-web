import { inject } from '@angular/core';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { runInCrm } from '../crm-runtime';

export interface SessionBranch {
  companyId: string;
  branchId: string;
}

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** An ambiguous or company-only selection cannot scope a read. */
export function sessionBranch(): SessionBranch | null {
  const state = runInCrm(() => inject(TenantScopeState));
  const selection = state.selection();
  const branchId = selection?.branchId;
  if (!branchId) return null;
  const parent = state.branchCompanies().get(branchId);
  const companyId = selection.companyId || parent;
  if (!parent || parent !== companyId || !uuidV7.test(branchId) || !uuidV7.test(companyId)) return null;
  return { companyId, branchId };
}

/** No scope headers: Core organization catalogues, through the shared Workspace lookups. */
export async function branchOptions(): Promise<{ id: string; name: string; companyName: string }[]> {
  if (!can('org.branch.read')) return [];
  const lookups = runInCrm(() => inject(WorkspaceLookups));
  const [branches, companies] = await Promise.all([
    lookups.allBranches({ status: 'ACTIVE' }),
    can('org.company.read') ? lookups.allCompanies() : Promise.resolve([]),
  ]);
  const names = new Map(companies.map((company) => [company.id, company.name]));
  return branches.map(({ id, name, companyId }) => ({ id, name, companyName: names.get(companyId) ?? '' }));
}
