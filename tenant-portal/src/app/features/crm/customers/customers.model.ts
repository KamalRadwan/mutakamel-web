import type { CardColor } from '../shared/record/fields/record-fields.model';
export type ProfileType = 'INDIVIDUAL' | 'CORPORATE';
export type CustomerStatus = 'PROSPECT' | 'ACTIVE_CUSTOMER' | 'INACTIVE' | 'BLACKLISTED';
export type ManualCustomerStatus = Exclude<CustomerStatus, 'ACTIVE_CUSTOMER'>;
export type ActivityBucket = 'OVERDUE' | 'TODAY' | 'FUTURE';
export type ContactMethodType = 'PHONE' | 'MOBILE' | 'EMAIL' | 'WHATSAPP' | 'WEBSITE' | 'OTHER';
export { CARD_COLORS } from '../shared/record/fields/record-fields.model';
export type { CardColor, CurrencyOption, OwnerOption } from '../shared/record/fields/record-fields.model';

export type CustomerView = 'board' | 'cards' | 'table';
export const CUSTOMER_VIEWS: readonly CustomerView[] = ['board', 'cards', 'table'];

export const CUSTOMER_BOARD_LIMIT = 50;
export const CUSTOMER_LIST_LIMIT = 20;

export const CUSTOMER_LIMITS = {
  displayName: 180,
  companyName: 180,
  legalName: 180,
  email: 180,
  website: 180,
  taxNumber: 64,
  commercialRegistrationNumber: 64,
  description: 2000,
  phonesMax: 10,
  phoneMax: 32,
  contactsMax: 20,
  contactFirstName: 80,
  contactLastName: 80,
  honorificTitle: 40,
  jobTitle: 120,
  contactFullName: 180,
} as const;

export const CUSTOMER_FILTERABLE_FIELDS = [
  'id',
  'branchId',
  'acquisitionSourceId',
  'profileType',
  'status',
  'rating',
  'cardColor',
  'ownerUserId',
  'sourceLeadId',
  'description',
  'createdAt',
  'updatedAt',
] as const;

export type CustomerFilterableField = (typeof CUSTOMER_FILTERABLE_FIELDS)[number];

