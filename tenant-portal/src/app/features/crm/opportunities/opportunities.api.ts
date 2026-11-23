import { inject } from '@angular/core';
import { ApiError, isRetryableWriteError, sharedErrorKeyOf } from '../../../core/api/api-errors';
import { CoreHttp, type CoreQuery, type CoreWriteMethod } from '../../../core/api/core-http';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { hasTenantWidePermission } from '../../../core/auth/tenant-wide-permission';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { listActiveCoreCurrencies } from '../../../shared/lookups/core-currencies';
import { can } from '../../../shared/widgets/dashboard/analytics-permissions';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../shared/crm-http';
import { runInCrm } from '../shared/crm-runtime';
import { listAssignableOwners as sharedOwners } from '../shared/lookups/assignable-owners';
import { customerOptions, customerContacts } from '../shared/lookups/customer-pickers';
import { branchOptions, sessionBranch } from '../shared/lookups/session-branch';
import { listPageSizes as sharedPageSizes } from '../shared/lookups/page-sizes';
import type { CustomerDetail } from '../customers/customers.model';
import { isRequiredForOperation, type CustomField } from '../settings/custom-fields/custom-fields.model';
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

const recordKey = ['crm-opportunities'] as const;
const retries = new WeakMap<CrmHttpTransport, Map<string, { bodyJson: string; key: string }>>();
const mismatches = new WeakMap<CrmHttpTransport, Map<string, ApiError>>();

/** Record and catalogue reads have no scope headers; the ID/query supplies their branch. */
function read<T>(path: string, query?: CoreQuery): Promise<T> {
  return crmQueries().fetchQuery({ queryKey: [...recordKey, path, query], queryFn: () => crmHttp().read<T>(path, query) });
}

/** No scope headers on record writes. Keep the exact payload/key after an uncertain response. */
async function write<T>(method: CoreWriteMethod, path: string, body: object, key?: string, invalidate = true): Promise<T> {
  const http = crmHttp();
  let pending = retries.get(http);
  if (!pending) retries.set(http, pending = new Map());
  const action = `${method} ${path}`;
  const mismatch = mismatches.get(http)?.get(action);
  if (mismatch) throw mismatch;
  const bodyJson = JSON.stringify(body);
  const previous = pending.get(action);
  const request = { bodyJson, key: key ?? (previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey()) };
  pending.set(action, request);
  let data: T;
  try {
    data = (await http.write<T>(method, path, JSON.parse(bodyJson), { key: request.key })).data;
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'))) {
      let blocked = mismatches.get(http);
      if (!blocked) mismatches.set(http, blocked = new Map());
      blocked.set(action, error);
    }
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) pending.delete(action);
    throw error;
  }
  pending.delete(action);
  if (invalidate) {
    await crmQueries().cancelQueries({ queryKey: recordKey });
    await crmQueries().invalidateQueries({ queryKey: recordKey });
  }
  return data;
}

export const OPPORTUNITY_ERROR_KEYS: Record<string, string> = {
  OPPORTUNITY_AMOUNT_SCALE_INVALID: 'oppForm.errors.OPPORTUNITY_AMOUNT_SCALE_INVALID',
  OPPORTUNITY_HISTORY_INTEGRITY_INVALID: 'oppPage.stages.integrityFailed',
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
  return read('/pipelines');
}

/** GET /api/tenant/crm/v1/pipelines/:id */
export function getPipeline(id: string): Promise<PipelineView> {
  return read(`/pipelines/${encodeURIComponent(id)}`);
}

/** POST /api/tenant/crm/v1/pipelines/:id/board (limitPerStage: 0 returns stage summaries only). */
export function loadBoard(pipelineId: string, body: BoardBody): Promise<BoardResponse> {
  return postRead(`/pipelines/${encodeURIComponent(pipelineId)}/board`, {
    ...boardFilters(body), limitPerStage: body.limitPerStage,
  });
}

/** POST /api/tenant/crm/v1/pipelines/:id/stages/:stageId/opportunities */
export function loadStagePage(
  pipelineId: string,
  stageId: string,
  body: StagePageBody,
): Promise<StagePageResponse> {
  return postRead(`/pipelines/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}/opportunities`, {
    ...boardFilters(body), limit: body.limit, ...(body.cursor ? { cursor: body.cursor } : {}),
  });
}

export interface OpportunityCardsBody extends OpportunitySearchBody {
  limit: 25 | 50 | 100;
  cursor?: string;
  stageId?: string;
}

export interface OpportunityCardsResponse {
  pipeline: PipelineView;
  selectedStageId: string | null;
  totalCount: number;
  items: OpportunityRow[];
  pageInfo: StagePageResponse['pageInfo'];
}

