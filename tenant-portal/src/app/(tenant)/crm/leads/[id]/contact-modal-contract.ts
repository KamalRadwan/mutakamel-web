import type { CorePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { CrmErrorBag, type CrmFieldMessages } from "../../shared/crm-form-validation";
import type { LeadContact, LeadDetail } from "../lead-contract";
import type { UpdateLeadRequest } from "../lead-write-contract";

// Core Directory UpdatePartyDto / UpdatePartyContactMethodDto, and CRM contact DTO.
export const CONTACT_MODAL_LIMITS = { displayName: 200, name: 120, honorificTitle: 40, jobTitle: 120, value: 255, methods: 200 } as const;
export const CONTACT_DIRECTORY_PERMISSIONS = ["directory.party.read", "directory.party.manage", "directory.contact.manage"] as const;
type MethodType = "PHONE" | "MOBILE" | "EMAIL" | "WHATSAPP" | "WEBSITE" | "OTHER";
export interface DirectoryContactMethod { id: string; methodType: MethodType; value: string; isPrimary: boolean; createdAt: string }
export interface ContactPerson {
  id: string; displayName: string; firstName: string; lastName: string; honorificTitle: string;
  contactMethods: DirectoryContactMethod[];
}
export interface ContactModalForm {
  partyId: string; displayName: string; firstName: string; lastName: string; honorificTitle: string;
  jobTitle: string; isPrimary: boolean; email: string;
  phones: Array<{ id: string | null; methodType: "PHONE" | "MOBILE"; value: string; isPrimary: boolean }>;
}
export type ContactModalField = Exclude<keyof ContactModalForm, "partyId" | "phones">;
export interface ContactCoreWrite { method: "patch" | "post" | "delete"; path: CorePath; body?: Record<string, unknown> }

export class ContactWriteResponseError extends Error {}

/** A 2xx with an unreadable receipt has already applied; its caller must reload. */
export function validateContactWriteResponse(operation: ContactCoreWrite, payload: unknown, partyId: string): void {
  if (operation.method === "delete") return;
  try {
    const result = record(payload);
    if (!isUUIDv7(result.id)) throw new Error();
    if (operation.path === contactPersonPath(partyId)) {
      if (result.id !== partyId || result.partyType !== "PERSON" || typeof result.displayName !== "string") throw new Error();
    } else if (result.partyId !== partyId || typeof result.value !== "string" || (operation.method === "patch" && result.id !== operation.path.split("/").at(-1))) throw new Error();
  } catch { throw new ContactWriteResponseError("The saved contact response could not be read."); }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid contact response.");
  return value as Record<string, unknown>;
}
function nullableText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new Error("Invalid contact response.");
  return value;
}
function safeId(id: string): string {
  if (!isUUIDv7(id)) throw new Error("Invalid contact identity.");
  return encodeURIComponent(id);
}
export function contactPersonPath(id: string): CorePath { return `/api/tenant/core/v1/directory/parties/${safeId(id)}`; }
function contactMethodPath(id: string): CorePath { return `/api/tenant/core/v1/directory/contact-methods/${safeId(id)}`; }
function createContactMethodPath(id: string): CorePath { return `/api/tenant/core/v1/directory/parties/${safeId(id)}/contact-methods`; }

export function parseContactPerson(payload: unknown, expectedId: string): ContactPerson {
  const party = record(payload);
  if (party.id !== expectedId || !isUUIDv7(party.id) || party.partyType !== "PERSON" || typeof party.displayName !== "string" || !party.displayName.trim() || !Array.isArray(party.contactMethods)) throw new Error("Invalid contact response.");
  const methods = party.contactMethods.map((entry): DirectoryContactMethod => {
    const method = record(entry);
    if (!isUUIDv7(method.id) || method.partyId !== expectedId || !["PHONE", "MOBILE", "EMAIL", "WHATSAPP", "WEBSITE", "OTHER"].includes(String(method.methodType)) || typeof method.value !== "string" || !method.value || typeof method.isPrimary !== "boolean" || typeof method.createdAt !== "string" || !Number.isFinite(Date.parse(method.createdAt))) throw new Error("Invalid contact method response.");
    return { id: method.id, methodType: method.methodType as MethodType, value: method.value, isPrimary: method.isPrimary, createdAt: method.createdAt };
  });
  if (methods.length > CONTACT_MODAL_LIMITS.methods || new Set(methods.map((method) => method.id)).size !== methods.length) throw new Error("Invalid contact method response.");
  // Exact CRM LeadContact projection order: primary, creation time, then ID.
  methods.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  return { id: expectedId, displayName: party.displayName, firstName: nullableText(party.firstName), lastName: nullableText(party.lastName), honorificTitle: nullableText(party.honorificTitle), contactMethods: methods };
}

