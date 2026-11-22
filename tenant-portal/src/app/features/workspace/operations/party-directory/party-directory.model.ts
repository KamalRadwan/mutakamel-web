import type { CorePage, CorePageMeta } from '../../settings/core-response.model';

export type PartyType = 'PERSON' | 'ORGANIZATION';
export type PartyStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type PartyImageKind = 'PHOTO' | 'LOGO';

export type ContactMethodType = 'PHONE' | 'MOBILE' | 'EMAIL' | 'WHATSAPP' | 'WEBSITE' | 'OTHER';
export type AddressType = 'LEGAL' | 'BILLING' | 'SHIPPING' | 'HOME' | 'WORK' | 'OTHER';

export type PartyRoleType =
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'EMPLOYEE'
  | 'LEAD'
  | 'SHIPPING_RECIPIENT'
  | 'CONTACT_PERSON'
  | 'BILLING_CONTACT'
  | 'LEGAL_ENTITY'
  | 'GUARANTOR'
  | 'PARTNER';

export type RelationshipType =
  | 'CONTACT_PERSON'
  | 'BILLING_CONTACT'
  | 'LEGAL_CONTACT'
  | 'GUARANTOR'
  | 'PARTNER_OF'
  | 'EMPLOYEE_OF'
  | 'OTHER';

export type DuplicateScope = 'TENANT' | 'BRANCH' | 'PARTY_ROLE';
export type PartySortBy = 'displayName' | 'createdAt' | 'updatedAt';
export type SortDir = 'ASC' | 'DESC';

export const PARTY_TYPES: readonly PartyType[] = ['PERSON', 'ORGANIZATION'];
export const PARTY_STATUSES: readonly PartyStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
export const CONTACT_METHOD_TYPES: readonly ContactMethodType[] = [
  'PHONE',
  'MOBILE',
  'EMAIL',
  'WHATSAPP',
  'WEBSITE',
  'OTHER',
];
export const ADDRESS_TYPES: readonly AddressType[] = ['LEGAL', 'BILLING', 'SHIPPING', 'HOME', 'WORK', 'OTHER'];
export const PARTY_ROLE_TYPES: readonly PartyRoleType[] = [
  'CUSTOMER',
  'SUPPLIER',
  'EMPLOYEE',
  'LEAD',
  'SHIPPING_RECIPIENT',
  'CONTACT_PERSON',
  'BILLING_CONTACT',
  'LEGAL_ENTITY',
  'GUARANTOR',
  'PARTNER',
];
export const RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  'CONTACT_PERSON',
  'BILLING_CONTACT',
  'LEGAL_CONTACT',
  'GUARANTOR',
  'PARTNER_OF',
  'EMPLOYEE_OF',
  'OTHER',
];

/** Core's ResponseEnvelopeInterceptor wraps a paginated result as { data, meta }. */
export type PageMeta = CorePageMeta;
export type Page<T> = CorePage<T>;

export interface PartyListRole {
  id: string;
  partyId: string;
  roleType: PartyRoleType;
  branchId: string | null;
  status: PartyStatus;
  /** Null for rows written before app ownership was tracked. */
  appSource: string | null;
}

