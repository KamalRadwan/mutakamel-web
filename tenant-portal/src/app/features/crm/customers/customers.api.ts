import { listCountries as listGeoCountries } from '../../../core/geo/geo.api';
import { GeoCountry } from '../../../core/geo/geo.model';
import { ApiError, isRetryableWriteError } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { type CoreWriteMethod } from '../../../core/api/core-http';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../shared/crm-http';
import { runInCrm } from '../shared/crm-runtime';
import { sessionBranch } from '../shared/lookups/session-branch';
import {
  fakeCanExport,
  fakeCanManageStatus,
  fakeCanManageTags,
  fakeListBranchOwners,
  fakeListBranches,
  fakeListCurrencies,
  fakeListCustomerCustomFields,
  fakeListCustomerStatusOptions,
  fakeListSources,
  fakeListTags,
} from './customers.fake';
import {
  BoardLane,
  BoardResponse,
  BranchOption,
  CUSTOMER_LIST_LIMIT,
  CUSTOMER_BOARD_LIMIT,
  CustomerBoardItem,
  CardColor,
  ContactChangeBody,
  CreateCustomerBody,
  CurrencyOption,
  CustomerCapabilities,
  CustomerCustomField,
  CustomerDetail,
  CustomerSearchBody,
  CustomerStatus,
  CustomerStatusOption,
  DuplicateCheckProbe,
  DuplicateCheckResponse,
  OwnerOption,
  SearchResponse,
  SourceOption,
  TagSummary,
  TagView,
  UpdateCustomerBody,
} from './customers.model';

