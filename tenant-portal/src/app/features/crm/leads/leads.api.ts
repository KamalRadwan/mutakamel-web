import { inject } from '@angular/core';
import { CoreHttp } from '../../../core/api/core-http';
import { can } from '../../../shared/widgets/dashboard/analytics-permissions';
import { runInCrm } from '../shared/crm-runtime';
import { listAssignableOwners } from '../shared/lookups/assignable-owners';
import { branchOptions, sessionBranch } from '../shared/lookups/session-branch';
import { ApiError, isRetryableWriteError } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../shared/crm-http';
import { listLeadStages as readStages } from '../settings/lead-stages/lead-stages.api';
import { listLeadSources as readSources } from '../settings/lead-sources/lead-sources.api';
import { listTags } from '../settings/tags/tags.api';
import { listCustomFields } from '../settings/custom-fields/custom-fields.api';
import { CreateLeadBody, UpdateLeadBody } from './lead-form/lead-draft';
import { LeadSearchBody } from './lead-search/lead-search.compile';
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

export interface LeadKpisResponse extends LeadKpis {
  byStage: { stageId: string; count: number }[];
}

/** POST /api/tenant/crm/v1/leads/board: filters and limit 50; no scope headers. */
export function loadBoard(body: LeadListSearchBody): Promise<LeadBoard> {
  return readList('/leads/board', { ...listFilters(body), limit: 50 });
}

/** POST /api/tenant/crm/v1/leads/board/stages/:id: filters, page and limit 50; no scope headers. */
export function loadStagePage(stageId: string, body: LeadListSearchBody, page: number): Promise<BoardLane> {
  return readList(`/leads/board/stages/${stageId}`, { ...listFilters(body), page, limit: 50 });
}

/** POST /api/tenant/crm/v1/leads/search: filters, page and limit; no scope headers. */
export function searchLeads(body: LeadListSearchBody, page: number, limit: number): Promise<Page<LeadRow>> {
  return readList('/leads/search', { ...listFilters(body), page, limit });
}

/** POST /api/tenant/crm/v1/leads/kpis: predicates only, no scope headers or paging/sort. */
export function loadLeadKpis(body: LeadListSearchBody): Promise<LeadKpisResponse> {
  return readList('/leads/kpis', listFilters(body));
}

/** Client composition of independent catalogues; NONE: no scope headers. */
export async function loadSearchOptions(): Promise<LeadSearchOptions> {
  const [stages, sources, tags] = await Promise.allSettled([readStages(), readSources(), listTags()]);
  return {
    stages: stages.status === 'fulfilled' ? stages.value : [],
    sources: sources.status === 'fulfilled' ? sources.value : [],
    tags: tags.status === 'fulfilled' ? tags.value : [],
    unavailable: [stages, sources, tags].flatMap((result, index) => result.status === 'rejected'
      ? [(['stage', 'source', 'tag'] as const)[index]] : []),
  };
}

/** POST /api/tenant/crm/v1/leads/:id/stage { stageId, disqualificationReasonId? }; record branch, no scope headers. */
export function moveLead(leadId: string, stageId: string, disqualificationReasonId?: string): Promise<LeadDetail> {
  return writeList('POST', `/leads/${leadId}/stage`, {
    stageId, ...(disqualificationReasonId ? { disqualificationReasonId } : {}),
  });
}

export async function convertLead(leadId: string, profileType: LeadDetail['leadProfileType']): Promise<LeadDetail> {
  const result = await writeList<{ lead: LeadWire }>('POST', `/leads/${leadId}/convert`, {
    profileType,
    keepLead: true,
  });
  await crmQueries().invalidateQueries({ queryKey: ['crm-customers'] });
  return recordFromWire(result.lead);
}

/** PATCH /api/tenant/crm/v1/leads/:id (inline rating/colour + loaded token); record branch, no scope headers. */
export function updateLead(
  id: string,
  changes: { rating?: number; cardColor?: CardColor | null },
  expectedUpdatedAt?: string,
): Promise<LeadDetail> {
  if (!expectedUpdatedAt) return Promise.reject(new ApiError(400, 'CRM_VALIDATION_FAILED', { expectedUpdatedAt: ['required'] }));
  return writeList('PATCH', `/leads/${id}`, { ...changes, expectedUpdatedAt });
}

