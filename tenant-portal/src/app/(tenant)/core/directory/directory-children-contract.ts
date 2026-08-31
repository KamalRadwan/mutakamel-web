import type { CorePath } from "@/lib/api/envelope";
import {
  invalidCoreResponse,
  isMember,
  nullableText,
  nullableUuidV7,
  record,
  requiredBoolean,
  requiredText,
  requiredUuidV7,
} from "../contracts/core-page";

// The four party children, and the one asymmetry that will bite:
//
//   create  ->  POST /parties/:id/contact-methods
//   edit    ->  PATCH /contact-methods/:methodId
//   delete  ->  DELETE /contact-methods/:methodId
//
// The same holds for addresses and roles. The child id cannot be derived from
// the party, so it has to be carried in list state — which is why every parser
// below keeps `id` rather than projecting a display-only row.
//
// Source: core-app/src/tenant/directory/directory.controller.ts and
// dto/party-{contact-method,address,role,relationship}.dto.ts.

/** packages/common/src/enums/party-contact-method-type.enum.ts. */
export const CONTACT_METHOD_TYPES = [
  "PHONE",
  "MOBILE",
  "EMAIL",
  "WHATSAPP",
  "WEBSITE",
  "OTHER",
] as const;
/** packages/common/src/enums/party-address-type.enum.ts. */
export const ADDRESS_TYPES = [
  "LEGAL",
  "BILLING",
  "SHIPPING",
  "HOME",
  "WORK",
  "OTHER",
] as const;
/** packages/common/src/enums/party-role-type.enum.ts. */
export const PARTY_ROLE_TYPES = [
  "CUSTOMER",
  "SUPPLIER",
  "EMPLOYEE",
  "LEAD",
  "SHIPPING_RECIPIENT",
  "CONTACT_PERSON",
  "BILLING_CONTACT",
  "LEGAL_ENTITY",
  "GUARANTOR",
  "PARTNER",
] as const;
/** packages/common/src/enums/party-relationship-type.enum.ts. */
export const RELATIONSHIP_TYPES = [
  "CONTACT_PERSON",
  "BILLING_CONTACT",
  "LEGAL_CONTACT",
  "GUARANTOR",
  "PARTNER_OF",
  "EMPLOYEE_OF",
  "OTHER",
] as const;

export type ContactMethodType = (typeof CONTACT_METHOD_TYPES)[number];
export type AddressType = (typeof ADDRESS_TYPES)[number];
export type PartyRoleType = (typeof PARTY_ROLE_TYPES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const CONTACT_VALUE_MAX = 255;
export const CONTACT_LABEL_MAX = 80;
export const ADDRESS_LABEL_MAX = 80;
export const ADDRESS_PLACE_MAX = 120;
export const ADDRESS_LINE_MAX = 160;
export const ADDRESS_UNIT_MAX = 80;
export const ADDRESS_POSTAL_MAX = 40;
export const RELATIONSHIP_LABEL_MAX = 120;
const ROLE_APP_SOURCE_MAX = 64;

/** `DirectoryService` limit rejections — both are configurable settings. */
export const CONTACT_METHOD_LIMIT_CODE = "PARTY_CONTACT_METHOD_LIMIT_EXCEEDED";
export const ADDRESS_LIMIT_CODE = "PARTY_ADDRESS_LIMIT_EXCEEDED";
export const ROLE_EXISTS_CODE = "PARTY_ROLE_ALREADY_EXISTS";
export const RELATIONSHIP_INVALID_CODE = "PARTY_RELATIONSHIP_INVALID";

export interface PartyContactMethod {
  id: string;
  methodType: ContactMethodType;
  value: string;
  label: string | null;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface PartyAddress {
  id: string;
  addressType: AddressType;
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
}

export interface PartyRole {
  id: string;
  roleType: PartyRoleType;
  branchId: string | null;
  appSource: string | null;
}

/** `PartyContactSummary` — the organization → person projection. */
export interface PartyContact {
  id: string;
  relationshipId: string;
  relationshipType: RelationshipType;
  relationshipLabel: string | null;
  isPrimary: boolean;
  displayName: string;
  email: string | null;
  mobile: string | null;
  phone: string | null;
}

export function parsePartyContactMethod(payload: unknown): PartyContactMethod {
  const row = record(payload);
  if (!row || !isMember(CONTACT_METHOD_TYPES, row.methodType)) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "id"),
    methodType: row.methodType,
    value: requiredText(row, "value", CONTACT_VALUE_MAX),
    label: nullableText(row, "label", CONTACT_LABEL_MAX),
    isPrimary: requiredBoolean(row, "isPrimary"),
    isVerified: requiredBoolean(row, "isVerified"),
  };
}

