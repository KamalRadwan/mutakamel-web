// Lead detail, edit and conversion — MASTER-PLAN 8.1-8.4.
//
//   GET   /api/tenant/crm/v1/leads/:id                              200
//   PATCH /api/tenant/crm/v1/leads/:id                              200
//   POST  /api/tenant/crm/v1/leads/:id/convert                      201
//   GET   /api/tenant/crm/v1/leads/company-options                  200
//   GET   /api/tenant/crm/v1/leads/company-options/:id/contacts     200
//
// The detail response is `LeadDetailReadModel` (crm-app/src/common/party-read-model.ts)
// = `LeadReadModel` — itself `LeadEntity` **&** `PartyBackedIdentity` **&**
// `LeadBoardFields` — plus `address` and `contacts`. Everything
// identity-shaped — displayName, the phones, the emails — lives on the Party
// behind the lead and is projected onto the row by `toPartyBackedReadModel`.
//
// **Only `GET /leads/:id` carries `address` and `contacts`.** They are two
// extra aggregates per row — a correlated subquery for the party's primary
// address and another for the lead's people — so `findReadModelById` selects
// them and `searchReadModels` does not. A 25-card board page would pay for
// fifty aggregates that no card draws, which is why `LeadCard`
// (./lead-card-contract.ts) has neither field and must not grow one. An empty
// `contacts` here therefore means the lead has none, never that nobody asked.
//
// Two joins matter and only one exists: `selectPartySummary` does
// `leftJoinAndSelect` on `acquisitionSource`, and **not** on `stage`. The lead
// therefore carries `stageId` and `stageFlag` but no stage name, which is why
// the screen resolves the label from the `/lead-stages` catalogue.

import { isUUIDv7 } from "@/lib/uuid";

const LEADS_PATH = "/api/tenant/crm/v1/leads";

const LEAD_STATUSES = [
  "OPEN",
  "CONVERTED",
  "DISQUALIFIED",
  "ON_HOLD",
] as const;

const LEAD_STAGE_FLAGS = [
  "NEW",
  "CONTACTED",
  "QUALIFYING",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONVERTED",
  "NURTURING",
  "ON_HOLD",
] as const;

export const CRM_PROFILE_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;

/** `LeadConversionContactMethodDto.methodType` — an `@IsIn`, not an enum. */
export const CRM_CONTACT_METHOD_TYPES = [
  "PHONE",
  "MOBILE",
  "EMAIL",
  "WHATSAPP",
  "WEBSITE",
  "OTHER",
] as const;

type LeadStatus = (typeof LEAD_STATUSES)[number];
type LeadStageFlagValue = (typeof LEAD_STAGE_FLAGS)[number];
export type CrmProfileType = (typeof CRM_PROFILE_TYPES)[number];
export type CrmContactMethodType = (typeof CRM_CONTACT_METHOD_TYPES)[number];

/**
 * `PartyAddressView` — the lead party's PRIMARY address, or `null`.
 *
 * One address and not a list: the backend's subquery is `ORDER BY is_primary
 * DESC ... LIMIT 1`, so a party holding a legal address and a shipping address
 * answers with the primary one only. The rest of them live on the party's own
 * directory screen, which is the surface that can edit them.
 *
 * `addressType` stays a `string` rather than the portal's `ADDRESS_TYPES`
 * union: it is a catalogue the backend can extend, and a value this build has
 * never heard of must show as itself rather than take the whole card down.
 * Every other field is nullable because every underlying column is.
 */
export interface LeadAddress {
  addressType: string;
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
}

/**
 * `LeadContactView` — one person linked to THIS lead.
 *
 * Joined through `crm_lead_contacts`, not through the company: an organization
 * may hold two dozen contacts while the lead names the two it is being worked
 * with, so this is a shorter list than
 * `parseLeadCompanyContactOptions` returns and the two must not be conflated.
 *
 * `relationshipId` is nullable here and required there, and that difference is
 * real: the company picker lists people BY their organization relationship,
 * while a lead contact may be a person with no organization link at all.
 *
 * The order is the server's — primary first, then by name — and is preserved
 * rather than re-sorted, so the list reads the same way as every other
 * server-collated name list on the screen.
 */
