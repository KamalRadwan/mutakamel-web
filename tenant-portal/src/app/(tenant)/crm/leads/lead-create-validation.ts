// Client-side mirror of what `POST /leads` will reject, so the common
// rejections never cost a round trip and land on the field that caused them.
//
// It is a MIRROR, not a second opinion: every rule below points at a specific
// decorator in `CreateLeadDto` or a specific throw in `LeadsService`. The
// server stays the authority — anything this misses still arrives as the
// modal's error summary.
//
// ONE rule is stricter than the server on purpose — the acquisition source.
// It is marked as such at the site, because a reader who assumes every rule
// here is a mirror would otherwise go looking for a decorator that is not
// there. No other rule may be added without the same treatment.

import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CrmErrorBag,
  sectionErrorCount,
  sectionOfErrorPath,
  type CrmFieldMessages,
} from "../shared/crm-form-validation";
import type { CrmFormErrors } from "../shared/hooks/useCrmCreateForm";
import {
  LEAD_CREATE_LIMITS,
  isCorporateLead,
  usesExistingCompany,
  type CreateLeadForm,
  type LeadContactForm,
} from "./lead-create-contract";

export type LeadCreateErrors = CrmFormErrors;

/** The shared field messages, plus the one rule only a lead has. */
export interface LeadCreateMessages extends CrmFieldMessages {
  contactRequired: string;
  /** Takes `{max}`. Mirrors `CreateLeadDto.tagIds`' array ceiling. */
  tagsLimit: string;
  tagsInvalid: string;
}

/** One `FormSection` id, and one key under `t.crmLeads.create.sections`. */
export type LeadCreateSectionId =
  | "classification"
  | "company"
  | "person"
  | "contacts"
  | "address"
  | "qualification"
  | "customFields";

const SECTION_BY_PREFIX: ReadonlyArray<[string, LeadCreateSectionId]> = [
  // Classification fields stay in the index so a user scrolled past the top
  // can still see why submission stopped.
  ["acquisitionSourceId", "classification"],
  ["tagIds", "classification"],
  ["contacts", "contacts"],
  ["address", "address"],
  ["customFields", "customFields"],
  ["companyName", "company"],
  ["legalName", "company"],
  ["taxNumber", "company"],
  ["commercialRegistrationNumber", "company"],
  ["companyPhones", "company"],
  ["firstName", "person"],
  ["lastName", "person"],
  ["honorificTitle", "person"],
  ["email", "person"],
  ["phones", "person"],
  ["description", "qualification"],
  ["interestSummary", "qualification"],
  ["expectedNeed", "qualification"],
];

export function sectionOfLeadCreateError(key: string): LeadCreateSectionId | null {
  return sectionOfErrorPath(SECTION_BY_PREFIX, key);
}

export function leadCreateSectionErrorCount(
  errors: LeadCreateErrors,
  section: LeadCreateSectionId,
): number {
  return sectionErrorCount(SECTION_BY_PREFIX, errors, section);
}

function validateContact(bag: CrmErrorBag, contact: LeadContactForm, index: number): void {
  const prefix = `contacts.${index}`;
  // A chosen person carries its own name; a new one is named by its parts, and
  // the first name is what CRM composes the rendered name from.
  if (contact.contactPartyId.length === 0) {
    if (bag.required(`${prefix}.firstName`, contact.firstName)) {
      bag.maxLength(`${prefix}.firstName`, contact.firstName, LEAD_CREATE_LIMITS.firstName);
    }
    bag.maxLength(`${prefix}.lastName`, contact.lastName, LEAD_CREATE_LIMITS.lastName);
  }
  bag.maxLength(`${prefix}.jobTitle`, contact.jobTitle, LEAD_CREATE_LIMITS.jobTitle);

  // Everything below is discarded by `ensureCorporateContactsBatch` for an
  // existing person, and the form hides it there — validating it would raise
  // errors on boxes that are not on screen.
  if (contact.contactPartyId.length > 0) return;
  bag.maxLength(`${prefix}.honorificTitle`, contact.honorificTitle, LEAD_CREATE_LIMITS.honorificTitle);
  bag.email(`${prefix}.email`, contact.email, LEAD_CREATE_LIMITS.email);
  bag.phones(`${prefix}.phones`, contact.phones);
}

