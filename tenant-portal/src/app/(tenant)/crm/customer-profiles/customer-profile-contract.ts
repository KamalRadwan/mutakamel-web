// Customer profile detail, create, edit, status change and add-contact —
// MASTER-PLAN 8.7-8.9, docs/build/OPEN-QUESTIONS.md Q12.
//
//   POST   /api/tenant/crm/v1/customer-profiles              201
//   GET    /api/tenant/crm/v1/customer-profiles/:id          200
//   PATCH  /api/tenant/crm/v1/customer-profiles/:id          200
//   POST   /api/tenant/crm/v1/customer-profiles/:id/contacts 201 -> { id }
//   DELETE /api/tenant/crm/v1/customer-profiles/:id          204, no body
//
// `GET /:id` returns the Party-backed identity plus the primary address and
// corporate contacts required by the detail workspace.
//
// Two pairs of legacy aliases exist on the write DTOs and only one of each is
// sent: `CustomerProfilesService` resolves `taxNumber ?? taxCardNumber` and
// `commercialRegistrationNumber ?? commercialRegisterNumber`, so the canonical
// name wins and sending both would be redundant.

import { isUUIDv7 } from "@/lib/uuid";
import type {
  CustomerProfileStatus,
  CustomerProfileType,
} from "./hooks/useCustomerProfiles";

export const CUSTOMER_STATUSES = [
  "PROSPECT",
  "ACTIVE_CUSTOMER",
  "INACTIVE",
  "BLACKLISTED",
] as const;

/**
 * Terminal in practice: a blacklisted customer is refused as the subject of a
 * new opportunity (`409 CUSTOMER_PROFILE_BLACKLISTED`), so the status change
 * confirms before it is sent — docs/api/crm-customer-profiles.md.
 */
export const BLACKLISTED_STATUS: CustomerProfileStatus = "BLACKLISTED";

export interface CustomerProfileAddress {
  country: string | null;
  city: string | null;
  area: string | null;
  street: string | null;
}

export interface CustomerProfileContact {
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

export interface CustomerProfileDetail {
  id: string;
  branchId: string;
  partyId: string;
  profileType: CustomerProfileType;
  status: CustomerProfileStatus;
  displayName: string;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  email: string | null;
  primaryMobile: string | null;
  phones: string[];
  address: CustomerProfileAddress | null;
  contacts: CustomerProfileContact[];
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  legalName: string | null;
  description: string | null;
  ownerUserId: string | null;
  sourceLeadId: string | null;
  acquisitionSourceId: string | null;
  acquisitionSourceNameAr: string | null;
  acquisitionSourceNameEn: string | null;
  createdAt: string;
  updatedAt: string;
}

function invalid(): never {
  throw new Error("Invalid customer profile response.");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseAddress(value: unknown): CustomerProfileAddress | null {
  if (value === undefined || value === null) return null;
  const address = record(value);
  if (!address) invalid();
  return {
    country: nullableText(address.country),
    city: nullableText(address.city),
    area: nullableText(address.area),
    street: nullableText(address.street),
  };
}

function parseContacts(value: unknown): CustomerProfileContact[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid();
  return value.map((entry) => {
    const contact = record(entry);
    if (
      !contact ||
      !isUUIDv7(contact.partyId) ||
      typeof contact.displayName !== "string" ||
      contact.displayName.length === 0 ||
      typeof contact.isPrimary !== "boolean" ||
      !Array.isArray(contact.phones) ||
      !contact.phones.every((phone) => typeof phone === "string")
    ) {
      invalid();
    }
    return {
      partyId: contact.partyId,
      relationshipId: isUUIDv7(contact.relationshipId)
        ? contact.relationshipId
        : null,
      displayName: contact.displayName,
      firstName: nullableText(contact.firstName),
      lastName: nullableText(contact.lastName),
      honorificTitle: nullableText(contact.honorificTitle),
      jobTitle: nullableText(contact.jobTitle),
      isPrimary: contact.isPrimary,
      email: nullableText(contact.email),
      phones: contact.phones,
    };
  });
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

const PROFILE_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;

export function parseCustomerProfileDetailResponse(
  payload: unknown,
): CustomerProfileDetail {
  const profile = record(payload);
  const normalizedStatus =
    profile?.status === "ACTIVE" ? "ACTIVE_CUSTOMER" : profile?.status;
  if (
    !profile ||
    !isUUIDv7(profile.id) ||
    !isUUIDv7(profile.branchId) ||
    !isUUIDv7(profile.partyId) ||
    !isMember(PROFILE_TYPES, profile.profileType) ||
    !isMember(CUSTOMER_STATUSES, normalizedStatus) ||
    typeof profile.displayName !== "string" ||
    profile.displayName.length === 0 ||
    typeof profile.createdAt !== "string" ||
    typeof profile.updatedAt !== "string"
  ) {
    invalid();
  }
  const party = record(profile.party);
  const source = record(profile.acquisitionSource);

  return {
    id: profile.id,
    branchId: profile.branchId,
    partyId: profile.partyId,
    profileType: profile.profileType,
    status: normalizedStatus,
    displayName: profile.displayName,
    companyName: nullableText(profile.companyName),
    companyEmail: nullableText(profile.companyEmail),
    companyPhone: nullableText(profile.companyPhone),
    companyWebsite: nullableText(profile.companyWebsite),
    email: nullableText(profile.email),
    primaryMobile: nullableText(profile.primaryMobile),
    phones: Array.isArray(profile.phones)
      ? profile.phones.filter(
          (phone): phone is string => typeof phone === "string",
        )
      : [],
    address: parseAddress(profile.address),
    contacts: parseContacts(profile.contacts),
    // The registration identifiers live on the Party, not the profile row —
    // `partySummaryFromRaw` selects them from `parties`.
    taxNumber: party ? nullableText(party.taxNumber) : null,
    commercialRegistrationNumber: party
      ? nullableText(party.commercialRegistrationNumber)
      : null,
    legalName: party ? nullableText(party.legalName) : null,
    description: nullableText(profile.description),
    ownerUserId: isUUIDv7(profile.ownerUserId) ? profile.ownerUserId : null,
    sourceLeadId: isUUIDv7(profile.sourceLeadId) ? profile.sourceLeadId : null,
    acquisitionSourceId: isUUIDv7(profile.acquisitionSourceId)
      ? profile.acquisitionSourceId
      : null,
    acquisitionSourceNameAr: source ? nullableText(source.nameAr) : null,
    acquisitionSourceNameEn: source ? nullableText(source.nameEn) : null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/** `POST /:id/contacts` answers `{ id }` — the new relationship, nothing more. */
export function parseAddContactResponse(payload: unknown): string {
  const result = record(payload);
  if (!result || !isUUIDv7(result.id)) {
    throw new Error("Invalid customer profile contact response.");
  }
  return result.id;
}