/** DELETE /api/tenant/crm/v1/leads/:id; record branch, no scope headers or body. */
export function deleteLead(id: string): Promise<void> {
  return writeList('DELETE', `/leads/${id}`, undefined);
}

/** GET /api/tenant/crm/v1/leads/:id; record branch, NONE: no scope headers. */
export function getLead(id: string): Promise<LeadDetail> {
  const scope = runInCrm(() => sessionBranch());
  if (!scope) return Promise.reject(new ApiError(403, 'BRANCH_REQUIRED'));
  if (!can('crm.leads.read')) return Promise.reject(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
  return crmQueries().fetchQuery({
    queryKey: ['crm-leads', 'detail', scope.branchId, id],
    queryFn: async () => {
      return recordFromWire(await crmHttp().read<LeadWire>(`/leads/${id}`));
    },
  });
}

/** POST /api/tenant/crm/v1/leads; NONE: branch in body, explicit key per create action. */
export async function createLead(body: CreateLeadBody, idempotencyKey: string): Promise<LeadDetail> {
  if (!body.branchId) throw new ApiError(400, 'CRM_VALIDATION_FAILED', { branchId: ['required'] });
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== body.branchId) throw new ApiError(403, 'BRANCH_REQUIRED');
  const http = crmHttp();
  let rejected = rejectedCreateKeys.get(http);
  if (!rejected) rejectedCreateKeys.set(http, rejected = new Set());
  if (rejected.has(idempotencyKey)) throw new ApiError(422, 'GW.IDEM.MISMATCH');
  try {
    const result = await http.write<LeadWire>('POST', '/leads', body, { key: idempotencyKey });
    await invalidateLeads();
    return recordFromWire(result.data);
  } catch (error) {
    if (isIdempotencyMismatch(error)) rejected.add(idempotencyKey);
    throw error;
  }
}

/** PATCH /api/tenant/crm/v1/leads/:id; NONE: record branch, loaded stale token always required. */
export async function patchLead(id: string, body: UpdateLeadBody): Promise<LeadDetail> {
  if (!body.expectedUpdatedAt) throw new ApiError(400, 'CRM_VALIDATION_FAILED', { expectedUpdatedAt: ['required'] });
  // These legacy properties remain type-compatible with the shared fakes, but are never record writes.
  const { contacts, tagIds, ...patch } = body;
  if (contacts !== undefined || tagIds !== undefined) throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  return recordFromWire(await writeList<LeadWire>('PATCH', `/leads/${id}`, patch));
}

/** PATCH /api/tenant/crm/v1/leads/:id; NONE: use the last detail token loaded by this transport. */
export function setLeadRating(id: string, rating: number): Promise<LeadDetail> {
  return patchLead(id, { rating, expectedUpdatedAt: loadedTokens.get(crmHttp())?.get(id) });
}

/** PATCH /api/tenant/crm/v1/leads/:id; NONE: use the last detail token loaded by this transport. */
export function setLeadColor(id: string, cardColor: CardColor | null): Promise<LeadDetail> {
  return patchLead(id, { cardColor, expectedUpdatedAt: loadedTokens.get(crmHttp())?.get(id) });
}

/** POST /api/tenant/crm/v1/leads/duplicate-check; NONE: read-like POST, branch in body. */
export function checkLeadDuplicates(probe: DuplicateCheckPayload): Promise<DuplicateCheckResponse> {
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== probe.branchId) return Promise.reject(new ApiError(403, 'BRANCH_REQUIRED'));
  return crmQueries().fetchQuery({
    queryKey: ['crm-leads', 'duplicates', probe],
    queryFn: async () => (await crmHttp().write<DuplicateCheckResponse>('POST', '/leads/duplicate-check', probe,
      { key: newIdempotencyKey() })).data,
  });
}

