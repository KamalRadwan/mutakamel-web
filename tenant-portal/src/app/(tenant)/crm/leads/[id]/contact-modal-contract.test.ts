import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadContact, LeadDetail } from "../lead-contract";
import { buildContactCoreWrites, buildSelectedContactLeadRequest, contactModalForm, parseContactPerson, validateContactModal } from "./contact-modal-contract";

const personId = "01900100-0000-7000-8000-000000000011";
const id = (suffix: string) => `01900100-0000-7000-8000-0000000000${suffix}`;
const contact = { partyId: personId, displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: "Ms", jobTitle: "Manager", isPrimary: true, email: "old@example.test", phones: ["+20111111"] } as LeadContact;
const payload = {
  id: personId, partyType: "PERSON", displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: "Ms",
  contactMethods: [
    { id: id("21"), partyId: personId, methodType: "MOBILE", value: "+20111111", isPrimary: true, createdAt: "2026-09-01T00:00:00Z" },
    { id: id("22"), partyId: personId, methodType: "PHONE", value: "+20222222", isPrimary: true, createdAt: "2026-09-01T00:00:00Z" },
    { id: id("23"), partyId: personId, methodType: "EMAIL", value: "old@example.test", isPrimary: true, createdAt: "2026-09-01T00:00:00Z" },
    { id: id("24"), partyId: personId, methodType: "EMAIL", value: "other@example.test", isPrimary: false, createdAt: "2026-08-01T00:00:00Z" },
    { id: id("25"), partyId: personId, methodType: "WHATSAPP", value: "+20333333", isPrimary: true, createdAt: "2026-09-01T00:00:00Z" },
  ],
};
const person = () => parseContactPerson(payload, personId);

describe("selected contact modal contract", () => {
  it("retains phone IDs/types and chooses the email using the CRM projection order", () => {
    const form = contactModalForm(contact, person());
    expect(form.phones).toEqual([
      { id: id("21"), methodType: "MOBILE", value: "+20111111", isPrimary: true },
      { id: id("22"), methodType: "PHONE", value: "+20222222", isPrimary: true },
    ]);
    expect(form.email).toBe("old@example.test");
    expect(buildContactCoreWrites(form, person())).toEqual([]);
  });
  it("rejects another person's response or foreign method identity", () => {
    expect(() => parseContactPerson(payload, id("99"))).toThrow();
    expect(() => parseContactPerson({ ...payload, contactMethods: [{ ...payload.contactMethods[0], partyId: id("99") }] }, personId)).toThrow();
    const form = contactModalForm(contact, person());
    form.phones[0].id = id("99");
    expect(() => buildContactCoreWrites(form, person())).toThrow();
  });
  it("updates only the selected person's changed field and selected method IDs", () => {
    const form = contactModalForm(contact, person());
    form.displayName = "Dena Ali";
    form.phones[1].value = "+20999999";
    form.email = "new@example.test";
    expect(buildContactCoreWrites(form, person())).toEqual([
      { method: "patch", path: `/api/tenant/core/v1/directory/parties/${personId}`, body: { displayName: "Dena Ali" } },
      { method: "patch", path: `/api/tenant/core/v1/directory/contact-methods/${id("22")}`, body: { value: "+20999999" } },
      { method: "patch", path: `/api/tenant/core/v1/directory/contact-methods/${id("23")}`, body: { value: "new@example.test" } },
    ]);
  });
  it("clears only the selected email and removed phone, preserving other methods", () => {
    const form = contactModalForm(contact, person());
    form.phones.splice(0, 1);
    form.email = "";
    expect(buildContactCoreWrites(form, person())).toEqual([
      { method: "delete", path: `/api/tenant/core/v1/directory/contact-methods/${id("21")}` },
      { method: "delete", path: `/api/tenant/core/v1/directory/contact-methods/${id("23")}` },
    ]);
  });
  it("adds a phone on the same person without recreating the person", () => {
    const form = contactModalForm(contact, person());
    form.phones.push({ id: null, methodType: "MOBILE", value: "+20555555", isPrimary: false });
    expect(buildContactCoreWrites(form, person())).toEqual([{ method: "post", path: `/api/tenant/core/v1/directory/parties/${personId}/contact-methods`, body: { methodType: "MOBILE", value: "+20555555" } }]);
    expect(buildContactCoreWrites(form, null)).toEqual([]);
  });
  it("preserves every other Lead relationship and allows an explicit blank title", () => {
    const baseline = contactModalForm(contact);
    const form = { ...baseline, jobTitle: "" };
    const lead = { contacts: [contact, { ...contact, partyId: id("12"), jobTitle: "Finance", isPrimary: false }] } as LeadDetail;
    expect(buildSelectedContactLeadRequest(lead, form, baseline)).toEqual({ contacts: [
      { contactPartyId: personId, jobTitle: "", isPrimary: true },
      { contactPartyId: id("12"), jobTitle: "Finance", isPrimary: false },
    ] });
    expect(buildSelectedContactLeadRequest(lead, baseline, baseline)).toEqual({});
  });
  it("promotes the selected contact without changing names or titles", () => {
    const selected = { ...contact, isPrimary: false };
    const baseline = contactModalForm(selected);
    const lead = { contacts: [{ ...contact, partyId: id("12") }, selected] } as LeadDetail;
    const result = buildSelectedContactLeadRequest(lead, { ...baseline, isPrimary: true }, baseline);
    expect(result.contacts?.map(({ contactPartyId, isPrimary }) => ({ contactPartyId, isPrimary }))).toEqual([{ contactPartyId: id("12"), isPrimary: false }, { contactPartyId: personId, isPrimary: true }]);
  });
  it("validates editable fields but skips unavailable identity fields", () => {
    const form = { ...contactModalForm(contact, person()), displayName: "", email: "invalid" };
    const messages = { ...en.crmLeads.create.errors, url: en.crmShared.fieldUrl, invalid: en.crmShared.errorValidation };
    expect(validateContactModal(form, true, messages)).toMatchObject({ displayName: messages.required, email: messages.email });
    expect(validateContactModal(form, false, messages)).toEqual({});
  });
});