/** Header-free POST read; cards use filter-bound cursors, not offset pages. */
export function loadOpportunityCards(pipelineId: string, body: OpportunityCardsBody): Promise<OpportunityCardsResponse> {
  return postRead(`/pipelines/${encodeURIComponent(pipelineId)}/cards`, {
    ...boardFilters(body), limit: body.limit,
    ...(body.cursor ? { cursor: body.cursor } : {}),
    ...(body.stageId ? { stageId: body.stageId } : {}),
  });
}

/** No scope headers: only the current session branch belongs in these search bodies. */
function boardFilters(body: OpportunitySearchBody): OpportunitySearchBody {
  const scope = runInCrm(() => sessionBranch());
  if (!scope) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  return {
    branchId: scope.branchId,
    ...(body.search !== undefined ? { search: body.search.slice(0, 200) } : {}),
    ...(body.searchField !== undefined ? { searchField: body.searchField } : {}),
    ...(body.filterTree !== undefined ? { filterTree: structuredClone(body.filterTree) } : {}),
    ...(body.tagIds !== undefined ? { tagIds: [...body.tagIds] } : {}),
  };
}

/** POST reads participate in the query cache without invalidating the list they just loaded. */
function postRead<T>(path: string, body: object): Promise<T> {
  return crmQueries().fetchQuery({
    queryKey: [...recordKey, path, body],
    queryFn: () => write<T>('POST', path, body, undefined, false),
  });
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
 * BRANCH_REQUIRED: the session company and branch travel in both scope headers.
 */
export function selectOpportunities(
  body: OpportunitySearchBody,
  limit = 10000,
): Promise<OpportunitySelectionResponse> {
  const scope = sessionBranch();
  if (!scope || body.branchId !== scope.branchId) {
    return Promise.reject(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
  }
  const request = toOpportunitySelectionRequest(body, limit);
  return crmQueries().fetchQuery({
    queryKey: [...recordKey, 'selection', scope, request],
    queryFn: async () => (await crmHttp().write<OpportunitySelectionResponse>(
      'POST', '/opportunities/selection', request, { key: newIdempotencyKey(), scope },
    )).data,
  });
}

/** GET /api/tenant/crm/v1/assignable-owners?resource=opportunities&action=update */
export function listAssignableOwners(branchId: string): Promise<OwnerOption[]> {
  return listOwners(branchId, 'update');
}

/** No scope headers: branchId is in the counts-by-party body. */
export function countOpportunitiesByParty(branchId: string, partyIds: string[]): Promise<{ items: { partyId: string; count: number }[] }> {
  return write('POST', '/opportunities/counts-by-party', { branchId, partyIds });
}

/** GET /api/tenant/trade/v1/quotations?crmOpportunityId=:id&page=:page&limit=:limit */
export function listLinkedQuotations(id: string, page: number, limit: number): Promise<Page<LinkedQuotation>> {
  const http = runInCrm(() => inject(CoreHttp));
  // Trade is bare; this gateway row has no scope headers.
  return crmQueries().fetchQuery({
    queryKey: [...recordKey, 'quotations', id, page, limit],
    queryFn: () => http.read('/api/tenant/trade/v1/quotations', { crmOpportunityId: id, page, limit }, { bare: true }),
  });
}

/** POST /api/tenant/crm/v1/opportunities/search */
export async function searchOpportunities(
  body: OpportunitySearchBody,
  page: number,
  limit: number,
): Promise<Page<OpportunityRow>> {
  // Header-free POST read: branch comes from the session, never a saved query or fixture scope.
  const scope = runInCrm(() => sessionBranch());
  if (!scope) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  const http = crmHttp();
  const request = {
    branchId: scope.branchId,
    ...(body.search !== undefined ? { search: body.search.slice(0, 200) } : {}),
    ...(body.searchField !== undefined ? { searchField: body.searchField } : {}),
    ...(body.filterTree !== undefined ? { filterTree: structuredClone(body.filterTree) } : {}),
    ...(body.tagIds !== undefined ? { tagIds: [...body.tagIds] } : {}),
    ...(body.sort !== undefined ? { sort: body.sort } : {}),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    limit: [20, 50, 100].includes(limit) ? limit : 20,
  };
  return crmQueries().fetchQuery({
    queryKey: [...recordKey, 'search', request],
    queryFn: async () => {
      const action = 'POST /opportunities/search';
      const mismatch = mismatches.get(http)?.get(action);
      if (mismatch) throw mismatch;
      let pending = retries.get(http);
      if (!pending) retries.set(http, (pending = new Map()));
      const bodyJson = JSON.stringify(request);
      const previous = pending.get(action);
      const key = previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey();
      pending.delete(action);
      try {
        const result = await http.write<Page<OpportunityRow>>(
          'POST',
          '/opportunities/search',
          request,
          { key },
        );
        return result.data;
      } catch (error) {
        if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401))
          pending.set(action, { bodyJson, key });
        if (
          error instanceof ApiError &&
          (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'))
        ) {
          let blocked = mismatches.get(http);
          if (!blocked) mismatches.set(http, (blocked = new Map()));
          blocked.set(action, error);
        }
        throw error;
      }
    },
  });
}

/** GET /api/tenant/crm/v1/opportunities/:id */
export function getOpportunity(id: string): Promise<OpportunityRow> {
  const blocked = mismatches.get(crmHttp());
  for (const method of ['PATCH', 'POST', 'PUT', 'DELETE']) {
    for (const suffix of ['', '/stage', '/pipeline', '/tags']) blocked?.delete(`${method} /opportunities/${encodeURIComponent(id)}${suffix}`);
  }
  return read(`/opportunities/${encodeURIComponent(id)}`);
}

/** POST /api/tenant/crm/v1/opportunities (header x-idempotency-key UUIDv7) */
export function createOpportunity(body: CreateOpportunityBody, idempotencyKey: string): Promise<OpportunityRow> {
  return write('POST', '/opportunities', body, idempotencyKey);
}

/** PATCH /api/tenant/crm/v1/opportunities/:id */
export function patchOpportunity(id: string, body: UpdateOpportunityBody): Promise<OpportunityRow> {
  return write('PATCH', `/opportunities/${encodeURIComponent(id)}`, body);
}

/** POST /api/tenant/crm/v1/opportunities/:id/stage */
export function moveOpportunityStage(id: string, body: MoveStageBody): Promise<OpportunityRow> {
  const { lostReasonId: _lost, winReasonId: _win, ...waveA } = body;
  return write('POST', `/opportunities/${encodeURIComponent(id)}/stage`, waveA);
}

/** PUT /api/tenant/crm/v1/opportunities/:id/pipeline */
export function transferOpportunityPipeline(
  id: string,
  body: TransferPipelineBody,
  idempotencyKey: string,
): Promise<OpportunityRow> {
  const { lostReasonId: _lost, winReasonId: _win, ...waveA } = body;
  return write('PUT', `/opportunities/${encodeURIComponent(id)}/pipeline`, waveA, idempotencyKey);
}

/** DELETE /api/tenant/crm/v1/opportunities/:id */
export function deleteOpportunity(id: string, reason?: string): Promise<void> {
  return write('DELETE', `/opportunities/${encodeURIComponent(id)}`, reason ? { reason } : {});
}

/** GET /api/tenant/crm/v1/opportunities/:id/tags */
export function listOpportunityTags(id: string): Promise<OpportunityTagView[]> {
  return read(`/opportunities/${encodeURIComponent(id)}/tags`);
}

/** POST /api/tenant/crm/v1/opportunities/:id/tags */
export function attachOpportunityTags(id: string, tagIds: string[]): Promise<OpportunityTagView[]> {
  return write('POST', `/opportunities/${encodeURIComponent(id)}/tags`, { tagIds });
}

/** DELETE /api/tenant/crm/v1/opportunities/:id/tags/:tagId */
export function detachOpportunityTag(id: string, tagId: string): Promise<void> {
  return write('DELETE', `/opportunities/${encodeURIComponent(id)}/tags/${encodeURIComponent(tagId)}`, {});
}

/**
 * GET /api/tenant/crm/v1/opportunities/capabilities?branchId=:branchId
 * The wire answer is `{ branchId, opportunities }` (opportunities.service.ts getCapabilities); the views read the
 * inner `opportunities` object, so the mapping lives here.
 */
export async function getOpportunityCapabilities(branchId: string): Promise<OpportunityCapabilities> {
  // BRANCH_REQUIRED: the selected, unambiguous session branch supplies both headers.
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== branchId) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  const response = await crmQueries().fetchQuery({
    queryKey: [...recordKey, 'capabilities', scope],
    queryFn: () => crmHttp().read<{ opportunities: OpportunityCapabilities }>('/opportunities/capabilities', { branchId }, { scope }),
  });
  return response.opportunities;
}