export function contactModalForm(contact: LeadContact, person?: ContactPerson | null): ContactModalForm {
  const phones: ContactModalForm["phones"] = person ? person.contactMethods.flatMap((method) => method.methodType === "MOBILE" || method.methodType === "PHONE" ? [{ id: method.id, methodType: method.methodType, value: method.value, isPrimary: method.isPrimary }] : []) : contact.phones.map((value) => ({ id: null, methodType: "MOBILE", value, isPrimary: false }));
  return { partyId: contact.partyId, displayName: person?.displayName ?? contact.displayName,
    firstName: person?.firstName ?? contact.firstName ?? "", lastName: person?.lastName ?? contact.lastName ?? "", honorificTitle: person?.honorificTitle ?? contact.honorificTitle ?? "",
    jobTitle: contact.jobTitle ?? "", isPrimary: contact.isPrimary,
    email: person ? person.contactMethods.find((method) => method.methodType === "EMAIL")?.value ?? "" : contact.email ?? "", phones };
}

export function validateContactModal(form: ContactModalForm, identity: boolean, messages: CrmFieldMessages & { invalid: string }): Record<string, string> {
  const bag = new CrmErrorBag(messages);
  const limits = CONTACT_MODAL_LIMITS;
  bag.maxLength("jobTitle", form.jobTitle, limits.jobTitle);
  if (!identity) return bag.errors;
  bag.required("displayName", form.displayName);
  bag.maxLength("displayName", form.displayName, limits.displayName);
  bag.maxLength("firstName", form.firstName, limits.name);
  bag.maxLength("lastName", form.lastName, limits.name);
  bag.maxLength("honorificTitle", form.honorificTitle, limits.honorificTitle);
  bag.email("email", form.email, limits.value);
  const seen = new Set<string>();
  for (const [index, phone] of form.phones.entries()) {
    const value = phone.value.trim();
    bag.maxLength(`phones.${index}`, value, limits.value);
    if (!value) continue;
    // Core normalizes per method TYPE; never merge PHONE and MOBILE identities.
    const key = phone.methodType + ":" + (value.startsWith("+") ? "+" : "") + value.replace(/\D/gu, "");
    if (seen.has(key)) bag.set(`phones.${index}`, messages.duplicatePhone);
    seen.add(key);
  }
  if (form.phones.length > limits.methods) bag.set("phones", messages.invalid);
  return bag.errors;
}

/** Only the selected person's method IDs are accepted. Clearing removes that
 * method, never another email or any unrelated method type. */
export function buildContactCoreWrites(form: ContactModalForm, person: ContactPerson | null): ContactCoreWrite[] {
  if (!person) return [];
  if (form.partyId !== person.id) throw new Error("Contact identity changed.");
  const writes: ContactCoreWrite[] = [];
  const body: Record<string, unknown> = {};
  for (const field of ["displayName", "firstName", "lastName", "honorificTitle"] as const) {
    const next = form[field].trim();
    if (next !== person[field]) body[field] = next;
  }
  if (Object.keys(body).length) writes.push({ method: "patch", path: contactPersonPath(person.id), body });
  const priorPhones = person.contactMethods.filter((method) => method.methodType === "MOBILE" || method.methodType === "PHONE");
  const retained = new Set<string>();
  for (const phone of form.phones) {
    const value = phone.value.trim();
    if (phone.id) {
      const before = priorPhones.find((method) => method.id === phone.id);
      if (!before || before.methodType !== phone.methodType || retained.has(phone.id)) throw new Error("Invalid contact method identity.");
      retained.add(phone.id);
      if (!value) writes.push({ method: "delete", path: contactMethodPath(phone.id) });
      else if (value !== before.value) writes.push({ method: "patch", path: contactMethodPath(phone.id), body: { value } });
    } else if (value) writes.push({ method: "post", path: createContactMethodPath(person.id), body: { methodType: phone.methodType, value } });
  }
  for (const before of priorPhones) if (!retained.has(before.id)) writes.push({ method: "delete", path: contactMethodPath(before.id) });
  const email = person.contactMethods.find((method) => method.methodType === "EMAIL");
  const value = form.email.trim();
  if (email && !value) writes.push({ method: "delete", path: contactMethodPath(email.id) });
  else if (email && value !== email.value) writes.push({ method: "patch", path: contactMethodPath(email.id), body: { value } });
  else if (!email && value) writes.push({ method: "post", path: createContactMethodPath(person.id), body: { methodType: "EMAIL", value, isPrimary: true } });
  return writes;
}

/** The CRM DTO replaces the list; preserve all other people from the latest
 * lead. Unchecking the sole primary leaves selection to the existing server
 * default (the first contact), so the modal requires choosing another primary. */
export function buildSelectedContactLeadRequest(lead: LeadDetail, form: ContactModalForm, baseline: ContactModalForm): UpdateLeadRequest {
  const selected = lead.contacts.find((contact) => contact.partyId === form.partyId);
  if (!selected) throw new Error("Contact no longer belongs to this lead.");
  const titleChanged = form.jobTitle.trim() !== baseline.jobTitle.trim();
  const primaryChanged = form.isPrimary !== baseline.isPrimary;
  if (!titleChanged && !primaryChanged) return {};
  if (primaryChanged && !form.isPrimary) throw new Error("Select another contact as primary.");
  return { contacts: lead.contacts.map((contact) => ({ contactPartyId: contact.partyId,
    jobTitle: contact.partyId === form.partyId && titleChanged ? form.jobTitle.trim() : contact.jobTitle ?? "",
    isPrimary: primaryChanged ? contact.partyId === form.partyId : contact.isPrimary })) };
}
