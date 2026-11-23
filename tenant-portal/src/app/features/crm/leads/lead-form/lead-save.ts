import { ApiError } from '../../../../core/api/api-errors';
import { attachLeadTags, detachLeadTag, getLead, patchLead } from '../leads.api';
import { LeadDetail } from '../leads.model';
import { ContactDraft, CreateLeadContactBody, LeadContactChange, LeadDraft, toPatchBody } from './lead-draft';

export interface SavedContactChange {
  op: LeadContactChange['op'];
  name: string;
}

/** A sequence is not atomic. The caller keeps the remaining draft against the freshly read base. */
export class LeadContactSaveError extends Error {
  constructor(
    readonly error: unknown,
    readonly fresh: LeadDetail | null,
    readonly remaining: LeadDraft,
    readonly saved: SavedContactChange[],
  ) { super('partial_contact_save'); }
}

export interface LeadSaveResult {
  lead: LeadDetail;
  tagError?: unknown;
}

type ContactOperation = { key: string; change: LeadContactChange; name: string };

function contactValues(contact: ContactDraft): Omit<CreateLeadContactBody, 'isPrimary'> {
  return {
    firstName: contact.firstName.trim(), lastName: contact.lastName.trim(),
    honorificTitle: contact.honorificTitle.trim() || undefined,
    jobTitle: contact.jobTitle.trim() || undefined,
    phones: contact.phones.map((phone) => phone.trim()).filter(Boolean),
    email: contact.email.trim() || undefined,
  };
}

function contactOperations(base: LeadDraft, draft: LeadDraft): ContactOperation[] {
  const operations: ContactOperation[] = [];
  const name = (contact: ContactDraft) => [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  const byId = new Map(base.contacts.filter((contact) => contact.contactPartyId)
    .map((contact) => [contact.contactPartyId!, contact]));
  for (const contact of base.contacts) {
    if (contact.contactPartyId && !draft.contacts.some((next) => next.contactPartyId === contact.contactPartyId)) {
      operations.push({ key: contact.key, name: name(contact),
        change: { op: 'REMOVE', contactPartyId: contact.contactPartyId } });
    }
  }
  for (const contact of draft.contacts) {
    const previous = contact.contactPartyId ? byId.get(contact.contactPartyId) : undefined;
    if (!previous || JSON.stringify(contactValues(previous)) === JSON.stringify(contactValues(contact))) continue;
    const values: Record<string, unknown> = {};
    const before = contactValues(previous);
    for (const [key, value] of Object.entries(contactValues(contact))) {
      if (JSON.stringify(before[key as keyof typeof before]) !== JSON.stringify(value)) values[key] = value ?? null;
    }
    operations.push({ key: contact.key, name: name(contact), change: {
      op: 'UPDATE', contactPartyId: contact.contactPartyId!, contact: { ...values, isPrimary: previous.isPrimary },
    } });
  }
  for (const contact of draft.contacts) {
    if (contact.contactPartyId && byId.has(contact.contactPartyId)) continue;
    operations.push({ key: contact.key, name: name(contact), change: { op: 'ADD', contact: contact.contactPartyId
      ? { contactPartyId: contact.contactPartyId, jobTitle: contact.jobTitle.trim() || undefined, isPrimary: false }
      : { ...contactValues(contact), isPrimary: false } } });
  }
  const primary = draft.contacts.find((contact) => contact.isPrimary);
  const oldPrimary = base.contacts.find((contact) => contact.isPrimary);
  if (primary && (!primary.contactPartyId || primary.contactPartyId !== oldPrimary?.contactPartyId)) {
    operations.push({ key: primary.key, name: name(primary),
      change: { op: 'SET_PRIMARY', contactPartyId: primary.contactPartyId ?? '' } });
  }
  return operations;
}

/** Main fields, individual contact operations, then tag diff. Every PATCH uses the previous response token. */
export async function saveLeadChanges(current: LeadDetail, base: LeadDraft, draft: LeadDraft): Promise<LeadSaveResult> {
  let lead = current;
  const body = toPatchBody(base, draft, current.updatedAt);
  if (Object.keys(body).some((key) => key !== 'expectedUpdatedAt')
    || JSON.stringify(base.tagIds) !== JSON.stringify(draft.tagIds)) {
    lead = await patchLead(current.id, body);
  }
  const operations = draft.leadProfileType === 'CORPORATE' ? contactOperations(base, draft) : [];
  const resolvedIds = new Map<string, string>();
  const saved: SavedContactChange[] = [];
  for (const operation of operations) {
    const change = operation.change.op === 'SET_PRIMARY'
      ? { ...operation.change, contactPartyId: resolvedIds.get(operation.key) ?? operation.change.contactPartyId }
      : operation.change;
    const previousIds = new Set(lead.contacts.map((contact) => contact.partyId));
    try {
      lead = await patchLead(current.id, { expectedUpdatedAt: lead.updatedAt, contactChange: change });
      if (change.op === 'ADD') {
        const addedId = change.contact.contactPartyId
          ?? lead.contacts.find((contact) => !previousIds.has(contact.partyId))?.partyId;
        if (!addedId) throw new ApiError(409, 'CRM_CONTACT_CHANGE_CONFLICT');
        resolvedIds.set(operation.key, addedId);
      }
      saved.push({ op: change.op, name: operation.name });
    } catch (error) {
      let fresh: LeadDetail | null = null;
      try { fresh = await getLead(current.id); } catch { /* Keep the draft when refetch is unavailable. */ }
      // A lost ADD response may still have committed. Resolve its returned contact before offering retry.
      if (fresh && change.op === 'ADD') {
        const candidates = fresh.contacts.filter((contact) => !previousIds.has(contact.partyId)
          && (change.contact.contactPartyId ? contact.partyId === change.contact.contactPartyId
            : contact.firstName?.trim() === change.contact.firstName?.trim()
              && (contact.lastName ?? '').trim() === (change.contact.lastName ?? '').trim()
              && (contact.email ?? '').trim().toLowerCase() === (change.contact.email ?? '').trim().toLowerCase()
              && JSON.stringify(contact.phones) === JSON.stringify(change.contact.phones ?? [])));
        if (candidates.length === 1) {
          resolvedIds.set(operation.key, candidates[0].partyId);
          saved.push({ op: 'ADD', name: operation.name });
        } else if (candidates.length > 1) {
          fresh = null;
        }
      }
      const remaining = structuredClone(draft);
      for (const contact of remaining.contacts) contact.contactPartyId = resolvedIds.get(contact.key) ?? contact.contactPartyId;
      throw new LeadContactSaveError(error, fresh, remaining, saved);
    }
  }
  const added = draft.tagIds.filter((id) => !base.tagIds.includes(id));
  const removed = base.tagIds.filter((id) => !draft.tagIds.includes(id));
  try {
    if (added.length) await attachLeadTags(current.id, added);
    for (const id of removed) await detachLeadTag(current.id, id);
    if (added.length || removed.length) lead = await getLead(current.id);
    return { lead };
  } catch (tagError) {
    try { lead = await getLead(current.id); } catch { /* Keep the last saved detail when refetch is unavailable. */ }
    return { lead, tagError };
  }
}