/** GET /api/tenant/crm/v1/opportunities/:id/stage-history?cursor=:cursor (default limit 100) */
export function listStageHistory(
  id: string,
  cursor: string | null,
): Promise<{ items: StageHistoryItem[]; nextCursor: string | null }> {
  return read(`/opportunities/${encodeURIComponent(id)}/stage-history`, { limit: 100, cursor });
}

/**
 * GET /api/tenant/crm/v1/opportunities/reasons?kind=:kind -> { items } (opportunities.controller.ts `reasons`).
 * Same `(query) -> { items }` shape as the settings reasons api, but its own route: it needs only
 * crm.opportunities.read (settings/reasons needs crm.settings.read), `kind` is required, there is no `active`
 * parameter (active reasons only), and each item is the narrow picker view (no isActive/isSystem/revision).
 */
export function listReasons(query: OpportunityReasonsQuery): Promise<OpportunityReasonListResponse> {
  return listOpportunityReasons(query);
}

/** No scope headers: active WIN/LOSS catalogue for sales users. */
export function listOpportunityReasons(query: OpportunityReasonsQuery): Promise<OpportunityReasonListResponse> {
  return read('/opportunities/reasons', { kind: query.kind });
}

/** GET /api/tenant/crm/v1/customer-profiles?branchId=:branchId&search=:query&limit=20 */
export async function searchCustomerOptions(branchId: string, query: string): Promise<CustomerOption[]> {
  const options = await customerOptions(branchId, query, 20);
  if (!Array.isArray(options)) throw options.error;
  return options.map((item) => ({ ...item, companyName: null, status: null, phone: null, email: null }));
}

