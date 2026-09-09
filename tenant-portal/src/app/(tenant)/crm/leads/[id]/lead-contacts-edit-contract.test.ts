import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadDetail } from "../lead-contract";
import { buildLeadContactsRequest, toLeadContactsForm, validateLeadContactsForm } from "./lead-contacts-edit-contract";

const lead = {
  leadProfileType: "CORPORATE", displayName: "Acme", firstName: null, lastName: null,
  honorificTitle: null, email: null, primaryMobile: null, phones: ["+2025551234"],
  contacts: [
    { partyId: "01900100-0000-7000-8000-000000000001", jobTitle: "Buyer", isPrimary: true },
    { partyId: "01900100-0000-7000-8000-000000000002", jobTitle: "Manager", isPrimary: false },
  ],
} as unknown as LeadDetail;
const messages = { ...en.crmLeads.create.errors, url: en.crmShared.fieldUrl, invalid: en.crmShared.errorValidation, conflict: en.crmShared.errorConflict };

describe("lead contacts edit contract", () => {
  it("preserves every identity and unaffected relationship when clearing a title", () => {
    const baseline = toLeadContactsForm(lead);
    const form = toLeadContactsForm(lead);
    form.contacts[0].jobTitle = " ";
    expect(buildLeadContactsRequest(lead, form, baseline)).toEqual({ contacts: [
      { contactPartyId: lead.contacts[0].partyId, jobTitle: "", isPrimary: true },
      { contactPartyId: lead.contacts[1].partyId, jobTitle: "Manager", isPrimary: false },
    ] });
  });

  it("returns no write for unchanged data or surrounding whitespace", () => {
    const form = toLeadContactsForm(lead);
    form.contacts[0].jobTitle = " Buyer ";
    expect(buildLeadContactsRequest(lead, form, toLeadContactsForm(lead))).toEqual({});
  });

  it("preserves a refreshed title on a contact that was not edited", () => {
    const form = toLeadContactsForm(lead);
    form.contacts[0].jobTitle = "Director";
    const refreshed = { ...lead, contacts: lead.contacts.map((contact, index) => index === 1 ? { ...contact, jobTitle: "Finance" } : contact) };
    expect(buildLeadContactsRequest(refreshed, form, toLeadContactsForm(lead)).contacts?.[1].jobTitle).toBe("Finance");
  });

  it("rejects missing contacts, duplicate identities, and multiple/no primary selections", () => {
    for (const contacts of [[], [lead.contacts[0]], [lead.contacts[0], lead.contacts[0]], lead.contacts.map((contact) => ({ ...contact, isPrimary: true })), lead.contacts.map((contact) => ({ ...contact, isPrimary: false }))]) {
      const form = { ...toLeadContactsForm(lead), contacts: contacts.map((contact) => ({ ...contact, jobTitle: contact.jobTitle ?? "" })) };
      expect(validateLeadContactsForm(lead, form, messages).contacts).toBeTruthy();
    }
  });

  it("sends only changed individual fields and explicit clears", () => {
    const person = { ...lead, leadProfileType: "INDIVIDUAL", displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: "Ms", email: "dina@example.test", phones: ["+20105551234"], contacts: [] } as LeadDetail;
    const baseline = toLeadContactsForm(person);
    const form = { ...baseline, firstName: "Dena", lastName: "", honorificTitle: "", email: "", phones: [""] };
    expect(buildLeadContactsRequest(person, form, baseline)).toEqual({ firstName: "Dena", lastName: "", honorificTitle: null, email: null, phones: [] });
  });

  it("validates an individual name, email and normalized duplicate phone rows", () => {
    const person = { ...lead, leadProfileType: "INDIVIDUAL" } as LeadDetail;
    const form = { ...toLeadContactsForm(person), displayName: " ", email: "invalid", phones: ["009661234567", "+9661234567"] };
    expect(validateLeadContactsForm(person, form, messages)).toMatchObject({ displayName: messages.required, email: messages.email, "phones.1": messages.duplicatePhone });
  });

  it("rejects oversized job titles and phone arrays rather than truncating data", () => {
    const form = toLeadContactsForm(lead);
    form.contacts[1].jobTitle = "x".repeat(121);
    expect(validateLeadContactsForm(lead, form, messages)["contacts.1.jobTitle"]).toBeTruthy();
    const person = { ...lead, leadProfileType: "INDIVIDUAL" } as LeadDetail;
    form.phones = Array.from({ length: 11 }, (_, i) => `+201055510${i}`);
    expect(validateLeadContactsForm(person, form, messages).phones).toBeTruthy();
  });
});