/** POST leads/:id/tags; NONE: record branch, only the new ids. */
export function attachLeadTags(id: string, tagIds: string[]): Promise<unknown> {
  return writeList('POST', `/leads/${id}/tags`, { tagIds });
}

/** DELETE leads/:id/tags/:tagId; NONE: record branch, no body. */
export function detachLeadTag(id: string, tagId: string): Promise<void> {
  return writeList('DELETE', `/leads/${id}/tags/${tagId}`, undefined);
}

type LeadWire = LeadDetail & {
  party?: { legalName: string | null; taxNumber: string | null; commercialRegistrationNumber: string | null };
};
const loadedTokens = new WeakMap<CrmHttpTransport, Map<string, string>>();
const rejectedCreateKeys = new WeakMap<CrmHttpTransport, Set<string>>();

function isIdempotencyMismatch(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'));
}

function recordFromWire(detail: LeadWire): LeadDetail {
  let tokens = loadedTokens.get(crmHttp());
  if (!tokens) loadedTokens.set(crmHttp(), tokens = new Map());
  tokens.set(detail.id, detail.updatedAt);
  const record = { ...detail,
    legalName: detail.party?.legalName ?? detail.legalName ?? null,
    taxNumber: detail.party?.taxNumber ?? detail.taxNumber ?? null,
    commercialRegistrationNumber: detail.party?.commercialRegistrationNumber ?? detail.commercialRegistrationNumber ?? null,
    companyPhones: detail.leadProfileType === 'CORPORATE' ? [...detail.phones] : [],
    customFields: detail.customFields ?? {},
  };
  // The read contract does not establish whether a company is shared; the server enforces Party manage.
  Reflect.deleteProperty(record, 'existingCompany');
  return record;
}

async function invalidateLeads(): Promise<void> {
  await crmQueries().cancelQueries({ queryKey: ['crm-leads'] });
  await crmQueries().invalidateQueries({ queryKey: ['crm-leads'] });
}

/** GET /api/tenant/crm/v1/leads/capabilities?branchId=:branchId */
export function getLeadCapabilities(branchId: string): Promise<LeadsCapabilities> {
  // BRANCH_REQUIRED: both headers from the validated session selection, never a first-branch fallback.
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== branchId) return Promise.reject(new ApiError(403, 'BRANCH_REQUIRED'));
  return crmQueries().fetchQuery({
    queryKey: ['crm-leads', 'capabilities', scope],
    queryFn: () => crmHttp().read('/leads/capabilities', { branchId }, { scope }),
  });
}

/** Whitelist the running image's predicates; related-record and Wave B fields cannot leak into a list call. */
function listFilters(body: LeadListSearchBody): LeadSearchBody {
  const { branchId, search, searchField, filterTree, tagIds, hasOverdueActivity } = body;
  return { branchId, ...(search !== undefined ? { search } : {}), ...(searchField ? { searchField } : {}),
    ...(filterTree ? { filterTree } : {}), ...(tagIds ? { tagIds } : {}),
    ...(hasOverdueActivity !== undefined ? { hasOverdueActivity } : {}) };
}

/** Read-only POSTs have their branch in the body; NONE: no scope headers. */
function readList<T>(path: string, body: LeadSearchBody & { page?: number; limit?: number }): Promise<T> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-leads', path, body],
    queryFn: async () => (await crmHttp().write<T>('POST', path, body, { key: newIdempotencyKey() })).data,
  });
}

const pendingListWrites = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string | undefined; blocked?: ApiError }>>();