export const CUSTOMER_ERROR_KEYS: Record<string, string> = {
  CUSTOMER_PROFILE_NOT_FOUND: 'customers.errors.CUSTOMER_PROFILE_NOT_FOUND',
  'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE': 'customers.errors.CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE',
  CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES: 'customers.errors.CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES',
  CUSTOMER_PROFILE_SOURCE_LEAD_CONFLICT: 'customers.errors.CUSTOMER_PROFILE_SOURCE_LEAD_CONFLICT',
  CUSTOMER_PROFILE_REOPEN_STAGE_UNAVAILABLE: 'customers.errors.CUSTOMER_PROFILE_REOPEN_STAGE_UNAVAILABLE',
  CRM_SCOPED_PERMISSION_DENIED: 'customers.errors.CRM_SCOPED_PERMISSION_DENIED',
  CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN: 'customers.errors.CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN',
  CUSTOMER_PROFILE_BLACKLISTED: 'customers.errors.CUSTOMER_PROFILE_BLACKLISTED',
  CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED: 'customers.errors.CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED',
  CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON: 'customers.errors.CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON',
  CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN: 'customers.errors.CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN',
  CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED: 'customers.errors.CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED',
  CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID: 'customers.errors.CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID',
  CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED: 'customers.errors.CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED',
  CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED: 'customers.errors.CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED',
  CUSTOMER_PROFILE_REFERENCE_CONFLICT: 'customers.errors.CUSTOMER_PROFILE_REFERENCE_CONFLICT',
  CUSTOMER_PROFILE_LINKED_LEAD_LIMIT: 'customers.errors.CUSTOMER_PROFILE_LINKED_LEAD_LIMIT',
  CUSTOMER_PROFILE_LINKED_LEADS_CHANGED: 'customers.errors.CUSTOMER_PROFILE_LINKED_LEADS_CHANGED',
  CUSTOMER_PROFILE_DISQUALIFY_STAGE_UNAVAILABLE: 'customers.errors.CUSTOMER_PROFILE_DISQUALIFY_STAGE_UNAVAILABLE',
  PARTY_CONTACT_INVALID: 'customers.errors.PARTY_CONTACT_INVALID',
  CRM_CONTACT_CHANGE_CONFLICT: 'customers.errors.CRM_CONTACT_CHANGE_CONFLICT',
  CRM_CONTACT_NOT_LINKED: 'customers.errors.CRM_CONTACT_NOT_LINKED',
  CRM_RECORD_TAG_ALREADY_ATTACHED: 'customers.errors.CRM_RECORD_TAG_ALREADY_ATTACHED',
  PARTY_DUPLICATE_CONTACT_METHOD: 'customers.errors.PARTY_DUPLICATE_CONTACT_METHOD',
  PARTY_CONTACT_LIMIT_EXCEEDED: 'customers.errors.PARTY_CONTACT_LIMIT_EXCEEDED',
  PARTY_CONTACT_METHOD_REPEATED: 'customers.errors.PARTY_CONTACT_METHOD_REPEATED',
  LEAD_DUPLICATE_CHECK_EMPTY: 'customers.errors.LEAD_DUPLICATE_CHECK_EMPTY',
  CRM_SETTINGS_MISSING: 'customers.errors.CRM_SETTINGS_MISSING',
  CUSTOMER_PROFILE_SELECTION_TOO_LARGE: 'customers.errors.CUSTOMER_PROFILE_SELECTION_TOO_LARGE',
  CRM_TAG_NOT_FOUND: 'customers.errors.CRM_TAG_NOT_FOUND',
  CRM_VALIDATION_FAILED: 'customers.errors.CRM_VALIDATION_FAILED',
  CRM_ACQUISITION_SOURCE_NOT_FOUND: 'customers.errors.CRM_ACQUISITION_SOURCE_NOT_FOUND',
  CRM_RECORD_TAG_NOT_FOUND: 'customers.errors.CRM_RECORD_TAG_NOT_FOUND',
  CRM_TAG_UNKNOWN: 'customers.errors.CRM_TAG_UNKNOWN',
  CRM_ACQUISITION_SOURCE_INACTIVE: 'customers.errors.CRM_ACQUISITION_SOURCE_INACTIVE',
  LEAD_ADDRESS_GEO_INVALID: 'customers.errors.LEAD_ADDRESS_GEO_INVALID',
  LEAD_ADDRESS_GEO_INCOMPLETE: 'customers.errors.LEAD_ADDRESS_GEO_INCOMPLETE',
  BRANCH_CONTEXT_REQUIRED: 'customers.errors.BRANCH_CONTEXT_REQUIRED',
  BRANCH_PERMISSION_DENIED: 'customers.errors.BRANCH_PERMISSION_DENIED',
  BRANCH_ACCESS_DENIED: 'customers.errors.BRANCH_ACCESS_DENIED',
  PARTY_DUPLICATE_CONTACT: 'customers.errors.PARTY_DUPLICATE_CONTACT',
  PARTY_NOT_FOUND: 'customers.errors.PARTY_NOT_FOUND',
  INVALID_FIELD: 'customers.errors.INVALID_FIELD',
  INVALID_OPERATOR_VALUE: 'customers.errors.INVALID_OPERATOR_VALUE',
  CRM_LEADS_DISABLED: 'customers.errors.CRM_LEADS_DISABLED',
  LEAD_PHONE_INVALID: 'customers.errors.LEAD_PHONE_INVALID',
  'GW.IDEM.MISSING': 'customers.errors.GW.IDEM.MISSING',
  'GW.IDEM.MISMATCH': 'customers.errors.GW.IDEM.MISMATCH',
};

/** No scope headers: branchId is in the body. Wave B returns status counts independently of lanes. */
export async function loadBoard(body: CustomerSearchBody): Promise<BoardResponse> {
  const query = imageSearchBody(body, 1, CUSTOMER_BOARD_LIMIT);
  const result = await crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'board', query],
    queryFn: () => customerRequest<BoardResponse>('POST', '/customer-profiles/board', query),
  });
  rememberCustomerTokens(result.statuses.flatMap((lane) => lane.items));
  return result;
}

/** POST /api/tenant/crm/v1/customer-profiles/board/statuses/:status — load the next page for one status lane. */
export function loadStatusPage(
  status: CustomerStatus,
  body: CustomerSearchBody,
  page: number,
): Promise<BoardLane> {
  const query = imageSearchBody(body, Math.max(2, page), CUSTOMER_BOARD_LIMIT);
  return crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'lane', status, query],
    queryFn: async () => {
      // No scope headers: branchId is in the body, status in the route.
      const result = await customerRequest<BoardLane>('POST', `/customer-profiles/board/statuses/${status}`, query);
      rememberCustomerTokens(result.items);
      return result;
    },
  });
}

