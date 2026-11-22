import { sharedErrorKeyOf } from '../../../core/api/api-errors';
import { listAssignableOwners as listLeadAssignableOwners, listPageSizes as listLeadPageSizes } from '../leads/lead-bulk/lead-bulk.api';
import { listBranchOwners, listLeadBranches, listLeadCurrencies } from '../leads/leads.api';
import {
  fakeAttachOpportunityTags,
  fakeCanManagePipelines,
  fakeCanManageTags,
  fakeCreateOpportunity,
  fakeDeleteOpportunity,
  fakeDetachOpportunityTag,
  fakeGetCustomerOption,
  fakeGetOpportunity,
  fakeGetOpportunityCapabilities,
  fakeGetOpportunityCustomValues,
  fakeGetPipeline,
  fakeGetRelatedCounts,
  fakeListCustomerContacts,
  fakeListCustomerOpportunities,
  fakeListLinkedQuotations,
  fakeListOpportunityCustomFields,
  fakeGetOpportunityReasons,
  fakeListOpportunityTags,
  fakeListPipelines,
  fakeListStageHistory,
  fakeLoadBoard,
  fakeLoadStagePage,
  fakeMoveOpportunityStage,
  fakePatchOpportunity,
  fakeSearchCustomerOptions,
  fakeSearchOpportunities,
  fakeSelectOpportunities,
  fakeTransferOpportunityPipeline,
} from './opportunities.fake';
import type {
  BoardBody,
  BoardResponse,
  BranchOption,
  CreateOpportunityBody,
  CurrencyOption,
  CustomFieldDef,
  CustomerContactOption,
  CustomerOption,
  LinkedQuotation,
  MoveStageBody,
  OpportunityCapabilities,
  OpportunityRelatedCounts,
  OpportunityRow,
  OpportunitySearchBody,
  OpportunityTag,
  OpportunityTagView,
  OwnerOption,
  Page,
  PipelineView,
  OpportunityReasonListResponse,
  OpportunityReasonsQuery,
  SelectedOpportunity,
  StageHistoryItem,
  StagePageBody,
  StagePageResponse,
  TransferPipelineBody,
  UpdateOpportunityBody,
} from './opportunities.model';

