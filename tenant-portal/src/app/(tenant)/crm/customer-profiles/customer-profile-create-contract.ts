// Request builder for `POST /customer-profiles` — the whole of
// `CreateCustomerProfileDto`.
//
// `forbidNonWhitelisted: true` is on (crm-app/src/main.ts), so an undocumented
// key is a 400 rather than a silently-ignored field. Every key below was read
// from `crm-app/src/crm/customer-profiles/dto/customer-profile.dto.ts`, and
// which keys are sent for which profile type from `CustomerProfilesService`.
//
// Four service rules shape this file more than the DTO does:
//
//  1. **There is no `address`.** Unlike `CreateLeadDto`, this DTO exposes no
//     address input at all, so sending one is a 400 rather than a silent drop.
//     An address is added afterwards through the Core Directory.
//  2. `assertCorporateOnlyFields` rejects all nine company keys on an
//     INDIVIDUAL profile — 422 CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN.
//  3. `companyPhones` is a **destructive full replace** of the party's PHONE
//     methods, applied AFTER `companyPhone` was written. Sending both creates
//     the singular and immediately soft-deletes it, so only the array is sent.
//     The same trap exists between `primaryContact.contactMethods` (MOBILE) and
//     `primaryContact.phones`; only `phones` is used.
//  4. `contacts` present — **even as `[]`** — discards `primaryContact`
//     entirely. The two are never sent together.

import type { CrmProfileType } from "../leads/lead-contract";

export const CUSTOMER_PROFILE_CREATE_LIMITS = {
  companyName: 180,
  firstName: 80,
  lastName: 80,
  honorificTitle: 40,
  jobTitle: 120,
  email: 180,
  website: 180,
  phone: 32,
  phones: 10,
  taxNumber: 64,
  commercialRegistrationNumber: 64,
  contacts: 20,
  description: 2000,
} as const;

/** `CustomerStatusEnum`. Written raw — there is no catalogue and no state machine. */
export const CUSTOMER_PROFILE_STATUSES = [
  "PROSPECT",
  "ACTIVE_CUSTOMER",
  "INACTIVE",
  "BLACKLISTED",
] as const;

export type CustomerProfileCreateStatus = (typeof CUSTOMER_PROFILE_STATUSES)[number];