/** No scope headers: branchId is in the body. Wave B search returns the status-filter counts. */
export async function searchCustomers(
  body: CustomerSearchBody,
  page = body.page ?? 1,
  limit = body.limit ?? CUSTOMER_LIST_LIMIT,
): Promise<SearchResponse> {
  const query = { ...imageSearchBody(body, page, limit), includeStatusCounts: true };
  const result = await crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'search', query],
    queryFn: () => customerRequest<SearchResponse>('POST', '/customer-profiles/search', query),
  });
  rememberCustomerTokens(result.items);
  return result;
}

/** GET /api/tenant/crm/v1/customer-profiles/:id */
export async function getCustomer(id: string): Promise<CustomerDetail> {
  // No scope headers: the record route resolves its branch.
  const detail = await crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'detail', id],
    staleTime: 0,
    queryFn: () => crmHttp().read<CustomerDetail>(`/customer-profiles/${id}`),
  });
  rememberCustomerTokens([detail]);
  return detail;
}

/** POST /api/tenant/crm/v1/customer-profiles (header x-idempotency-key UUIDv7) */
export async function createCustomer(body: CreateCustomerBody, idempotencyKey: string): Promise<CustomerDetail> {
  // No scope headers: branchId is in the create body.
  const saved = await customerRequest<CustomerDetail>('POST', '/customer-profiles', imageCreateBody(body), idempotencyKey);
  rememberCustomerTokens([saved]);
  await refreshCustomerQueries();
  return saved;
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id */
export async function patchCustomer(id: string, body: UpdateCustomerBody): Promise<CustomerDetail> {
  if (!body.expectedUpdatedAt) throw new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
  // Contacts are saved individually through changeCustomerContact, never as a replacement list.
  const { contacts: _contacts, contactChange: _change, ...patch } = body;
  const allowed = pickCustomerFields(patch);
  // No scope headers: the record route resolves its branch.
  const saved = await customerRequest<CustomerDetail>('PATCH', `/customer-profiles/${id}`, allowed);
  rememberCustomerTokens([saved]);
  await refreshCustomerQueries();
  return saved;
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { rating } */
export function setCustomerRating(id: string, rating: number): Promise<CustomerDetail> {
  return writeCustomerInline(id, { rating });
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { cardColor } */
export function setCustomerColor(id: string, cardColor: CardColor | null): Promise<CustomerDetail> {
  return writeCustomerInline(id, { cardColor });
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { status, expectedUpdatedAt } */
export function setCustomerStatus(
  id: string,
  status: CustomerStatus,
  expectedUpdatedAt?: string,
): Promise<CustomerDetail> {
  return writeCustomerInline(id, { status, expectedUpdatedAt });
}

/** DELETE /api/tenant/crm/v1/customer-profiles/:id (body { reason }) */
export async function deleteCustomer(id: string, reason?: string): Promise<void> {
  // No scope headers: the service resolves the record's branch.
  await customerRequest<void>('DELETE', `/customer-profiles/${id}`, reason === undefined ? {} : { reason });
  await refreshCustomerQueries();
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { contactChange, expectedUpdatedAt } */
export async function changeCustomerContact(
  id: string,
  contactChange: ContactChangeBody,
  expectedUpdatedAt?: string,
): Promise<CustomerDetail> {
  if (!expectedUpdatedAt) throw new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
  // No scope headers: the record route resolves its branch. One contact operation per PATCH.
  const saved = await customerRequest<CustomerDetail>('PATCH', `/customer-profiles/${id}`, {
    expectedUpdatedAt, contactChange,
  });
  rememberCustomerTokens([saved]);
  await refreshCustomerQueries();
  return saved;
}

/** GET /api/tenant/crm/v1/customer-profiles/:id/tags */
export function listCustomerTags(id: string): Promise<TagView[]> {
  // No scope headers: the parent record resolves its branch.
  return crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'tags', id],
    queryFn: () => crmHttp().read(`/customer-profiles/${id}/tags`),
  });
}

/** POST /api/tenant/crm/v1/customer-profiles/:id/tags */
export async function attachCustomerTags(id: string, tagIds: string[]): Promise<TagView[]> {
  // No scope headers: the parent record resolves its branch.
  try {
    return await customerRequest<TagView[]>('POST', `/customer-profiles/${id}/tags`, { tagIds });
  } finally {
    await refreshCustomerQueries();
  }
}

/** DELETE /api/tenant/crm/v1/customer-profiles/:id/tags/:tagId */
export async function detachCustomerTag(id: string, tagId: string): Promise<void> {
  // No scope headers: the parent record resolves its branch.
  try {
    await customerRequest<void>('DELETE', `/customer-profiles/${id}/tags/${tagId}`, undefined);
  } finally {
    await refreshCustomerQueries();
  }
}

/** GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId=:branchId */
export function getCustomerCapabilities(branchId: string): Promise<CustomerCapabilities> {
  const scope = runInCrm(() => sessionBranch());
  if (!scope || scope.branchId !== branchId) return Promise.reject(new ApiError(403, 'BRANCH_CONTEXT_REQUIRED'));
  // BRANCH_REQUIRED: both headers, validated against the selected session branch.
  return crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'capabilities', scope],
    queryFn: () => crmHttp().read('/customer-profiles/capabilities', { branchId }, { scope }),
  });
}

