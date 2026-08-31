// Customer profile detail, create, edit, status change and add-contact —
// MASTER-PLAN 8.7-8.9, docs/build/OPEN-QUESTIONS.md Q12.
//
//   POST   /api/tenant/crm/v1/customer-profiles              201
//   GET    /api/tenant/crm/v1/customer-profiles/:id          200
//   PATCH  /api/tenant/crm/v1/customer-profiles/:id          200
//   POST   /api/tenant/crm/v1/customer-profiles/:id/contacts 201 -> { id }
//   DELETE /api/tenant/crm/v1/customer-profiles/:id          204, no body
//
// `GET /:id` returns `CustomerProfileReadModel` = `CustomerProfileEntity` &
// `PartyBackedIdentity`, so the identity columns come off the Party behind the
// profile. **It carries no contacts list** — `selectPartySummary` joins the
// acquisition source and the party summary, and nothing joins
// `party_relationships`. That is why this screen can add a contact and cannot
// list the existing ones.
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
  if (
    !profile ||
    !isUUIDv7(profile.id) ||
    !isUUIDv7(profile.branchId) ||
    !isUUIDv7(profile.partyId) ||
    !isMember(PROFILE_TYPES, profile.profileType) ||
    !isMember(CUSTOMER_STATUSES, profile.status) ||
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
    status: profile.status,
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
