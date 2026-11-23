import { LeadSearchBody } from '../lead-search/lead-search.compile';
import { listAssignableOwners as sharedAssignableOwners } from '../../shared/lookups/assignable-owners';
import { listPageSizes as sharedPageSizes } from '../../shared/lookups/page-sizes';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { listReasons } from '../../settings/reasons/reasons.api';
import { SelectedRow } from './lead-bulk.model';

/** POST /api/tenant/crm/v1/leads/selection; BRANCH_REQUIRED: both session scope headers. */
export function selectLeads(
  body: LeadSearchBody,
  limit = 10000,
): Promise<{ items: SelectedRow[]; total: number; truncated: boolean }> {
  const scope = sessionBranch();
  if (!scope || scope.branchId !== body.branchId) return Promise.reject(new ApiError(403, 'BRANCH_REQUIRED'));
  const { branchId, search, searchField, tagIds, hasOverdueActivity, filterTree } = body;
  const sort = 'sort' in body && typeof body.sort === 'string' ? body.sort : undefined;
  const request = { branchId, search, searchField, tagIds, hasOverdueActivity, filterTree, sort, limit };
  return crmQueries().fetchQuery({
    queryKey: ['crm-leads', 'selection', scope, request],
    queryFn: async () => (await crmHttp().write<{ items: SelectedRow[]; total: number; truncated: boolean }>(
      'POST', '/leads/selection', request, { key: newIdempotencyKey(), scope },
    )).data,
  });
}

/** GET /api/tenant/crm/v1/assignable-owners; BRANCH_REQUIRED, delegated to XR-LK. */
export function listAssignableOwners(
  branchId: string,
  resource: 'leads' | 'opportunities' = 'leads',
): Promise<{ id: string; displayName: string; avatarUrl: string | null }[]> {
  return sharedAssignableOwners(branchId, resource, 'update').then((page) => page.items);
}

/** GET /api/tenant/crm/v1/settings/reasons?kind=DISQUALIFICATION&active=true; NONE, no scope headers. */
export function listDisqualificationReasons(): Promise<{ id: string; code: string; nameEn: string; nameAr: string }[]> {
  return listReasons({ kind: 'DISQUALIFICATION', active: 'true' }).then((page) => page.items);
}

/** GET /api/tenant/crm/v1/static-data (pagination); no scope headers. */
export function listPageSizes(): Promise<{ pageSizes: number[]; defaultPageSize: number }> {
  return sharedPageSizes();
}
