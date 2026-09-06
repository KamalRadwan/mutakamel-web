// Client-side mirror of what `POST /customer-profiles` will reject, so the
// common rejections never cost a round trip and land on the field that caused
// them. The server stays the authority — anything this misses still arrives as
// the modal's error summary.

import {
  CrmErrorBag,
  sectionErrorCount,
  sectionOfErrorPath,
  type CrmFieldMessages,
} from "../shared/crm-form-validation";
import type { CrmFormErrors } from "../shared/hooks/useCrmCreateForm";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  isCorporateCustomerProfile,
  type CreateCustomerProfileForm,
  type CustomerContactRowForm,
} from "./customer-profile-create-contract";

export type CustomerProfileCreateMessages = CrmFieldMessages;

/** One `FormSection` id, and one key under `t.crmCustomerProfiles.create.sections`. */
export type CustomerProfileSectionId =
  | "classification"
  | "person"
  | "company"
  | "contacts"
  | "notes"
  | "customFields";

const SECTION_BY_PREFIX: ReadonlyArray<readonly [string, CustomerProfileSectionId]> = [
  ["contacts", "contacts"],
  ["customFields", "customFields"],
  ["honorificTitle", "person"],
  ["firstName", "person"],
  ["lastName", "person"],
  ["email", "person"],
  ["phones", "person"],
  ["companyName", "company"],
  ["taxNumber", "company"],
  ["commercialRegistrationNumber", "company"],
  ["companyEmail", "company"],
  ["companyWebsite", "company"],
  ["companyPhones", "company"],
  ["description", "notes"],
];

export function sectionOfCustomerProfileError(key: string): CustomerProfileSectionId | null {
  return sectionOfErrorPath(SECTION_BY_PREFIX, key);
}

export function customerProfileSectionErrorCount(
  errors: CrmFormErrors,
  section: CustomerProfileSectionId,
): number {
  return sectionErrorCount(SECTION_BY_PREFIX, errors, section);
}

function validateContact(
  bag: CrmErrorBag,
  contact: CustomerContactRowForm,
  index: number,
  limits: typeof CUSTOMER_PROFILE_CREATE_LIMITS,
): void {
  const prefix = `contacts.${index}`;
  // A contact row is optional here — unlike a lead, a corporate profile may be
  // created with none. A row with any content but no name is the error case:
  // the builder drops nameless rows, so without this the other values would
  // vanish silently.
  const hasContent =
    contact.jobTitle.trim().length > 0 ||
    contact.honorificTitle.trim().length > 0 ||
    contact.email.trim().length > 0 ||
    contact.phones.some((phone) => phone.trim().length > 0);
  // The row is named by its parts now; the first name is the one CRM cannot
  // compose a name without.
  if (contact.firstName.trim().length === 0) {
    if (hasContent) bag.required(`${prefix}.firstName`, contact.firstName);
    return;
  }
  bag.maxLength(`${prefix}.firstName`, contact.firstName, limits.firstName);
  bag.maxLength(`${prefix}.lastName`, contact.lastName, limits.lastName);
  bag.maxLength(`${prefix}.jobTitle`, contact.jobTitle, limits.jobTitle);
  bag.maxLength(`${prefix}.honorificTitle`, contact.honorificTitle, limits.honorificTitle);
  bag.email(`${prefix}.email`, contact.email, limits.email);
  bag.phones(`${prefix}.phones`, contact.phones);
}

export function validateCreateCustomerProfile(
  form: CreateCustomerProfileForm,
  messages: CustomerProfileCreateMessages,
  /** `fieldKey`s whose definition has a required CREATE requirement for CUSTOMER_PROFILE. */
  requiredCustomFieldKeys: readonly string[] = [],
): CrmFormErrors {
  const bag = new CrmErrorBag(messages);
  const limits = CUSTOMER_PROFILE_CREATE_LIMITS;

  if (isCorporateCustomerProfile(form)) {
    // The display name is no longer typed: CRM composes it from the company
    // name, and copies it into `organization_name` and `legal_name` too. So the
    // company name is what the form must actually have.
    if (bag.required("companyName", form.companyName)) {
      bag.maxLength("companyName", form.companyName, limits.companyName);
    }
    bag.maxLength("taxNumber", form.taxNumber, limits.taxNumber);
    bag.maxLength(
      "commercialRegistrationNumber",
      form.commercialRegistrationNumber,
      limits.commercialRegistrationNumber,
    );
    bag.email("companyEmail", form.companyEmail, limits.email);
    // `@IsUrl({ require_protocol: true })` — `acme.com` is a 400 here, so the
    // form says so rather than letting the whole write fail on it.
    bag.url("companyWebsite", form.companyWebsite, limits.website);
    bag.phones("companyPhones", form.companyPhones);
    form.contacts
      .slice(0, limits.contacts)
      .forEach((contact, index) => validateContact(bag, contact, index, limits));
  } else {
    // Every one of these is a 422 CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN
    // on an individual profile, so the form does not render them and there is
    // nothing here to check.
    bag.maxLength("honorificTitle", form.honorificTitle, limits.honorificTitle);
    // An individual's display name is composed from these, so the first name is
    // the one part the service cannot do without.
    if (bag.required("firstName", form.firstName)) {
      bag.maxLength("firstName", form.firstName, limits.firstName);
    }
    bag.maxLength("lastName", form.lastName, limits.lastName);
    bag.email("email", form.email, limits.email);
    bag.phones("phones", form.phones);
  }

  bag.maxLength("description", form.description, limits.description);

  // 422 CUSTOM_FIELD_REQUIRED — a requirement row with operation CREATE.
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
