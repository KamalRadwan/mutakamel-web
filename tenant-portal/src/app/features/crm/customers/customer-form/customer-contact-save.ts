import { ApiError } from '../../../../core/api/api-errors';
import { changeCustomerContact, getCustomer } from '../customers.api';
import { ContactChangeBody, ContactPersonBody, CustomerDetail } from '../customers.model';
import { ContactChange, ContactDraft } from '../../shared/record/record-contact';
import { toContactChangeBody } from './customer-draft';

export class CustomerContactSaveError extends Error {
  constructor(
    readonly error: unknown,
    readonly fresh: CustomerDetail | null,
    readonly remaining: ContactDraft[],
    readonly saved: string[],
  ) { super('partial_contact_save'); }
}

function contactValues(contact: ContactDraft): ContactPersonBody {
  return {
    firstName: contact.firstName.trim(), lastName: contact.lastName.trim(),
    honorificTitle: contact.honorificTitle.trim(), jobTitle: contact.jobTitle.trim(),
    email: contact.email.trim() || null,
    phones: contact.phones.map((phone) => phone.trim()).filter(Boolean),
  };
}

/** Contact-card actions and a restored record draft use the same ordered save path. */
export function contactsAfterChange(base: readonly ContactDraft[], change: ContactChange): ContactDraft[] {
  if (change.op === 'ADD') {
    const existing = base.find((contact) => contact.key === change.contact.key);
    return existing ? base.map((contact) => contact === existing
      ? { ...change.contact, contactPartyId: existing.contactPartyId ?? change.contact.contactPartyId } : contact)
      : [...base, change.contact];
  }
  if (change.op === 'REMOVE') return base.filter((contact) => contact.contactPartyId !== change.contactPartyId);
  if (change.op === 'UPDATE') return base.map((contact) =>
    contact.contactPartyId === change.contactPartyId ? change.contact : contact);
  return base.map((contact) => ({ ...contact, isPrimary: contact.contactPartyId === change.contactPartyId }));
}

function contactOperations(base: readonly ContactDraft[], draft: readonly ContactDraft[]) {
  const operations: { key: string; name: string; change: ContactChangeBody }[] = [];
  const name = (contact: ContactDraft) => [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  const byId = new Map(base.map((contact) => [contact.contactPartyId, contact]));
  for (const contact of base) {
    if (contact.contactPartyId && !draft.some((next) => next.contactPartyId === contact.contactPartyId)) {
      operations.push({ key: contact.key, name: name(contact),
        change: { op: 'REMOVE', contactPartyId: contact.contactPartyId } });
    }
  }
  for (const contact of draft) {
    const previous = contact.contactPartyId ? byId.get(contact.contactPartyId) : undefined;
    if (!previous) continue;
    const before = contactValues(previous);
    const changed = Object.fromEntries(Object.entries(contactValues(contact))
      .filter(([key, value]) => JSON.stringify(before[key as keyof ContactPersonBody]) !== JSON.stringify(value)));
    if (Object.keys(changed).length) operations.push({ key: contact.key, name: name(contact),
      change: { op: 'UPDATE', contactPartyId: contact.contactPartyId!, contact: changed } });
  }
  for (const contact of draft) {
    if (contact.contactPartyId && byId.has(contact.contactPartyId)) continue;
    operations.push({ key: contact.key, name: name(contact),
      change: toContactChangeBody({ op: 'ADD', contact: { ...contact, isPrimary: false } }) });
  }
  const primary = draft.find((contact) => contact.isPrimary);
  if (primary && (!primary.contactPartyId || primary.contactPartyId !== base.find((contact) => contact.isPrimary)?.contactPartyId)) {
    operations.push({ key: primary.key, name: name(primary),
      change: { op: 'SET_PRIMARY', contactPartyId: primary.contactPartyId ?? '' } });
  }
  return operations;
}

export function hasCustomerContactChanges(base: readonly ContactDraft[], draft: readonly ContactDraft[]): boolean {
  return contactOperations(base, draft).length > 0;
}

/** Every operation uses the previous response token; a failure stops the sequence before any retry. */
export async function saveCustomerContacts(
  current: CustomerDetail, base: readonly ContactDraft[], draft: readonly ContactDraft[],
): Promise<CustomerDetail> {
  let latest = current;
  const resolvedIds = new Map<string, string>();
  const saved: string[] = [];
  for (const operation of contactOperations(base, draft)) {
    const change = operation.change.op === 'SET_PRIMARY'
      ? { ...operation.change, contactPartyId: resolvedIds.get(operation.key) ?? operation.change.contactPartyId }
      : operation.change;
    const previousIds = new Set(latest.contacts.map((contact) => contact.partyId));
    try {
      latest = await changeCustomerContact(current.id, change, latest.updatedAt);
      saved.push(operation.name);
      if (change.op === 'ADD') {
        const id = latest.contacts.find((contact) => !previousIds.has(contact.partyId))?.partyId;
        if (!id) throw new ApiError(400, 'CRM_CONTACT_CHANGE_CONFLICT');
        resolvedIds.set(operation.key, id);
      }
    } catch (error) {
      let fresh: CustomerDetail | null = null;
      try { fresh = await getCustomer(current.id); } catch { /* Keep the draft if the read also fails. */ }
      // A lost ADD response may have committed; resolve it before offering a retry.
      if (fresh && change.op === 'ADD' && !resolvedIds.has(operation.key)) {
        const candidates = fresh.contacts.filter((contact) => !previousIds.has(contact.partyId)
          && (change.contact.contactPartyId ? contact.partyId === change.contact.contactPartyId
            : contact.firstName?.trim() === change.contact.firstName?.trim()
              && (contact.lastName ?? '').trim() === (change.contact.lastName ?? '').trim()
              && (contact.email ?? '').trim().toLowerCase() === (change.contact.email ?? '').trim().toLowerCase()
              && JSON.stringify(contact.phones) === JSON.stringify(change.contact.phones ?? [])));
        if (candidates.length === 1) {
          resolvedIds.set(operation.key, candidates[0].partyId);
          if (!saved.includes(operation.name)) saved.push(operation.name);
        } else if (candidates.length > 1) fresh = null;
      }
      const remaining = structuredClone([...draft]);
      for (const contact of remaining) contact.contactPartyId = resolvedIds.get(contact.key) ?? contact.contactPartyId;
      throw new CustomerContactSaveError(error, fresh, remaining, saved);
    }
  }
  return latest;
}
