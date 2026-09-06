// Request builder for `POST /leads` — the whole of `CreateLeadDto`.
//
// `forbidNonWhitelisted: true` is on (crm-app/src/main.ts), so an undocumented
// key is a 400 rather than a silently-ignored field. Every key below was read
// from `crm-app/src/crm/leads/dto/lead.dto.ts`, and which keys are sent for
// which profile type was read from `LeadsService.create` — the DTO accepts
// more than the service uses, and a form that offers a box the service drops
// on the floor is a form that lies.
//
// Three service rules shape this file more than the DTO does:
//
//  1. `assertCorporateLeadDetails` rejects `companyPhone(s)`, `legalName`,
//     `taxNumber`, `commercialRegistrationNumber` and `address` outright when
//     `existingCompanyPartyId` is set — 422 LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN.
//  2. The same guard rejects the corporate registration trio on an INDIVIDUAL
//     lead — 422 LEAD_CORPORATE_FIELDS_FORBIDDEN.
//  3. `phones ?? [primaryMobile]` and `companyPhones ?? [companyPhone]`: when
//     the array is present the singular is IGNORED. Only the arrays are sent,
//     so there is no shape in which one silently wins over the other.

import { CRM_PROFILE_TYPES, type CrmProfileType } from "./lead-contract";

export const LEAD_CREATE_LIMITS = {
  companyName: 180,
  legalName: 180,
  firstName: 80,
  lastName: 80,
  honorificTitle: 40,
  jobTitle: 120,
  email: 180,
  phone: 32,
  phones: 10,
  taxNumber: 64,
  commercialRegistrationNumber: 64,
  contacts: 20,
  description: 2000,
  interestSummary: 4000,
  expectedNeed: 4000,
  addressShort: 80,
  addressMedium: 120,
  addressLong: 160,
  postalCode: 40,
} as const;

export interface LeadContactForm {
  /** Stable row identity for React; never sent. */
  key: string;
  /** An existing person Party on the chosen company — `contacts[].contactPartyId`. */
  contactPartyId: string;
  /** Held only for a person reused from the directory, whose name is theirs. */
  fullName: string;
  firstName: string;
  lastName: string;
  honorificTitle: string;
  jobTitle: string;
  email: string;
  phones: string[];
  isPrimary: boolean;
}

export interface LeadAddressForm {
  country: string;
  city: string;
  state: string;
  street1: string;
  street2: string;
  buildingNo: string;
  floor: string;
  landmark: string;
  postalCode: string;
}

export interface CreateLeadForm {
  /**
   * The branch this lead is filed under, when the user picked one in the form.
   *
   * Empty means "whichever branch the screen is on" — `buildCreateLeadRequest`
   * falls back to its `branchId` argument. Empty rather than pre-seeded, so
   * that re-picking the branch the screen already had leaves the form
   * undirtied and the close guard stays quiet about changes nobody made.
   */
  branchId: string;
  leadProfileType: CrmProfileType;
  stageId: string;
  acquisitionSourceId: string;
  existingCompanyPartyId: string;
  companyName: string;
  legalName: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
  companyPhones: string[];
  contacts: LeadContactForm[];
  honorificTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  phones: string[];
  address: LeadAddressForm;
  description: string;
  interestSummary: string;
  expectedNeed: string;
  /** Keyed by `fieldKey`. Values are already the JS type the definition declares. */
  customFields: Record<string, unknown>;
}

const EMPTY_LEAD_ADDRESS: LeadAddressForm = {
  country: "",
  city: "",
  state: "",
  street1: "",
  street2: "",
  buildingNo: "",
  floor: "",
  landmark: "",
  postalCode: "",
};

export function emptyLeadContact(key: string): LeadContactForm {
  return {
    key,
    contactPartyId: "",
    fullName: "",
    firstName: "",
    lastName: "",
    honorificTitle: "",
    jobTitle: "",
    email: "",
    phones: [""],
    isPrimary: true,
  };
}