export interface LeadContact {
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

export interface LeadDetail {
  id: string;
  branchId: string;
  partyId: string;
  leadProfileType: CrmProfileType;
  stageId: string;
  stageFlag: LeadStageFlagValue;
  status: LeadStatus;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  companyName: string | null;
  primaryMobile: string | null;
  email: string | null;
  companyPhone: string | null;
  /**
   * The COMPANY party's own email — not the primary contact's.
   *
   * The lead's `email` above still prefers its contact's address, because that
   * is who a salesperson writes to; these are two different values and used to
   * be the same one. The type did not change, only what it means, so nothing
   * here parses differently.
   */
  companyEmail: string | null;
  companyWebsite: string | null;
  /**
   * The registration pair, off the party the lead is backed by
   * (`party_view_tax_number` / `..._commercial_registration_number` in
   * `toLeadReadModel`). They were in every response already and simply unread —
   * which is why the detail screen used to ask a corporate lead's registration
   * questions and answer none of them.
   */
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  phones: string[];
  /** `null` when the party has no address at all — see `LeadAddress`. */
  address: LeadAddress | null;
  /** Always an array; `[]` when the lead names nobody. */
  contacts: LeadContact[];
  acquisitionSourceId: string | null;
  acquisitionSourceNameAr: string | null;
  acquisitionSourceNameEn: string | null;
  description: string | null;
  interestSummary: string | null;
  expectedNeed: string | null;
  ownerUserId: string | null;
  createdByUserId: string | null;
  convertedCustomerProfileId: string | null;
  convertedOpportunityId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `CrmOrganizationOption`, from `PartyDirectoryAdapter.listActiveOrganizationOptions`.
 *
 * **`branchId` is nullable**, and that is not a defensive guess: the query is
 * `WHERE ... AND (party.branch_id = $1 OR party.branch_id IS NULL)`, so a
 * tenant-wide organization with no branch is a legitimate option. Requiring a
 * UUID here would silently drop every one of them.
 *
 * `docs/api/crm-leads.md` documents this row as
 * `{ id, displayName, legalName, branchId }`; the query also selects
 * `organizationName`.
 */
export interface LeadCompanyOption {
  id: string;
  displayName: string;
  legalName: string | null;
  organizationName: string | null;
  branchId: string | null;
}

/**
 * `CrmOrganizationContactOption`, from `listOrganizationContacts`.
 *
 * The identity column is **`partyId`**, not `id` — the row also carries
 * `relationshipId`, and conflating the two would send the wrong id as
 * `contactPartyId`. The controller documents this response as
 * `exampleSchema([])`, so every field name here comes from the SQL projection.
 */
export interface LeadCompanyContactOption {
  partyId: string;
  relationshipId: string;
  displayName: string;
  jobTitle: string | null;
  primaryEmail: string | null;
  phones: string[];
  isPrimary: boolean;
}

function invalid(): never {
  throw new Error("Invalid lead response.");
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

function requiredTimestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    invalid();
  }
  return value;
}

/**
 * The address, or `null` — and never a throw.
 *
 * Unlike the identity fields above, a bad address is not a bad lead. The whole
 * detail screen refusing to render because one optional aggregate came back in
 * a shape this build did not expect is a far worse outcome than a card that
 * says the lead has no address on file, so every failure here lands on `null`.
 *
 * `addressType` is the one field the row cannot be missing — it is NOT NULL on
 * `party_addresses` and it is what the card labels itself with — so its
 * absence is what "malformed" means. The other ten are nullable columns and
 * `nullableText` already answers for each of them.
 */
function parseLeadAddress(value: unknown): LeadAddress | null {
  const address = record(value);
  if (!address || typeof address.addressType !== "string") return null;
  if (address.addressType.length === 0) return null;

  return {
    addressType: address.addressType,
    label: nullableText(address.label),
    country: nullableText(address.country),
    city: nullableText(address.city),
    area: nullableText(address.area),
    street: nullableText(address.street),
    buildingNo: nullableText(address.buildingNo),
    floor: nullableText(address.floor),
    apartment: nullableText(address.apartment),
    landmark: nullableText(address.landmark),
    postalCode: nullableText(address.postalCode),
  };
}

/**
 * The DTO caps a WRITE at `@ArrayMaxSize(20)` contacts. This is the READ
 * bound, deliberately looser: rows predating the cap, or written by another
 * client, are still real data and truncating them at twenty would hide people
 * who are genuinely on the lead. A hundred is the point past which the list is
 * a directory query rather than a detail card, and the overflow is dropped so
 * a runaway response cannot turn into a runaway render.
 */
const MAX_LEAD_CONTACTS = 100;

/**
 * The contacts, or `[]` — and never a throw, for the same reason as the
 * address.
 *
 * One malformed entry costs that entry and nothing else: a detail screen that
 * renders nine of ten contacts tells the user more than one that renders none.
 * A row is kept when it can be identified and named, which is exactly what the
 * screen needs to draw and to link it; everything else falls back.
 *
 * The server's order — primary first, then by name — is preserved as received.
 */
function parseLeadContacts(value: unknown): LeadContact[] {
  if (!Array.isArray(value)) return [];

  const contacts: LeadContact[] = [];
  for (const entry of value) {
    if (contacts.length === MAX_LEAD_CONTACTS) break;
    const contact = record(entry);
    if (
      !contact ||
      !isUUIDv7(contact.partyId) ||
      typeof contact.displayName !== "string" ||
      contact.displayName.length === 0
    ) {
      continue;
    }
    contacts.push({
      partyId: contact.partyId,
      relationshipId: isUUIDv7(contact.relationshipId)
        ? contact.relationshipId
        : null,
      displayName: contact.displayName,
      firstName: nullableText(contact.firstName),
      lastName: nullableText(contact.lastName),
      honorificTitle: nullableText(contact.honorificTitle),
      jobTitle: nullableText(contact.jobTitle),
      // `=== true` rather than a truthiness test: a missing flag must read as
      // "not primary", and the screen crowns whoever it marks.
      isPrimary: contact.isPrimary === true,
      email: nullableText(contact.email),
      phones: Array.isArray(contact.phones)
        ? contact.phones.filter(
            (phone): phone is string => typeof phone === "string",
          )
        : [],
    });
  }
  return contacts;
}

export function parseLeadDetailResponse(payload: unknown): LeadDetail {
  const lead = record(payload);
  if (
    !lead ||
    !isUUIDv7(lead.id) ||
    !isUUIDv7(lead.branchId) ||
    !isUUIDv7(lead.partyId) ||
    !isUUIDv7(lead.stageId) ||
    !isMember(CRM_PROFILE_TYPES, lead.leadProfileType) ||
    !isMember(LEAD_STAGE_FLAGS, lead.stageFlag) ||
    !isMember(LEAD_STATUSES, lead.status) ||
    typeof lead.displayName !== "string" ||
    lead.displayName.length === 0
  ) {
    invalid();
  }
  const source = record(lead.acquisitionSource);
  const phones = Array.isArray(lead.phones)
    ? lead.phones.filter((phone): phone is string => typeof phone === "string")
    : [];

  return {
    id: lead.id,
    branchId: lead.branchId,
    partyId: lead.partyId,
    leadProfileType: lead.leadProfileType,
    stageId: lead.stageId,
    stageFlag: lead.stageFlag,
    status: lead.status,
    displayName: lead.displayName,
    firstName: nullableText(lead.firstName),
    lastName: nullableText(lead.lastName),
    honorificTitle: nullableText(lead.honorificTitle),
    companyName: nullableText(lead.companyName),
    primaryMobile: nullableText(lead.primaryMobile),
    email: nullableText(lead.email),
    companyPhone: nullableText(lead.companyPhone),
    companyEmail: nullableText(lead.companyEmail),
    companyWebsite: nullableText(lead.companyWebsite),
    taxNumber: nullableText(lead.taxNumber),
    commercialRegistrationNumber: nullableText(lead.commercialRegistrationNumber),
    phones,
    address: parseLeadAddress(lead.address),
    contacts: parseLeadContacts(lead.contacts),
    acquisitionSourceId: isUUIDv7(lead.acquisitionSourceId)
      ? lead.acquisitionSourceId
      : null,
    acquisitionSourceNameAr: source ? nullableText(source.nameAr) : null,
    acquisitionSourceNameEn: source ? nullableText(source.nameEn) : null,
    description: nullableText(lead.description),
    interestSummary: nullableText(lead.interestSummary),
    expectedNeed: nullableText(lead.expectedNeed),
    ownerUserId: isUUIDv7(lead.ownerUserId) ? lead.ownerUserId : null,
    createdByUserId: isUUIDv7(lead.createdByUserId) ? lead.createdByUserId : null,
    convertedCustomerProfileId: isUUIDv7(lead.convertedCustomerProfileId)
      ? lead.convertedCustomerProfileId
      : null,
    convertedOpportunityId: isUUIDv7(lead.convertedOpportunityId)
      ? lead.convertedOpportunityId
      : null,
    convertedAt: nullableText(lead.convertedAt),
    createdAt: requiredTimestamp(lead.createdAt),
    updatedAt: requiredTimestamp(lead.updatedAt),
  };
}

const MAX_COMPANY_OPTIONS = 1000;

export function parseLeadCompanyOptions(payload: unknown): LeadCompanyOption[] {
  if (!Array.isArray(payload) || payload.length > MAX_COMPANY_OPTIONS) invalid();
  return payload.map((entry) => {
    const option = record(entry);
    if (
      !option ||
      !isUUIDv7(option.id) ||
      typeof option.displayName !== "string" ||
      option.displayName.length === 0 ||
      (option.branchId !== null &&
        option.branchId !== undefined &&
        !isUUIDv7(option.branchId))
    ) {
      invalid();
    }
    return {
      id: option.id,
      displayName: option.displayName,
      legalName: nullableText(option.legalName),
      organizationName: nullableText(option.organizationName),
      branchId: isUUIDv7(option.branchId) ? option.branchId : null,
    };
  });
}

export function parseLeadCompanyContactOptions(
  payload: unknown,
): LeadCompanyContactOption[] {
  if (!Array.isArray(payload) || payload.length > MAX_COMPANY_OPTIONS) invalid();
  return payload.map((entry) => {
    const contact = record(entry);
    if (
      !contact ||
      !isUUIDv7(contact.partyId) ||
      !isUUIDv7(contact.relationshipId) ||
      typeof contact.displayName !== "string" ||
      contact.displayName.length === 0 ||
      typeof contact.isPrimary !== "boolean"
    ) {
      invalid();
    }
    return {
      partyId: contact.partyId,
      relationshipId: contact.relationshipId,
      displayName: contact.displayName,
      jobTitle: nullableText(contact.jobTitle),
      primaryEmail: nullableText(contact.primaryEmail),
      phones: Array.isArray(contact.phones)
        ? contact.phones.filter(
            (phone): phone is string => typeof phone === "string",
          )
        : [],
      isPrimary: contact.isPrimary,
    };
  });
}

export function leadPath(id: string): string {
  if (!isUUIDv7(id)) throw new Error("Invalid lead id.");
  return `${LEADS_PATH}/${encodeURIComponent(id)}`;
}

export function leadConvertPath(id: string): string {
  return `${leadPath(id)}/convert`;
}

export function leadCompanyOptionsPath(branchId: string): string {
  return `${LEADS_PATH}/company-options?${new URLSearchParams({ branchId })}`;
}

export function leadCompanyContactsPath(
  companyPartyId: string,
  branchId: string,
): string {
  if (!isUUIDv7(companyPartyId)) throw new Error("Invalid company party id.");
  const query = new URLSearchParams({ branchId }).toString();
  return `${LEADS_PATH}/company-options/${encodeURIComponent(companyPartyId)}/contacts?${query}`;
}