const customerQueryKey = ['crm-customers'] as const;
const customerActions = new WeakMap<CrmHttpTransport, Map<string, { body: string; key: string; blocked?: boolean }>>();
const customerTokens = new WeakMap<CrmHttpTransport, Map<string, string>>();

/** Keep the public inline signatures; their stale tokens come only from loaded list rows. */
function rememberCustomerTokens(items: readonly CustomerBoardItem[]): void {
  const http = crmHttp();
  let tokens = customerTokens.get(http);
  if (!tokens) customerTokens.set(http, (tokens = new Map()));
  for (const item of items) tokens.set(item.id, item.updatedAt);
}

function imageSearchBody(body: CustomerSearchBody, page: number, limit: number): CustomerSearchBody {
  const { branchId, search, searchField, tagIds, status, sort } = body;
  const filterTree = body.filterTree ?? (body.filter?.length ? { op: 'AND' as const, children: body.filter } : undefined);
  return {
    branchId,
    ...(search !== undefined ? { search } : {}),
    ...(searchField ? { searchField } : {}),
    ...(filterTree ? { filterTree } : {}),
    ...(tagIds ? { tagIds } : {}),
    ...(status ? { status } : {}),
    ...(sort ? { sort } : {}),
    page,
    limit,
  };
}

async function writeCustomerInline(id: string, patch: { rating?: number; cardColor?: CardColor | null; status?: CustomerStatus; expectedUpdatedAt?: string }): Promise<CustomerDetail> {
  const expectedUpdatedAt = patch.expectedUpdatedAt ?? customerTokens.get(crmHttp())?.get(id);
  if (!expectedUpdatedAt) throw new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
  // No scope headers: record branch is resolved by the server; always send the loaded stale token.
  const saved = await customerRequest<CustomerDetail>('PATCH', `/customer-profiles/${id}`, { ...patch, expectedUpdatedAt });
  rememberCustomerTokens([saved]);
  await refreshCustomerQueries();
  return saved;
}

async function customerRequest<T>(method: CoreWriteMethod, path: string, body: unknown, suppliedKey?: string): Promise<T> {
  const http = crmHttp();
  let actions = customerActions.get(http);
  if (!actions) customerActions.set(http, (actions = new Map()));
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify(body) ?? '';
  const previous = actions.get(action);
  if (previous?.blocked && previous.body === bodyJson) throw new ApiError(409, 'GW.IDEM.MISMATCH');
  const key = suppliedKey ?? (previous?.body === bodyJson ? previous.key : newIdempotencyKey());
  actions.delete(action);
  try {
    return (await crmQueries().getMutationCache().build(crmQueries(), {
      mutationFn: () => http.write<T>(method, path, body, { key }),
      retry: false,
    }).execute(undefined)).data;
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'))) {
      actions.set(action, { body: bodyJson, key, blocked: true });
    } else if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401)) {
      actions.set(action, { body: bodyJson, key });
    }
    throw error;
  }
}