export function emptyCreateLeadForm(contactKey: string): CreateLeadForm {
  return {
    branchId: "",
    // INDIVIDUAL is the default because it is the SMALLER of the two shapes:
    // it asks for one person and nothing else, while CORPORATE additionally
    // demands a company name and at least one contact person — both of them
    // 422s when missing (LEAD_COMPANY_NAME_REQUIRED, LEAD_CONTACT_REQUIRED).
    // Opening on the shape with fewer mandatory fields means a user who came
    // to type one name is never first shown two errors they did not cause.
    leadProfileType: "INDIVIDUAL",
    stageId: "",
    acquisitionSourceId: "",
    existingCompanyPartyId: "",
    companyName: "",
    legalName: "",
    taxNumber: "",
    commercialRegistrationNumber: "",
    companyPhones: [""],
    contacts: [emptyLeadContact(contactKey)],
    honorificTitle: "",
    firstName: "",
    lastName: "",
    email: "",
    phones: [""],
    address: { ...EMPTY_LEAD_ADDRESS },
    description: "",
    interestSummary: "",
    expectedNeed: "",
    customFields: {},
  };
}

export function isCorporateLead(form: CreateLeadForm): boolean {
  return form.leadProfileType === "CORPORATE";
}

/**
 * Whether the lead reuses a company already in the Directory.
 *
 * Only meaningful on a corporate lead: `assertCorporateLeadDetails` answers an
 * `existingCompanyPartyId` on an individual lead with a 422, so the picker is
 * never rendered there and the id never survives a switch of profile type.
 */
export function usesExistingCompany(form: CreateLeadForm): boolean {
  return isCorporateLead(form) && form.existingCompanyPartyId.length > 0;
}

/**
 * `LeadsService.normalizeMobile`, mirrored.
 *
 * Only ever used to compare two numbers the user typed. What is SENT is the
 * raw string — normalising client-side would hide from the user which of their
 * two entries the server considers the same number.
 */