export interface CustomerContactRowForm {
  /** Stable row identity for React; never sent. */
  key: string;
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

export interface CreateCustomerProfileForm {
  profileType: CrmProfileType;
  status: CustomerProfileCreateStatus;
  acquisitionSourceId: string;
  /** INDIVIDUAL only — these reach the PERSON party through `primaryContact`. */
  honorificTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  phones: string[];
  /** CORPORATE only. */
  companyName: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
  companyEmail: string;
  companyWebsite: string;
  companyPhones: string[];
  contacts: CustomerContactRowForm[];
  description: string;
  /** Keyed by `fieldKey`. Values are already the JS type the definition declares. */
  customFields: Record<string, unknown>;
}

export function emptyCustomerContactRow(key: string): CustomerContactRowForm {
  return {
    key,
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

export function emptyCreateCustomerProfileForm(contactKey: string): CreateCustomerProfileForm {
  return {
    profileType: "CORPORATE",
    // The column default, restated so the form shows what the server would
    // have chosen rather than an empty picker.
    status: "PROSPECT",
    acquisitionSourceId: "",
    honorificTitle: "",
    firstName: "",
    lastName: "",
    email: "",
    phones: [""],
    companyName: "",
    taxNumber: "",
    commercialRegistrationNumber: "",
    companyEmail: "",
    companyWebsite: "",
    companyPhones: [""],
    contacts: [emptyCustomerContactRow(contactKey)],
    description: "",
    customFields: {},
  };
}

export function isCorporateCustomerProfile(form: CreateCustomerProfileForm): boolean {
  return form.profileType === "CORPORATE";
}

function filledPhones(phones: readonly string[]): string[] {
  return phones.map((phone) => phone.trim()).filter((phone) => phone.length > 0);
}

function optional<T extends string>(key: T, value: string): Partial<Record<T, string>> {
  const trimmed = value.trim();
  return trimmed.length > 0 ? ({ [key]: trimmed } as Record<T, string>) : {};
}

interface CustomerContactRequest {
  /** Omitted for the individual's own record: CRM builds it from the name parts. */
  fullName?: string;
  /** Only meaningful on an individual profile, where it names the PERSON party. */
  firstName?: string;
  lastName?: string;
  honorificTitle?: string;
  jobTitle?: string;
  email?: string;
  phones?: string[];
  isPrimary?: true;
}

export interface CreateCustomerProfileFullRequest {
  branchId: string;
  profileType: CrmProfileType;
  /** Never sent from this form; CRM composes it. Kept for callers that do. */
  displayName?: string;
  status?: CustomerProfileCreateStatus;
  acquisitionSourceId?: string;
  companyName?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyPhones?: string[];
  primaryContact?: CustomerContactRequest;
  contacts?: CustomerContactRequest[];
  description?: string;
  customFields?: Record<string, unknown>;
}

function buildContact(
  contact: CustomerContactRowForm,
  isPrimary: boolean,
): CustomerContactRequest {
  // No `fullName`: CRM composes it from the parts below.
  const request: CustomerContactRequest = {};
  if (isPrimary) request.isPrimary = true;
  Object.assign(
    request,
    optional("firstName", contact.firstName),
    optional("lastName", contact.lastName),
    optional("honorificTitle", contact.honorificTitle),
    optional("jobTitle", contact.jobTitle),
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

export function buildCreateCustomerProfileFullRequest(
  form: CreateCustomerProfileForm,
  branchId: string,
): CreateCustomerProfileFullRequest {
  const corporate = isCorporateCustomerProfile(form);

  // No `displayName` is sent. CRM composes it from the identity below —
  // `companyName` for a corporate profile, the primary contact's name parts for
  // an individual — so the same name is never typed twice on this form.
  const request: CreateCustomerProfileFullRequest = {
    branchId,
    profileType: form.profileType,
    status: form.status,
    ...optional("acquisitionSourceId", form.acquisitionSourceId),
    ...optional("description", form.description),
  };

  const customFields = buildCustomFields(form.customFields);
  if (customFields) request.customFields = customFields;

  if (corporate) {
    Object.assign(
      request,
      optional("companyName", form.companyName),
      optional("taxNumber", form.taxNumber),
      optional("commercialRegistrationNumber", form.commercialRegistrationNumber),
      optional("companyEmail", form.companyEmail),
      optional("companyWebsite", form.companyWebsite),
    );
    // `companyPhone` is deliberately never sent beside this: `synchronizePhoneNumbers`
    // replaces the party's whole PHONE set from this array afterwards, so the
    // singular would be created and then soft-deleted in the same request.
    const companyPhones = filledPhones(form.companyPhones);
    if (companyPhones.length > 0) request.companyPhones = companyPhones;

    // Only rows the user actually filled in. A corporate profile with no
    // contacts is legal here (unlike a lead), so an empty list is simply
    // omitted rather than sent as `[]` — which would ALSO discard
    // `primaryContact`, and is the shape that silently no-ops.
    const named = form.contacts.filter(
      (contact) => contact.firstName.trim().length > 0,
    );
    if (named.length > 0) {
      const primaryIndex = Math.max(
        named.findIndex((contact) => contact.isPrimary),
        0,
      );
      request.contacts = named.map((contact, index) =>
        buildContact(contact, index === primaryIndex),
      );
    }
    return request;
  }

  // An individual's own name, email and numbers reach the PERSON party through
  // `primaryContact` — there is no top-level `email` or `phones` on this DTO.
  // `fullName` is left out too: the service builds it from the honorific and
  // the two name parts, and that same value becomes the profile's display name.
  const primaryContact: CustomerContactRequest = {};
  Object.assign(
    primaryContact,
    optional("honorificTitle", form.honorificTitle),
    optional("email", form.email),
  );
  Object.assign(
    primaryContact,
    optional("firstName", form.firstName),
    optional("lastName", form.lastName),
  );
  const phones = filledPhones(form.phones);
  if (phones.length > 0) primaryContact.phones = phones;

  request.primaryContact = primaryContact;
  return request;
}
