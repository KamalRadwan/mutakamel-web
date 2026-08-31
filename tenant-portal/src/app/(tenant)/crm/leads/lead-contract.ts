// Lead detail, edit and conversion — MASTER-PLAN 8.1-8.4.
//
//   GET   /api/tenant/crm/v1/leads/:id                              200
//   PATCH /api/tenant/crm/v1/leads/:id                              200
//   POST  /api/tenant/crm/v1/leads/:id/convert                      201
//   GET   /api/tenant/crm/v1/leads/company-options                  200
//   GET   /api/tenant/crm/v1/leads/company-options/:id/contacts     200
//
// The detail response is `LeadReadModel` = `LeadEntity` **&**
// `PartyBackedIdentity` (crm-app/src/common/party-read-model.ts). Everything
// identity-shaped — displayName, the phones, the emails — lives on the Party
// behind the lead and is projected onto the row by `toPartyBackedReadModel`.
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
  companyEmail: string | null;
  companyWebsite: string | null;
  phones: string[];
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
    phones,
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
