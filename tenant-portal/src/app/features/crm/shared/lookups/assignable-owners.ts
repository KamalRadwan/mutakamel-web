import { crmHttp, crmQueries } from '../crm-http';
import { sessionBranch } from './session-branch';

export type AssignableOwnersResource = 'leads' | 'customer_profiles' | 'opportunities';
export interface AssignableOwner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}
export interface AssignableOwnersPage {
  items: AssignableOwner[];
  nextCursor: string | null;
}

/** BRANCH_REQUIRED: both UUID v7 scope headers; call before leaving the injection context. */
export async function listAssignableOwners(
  branchId: string,
  resource: AssignableOwnersResource,
  action: 'create' | 'update',
  options: { cursor?: string; limit?: number; search?: string } = {},
): Promise<AssignableOwnersPage> {
  const scope = sessionBranch();
  if (!scope || scope.branchId !== branchId) return { items: [], nextCursor: null };
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(200, Math.trunc(options.limit!))) : 100;
  const search = options.search?.trim().toLowerCase() ?? '';
  const page = await crmQueries().fetchQuery({
    queryKey: ['crm-lookups', 'assignable-owners', scope, resource, action, options.cursor, limit, search],
    queryFn: () => crmHttp().read<AssignableOwnersPage>('/assignable-owners', {
      branchId, resource, action, cursor: options.cursor, limit,
    }, { scope }),
  });
  // The current DTO has no search field; filter this cursor page without sending a rejected property.
  return search ? { ...page, items: page.items.filter((owner) => owner.displayName.toLowerCase().includes(search)) } : page;
}