export interface PartyRole extends PartyListRole {
  /** jsonb, defaults to {}. */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PartyListContactMethod {
  id: string;
  partyId: string;
  methodType: ContactMethodType;
  value: string;
  label: string | null;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface PartyContactMethod {
  id: string;
  partyId: string;
  methodType: ContactMethodType;
  value: string;
  normalizedValue: string;
  phoneDigits?: string | null;
  label: string | null;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PartyAddress {
  id: string;
  partyId: string;
  addressType: AddressType;
  /** Geo references stored on the entity; the directory API does not write them yet. */
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  districtId: string | null;
  label: string | null;
  country: string | null;
  city: string | null;
  area: string | null;
  street: string | null;
  buildingNo: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  postalCode: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PartyRelationship {
  id: string;
  fromPartyId: string;
  toPartyId: string;
  relationshipType: RelationshipType;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface OrgContactPhone {
  id: string;
  methodType: ContactMethodType;
  value: string;
  label: string | null;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface OrgContact {
  relationshipId: string;
  relationshipType: RelationshipType;
  relationshipLabel: string | null;
  isPrimary: boolean;
  partyId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  phones: OrgContactPhone[];
  imageUrl: string | null;
  imageKind: 'PHOTO';
  imageRevision: string | null;
}

export interface PartyBase {
  id: string;
  partyType: PartyType;
  displayName: string;
  legalName: string | null;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  jobTitle: string | null;
  organizationName: string | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  branchId: string | null;
  ownerUserId: string | null;
  status: PartyStatus;
  imageUrl: string | null;
  imageKind: PartyImageKind;
  imageRevision: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PartyListItem extends PartyBase {
  roles: PartyListRole[];
  contactMethods: PartyListContactMethod[];
}

export interface PartyDetail extends PartyBase {
  roles: PartyRole[];
  contactMethods: PartyContactMethod[];
  addresses: PartyAddress[];
}

export interface CreateContactMethodBody {
  methodType: ContactMethodType;
  value: string;
  label?: string | null;
  isPrimary?: boolean;
}

export interface UpdateContactMethodBody {
  methodType?: ContactMethodType;
  value?: string;
  label?: string | null;
  isPrimary?: boolean;
}

export interface CreateAddressBody {
  addressType: AddressType;
  label?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  street?: string | null;
  buildingNo?: string | null;
  floor?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  postalCode?: string | null;
  isPrimary?: boolean;
}

export interface UpdateAddressBody {
  addressType?: AddressType;
  label?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  street?: string | null;
  buildingNo?: string | null;
  floor?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  postalCode?: string | null;
  isPrimary?: boolean;
}

export interface CreateRoleBody {
  roleType: PartyRoleType;
  branchId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateRelationshipBody {
  fromPartyId: string;
  toPartyId: string;
  relationshipType: RelationshipType;
  label?: string | null;
  isPrimary?: boolean;
}

export interface CreatePartyBody {
  partyType: PartyType;
  displayName: string;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  honorificTitle?: string | null;
  organizationName?: string | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  branchId?: string | null;
  ownerUserId?: string | null;
  roles?: CreateRoleBody[];
  contactMethods?: CreateContactMethodBody[];
  addresses?: CreateAddressBody[];
}

export interface UpdatePartyBody {
  displayName?: string;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  honorificTitle?: string | null;
  organizationName?: string | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  branchId?: string | null;
  ownerUserId?: string | null;
  status?: PartyStatus;
}

export interface ListPartiesQuery {
  page?: number;
  limit?: number;
  sortBy?: PartySortBy;
  sortDir?: SortDir;
  search?: string;
  partyType?: PartyType;
  status?: PartyStatus;
  roleType?: PartyRoleType;
  branchId?: string;
  ownerUserId?: string;
}

export interface ListOrgContactsQuery {
  page?: number;
  limit?: number;
}

export interface DirectorySettings {
  id: string;
  duplicateScope: DuplicateScope;
  preventDuplicateEmail: boolean;
  preventDuplicatePhone: boolean;
  preventDuplicateWhatsapp: boolean;
  maxContactMethodsPerParty: number;
  maxAddressesPerParty: number;
  createdAt: string;
  updatedAt: string;
}

export const PARTY_LIMITS = {
  displayName: 200,
  legalName: 240,
  firstName: 120,
  lastName: 120,
  honorificTitle: 40,
  organizationName: 200,
  taxNumber: 80,
  commercialRegistrationNumber: 80,
  contactValue: 255,
  contactLabel: 80,
  addressLabel: 80,
  addressCountry: 120,
  addressCity: 120,
  addressArea: 120,
  addressStreet: 160,
  addressBuildingNo: 80,
  addressFloor: 80,
  addressApartment: 80,
  addressLandmark: 160,
  addressPostalCode: 40,
  relationshipLabel: 120,
  roleMetadataBytes: 4096,
  maxRolesPerParty: 200,
  maxImageBytes: 2 * 1024 * 1024,
  search: 200,
  pageSize: 100,
} as const;