export const OPPORTUNITY_ERROR_KEYS: Record<string, string> = {
  OPPORTUNITY_NOT_FOUND: 'opportunities.errors.OPPORTUNITY_NOT_FOUND',
  'CRM.OPPORTUNITY.CONCURRENT_UPDATE': 'opportunities.errors.CRM.OPPORTUNITY.CONCURRENT_UPDATE',
  OPPORTUNITY_LOST_REASON_REQUIRED: 'opportunities.errors.OPPORTUNITY_LOST_REASON_REQUIRED',
  CRM_REASON_REQUIRED: 'opportunities.errors.CRM_REASON_REQUIRED',
  CRM_REASON_KIND_MISMATCH: 'opportunities.errors.CRM_REASON_KIND_MISMATCH',
  CRM_REASON_UNAVAILABLE: 'opportunities.errors.CRM_REASON_UNAVAILABLE',
  CUSTOMER_PROFILE_BLACKLISTED: 'opportunities.errors.CUSTOMER_PROFILE_BLACKLISTED',
  CUSTOMER_PROFILE_NOT_FOUND: 'opportunities.errors.CUSTOMER_PROFILE_NOT_FOUND',
  OPPORTUNITY_OWNER_INELIGIBLE: 'opportunities.errors.OPPORTUNITY_OWNER_INELIGIBLE',
  PIPELINE_STAGE_NOT_FOUND: 'opportunities.errors.PIPELINE_STAGE_NOT_FOUND',
  OPPORTUNITY_CREATE_STAGE_TERMINAL: 'opportunities.errors.OPPORTUNITY_CREATE_STAGE_TERMINAL',
  OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED: 'opportunities.errors.OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED',
  'CRM.OPPORTUNITY.STALE_MOVE': 'opportunities.errors.CRM.OPPORTUNITY.STALE_MOVE',
  OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH: 'opportunities.errors.OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH',
  OPPORTUNITY_LEAD_CUSTOMER_MISMATCH: 'opportunities.errors.OPPORTUNITY_LEAD_CUSTOMER_MISMATCH',
  OPPORTUNITY_PIPELINE_UNCHANGED: 'opportunities.errors.OPPORTUNITY_PIPELINE_UNCHANGED',
  OPPORTUNITY_BOARD_CURSOR_INVALID: 'opportunities.errors.OPPORTUNITY_BOARD_CURSOR_INVALID',
  OPPORTUNITY_CREATE_IDEMPOTENCY_MISMATCH: 'opportunities.errors.OPPORTUNITY_CREATE_IDEMPOTENCY_MISMATCH',
  CRM_OPPORTUNITIES_DISABLED: 'opportunities.errors.CRM_OPPORTUNITIES_DISABLED',
  CRM_BRANCH_MISMATCH: 'opportunities.errors.CRM_BRANCH_MISMATCH',
  CRM_VALIDATION_FAILED: 'opportunities.errors.CRM_VALIDATION_FAILED',
  CRM_SCOPED_PERMISSION_DENIED: 'opportunities.errors.CRM_SCOPED_PERMISSION_DENIED',
  OPPORTUNITY_FILTER_TAGS_CONFLICT: 'opportunities.errors.OPPORTUNITY_FILTER_TAGS_CONFLICT',
  OPPORTUNITY_PIPELINE_MISMATCH: 'opportunities.errors.OPPORTUNITY_PIPELINE_MISMATCH',
  OPPORTUNITY_CREATE_IDEMPOTENCY_INVALID: 'opportunities.errors.OPPORTUNITY_CREATE_IDEMPOTENCY_INVALID',
  OPPORTUNITY_SELECTION_TOO_LARGE: 'opportunities.errors.OPPORTUNITY_SELECTION_TOO_LARGE',
  OPPORTUNITY_HISTORY_CURSOR_INVALID: 'opportunities.errors.OPPORTUNITY_HISTORY_CURSOR_INVALID',
  CRM_TAG_UNKNOWN: 'opportunities.errors.CRM_TAG_UNKNOWN',
  CRM_RECORD_TAG_ALREADY_ATTACHED: 'opportunities.errors.CRM_RECORD_TAG_ALREADY_ATTACHED',
  CRM_RECORD_TAG_NOT_FOUND: 'opportunities.errors.CRM_RECORD_TAG_NOT_FOUND',
  PIPELINE_NOT_FOUND: 'opportunities.errors.PIPELINE_NOT_FOUND',
  INVALID_FILTER_TREE: 'opportunities.errors.INVALID_FILTER_TREE',
  LEAD_NOT_FOUND: 'opportunities.errors.LEAD_NOT_FOUND',
  PARTY_NOT_FOUND: 'opportunities.errors.PARTY_NOT_FOUND',
};

/** Codes without an opportunities text (GW.IDEM.*, rate limit, session) use the shared `apiErrors.*` message. */
export function opportunitySharedErrorKey(code: string): string | null {
  const shared = sharedErrorKeyOf(code);
  return shared ? `apiErrors.${shared}` : null;
}

/** GET /api/tenant/crm/v1/pipelines — active pipelines the user can use, with ranked stages. */
export function listPipelines(): Promise<PipelineView[]> {
  return fakeListPipelines();
}

/** GET /api/tenant/crm/v1/pipelines/:id */
export function getPipeline(id: string): Promise<PipelineView> {
  return fakeGetPipeline(id);
}

/** POST /api/tenant/crm/v1/pipelines/:id/board (limitPerStage: 0 returns stage summaries only). */
export function loadBoard(pipelineId: string, body: BoardBody): Promise<BoardResponse> {
  return fakeLoadBoard(pipelineId, body);
}

/** POST /api/tenant/crm/v1/pipelines/:id/stages/:stageId/opportunities */
export function loadStagePage(
  pipelineId: string,
  stageId: string,
  body: StagePageBody,
): Promise<StagePageResponse> {
  return fakeLoadStagePage(pipelineId, stageId, body);
}

export type OpportunitySelectionRequest = OpportunitySearchBody & { limit: number };
export interface OpportunitySelectionResponse {
  items: SelectedOpportunity[];
  total: number;
  truncated: boolean;
}

