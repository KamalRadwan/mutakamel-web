import { LeadSearchBody } from '../lead-search/lead-search.compile';
import {
  fakeListAssignableOwners,
  fakeListDisqualificationReasons,
  fakeListPageSizes,
  fakeSelectLeads,
} from '../leads.fake';
import { SelectedRow } from './lead-bulk.model';

/** POST /api/tenant/crm/v1/leads/selection */
export function selectLeads(
  body: LeadSearchBody,
  limit = 10000,
): Promise<{ items: SelectedRow[]; total: number; truncated: boolean }> {
  return fakeSelectLeads(body, limit);
}

/** GET /api/tenant/crm/v1/assignable-owners?branchId=:branchId&resource=:resource&action=update */
export function listAssignableOwners(
  branchId: string,
  resource: 'leads' | 'opportunities' = 'leads',
): Promise<{ id: string; displayName: string; avatarUrl: string | null }[]> {
  void resource;
  return fakeListAssignableOwners(branchId);
}

/** GET /api/tenant/crm/v1/settings/reasons?kind=DISQUALIFICATION&active=true */
export function listDisqualificationReasons(): Promise<{ id: string; code: string; nameEn: string; nameAr: string }[]> {
  return fakeListDisqualificationReasons();
}

/** GET /api/tenant/crm/v1/settings/static-data (pagination) */
export function listPageSizes(): Promise<{ pageSizes: number[]; defaultPageSize: number }> {
  return fakeListPageSizes();
}