function validateAddress(bag: CrmErrorBag, form: CreateLeadForm): void {
  const { address } = form;
  const limits = LEAD_CREATE_LIMITS;
  bag.maxLength("address.country", address.country, limits.addressMedium);
  bag.maxLength("address.city", address.city, limits.addressMedium);
  bag.maxLength("address.state", address.state, limits.addressMedium);
  bag.maxLength("address.street1", address.street1, limits.addressLong);
  bag.maxLength("address.street2", address.street2, limits.addressShort);
  bag.maxLength("address.buildingNo", address.buildingNo, limits.addressShort);
  bag.maxLength("address.floor", address.floor, limits.addressShort);
  bag.maxLength("address.landmark", address.landmark, limits.addressLong);
  bag.maxLength("address.postalCode", address.postalCode, limits.postalCode);
}

export function validateCreateLead(
  form: CreateLeadForm,
  messages: LeadCreateMessages,
  /** `fieldKey`s whose definition has a required CREATE requirement for LEAD. */
  requiredCustomFieldKeys: readonly string[] = [],
): LeadCreateErrors {
  const bag = new CrmErrorBag(messages);
  const corporate = isCorporateLead(form);
  const existingCompany = usesExistingCompany(form);
  const limits = LEAD_CREATE_LIMITS;

  // THE ONE RULE IN THIS FILE THAT IS NOT A MIRROR. `CreateLeadDto` marks
  // `acquisitionSourceId` `@IsOptional()` (crm-app/src/crm/leads/dto/lead.dto.ts:299-301),
  // so the server accepts a lead without one; this form does not. It is a
  // product rule about lead attribution, not a decorator — a lead whose source
  // is unknown cannot be counted in any acquisition report later, and nobody
  // goes back to fill it in. Loosening it breaks no contract; tightening it
  // costs the user one click they would otherwise have skipped.
  bag.required("acquisitionSourceId", form.acquisitionSourceId);
  if (form.tagIds.length > limits.tags) {
    bag.set("tagIds", formatTemplate(messages.tagsLimit, { max: limits.tags }));
  } else if (
    new Set(form.tagIds.map((tagId) => tagId.toLowerCase())).size !==
      form.tagIds.length ||
    !form.tagIds.every(isUUIDv7)
  ) {
    bag.set("tagIds", messages.tagsInvalid);
  }

  if (corporate) {
    // 422 LEAD_COMPANY_NAME_REQUIRED. Picking a company from the Directory
    // fills the box, so this fires only when neither route was taken.
    if (bag.required("companyName", form.companyName)) {
      bag.maxLength("companyName", form.companyName, limits.companyName);
    }
    // 422 LEAD_CONTACT_REQUIRED.
    if (form.contacts.length === 0) bag.set("contacts", messages.contactRequired);
    form.contacts
      .slice(0, limits.contacts)
      .forEach((contact, index) => validateContact(bag, contact, index));

    if (!existingCompany) {
      bag.maxLength("legalName", form.legalName, limits.legalName);
      bag.maxLength("taxNumber", form.taxNumber, limits.taxNumber);
      bag.maxLength(
        "commercialRegistrationNumber",
        form.commercialRegistrationNumber,
        limits.commercialRegistrationNumber,
      );
      bag.phones("companyPhones", form.companyPhones);
    }
  } else {
    // The lead's name is composed from these, so the first name is the part
    // CRM cannot do without.
    if (bag.required("firstName", form.firstName)) {
      bag.maxLength("firstName", form.firstName, limits.firstName);
    }
    bag.maxLength("lastName", form.lastName, limits.lastName);
    bag.maxLength("honorificTitle", form.honorificTitle, limits.honorificTitle);
    bag.email("email", form.email, limits.email);
    bag.phones("phones", form.phones);
  }

  // The address block is forbidden alongside an existing company, so it is not
  // rendered there and must not be validated there either.
  if (!existingCompany) validateAddress(bag, form);

  bag.maxLength("description", form.description, limits.description);
  bag.maxLength("interestSummary", form.interestSummary, limits.interestSummary);
  bag.maxLength("expectedNeed", form.expectedNeed, limits.expectedNeed);

  // 422 CUSTOM_FIELD_REQUIRED — a requirement row with operation CREATE. The
  // server checks these too; catching them here is what stops a submit that
  // would fail on a field the user can see and fill in.
  for (const fieldKey of requiredCustomFieldKeys) {
    const value = form.customFields[fieldKey];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0);
    if (empty) bag.set(`customFields.${fieldKey}`, messages.required);
  }

  return bag.errors;
}