/** OpportunitySelectionDto: the search filters plus optional sort and limit, never a page. */
export function toOpportunitySelectionRequest(body: OpportunitySearchBody, limit: number): OpportunitySelectionRequest {
  const { page: _page, limit: _limit, ...filters } = body as OpportunitySearchBody & { page?: unknown; limit?: unknown };
  return { ...filters, limit };
}

/**
 * POST /api/tenant/crm/v1/opportunities/selection (crm-app opportunities.controller.ts:168 `selection`).
 * Body: OpportunitySelectionDto (filters + limit, no page). Fake-only until Phase 5.
 */
export function selectOpportunities(
  body: OpportunitySearchBody,
  limit = 10000,
): Promise<OpportunitySelectionResponse> {
  const { limit: requestLimit, ...filters } = toOpportunitySelectionRequest(body, limit);
  return fakeSelectOpportunities(filters, requestLimit);
}

/** GET /api/tenant/crm/v1/assignable-owners?resource=opportunities&action=update */
export function listAssignableOwners(branchId: string): Promise<OwnerOption[]> {
  return listLeadAssignableOwners(branchId, 'opportunities');
}

/** POST /api/tenant/trade/v1/documents/counts-by-crm-opportunity */
export function getRelatedCounts(id: string): Promise<OpportunityRelatedCounts> {
  return fakeGetRelatedCounts(id);
}

/** GET /api/tenant/trade/v1/quotations?crmOpportunityId=:id&page=:page&limit=:limit */
export function listLinkedQuotations(id: string, page: number, limit: number): Promise<Page<LinkedQuotation>> {
  return fakeListLinkedQuotations(id, page, limit);
}

/** POST /api/tenant/crm/v1/opportunities/search */
export function searchOpportunities(
  body: OpportunitySearchBody,
  page: number,
  limit: number,
): Promise<Page<OpportunityRow>> {
  return fakeSearchOpportunities(body, page, limit);
}

/** GET /api/tenant/crm/v1/opportunities?branchId=:branchId&customerProfileId=:customerProfileId */
export function listCustomerOpportunities(
  branchId: string,
  customerProfileId: string,
  page: number,
  limit: number,
): Promise<Page<OpportunityRow>> {
  return fakeListCustomerOpportunities(branchId, customerProfileId, page, limit);
}

/** GET /api/tenant/crm/v1/opportunities/:id */
export function getOpportunity(id: string): Promise<OpportunityRow> {
  return fakeGetOpportunity(id);
}

/** POST /api/tenant/crm/v1/opportunities (header x-idempotency-key UUIDv7) */
export function createOpportunity(body: CreateOpportunityBody, idempotencyKey: string): Promise<OpportunityRow> {
  return fakeCreateOpportunity(body, idempotencyKey);
}

/** PATCH /api/tenant/crm/v1/opportunities/:id */
export function patchOpportunity(id: string, body: UpdateOpportunityBody): Promise<OpportunityRow> {
  return fakePatchOpportunity(id, body);
}

/** POST /api/tenant/crm/v1/opportunities/:id/stage */
export function moveOpportunityStage(id: string, body: MoveStageBody): Promise<OpportunityRow> {
  return fakeMoveOpportunityStage(id, body);
}

/** PUT /api/tenant/crm/v1/opportunities/:id/pipeline */
export function transferOpportunityPipeline(
  id: string,
  body: TransferPipelineBody,
  idempotencyKey: string,
): Promise<OpportunityRow> {
  return fakeTransferOpportunityPipeline(id, body, idempotencyKey);
}

/** DELETE /api/tenant/crm/v1/opportunities/:id */
export function deleteOpportunity(id: string, reason?: string): Promise<void> {
  return fakeDeleteOpportunity(id, reason);
}

/** GET /api/tenant/crm/v1/opportunities/:id/tags */
export function listOpportunityTags(id: string): Promise<OpportunityTagView[]> {
  return fakeListOpportunityTags(id);
}

/** POST /api/tenant/crm/v1/opportunities/:id/tags */
export function attachOpportunityTags(id: string, tagIds: string[]): Promise<OpportunityTagView[]> {
  return fakeAttachOpportunityTags(id, tagIds);
}