export function parsePartyAddress(payload: unknown): PartyAddress {
  const row = record(payload);
  if (!row || !isMember(ADDRESS_TYPES, row.addressType)) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "id"),
    addressType: row.addressType,
    label: nullableText(row, "label", ADDRESS_LABEL_MAX),
    country: nullableText(row, "country", ADDRESS_PLACE_MAX),
    city: nullableText(row, "city", ADDRESS_PLACE_MAX),
    area: nullableText(row, "area", ADDRESS_PLACE_MAX),
    street: nullableText(row, "street", ADDRESS_LINE_MAX),
    buildingNo: nullableText(row, "buildingNo", ADDRESS_UNIT_MAX),
    floor: nullableText(row, "floor", ADDRESS_UNIT_MAX),
    apartment: nullableText(row, "apartment", ADDRESS_UNIT_MAX),
    landmark: nullableText(row, "landmark", ADDRESS_LINE_MAX),
    postalCode: nullableText(row, "postalCode", ADDRESS_POSTAL_MAX),
    isPrimary: requiredBoolean(row, "isPrimary"),
  };
}

export function parsePartyRole(payload: unknown): PartyRole {
  const row = record(payload);
  if (!row || !isMember(PARTY_ROLE_TYPES, row.roleType)) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "id"),
    roleType: row.roleType,
    branchId: nullableUuidV7(row, "branchId"),
    appSource: nullableText(row, "appSource", ROLE_APP_SOURCE_MAX),
  };
}

export function parsePartyContact(payload: unknown): PartyContact {
  const row = record(payload);
  if (!row || !isMember(RELATIONSHIP_TYPES, row.relationshipType)) invalidCoreResponse();
  return {
    // The contact list is keyed by the PERSON, but every mutation targets the
    // relationship, so both ids are kept and `id` is the relationship's.
    id: requiredUuidV7(row, "relationshipId"),
    relationshipId: requiredUuidV7(row, "relationshipId"),
    relationshipType: row.relationshipType,
    relationshipLabel: nullableText(row, "relationshipLabel", RELATIONSHIP_LABEL_MAX),
    isPrimary: requiredBoolean(row, "isPrimary"),
    displayName: requiredText(row, "displayName", 200),
    email: nullableText(row, "email", CONTACT_VALUE_MAX),
    mobile: nullableText(row, "mobile", CONTACT_VALUE_MAX),
    phone: nullableText(row, "phone", CONTACT_VALUE_MAX),
  };
}

// Every route below is a complete literal. Assembling them from a shared
// directory prefix would leave a bare, routeless prefix in source, which
// `scripts/docs/verify-called-routes.mjs` cannot match to any Gateway route —
// and the child URLs could not be built from the party prefix anyway, since a
// contact method is edited by its own id rather than through its party.
function safeId(id: string): string {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) invalidCoreResponse();
  return encodeURIComponent(id);
}

export const RELATIONSHIPS_PATH = "/api/tenant/core/v1/directory/relationships";

export function contactMethodPath(methodId: string): CorePath {
  return `/api/tenant/core/v1/directory/contact-methods/${safeId(methodId)}`;
}

export function addressPath(addressId: string): CorePath {
  return `/api/tenant/core/v1/directory/addresses/${safeId(addressId)}`;
}

export function partyRolePath(roleId: string): CorePath {
  return `/api/tenant/core/v1/directory/party-roles/${safeId(roleId)}`;
}

export function relationshipPath(relationshipId: string): CorePath {
  return `/api/tenant/core/v1/directory/relationships/${safeId(relationshipId)}`;
}

export function partyContactMethodsPath(partyId: string): CorePath {
  return `/api/tenant/core/v1/directory/parties/${safeId(partyId)}/contact-methods`;
}

export function partyAddressesPath(partyId: string): CorePath {
  return `/api/tenant/core/v1/directory/parties/${safeId(partyId)}/addresses`;
}

export function partyRolesPath(partyId: string): CorePath {
  return `/api/tenant/core/v1/directory/parties/${safeId(partyId)}/roles`;
}

export function partyContactsPath(partyId: string): CorePath {
  return `/api/tenant/core/v1/directory/parties/${safeId(partyId)}/contacts`;
}
