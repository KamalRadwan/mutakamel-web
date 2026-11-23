import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreWriteMethod } from '../../../../core/api/core-http';
import { bindCrmHttpForTest, CrmWriteOptions, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { ContactDraft, newContact } from '../../shared/record/record-contact';
import { changeCustomerContact } from '../customers.api';
import { CUSTOMERS_FAKE_DB } from '../customers.fake';
import { ContactChangeBody, CustomerContactView, CustomerDetail } from '../customers.model';
import { draftFromDetail } from './customer-draft';
import { contactsAfterChange, CustomerContactSaveError, saveCustomerContacts } from './customer-contact-save';

function person(id: string, primary = false): CustomerContactView {
  return { partyId: id, relationshipId: null, displayName: id, firstName: id, lastName: '',
    honorificTitle: null, jobTitle: null, email: null, phones: ['+201001234567'], isPrimary: primary };
}

class ContactTransport extends CrmHttpStub {
  record: CustomerDetail = { ...structuredClone(CUSTOMERS_FAKE_DB[0]), profileType: 'CORPORATE',
    contacts: [person('remove', true), person('update')], updatedAt: '2026-11-23T00:00:00.000Z' };
  failAt = 0;
  failure = new ApiError(409, 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE');
  loseAddResponse = false;
  private revision = 0;

  constructor() { super({}); }

  override async read<T>(path: string) {
    await super.read(path).catch(() => undefined);
    return structuredClone(this.record) as T;
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const result = await super.write<T>(method, path, body, options);
    if (this.failAt === this.recordedWrites().length) throw this.failure;
    const input = body as { expectedUpdatedAt: string; contactChange: ContactChangeBody };
    expect(input.expectedUpdatedAt).toBe(this.record.updatedAt);
    const change = input.contactChange;
    if (change.op === 'REMOVE') this.record.contacts = this.record.contacts.filter((contact) => contact.partyId !== change.contactPartyId);
    if (change.op === 'UPDATE') Object.assign(this.record.contacts.find((contact) => contact.partyId === change.contactPartyId)!, change.contact);
    if (change.op === 'ADD') this.record.contacts.push({ ...person(change.contact.contactPartyId ?? 'server-new'), ...change.contact,
      firstName: change.contact.firstName ?? 'Linked', displayName: change.contact.firstName ?? 'Linked' });
    if (change.op === 'SET_PRIMARY') for (const contact of this.record.contacts) contact.isPrimary = contact.partyId === change.contactPartyId;
    this.record.updatedAt = `2026-11-23T00:00:${String(++this.revision).padStart(2, '0')}.000Z`;
    if (change.op === 'ADD' && this.loseAddResponse) throw new ApiError(0, 'NETWORK');
    return { ...result, data: structuredClone(this.record) as T };
  }
}

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('CustomerForm %s %s', (lang, theme) => {
  let http: ContactTransport;
  let dispose: () => void;
  let attributes: (string | null)[];
  let base: ContactDraft[];
  let draft: ContactDraft[];

  beforeEach(() => {
    attributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    http = new ContactTransport();
    dispose = bindCrmHttpForTest(http);
    crmQueries().clear();
    base = draftFromDetail(http.record).contacts;
    draft = [{ ...base[1], firstName: 'Updated' }, { ...newContact(true), firstName: 'New', phones: ['+201009876543'] }];
  });

  afterEach(() => {
    dispose(); crmQueries().clear();
    ['lang', 'dir', 'data-theme'].forEach((name, index) => attributes[index] === null
      ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, attributes[index]!));
  });

  it('CustomerForm › contact operations in order', async () => {
    const result = await saveCustomerContacts(http.record, base, draft);
    const writes = http.recordedWrites();
    expect(writes.map(({ body }) => (body as { contactChange: ContactChangeBody }).contactChange.op))
      .toEqual(['REMOVE', 'UPDATE', 'ADD', 'SET_PRIMARY']);
    expect(writes.map(({ body }) => (body as { expectedUpdatedAt: string }).expectedUpdatedAt))
      .toEqual(['2026-11-23T00:00:00.000Z', '2026-11-23T00:00:01.000Z', '2026-11-23T00:00:02.000Z', '2026-11-23T00:00:03.000Z']);
    expect(writes[3].body).toMatchObject({ contactChange: { op: 'SET_PRIMARY', contactPartyId: 'server-new' } });
    expect(writes.every(({ method, path, body, options }) => method === 'PATCH'
      && path === `/customer-profiles/${http.record.id}` && !('contacts' in (body as object))
      && /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(options.key) && !options.scope)).toBe(true);
    expect(new Set(writes.map(({ options }) => options.key)).size).toBe(4);
    expect(result.contacts.find((contact) => contact.isPrimary)?.partyId).toBe('server-new');
  });

  it('CustomerForm › partial contact save', async () => {
    http.failAt = 2;
    const failure = await saveCustomerContacts(http.record, base, draft).catch((error: unknown) => error) as CustomerContactSaveError;
    expect(failure).toBeInstanceOf(CustomerContactSaveError);
    expect(failure.saved).toEqual(['remove']);
    expect(http.recordedWrites()).toHaveLength(2);
    expect(http.recordedReads()).toEqual([{ path: `/customer-profiles/${http.record.id}`, query: undefined, scope: undefined }]);
    expect(failure.fresh?.contacts.map((contact) => contact.partyId)).toEqual(['update']);
    expect(failure.remaining[0].firstName).toBe('Updated');
    http.failAt = 0;
    await saveCustomerContacts(failure.fresh!, draftFromDetail(failure.fresh!).contacts, failure.remaining);
    expect(http.recordedWrites().slice(2).map(({ body }) => (body as { contactChange: ContactChangeBody }).contactChange.op))
      .toEqual(['UPDATE', 'ADD', 'SET_PRIMARY']);
  });

  it.each([[400, 'CRM_CONTACT_CHANGE_CONFLICT'], [404, 'CRM_CONTACT_NOT_LINKED']])('stops and refetches on %s %s', async (status, code) => {
    http.failAt = 1; http.failure = new ApiError(status as number, code as string);
    const failure = await saveCustomerContacts(http.record, base, draft).catch((error: unknown) => error) as CustomerContactSaveError;
    expect(failure.error).toMatchObject({ code });
    expect(http.recordedWrites()).toHaveLength(1); expect(http.recordedReads()).toHaveLength(1);
  });

  it('does not write unchanged contacts', async () => {
    await saveCustomerContacts(http.record, base, structuredClone(base));
    expect(http.recordedWrites()).toEqual([]);
  });

  it('resolves a committed ADD after a lost response so retry cannot add it twice', async () => {
    http.loseAddResponse = true;
    const failure = await saveCustomerContacts(http.record, base, draft).catch((error: unknown) => error) as CustomerContactSaveError;
    expect(failure.remaining.at(-1)?.contactPartyId).toBe('server-new');
    expect(failure.saved).toEqual(['remove', 'Updated', 'New']);
    http.loseAddResponse = false;
    await saveCustomerContacts(failure.fresh!, draftFromDetail(failure.fresh!).contacts, failure.remaining);
    expect(http.recordedWrites().map(({ body }) => (body as { contactChange: ContactChangeBody }).contactChange.op))
      .toEqual(['REMOVE', 'UPDATE', 'ADD', 'SET_PRIMARY']);
  });

  it('contact-card changes use the same draft sequence', () => {
    expect(contactsAfterChange(base, { op: 'REMOVE', contactPartyId: 'remove' })).toEqual([base[1]]);
    expect(contactsAfterChange(base, { op: 'SET_PRIMARY', contactPartyId: 'update' }).map((contact) => contact.isPrimary)).toEqual([false, true]);
  });

  it('a contact-card retry after ADD keeps the resolved server id', async () => {
    const added = { ...newContact(true), firstName: 'New', phones: ['+201009876543'] };
    const next = [...base.map((contact) => ({ ...contact, isPrimary: false })), added];
    http.failAt = 2;
    const failure = await saveCustomerContacts(http.record, base, next).catch((error: unknown) => error) as CustomerContactSaveError;
    expect(failure.saved).toEqual(['New']);
    const retry = contactsAfterChange(failure.remaining, { op: 'ADD', contact: added });
    expect(retry.at(-1)?.contactPartyId).toBe('server-new');
    http.failAt = 0;
    await saveCustomerContacts(failure.fresh!, draftFromDetail(failure.fresh!).contacts, retry);
    expect(http.recordedWrites().map(({ body }) => (body as { contactChange: ContactChangeBody }).contactChange.op))
      .toEqual(['ADD', 'SET_PRIMARY', 'SET_PRIMARY']);
  });

  it('never resends an idempotency mismatch', async () => {
    http.failAt = 1; http.failure = new ApiError(409, 'GW.IDEM.MISMATCH');
    const change: ContactChangeBody = { op: 'REMOVE', contactPartyId: 'remove' };
    await expect(changeCustomerContact(http.record.id, change, http.record.updatedAt)).rejects.toBe(http.failure);
    await expect(changeCustomerContact(http.record.id, change, http.record.updatedAt)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    expect(http.recordedWrites()).toHaveLength(1);
  });

  it('requires a loaded token and preserves a key only for a retry of the same action', async () => {
    const change: ContactChangeBody = { op: 'REMOVE', contactPartyId: 'remove' };
    await expect(changeCustomerContact(http.record.id, change)).rejects.toMatchObject({ code: 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE' });
    expect(http.recordedWrites()).toHaveLength(0);
    http.failAt = 1; http.failure = new ApiError(503, 'UNAVAILABLE');
    await expect(changeCustomerContact(http.record.id, change, http.record.updatedAt)).rejects.toBe(http.failure);
    http.failAt = 0;
    const token = http.record.updatedAt;
    await changeCustomerContact(http.record.id, change, token);
    expect(http.recordedWrites()[0].options.key).toBe(http.recordedWrites()[1].options.key);
    await changeCustomerContact(http.record.id, { op: 'SET_PRIMARY', contactPartyId: 'update' }, http.record.updatedAt);
    expect(http.recordedWrites()[2].options.key).not.toBe(http.recordedWrites()[1].options.key);
  });
});