/** DELETE /api/tenant/crm/v1/opportunities/:id/tags/:tagId */
export function detachOpportunityTag(id: string, tagId: string): Promise<void> {
  return fakeDetachOpportunityTag(id, tagId);
}

/**
 * GET /api/tenant/crm/v1/opportunities/capabilities?branchId=:branchId
 * The wire answer is `{ branchId, opportunities }` (opportunities.service.ts getCapabilities); the views read the
 * inner `opportunities` object, so the mapping lives here.
 */
export async function getOpportunityCapabilities(branchId: string): Promise<OpportunityCapabilities> {
  return (await fakeGetOpportunityCapabilities(branchId)).opportunities;
}

/** GET /api/tenant/crm/v1/opportunities/:id/stage-history?cursor=:cursor (default limit 100) */
export function listStageHistory(
  id: string,
  cursor: string | null,
): Promise<{ items: StageHistoryItem[]; nextCursor: string | null }> {
  return fakeListStageHistory(id, cursor);
}

/**
 * GET /api/tenant/crm/v1/opportunities/reasons?kind=:kind -> { items } (opportunities.controller.ts `reasons`).
 * Same `(query) -> { items }` shape as the settings reasons api, but its own route: it needs only
 * crm.opportunities.read (settings/reasons needs crm.settings.read), `kind` is required, there is no `active`
 * parameter (active reasons only), and each item is the narrow picker view (no isActive/isSystem/revision).
 */
export function listReasons(query: OpportunityReasonsQuery): Promise<OpportunityReasonListResponse> {
  return fakeGetOpportunityReasons(query);
}

/** GET /api/tenant/crm/v1/customer-profiles?branchId=:branchId&search=:query&limit=20 */
export function searchCustomerOptions(branchId: string, query: string): Promise<CustomerOption[]> {
  return fakeSearchCustomerOptions(branchId, query);
}

/** GET /api/tenant/crm/v1/customer-profiles/:id */
export function getCustomerOption(id: string): Promise<CustomerOption> {
  return fakeGetCustomerOption(id);
}

/** GET /api/tenant/crm/v1/customer-profiles/:id (contacts[] + customer Party for INDIVIDUAL) */
export function listCustomerContacts(customerProfileId: string): Promise<CustomerContactOption[]> {
  return fakeListCustomerContacts(customerProfileId);
}

/** GET /api/tenant/crm/v1/custom-fields?ownerType=OPPORTUNITY */
export function listOpportunityCustomFields(): Promise<CustomFieldDef[]> {
  return fakeListOpportunityCustomFields();
}

/** GET /api/tenant/crm/v1/custom-fields/values?branchId=:branchId&ownerType=OPPORTUNITY&ownerId=:id */
export function getOpportunityCustomValues(branchId: string, id: string): Promise<Record<string, unknown>> {
  return fakeGetOpportunityCustomValues(branchId, id);
}

/**
 * GET /api/tenant/crm/v1/assignable-owners?branchId=:branchId&resource=opportunities&action=:action (first page of items).
 * Pass 'update' in edit flows, 'create' in create flows. A branch without a grant (unknown or inactive) is
 * 403 CRM_SCOPED_PERMISSION_DENIED, never an empty list.
 */
export async function listOwners(branchId: string, action: 'create' | 'update' = 'create'): Promise<OwnerOption[]> {
  return listBranchOwners(branchId, action, 'opportunities');
}

/** GET /api/tenant/core/v1/currencies */
export async function listCurrencies(): Promise<CurrencyOption[]> {
  return listLeadCurrencies();
}

/** GET /api/tenant/core/v1/branches */
export function listBranches(): Promise<BranchOption[]> {
  return listLeadBranches();
}

/** GET /api/tenant/crm/v1/settings/static-data (pagination) */
export function listPageSizes(): Promise<{ pageSizes: number[]; defaultPageSize: number }> {
  return listLeadPageSizes();
}

/** Session permission check: crm.tags.manage */
export function canManageTags(): boolean {
  return fakeCanManageTags();
}

/** Session permission check: crm.pipelines.manage */
export function canManagePipelines(): boolean {
  return fakeCanManagePipelines();
}