/** Record-branch writes: NONE, no scope headers. Retain a retry key only while the result is uncertain. */
async function writeList<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown): Promise<T> {
  const http = crmHttp();
  let pending = pendingListWrites.get(http);
  if (!pending) pendingListWrites.set(http, pending = new Map());
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify(body);
  const previous = pending.get(action);
  if (previous?.bodyJson === bodyJson && previous?.blocked) throw previous.blocked;
  const key = previous?.bodyJson === bodyJson && previous ? previous.key : newIdempotencyKey();
  pending.delete(action);
  let data: T;
  try {
    data = (await http.write<T>(method, path, body, { key })).data;
  } catch (error) {
    if (isRetryableWriteError(error) || error instanceof ApiError && error.status === 401) pending.set(action, { key, bodyJson });
    if (isIdempotencyMismatch(error)) pending.set(action, { key, bodyJson, blocked: error });
    if (!(method === 'DELETE' && error instanceof ApiError && error.status === 404)) throw error;
    data = undefined as T;
  }
  await crmQueries().cancelQueries({ queryKey: ['crm-leads'] });
  await crmQueries().invalidateQueries({ queryKey: ['crm-leads'] });
  return data;
}

/** GET /api/tenant/crm/v1/leads/company-options; NONE: branch in query. */
export function listCompanyOptions(branchId: string, search: string): Promise<CompanyOption[]> {
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== branchId) return Promise.reject(new ApiError(403, 'BRANCH_REQUIRED'));
  return crmQueries().fetchQuery({ queryKey: ['crm-leads', 'companies', branchId, search],
    queryFn: () => crmHttp().read('/leads/company-options', { branchId, search, limit: 50 }) });
}

/** GET /leads/company-options/:id/contacts; BRANCH_REQUIRED: both validated session headers. */
export function listCompanyContacts(branchId: string, companyPartyId: string): Promise<CompanyContactOption[]> {
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== branchId) return Promise.reject(new ApiError(403, 'BRANCH_REQUIRED'));
  return crmQueries().fetchQuery({ queryKey: ['crm-leads', 'company-contacts', scope, companyPartyId],
    queryFn: () => crmHttp().read(`/leads/company-options/${companyPartyId}/contacts`, { branchId }, { scope }) });
}

/** GET /api/tenant/core/v1/organization/branches; no scope headers. */
export function listLeadBranches(): Promise<BranchOption[]> {
  return runInCrm(() => branchOptions());
}

/** The `resource` query value of GET crm/v1/assignable-owners. */
export type AssignableOwnersResource = 'leads' | 'opportunities';

/**
 * GET /api/tenant/crm/v1/assignable-owners?branchId=:branchId&resource=:resource&action=:action (first page of items).
 * BRANCH_REQUIRED: both session scope headers; no request for a mismatched branch.
 */
export async function listBranchOwners(
  branchId: string,
  action: 'create' | 'update' = 'create',
  resource: AssignableOwnersResource = 'leads',
): Promise<OwnerOption[]> {
  return (await listAssignableOwners(branchId, resource, action)).items;
}

/** GET /api/tenant/crm/v1/acquisition-sources; NONE: catalogue. */
export function listLeadSources(): Promise<SourceOption[]> {
  return readSources();
}

/** GET /api/tenant/crm/v1/lead-stages; NONE: catalogue. */
export function listLeadStages(): Promise<LeadStage[]> {
  return readStages();
}

/** Core GET currencies/options; NONE: authenticated active currency catalogue (BE-XR2). */
export function listLeadCurrencies(): Promise<CurrencyOption[]> {
  const http = runInCrm(() => inject(CoreHttp));
  return crmQueries().fetchQuery({ queryKey: ['crm-leads', 'currencies'],
    queryFn: () => http.read('/api/tenant/core/v1/currencies/options') });
}

/** GET custom-fields; NONE: catalogue, filter owner types locally. */
export async function listLeadCustomFields(): Promise<LeadCustomField[]> {
  return (await listCustomFields()).filter((field) => field.isActive && ['LEAD', 'LEAD_AND_PARTY'].includes(field.ownerType))
    .map((field) => ({ ...field, options: field.options.filter((option) => option.isActive),
      requiredOnCreate: field.requirements.some((rule) => rule.operation === 'CREATE' && rule.isRequired),
      requiredOnUpdate: field.requirements.some((rule) => rule.operation === 'UPDATE' && rule.isRequired),
    }));
}

/** Session permission check: crm.tags.manage */
export function canManageTags(): boolean {
  return can('crm.tags.manage');
}