export interface OwnerSummary {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface SourceSummary {
  id: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
}

/** LeadTagSummary: tags[] on board/list/detail rows (crm/common/lead-board-read-model). */
export interface TagSummary {
  id: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
}

/** TagView: GET/POST /crm/customer-profiles/:id/tags items (tags.service), ordered by name. */
export interface TagView extends TagSummary {
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNextActivity {
  activityAt: string;
  bucket: ActivityBucket;
}

/** POST /crm/customer-profiles/board -> statuses[].items */
export interface CustomerBoardItem {
  id: string;
  branchId: string;
  partyId: string;
  profileType: ProfileType;
  status: CustomerStatus;
  rating: number;
  cardColor: CardColor | null;
  displayName: string;
  companyName: string | null;
  primaryContactName: string | null;
  tags: TagSummary[];
  ownerUserId: string | null;
  owner: OwnerSummary | null;
  acquisitionSource: SourceSummary | null;
  acquisitionSourceIconUrl: string | null;
  nextActivity: CustomerNextActivity | null;
  address: CustomerAddress | null;
  cityId: string | null;
  cityName: Named | null;
  updatedAt: string;
}

export interface Named {
  id: string;
  nameEn: string;
  nameAr: string;
}

export interface CustomerAddress {
  addressType: string;
  label: string | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  districtId: string | null;
  countryName: Named | null;
  stateName: Named | null;
  cityName: Named | null;
  districtName: Named | null;
  country: string | null;
  city: string | null;
  area: string | null;
  street: string | null;
  buildingNo: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  postalCode: string | null;
}

/** CrmPartySummary (common/party-directory.adapter): the `party` object on list/search/detail rows. */
export interface PartySummary {
  id: string;
  partyType: 'PERSON' | 'ORGANIZATION';
  status?: string;
  displayName: string;
  legalName: string | null;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  organizationName: string | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  branchId: string | null;
  ownerUserId: string | null;
  primaryMobile: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  primaryWebsite: string | null;
  phones: string[];
  imageUrl: string | null;
  imageKind: 'LOGO' | 'PHOTO';
  imageRevision: string | null;
}

export interface PrimaryContactView {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
}

/** GET list / POST search items */
export interface CustomerRow extends CustomerBoardItem {
  party: PartySummary;
  createdAt: string;
  sourceLeadId: string | null;
  acquisitionSourceId: string | null;
  description: string | null;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  primaryMobile: string | null;
  email: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  phones: string[];
  primaryContact: PrimaryContactView | null;
}

export interface CustomerContactView {
  partyId: string;
  relationshipId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
}

export interface CustomerDetail extends CustomerRow {
  contacts: CustomerContactView[];
  customFields: Record<string, unknown>;
  legalName: string | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BoardLane extends Page<CustomerBoardItem> {
  status: CustomerStatus;
}

export type StatusCounts = Record<'ALL' | CustomerStatus, number>;

export interface BoardResponse {
  statuses: BoardLane[];
  counts?: StatusCounts;
}

export interface SearchResponse extends Page<CustomerRow> {
  counts?: StatusCounts;
}

export interface Cap {
  scope: 'own' | 'team' | 'all';
  ownerUserIds: string[] | null;
}

export interface CustomerCapabilities {
  branchId: string;
  customerProfiles: {
    create: Cap | null;
    update: Cap | null;
    delete: Cap | null;
  };
}

export interface ContactPersonBody {
  contactPartyId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  honorificTitle?: string;
  jobTitle?: string;
  isPrimary?: boolean;
  email?: string | null;
  phones?: string[];
  contactMethods?: ContactMethodBody[];
}

/** CustomerProfileContactMethodDto */
export interface ContactMethodBody {
  methodType: ContactMethodType;
  value: string;
  label?: string;
}

/** PartyAddressDto (common/party-address.dto). `state` is stored as `area`, `street1` as `street`, `street2` as `apartment`. */
export interface AddressBody {
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  country?: string;
  city?: string;
  state?: string;
  street1?: string;
  street2?: string;
  buildingNo?: string;
  floor?: string;
  landmark?: string;
  postalCode?: string;
}

export type ContactChangeBody =
  | { op: 'ADD'; contact: ContactPersonBody }
  | { op: 'UPDATE'; contactPartyId: string; contact: ContactPersonBody }
  | { op: 'REMOVE'; contactPartyId: string }
  | { op: 'SET_PRIMARY'; contactPartyId: string };

export interface CreateCustomerBody {
  branchId: string;
  profileType: ProfileType;
  displayName?: string;
  legalName?: string;
  status?: ManualCustomerStatus;
  ownerUserId?: string;
  acquisitionSourceId?: string | null;
  companyName?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  companyPhones?: string[];
  companyEmail?: string;
  companyWebsite?: string;
  description?: string;
  primaryContact?: ContactPersonBody;
  contacts?: ContactPersonBody[];
  customFields?: Record<string, unknown>;
  rating?: number;
  cardColor?: CardColor | null;
  tagIds?: string[];
  address?: AddressBody;
}

export interface UpdateCustomerBody {
  expectedUpdatedAt?: string;
  legalName?: string | null;
  displayName?: string;
  status?: ManualCustomerStatus;
  rating?: number;
  cardColor?: CardColor | null;
  ownerUserId?: string;
  acquisitionSourceId?: string | null;
  companyName?: string;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  companyPhones?: string[];
  companyEmail?: string | null;
  companyWebsite?: string | null;
  description?: string;
  primaryContact?: ContactPersonBody;
  contacts?: ContactPersonBody[];
  contactChange?: ContactChangeBody;
  customFields?: Record<string, unknown>;
  address?: AddressBody;
}

export type CustomerSearchField = 'customer' | 'email' | 'phone';
export type CustomerSortField = 'displayName' | 'createdAt' | 'updatedAt' | 'rating' | 'status';
export type CustomerSort = `${CustomerSortField}:${'ASC' | 'DESC'}`;

/** Sent on every Board/Cards/Table request (the backend's own fallback is createdAt ASC). */
export const CUSTOMER_DEFAULT_SORT: CustomerSort = 'updatedAt:DESC';

export interface CustomerFilterItem {
  field: string;
  operator: string;
  value: unknown;
}

export type CustomerFilterNode =
  | { op: 'AND' | 'OR'; children: CustomerFilterNode[] }
  | { field: string; operator: string; value?: unknown };

export interface CustomerSearchBody {
  branchId: string;
  search?: string;
  searchField?: CustomerSearchField;
  filter?: CustomerFilterItem[];
  filterTree?: CustomerFilterNode;
  tagIds?: string[];
  status?: CustomerStatus;
  includeStatusCounts?: boolean;
  sort?: CustomerSort;
  page?: number;
  limit?: number;
}

export interface BranchOption {
  id: string;
  name: string;
  companyName: string;
}

export interface SourceOption extends SourceSummary {
  iconUrl: string | null;
}

export type CustomerCustomFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE';

export interface CustomerCustomFieldOption {
  key: string;
  nameAr: string;
  nameEn: string;
}

export interface CustomerCustomField {
  id: string;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CustomerCustomFieldType;
  placeholderAr: string | null;
  placeholderEn: string | null;
  options: CustomerCustomFieldOption[];
  requiredOnCreate: boolean;
  requiredOnUpdate: boolean;
  sortOrder: number;
}

export interface CustomerStatusOption {
  value: CustomerStatus;
  label: { en: string; ar: string };
}

export type {
  DuplicateCheckResponse,
  DuplicateContactMethodHit,
  DuplicateLevel,
  DuplicateMatch,
  DuplicateMatchType,
  DuplicateCheckPayload as DuplicateCheckProbe,
} from '../shared/record/duplicate-strip/duplicate.model';

export function nameIn(item: { nameEn: string; nameAr: string }, language: string): string {
  return language === 'ar' ? item.nameAr : item.nameEn;
}

export function ownerFullName(owner: OwnerSummary | null): string {
  if (!owner) return '';
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ');
}
