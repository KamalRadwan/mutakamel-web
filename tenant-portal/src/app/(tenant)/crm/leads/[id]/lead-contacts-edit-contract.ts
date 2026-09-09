import { CrmErrorBag, type CrmFieldMessages } from "../../shared/crm-form-validation";
import type { LeadDetail } from "../lead-contract";
import type { UpdateLeadRequest } from "../lead-write-contract";

export interface LeadContactsForm {
  contacts: Array<{ partyId: string; jobTitle: string; isPrimary: boolean }>;
  displayName: string;
  firstName: string;
  lastName: string;
  honorificTitle: string;
  email: string;
  phones: string[];
}

export type LeadContactPersonField = Exclude<keyof LeadContactsForm, "contacts" | "phones">;

// crm-app/src/crm/leads/dto/lead.dto.ts: UpdateLeadDto and CreateLeadCorporateContactDto.
export const LEAD_CONTACT_EDIT_LIMITS = { contacts: 20, phones: 10, name: 80, displayName: 180, honorificTitle: 40, jobTitle: 120, email: 180 } as const;

export function toLeadContactsForm(lead: LeadDetail): LeadContactsForm {
  return {
    contacts: lead.contacts.map(({ partyId, jobTitle, isPrimary }) => ({ partyId, jobTitle: jobTitle ?? "", isPrimary })),
    displayName: lead.displayName,
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    honorificTitle: lead.honorificTitle ?? "",
    email: lead.email ?? "",
    phones: lead.phones.length > 0 ? [...lead.phones] : lead.primaryMobile ? [lead.primaryMobile] : [""],
  };
}

function filledPhones(phones: string[]) {
  return phones.map((phone) => phone.trim()).filter(Boolean);
}

export function validateLeadContactsForm(
  lead: LeadDetail,
  form: LeadContactsForm,
  messages: CrmFieldMessages & { invalid: string; conflict: string },
): Record<string, string> {
  const bag = new CrmErrorBag(messages);
  const limits = LEAD_CONTACT_EDIT_LIMITS;
  if (lead.leadProfileType === "CORPORATE") {
    const ids = new Set(form.contacts.map((contact) => contact.partyId));
    if (form.contacts.length !== lead.contacts.length || ids.size !== form.contacts.length || lead.contacts.some((contact) => !ids.has(contact.partyId))) {
      bag.set("contacts", messages.conflict);
    }
    if (!form.contacts.length || form.contacts.length > limits.contacts || form.contacts.filter((contact) => contact.isPrimary).length !== 1) {
      bag.set("contacts", messages.invalid);
    }
    form.contacts.forEach((contact, index) => bag.maxLength(`contacts.${index}.jobTitle`, contact.jobTitle, limits.jobTitle));
  } else {
    bag.required("displayName", form.displayName);
    bag.maxLength("displayName", form.displayName, limits.displayName);
    bag.maxLength("firstName", form.firstName, limits.name);
    bag.maxLength("lastName", form.lastName, limits.name);
    bag.maxLength("honorificTitle", form.honorificTitle, limits.honorificTitle);
    bag.email("email", form.email, limits.email);
    bag.phones("phones", form.phones);
    if (filledPhones(form.phones).length > limits.phones) bag.set("phones", messages.invalid);
  }
  return bag.errors;
}

/** Existing contact identities are immutable through this endpoint. Keep every
 * contactPartyId: omitting one would create a new person or unlink a person.
 * Empty jobTitle is intentional; saveCorporateLeadContacts stores it as null. */
export function buildLeadContactsRequest(
  lead: LeadDetail,
  form: LeadContactsForm,
  baseline: LeadContactsForm,
): UpdateLeadRequest {
  if (lead.leadProfileType === "CORPORATE") {
    const changed = form.contacts.some((contact) => {
      const before = baseline.contacts.find((item) => item.partyId === contact.partyId);
      return !before || contact.jobTitle.trim() !== before.jobTitle.trim() || contact.isPrimary !== before.isPrimary;
    });
    if (!changed) return {};
    const primaryChanged = form.contacts.some((contact) => contact.isPrimary !== baseline.contacts.find((item) => item.partyId === contact.partyId)?.isPrimary);
    return { contacts: lead.contacts.map((contact) => {
      const edited = form.contacts.find((item) => item.partyId === contact.partyId);
      const before = baseline.contacts.find((item) => item.partyId === contact.partyId);
      return {
        contactPartyId: contact.partyId,
        jobTitle: edited && before && edited.jobTitle.trim() !== before.jobTitle.trim() ? edited.jobTitle.trim() : contact.jobTitle ?? "",
        isPrimary: primaryChanged && edited ? edited.isPrimary : contact.isPrimary,
      };
    }) };
  }
  const request: UpdateLeadRequest = {};
  for (const field of ["displayName", "firstName", "lastName"] as const) {
    const next = form[field].trim();
    if (next !== baseline[field].trim()) request[field] = next;
  }
  for (const field of ["honorificTitle", "email"] as const) {
    const next = form[field].trim();
    if (next !== baseline[field].trim()) request[field] = next || null;
  }
  const phones = filledPhones(form.phones);
  if (JSON.stringify(phones) !== JSON.stringify(filledPhones(baseline.phones))) request.phones = phones;
  return request;
}
