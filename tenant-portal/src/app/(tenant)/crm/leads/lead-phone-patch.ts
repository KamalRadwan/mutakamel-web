// The inline "primary phone" editors on the board card, the quick-edit modal
// and the table cell edit ONE number: the first mobile of the person the lead
// is about -- the individual, or a corporate lead's primary contact. They send
// `primaryPhone` on `PATCH /api/tenant/crm/v1/leads/:id`, which replaces only
// that number and keeps every other one (docs/api/crm-leads.md). Rebuilding
// the whole `phones`/`companyPhones` list here used to drop numbers, and
// writing a contact's mobile into `companyPhones` copied it onto the company.

import type { LeadItem } from "./hooks/useLeads";
import type { UpdateLeadRequest } from "./lead-write-contract";

type PhoneLead = Pick<LeadItem, "leadProfileType" | "phone" | "phones" | "primaryContact">;

/** The number the inline editors show and edit. */
export function leadEditablePrimaryPhone(lead: PhoneLead): string {
  if (lead.leadProfileType === "CORPORATE") return lead.primaryContact?.phones[0] ?? "";
  return lead.phone || lead.phones[0] || "";
}

/**
 * The PATCH body for an inline edit of that number, or `{}` when nothing
 * changes. Clearing it removes an individual's first number; a contact's
 * number cannot be cleared from a card, only from the contact itself.
 */
export function leadPrimaryPhonePatch(
  lead: PhoneLead,
  nextPhone: string,
): Pick<UpdateLeadRequest, "primaryPhone" | "phones" | "primaryMobile"> {
  const current = leadEditablePrimaryPhone(lead);
  const next = nextPhone.trim();
  if (next === current) return {};
  if (next) return { primaryPhone: next };
  if (lead.leadProfileType === "CORPORATE") return {};
  const others = lead.phones.filter((phone) => phone !== current);
  return { primaryMobile: others[0] ?? null, phones: others };
}