/** GET /api/tenant/crm/v1/customer-profiles/:id */
export async function getCustomerOption(id: string): Promise<CustomerOption> {
  const customer = await read<CustomerDetail>(`/customer-profiles/${encodeURIComponent(id)}`);
  return { id: customer.id, partyId: customer.partyId, profileType: customer.profileType,
    displayName: customer.displayName, companyName: customer.companyName, status: customer.status,
    phone: customer.phones[0] ?? null, email: customer.email };
}

/** GET /api/tenant/crm/v1/customer-profiles/:id (contacts[] + customer Party for INDIVIDUAL) */
export function listCustomerContacts(customerProfileId: string): Promise<CustomerContactOption[]> {
  return customerContacts(customerProfileId);
}

/** GET /api/tenant/crm/v1/custom-fields?ownerType=OPPORTUNITY */
export async function listOpportunityCustomFields(): Promise<CustomFieldDef[]> {
  const fields = await read<CustomField[]>('/custom-fields', { ownerType: 'OPPORTUNITY' });
  return fields.filter((field) => field.ownerType === 'OPPORTUNITY' && field.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder).map((field) => ({
      ...field,
      options: field.options.filter((option) => option.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
      requiredOnCreate: isRequiredForOperation(field, 'CREATE', 'OPPORTUNITY'),
      requiredOnUpdate: isRequiredForOperation(field, 'UPDATE', 'OPPORTUNITY'),
    }));
}

/** GET /api/tenant/crm/v1/custom-fields/values?branchId=:branchId&ownerType=OPPORTUNITY&ownerId=:id */
export function getOpportunityCustomValues(branchId: string, id: string): Promise<Record<string, unknown>> {
  return getOpportunity(id).then((row) => row.customFields);
}

/**
 * GET /api/tenant/crm/v1/assignable-owners?branchId=:branchId&resource=opportunities&action=:action (first page of items).
 * Pass 'update' in edit flows, 'create' in create flows. A branch without a grant (unknown or inactive) is
 * 403 CRM_SCOPED_PERMISSION_DENIED, never an empty list.
 */
export async function listOwners(branchId: string, action: 'create' | 'update' = 'create'): Promise<OwnerOption[]> {
  return (await runInCrm(() => sharedOwners(branchId, 'opportunities', action))).items;
}

/** GET /api/tenant/core/v1/currencies */
export async function listCurrencies(): Promise<CurrencyOption[]> {
  return runInCrm(() => hasTenantWidePermission(inject(TenantScopeState).me(), 'currencies.currency.read')
    ? listActiveCoreCurrencies() : Promise.resolve([]));
}

/** GET /api/tenant/core/v1/branches */
export function listBranches(): Promise<BranchOption[]> {
  return runInCrm(() => branchOptions());
}

/** GET /api/tenant/crm/v1/settings/static-data (pagination) */
export function listPageSizes(): Promise<{ pageSizes: number[]; defaultPageSize: number }> {
  return sharedPageSizes();
}

/** Session permission check: crm.tags.manage */
export function canManageTags(): boolean {
  return can('crm.tags.manage');
}

/** Session permission check: crm.pipelines.manage */
export function canManagePipelines(): boolean {
  return can('crm.pipelines.manage');
}
