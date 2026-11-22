import { listCountries as listGeoCountries } from '../../../core/geo/geo.api';
import { GeoCountry } from '../../../core/geo/geo.model';
import {
  fakeAttachCustomerTags,
  fakeCanExport,
  fakeCanManageStatus,
  fakeCanManageTags,
  fakeChangeCustomerContact,
  fakeCheckDuplicates,
  fakeCreateCustomer,
  fakeDeleteCustomer,
  fakeDetachCustomerTag,
  fakeGetCustomer,
  fakeGetCustomerCapabilities,
  fakeListBranchOwners,
  fakeListBranches,
  fakeListCurrencies,
  fakeListCustomerCustomFields,
  fakeListCustomerStatusOptions,
  fakeListCustomerTags,
  fakeListSources,
  fakeListTags,
  fakeLoadBoard,
  fakeLoadStatusPage,
  fakePatchCustomer,
  fakeSearchCustomerProfiles,
  fakeSetCustomerColor,
  fakeSetCustomerRating,
  fakeSetCustomerStatus,
} from './customers.fake';
import {
  BoardLane,
  BoardResponse,
  BranchOption,
  CUSTOMER_LIST_LIMIT,
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

/** POST /api/tenant/crm/v1/customer-profiles/board — returns all status lanes (limit 50) and counts. */
export function loadBoard(body: CustomerSearchBody): Promise<BoardResponse> {
  return fakeLoadBoard(body);
}

/** POST /api/tenant/crm/v1/customer-profiles/board/statuses/:status — load the next page for one status lane. */
export function loadStatusPage(
  status: CustomerStatus,
  body: CustomerSearchBody,
  page: number,
): Promise<BoardLane> {
  return fakeLoadStatusPage(status, body, page);
}

/** POST /api/tenant/crm/v1/customer-profiles/search — paged list search (with optional status counts). */
export function searchCustomers(
  body: CustomerSearchBody,
  page = body.page ?? 1,
  limit = body.limit ?? CUSTOMER_LIST_LIMIT,
): Promise<SearchResponse> {
  return fakeSearchCustomerProfiles(body, page, limit);
}

/** GET /api/tenant/crm/v1/customer-profiles/:id */
export function getCustomer(id: string): Promise<CustomerDetail> {
  return fakeGetCustomer(id);
}

/** POST /api/tenant/crm/v1/customer-profiles (header x-idempotency-key UUIDv7) */
export function createCustomer(body: CreateCustomerBody, idempotencyKey: string): Promise<CustomerDetail> {
  return fakeCreateCustomer(body, idempotencyKey);
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id */
export function patchCustomer(id: string, body: UpdateCustomerBody): Promise<CustomerDetail> {
  return fakePatchCustomer(id, body);
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { rating } */
export function setCustomerRating(id: string, rating: number): Promise<CustomerDetail> {
  return fakeSetCustomerRating(id, rating);
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { cardColor } */
export function setCustomerColor(id: string, cardColor: CardColor | null): Promise<CustomerDetail> {
  return fakeSetCustomerColor(id, cardColor);
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { status, expectedUpdatedAt } */
export function setCustomerStatus(
  id: string,
  status: CustomerStatus,
  expectedUpdatedAt?: string,
): Promise<CustomerDetail> {
  return fakeSetCustomerStatus(id, status, expectedUpdatedAt);
}

/** DELETE /api/tenant/crm/v1/customer-profiles/:id (body { reason }) */
export function deleteCustomer(id: string, reason?: string): Promise<void> {
  return fakeDeleteCustomer(id, reason);
}

/** PATCH /api/tenant/crm/v1/customer-profiles/:id { contactChange, expectedUpdatedAt } */
export function changeCustomerContact(
  id: string,
  contactChange: ContactChangeBody,
  expectedUpdatedAt?: string,
): Promise<CustomerDetail> {
  return fakeChangeCustomerContact(id, contactChange, expectedUpdatedAt);
}

/** GET /api/tenant/crm/v1/customer-profiles/:id/tags */
export function listCustomerTags(id: string): Promise<TagView[]> {
  return fakeListCustomerTags(id);
}

/** POST /api/tenant/crm/v1/customer-profiles/:id/tags */
export function attachCustomerTags(id: string, tagIds: string[]): Promise<TagView[]> {
  return fakeAttachCustomerTags(id, tagIds);
}

/** DELETE /api/tenant/crm/v1/customer-profiles/:id/tags/:tagId */
export function detachCustomerTag(id: string, tagId: string): Promise<void> {
  return fakeDetachCustomerTag(id, tagId);
}

/** GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId=:branchId */
export function getCustomerCapabilities(branchId: string): Promise<CustomerCapabilities> {
  return fakeGetCustomerCapabilities(branchId);
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
  return fakeCheckDuplicates(probe);
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
