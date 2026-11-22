import { CreateLeadBody, UpdateLeadBody } from './lead-form/lead-draft';
import { LeadSearchBody } from './lead-search/lead-search.compile';
import {
  fakeBoard,
  fakeCanManageTags,
  fakeCheckLeadDuplicates,
  fakeCreateLead,
  fakeDeleteLead,
  fakeGetLead,
  fakeGetLeadCapabilities,
  fakeLeadKpis,
  fakeListBranchOwners,
  fakeListCompanyContacts,
  fakeListCompanyOptions,
  fakeListLeadBranches,
  fakeListLeadCurrencies,
  fakeListLeadCustomFields,
  fakeListLeadSources,
  fakeListLeadStages,
  fakeMove,
  fakePatchLead,
  fakeSearch,
  fakeSearchOptions,
  fakeSetLeadColor,
  fakeSetLeadRating,
  fakeStagePage,
  fakeUpdateLead,
} from './leads.fake';
import {
  BoardLane,
  BranchOption,
  CardColor,
  CompanyContactOption,
  CompanyOption,
  CurrencyOption,
  LeadBoard,
  LeadCustomField,
  LeadDetail,
  LeadKpis,
  LeadRow,
  LeadSearchOptions,
  LeadStage,
  LeadsCapabilities,
  OwnerOption,
  Page,
  SourceOption,
} from './leads.model';
import { DuplicateCheckPayload, DuplicateCheckResponse } from '../shared/record/duplicate-strip/duplicate.model';

export type LeadListSearchBody = LeadSearchBody & {
  partyId?: string;
  excludeId?: string;
};

/** POST /api/tenant/crm/v1/leads/board — body is the same for /leads/board, /leads/board/stages/:id, /leads/search, /leads/kpis. */
export function loadBoard(body: LeadListSearchBody): Promise<LeadBoard> {
  return fakeBoard(body);
}

/** POST /api/tenant/crm/v1/leads/board/stages/:id — body is the same for /leads/board, /leads/board/stages/:id, /leads/search, /leads/kpis. */
export function loadStagePage(stageId: string, body: LeadListSearchBody, page: number): Promise<BoardLane> {
  return fakeStagePage(stageId, body, page);
}

/** POST /api/tenant/crm/v1/leads/search — body is the same for /leads/board, /leads/board/stages/:id, /leads/search, /leads/kpis. */
export function searchLeads(body: LeadListSearchBody, page: number, limit: number): Promise<Page<LeadRow>> {
  return fakeSearch(body, page, limit);
}

/** POST /api/tenant/crm/v1/leads/kpis — body is the same for /leads/board, /leads/board/stages/:id, /leads/search, /leads/kpis. */
export function loadLeadKpis(body: LeadListSearchBody): Promise<LeadKpis> {
  return fakeLeadKpis(body);
}

/** GET /api/tenant/crm/v1/leads/search-options */
export function loadSearchOptions(): Promise<LeadSearchOptions> {
  return fakeSearchOptions();
}

/** POST /api/tenant/crm/v1/leads/:id/stage { stageId, disqualificationReasonId? }: the lead detail. */
export function moveLead(leadId: string, stageId: string, disqualificationReasonId?: string): Promise<LeadDetail> {
  return fakeMove(leadId, stageId, disqualificationReasonId);
}

/** PATCH /api/tenant/crm/v1/leads/:id (card/board inline rating & color): the lead detail. */
export function updateLead(
  id: string,
  changes: { rating?: number; cardColor?: CardColor | null },
  expectedUpdatedAt?: string,
): Promise<LeadDetail> {
  return fakeUpdateLead(id, changes, expectedUpdatedAt);
}

/** DELETE /api/tenant/crm/v1/leads/:id */
export function deleteLead(id: string): Promise<void> {
  return fakeDeleteLead(id);
}

/** GET /api/tenant/crm/v1/leads/:id */
export function getLead(id: string): Promise<LeadDetail> {
  return fakeGetLead(id);
}

/** POST /api/tenant/crm/v1/leads (header x-idempotency-key UUIDv7) */
export function createLead(body: CreateLeadBody, idempotencyKey: string): Promise<LeadDetail> {
  return fakeCreateLead(body, idempotencyKey);
}

/** PATCH /api/tenant/crm/v1/leads/:id */
export function patchLead(id: string, body: UpdateLeadBody): Promise<LeadDetail> {
  return fakePatchLead(id, body);
}

/** PATCH /api/tenant/crm/v1/leads/:id { rating } */
export function setLeadRating(id: string, rating: number): Promise<LeadDetail> {
  return fakeSetLeadRating(id, rating);
}

/** PATCH /api/tenant/crm/v1/leads/:id { cardColor } */
export function setLeadColor(id: string, cardColor: CardColor | null): Promise<LeadDetail> {
  return fakeSetLeadColor(id, cardColor);
}

/** POST /api/tenant/crm/v1/leads/duplicate-check: { matches }. */
export function checkLeadDuplicates(probe: DuplicateCheckPayload): Promise<DuplicateCheckResponse> {
  return fakeCheckLeadDuplicates(probe);
}

/** GET /api/tenant/crm/v1/leads/capabilities?branchId=:branchId */
export function getLeadCapabilities(branchId: string): Promise<LeadsCapabilities> {
  return fakeGetLeadCapabilities(branchId);
}

/** GET /api/tenant/crm/v1/leads/company-options */
export function listCompanyOptions(branchId: string, search: string): Promise<CompanyOption[]> {
  return fakeListCompanyOptions(branchId, search);
}

/** GET /api/tenant/crm/v1/leads/company-options/:companyPartyId/contacts?branchId=:branchId */
export function listCompanyContacts(branchId: string, companyPartyId: string): Promise<CompanyContactOption[]> {
  return fakeListCompanyContacts(branchId, companyPartyId);
}

/** GET /api/tenant/core/v1/branches */
export function listLeadBranches(): Promise<BranchOption[]> {
  return fakeListLeadBranches();
}

/** The `resource` query value of GET crm/v1/assignable-owners. */
export type AssignableOwnersResource = 'leads' | 'opportunities';

/**
 * GET /api/tenant/crm/v1/assignable-owners?branchId=:branchId&resource=:resource&action=:action (first page of items).
 * The fake grants owners from the branch capabilities for both resources.
 */
export async function listBranchOwners(
  branchId: string,
  action: 'create' | 'update' = 'create',
  resource: AssignableOwnersResource = 'leads',
): Promise<OwnerOption[]> {
  void resource;
  return (await fakeListBranchOwners(branchId, action)).items;
}

/** GET /api/tenant/crm/v1/lead-sources */
export function listLeadSources(): Promise<SourceOption[]> {
  return fakeListLeadSources();
}

/** GET /api/tenant/crm/v1/lead-stages */
export function listLeadStages(): Promise<LeadStage[]> {
  return fakeListLeadStages();
}

/** GET /api/tenant/core/v1/currencies */
export function listLeadCurrencies(): Promise<CurrencyOption[]> {
  return fakeListLeadCurrencies();
}

/** GET /api/tenant/crm/v1/custom-fields?ownerType=LEAD */
export function listLeadCustomFields(): Promise<LeadCustomField[]> {
  return fakeListLeadCustomFields();
}

/** Session permission check: crm.tags.manage */
export function canManageTags(): boolean {
  return fakeCanManageTags();
}