async function refreshCustomerQueries(): Promise<void> {
  await crmQueries().cancelQueries({ queryKey: customerQueryKey });
  await crmQueries().invalidateQueries({ queryKey: customerQueryKey });
}

/** GET /api/tenant/crm/v1/custom-fields?ownerType=CUSTOMER_PROFILE */
export function listCustomerCustomFields(): Promise<CustomerCustomField[]> {
  return fakeListCustomerCustomFields();
}

/** GET /api/tenant/crm/v1/static-data -> enumOptions.customerStatuses */
export function listCustomerStatusOptions(): Promise<CustomerStatusOption[]> {
  return fakeListCustomerStatusOptions();
}

/** Session permission check: crm.customer_profiles.status.manage */
export function canManageStatus(): boolean {
  return fakeCanManageStatus();
}

/** Session permission check: crm.tags.manage */
export function canManageTags(): boolean {
  return fakeCanManageTags();
}

/** Session permission check: crm.customer_profiles.export */
export function canExport(): boolean {
  return fakeCanExport();
}

/**
 * POST /api/tenant/crm/v1/leads/duplicate-check -> { matches }.
 * Rejects 403 without crm.leads.create or when Leads is off (CRM_LEADS_DISABLED): the check is then
 * unavailable, the strip hides quietly and saving stays allowed (the server enforces).
 */
export function checkDuplicates(probe: DuplicateCheckProbe): Promise<DuplicateCheckResponse> {
  // No scope headers: branchId is in the probe; this is deliberately the Leads route.
  return crmQueries().fetchQuery({
    queryKey: [...customerQueryKey, 'duplicates', probe],
    queryFn: () => customerRequest('POST', '/leads/duplicate-check', probe),
  });
}

const customerFieldNames = [
  'expectedUpdatedAt', 'displayName', 'legalName', 'status', 'rating', 'cardColor',
  'ownerUserId', 'acquisitionSourceId', 'companyName', 'taxNumber',
  'commercialRegistrationNumber', 'companyPhones', 'companyEmail', 'companyWebsite',
  'description', 'primaryContact', 'customFields', 'address',
] as const;

function pickCustomerFields<T extends UpdateCustomerBody>(body: T, includeToken = true): Partial<T> {
  return Object.fromEntries(customerFieldNames
    .filter((key) => (includeToken || key !== 'expectedUpdatedAt') && body[key] !== undefined)
    .map((key) => [key, body[key]])) as Partial<T>;
}

function imageCreateBody(body: CreateCustomerBody): CreateCustomerBody {
  const fields = pickCustomerFields(body, false);
  return {
    ...fields,
    branchId: body.branchId,
    profileType: body.profileType,
    ...(body.tagIds ? { tagIds: body.tagIds } : {}),
    ...(body.profileType === 'CORPORATE' && body.contacts ? { contacts: body.contacts } : {}),
  };
}

/** GET /api/tenant/core/v1/branches */
export function listBranches(): Promise<BranchOption[]> {
  return fakeListBranches();
}

/** GET /api/tenant/crm/v1/assignable-owners?resource=customer_profiles&branchId=:branchId */
export function listBranchOwners(branchId: string): Promise<OwnerOption[]> {
  return fakeListBranchOwners(branchId);
}

/** GET /api/tenant/crm/v1/acquisition-sources */
export function listSources(): Promise<SourceOption[]> {
  return fakeListSources();
}

/** GET /api/tenant/crm/v1/tags */
export function listTags(): Promise<TagSummary[]> {
  return fakeListTags();
}

/** GET /api/tenant/core/v1/currencies */
export function listCurrencies(): Promise<CurrencyOption[]> {
  return fakeListCurrencies();
}

/** GET /api/tenant/core/v1/geo/countries */
export function listCountries(): Promise<GeoCountry[]> {
  return listGeoCountries();
}
