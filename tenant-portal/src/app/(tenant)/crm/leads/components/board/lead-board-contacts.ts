import type { LeadDetail } from "../../lead-contract";
import type { LeadItem } from "../../hooks/useLeads";

// The expanded card is a glance, not the lead page: two numbers per person or
// company and three people at most. The lead page lists the rest.
const PHONES_SHOWN = 2;
export const CONTACTS_SHOWN = 3;

interface LeadBoardContact {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  isPrimary: boolean;
  phones: string[];
}

function distinct(phones: ReadonlyArray<string | null | undefined>, limit: number): string[] {
  const present = phones
    .map((phone) => phone?.trim() ?? "")
    .filter((phone) => phone.length > 0);
  return Array.from(new Set(present)).slice(0, limit);
}

/** An individual lead's own numbers: the detail read first, then the list row's. */
export function individualPhones(lead: LeadItem, detail: LeadDetail | null): string[] {
  return distinct(
    [...(detail?.phones ?? []), ...lead.phones, lead.primaryMobile, lead.phone],
    PHONES_SHOWN,
  );
}

/** A corporate lead's company numbers. */
export function companyPhones(lead: LeadItem, detail: LeadDetail | null): string[] {
  return distinct(
    [detail?.companyPhone, ...(detail?.phones ?? []), lead.phone, ...lead.phones],
    PHONES_SHOWN,
  );
}

/**
 * The people behind a corporate lead. Only the detail read lists them all; the
 * list row carries the primary one, which stands in until that read lands.
 * With several people each shows its first number; a lone contact shows two,
 * topped up from the list row's primary-contact numbers.
 */
export function corporateContacts(lead: LeadItem, detail: LeadDetail | null): LeadBoardContact[] {
  const fromList = lead.primaryContact ? [lead.primaryContact] : [];
  const contacts = detail && detail.contacts.length > 0 ? detail.contacts : fromList;
  const isLone = contacts.length === 1;
  return contacts.map((contact) => ({
    partyId: contact.partyId,
    displayName: contact.displayName,
    jobTitle: contact.jobTitle || null,
    isPrimary: contact.isPrimary,
    phones: isLone
      ? distinct([...contact.phones, ...(lead.primaryContact?.phones ?? []), lead.primaryMobile], PHONES_SHOWN)
      : distinct(contact.phones, 1),
  }));
}