export function normalizeLeadPhone(phone: string): string {
  const compact = phone.replace(/[^\d+]/gu, "").trim();
  const digits = compact.replace(/\D/gu, "");
  if (compact.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return digits;
}

function filledPhones(phones: readonly string[]): string[] {
  return phones.map((phone) => phone.trim()).filter((phone) => phone.length > 0);
}

function optional<T extends string>(
  key: T,
  value: string,
): Partial<Record<T, string>> {
  const trimmed = value.trim();
  return trimmed.length > 0 ? ({ [key]: trimmed } as Record<T, string>) : {};
}

interface CreateLeadAddressRequest {
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

interface CreateLeadContactRequest {
  contactPartyId?: string;
  firstName?: string;
  lastName?: string;
  honorificTitle?: string;
  jobTitle?: string;
  email?: string;
  phones?: string[];
  isPrimary?: true;
}

export interface CreateLeadRequest {
  branchId: string;
  leadProfileType: CrmProfileType;
  /** Never sent from this form; CRM composes it. Kept for callers that do. */
  displayName?: string;
  stageId?: string;
  acquisitionSourceId?: string;
  companyName?: string;
  existingCompanyPartyId?: string;
  legalName?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  companyPhones?: string[];
  contacts?: CreateLeadContactRequest[];
  firstName?: string;
  lastName?: string;
  honorificTitle?: string;
  email?: string;
  phones?: string[];
  address?: CreateLeadAddressRequest;
  description?: string;
  interestSummary?: string;
  expectedNeed?: string;
  customFields?: Record<string, unknown>;
}

/**
 * The address block, or nothing.
 *
 * The legacy aliases (`area`, `street`, `apartment`) are deliberately not
 * offered: `leadPartyAddresses` maps `state -> area`, `street1 -> street` and
 * `street2 -> apartment`, so a form carrying both spellings would have two
 * boxes writing one column with the modern one always winning.
 */
function buildAddress(address: LeadAddressForm): CreateLeadAddressRequest | undefined {
  const request: CreateLeadAddressRequest = {
    ...optional("country", address.country),
    ...optional("city", address.city),
    ...optional("state", address.state),
    ...optional("street1", address.street1),
    ...optional("street2", address.street2),
    ...optional("buildingNo", address.buildingNo),
    ...optional("floor", address.floor),
    ...optional("landmark", address.landmark),
    ...optional("postalCode", address.postalCode),
  };
  return Object.keys(request).length > 0 ? request : undefined;
}

/**
 * One `contacts[]` entry.
 *
 * When `contactPartyId` is present the server takes the stored person and
 * discards the submitted name, email and phones — `ensureCorporateContactsBatch`
 * builds no contact methods for a selected party. Only `jobTitle` and the
 * primary flag still apply, so only those are sent: a request that carried the
 * rest would claim to write data the server never looks at. The name is not
 * sent at all any more: it is composed by CRM from the parts, and a reused
 * party keeps the name the directory already holds.
 */
function buildContact(contact: LeadContactForm, isPrimary: boolean): CreateLeadContactRequest {
  const request: CreateLeadContactRequest = {};
  if (isPrimary) request.isPrimary = true;
  Object.assign(request, optional("jobTitle", contact.jobTitle));

  if (contact.contactPartyId.length > 0) {
    request.contactPartyId = contact.contactPartyId;
    return request;
  }

  Object.assign(
    request,
    optional("firstName", contact.firstName),
    optional("lastName", contact.lastName),
    optional("honorificTitle", contact.honorificTitle),
    optional("email", contact.email),
  );
  const phones = filledPhones(contact.phones);
  if (phones.length > 0) request.phones = phones;
  return request;
}

function buildCustomFields(values: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = Object.entries(values).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * @param branchId the branch the calling screen is scoped to. It is the
 * FALLBACK, not the answer: a form whose own `branchId` is set was filed
 * against a branch the user chose in the modal, and that choice wins. There is
 * no company argument because `CreateLeadDto` has no company key at all — the
 * company is derived server-side from `branchId`.
 */
export function buildCreateLeadRequest(
  form: CreateLeadForm,
  branchId: string,
): CreateLeadRequest {
  const corporate = isCorporateLead(form);
  const existingCompany = usesExistingCompany(form);
  const companyName = form.companyName.trim();

  // No display name is sent. CRM composes it from the identity below — the
  // company name for a corporate lead, the first and last name for an
  // individual — which is also what `ensureParty` writes onto the party, so the
  // list and the Directory cannot disagree about it.
  const request: CreateLeadRequest = {
    branchId: form.branchId || branchId,
    leadProfileType: form.leadProfileType,
    ...optional("stageId", form.stageId),
    ...optional("acquisitionSourceId", form.acquisitionSourceId),
    ...optional("description", form.description),
    ...optional("interestSummary", form.interestSummary),
    ...optional("expectedNeed", form.expectedNeed),
  };

  const customFields = buildCustomFields(form.customFields);
  if (customFields) request.customFields = customFields;

  if (corporate) {
    if (companyName.length > 0) request.companyName = companyName;
    const primaryIndex = Math.max(
      form.contacts.findIndex((contact) => contact.isPrimary),
      0,
    );
    request.contacts = form.contacts.map((contact, index) =>
      buildContact(contact, index === primaryIndex),
    );

    if (existingCompany) {
      request.existingCompanyPartyId = form.existingCompanyPartyId;
      return request;
    }

    Object.assign(
      request,
      optional("legalName", form.legalName),
      optional("taxNumber", form.taxNumber),
      optional("commercialRegistrationNumber", form.commercialRegistrationNumber),
    );
    const companyPhones = filledPhones(form.companyPhones);
    if (companyPhones.length > 0) request.companyPhones = companyPhones;
  } else {
    Object.assign(
      request,
      optional("firstName", form.firstName),
      optional("lastName", form.lastName),
      optional("honorificTitle", form.honorificTitle),
      optional("email", form.email),
    );
    const phones = filledPhones(form.phones);
    if (phones.length > 0) request.phones = phones;
  }

  const address = buildAddress(form.address);
  if (address) request.address = address;
  return request;
}

export { CRM_PROFILE_TYPES };
export type { CrmProfileType };
