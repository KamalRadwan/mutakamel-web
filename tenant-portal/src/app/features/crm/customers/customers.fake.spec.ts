import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../settings/shared/settings-api';
import {
  changeCustomerContact,
  createCustomer,
  getCustomer,
  listBranchOwners,
  listCurrencies,
  loadBoard,
  loadStatusPage,
  patchCustomer,
  searchCustomers,
  setCustomerStatus,
} from './customers.api';
import { CUSTOMER_STATUS_ORDER, MANUAL_STATUSES, isManualStatus } from './customer-statuses';
import { ACME_CUSTOMER_ID, CUSTOMERS_FAKE_DB, DEFAULT_CUSTOMER_BRANCH_ID, fakeListTags } from './customers.fake';
import {
  CUSTOMER_BOARD_LIMIT,
  CUSTOMER_LIST_LIMIT,
  CreateCustomerBody,
  CustomerDetail,
  CustomerSearchBody,
} from './customers.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

let keyCounter = 0;
const nextKey = () => `0190a1b2-c3d4-7e5f-8a9b-${String(++keyCounter).padStart(12, '0')}`;

const BASE: CustomerSearchBody = { branchId: DEFAULT_CUSTOMER_BRANCH_ID };

function createCorporate(name: string, extra: Partial<CreateCustomerBody> = {}): Promise<CustomerDetail> {
  return settle(
    createCustomer(
      { branchId: DEFAULT_CUSTOMER_BRANCH_ID, profileType: 'CORPORATE', companyName: name, ...extra },
      nextKey(),
    ),
  );
}

function useTimers(): void {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

describe('customers fake: board', () => {
  useTimers();

  it('returns one lane per status in canonical order in a single call', async () => {
    const board = await settle(loadBoard(BASE));
    expect(board.statuses.map((l) => l.status)).toEqual(CUSTOMER_STATUS_ORDER);
  });

  it('returns counts whose ALL equals the sum of the status counts', async () => {
    const { counts } = await settle(loadBoard(BASE));
    expect(counts.ALL).toBe(counts.PROSPECT + counts.ACTIVE_CUSTOMER + counts.INACTIVE + counts.BLACKLISTED);
  });

  it('reports each lane total equal to its status count', async () => {
    const { statuses, counts } = await settle(loadBoard(BASE));
    for (const lane of statuses) expect(lane.total).toBe(counts[lane.status]);
  });

  it('caps each lane to the board limit and flags hasNext when more exist', async () => {
    const { statuses } = await settle(loadBoard(BASE));
    for (const lane of statuses) {
      expect(lane.items.length).toBeLessThanOrEqual(CUSTOMER_BOARD_LIMIT);
      expect(lane.limit).toBe(CUSTOMER_BOARD_LIMIT);
      expect(lane.hasNext).toBe(lane.total > CUSTOMER_BOARD_LIMIT);
    }
  });

  it('only places items of the lane status inside that lane', async () => {
    const { statuses } = await settle(loadBoard(BASE));
    for (const lane of statuses) expect(lane.items.every((i) => i.status === lane.status)).toBe(true);
  });

  it('carries an ISO updatedAt on every board item', async () => {
    const { statuses } = await settle(loadBoard(BASE));
    const items = statuses.flatMap((l) => l.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(Number.isNaN(Date.parse(item.updatedAt))).toBe(false);
  });

  it('returns zero counts and empty lanes when the search matches nothing', async () => {
    const board = await settle(loadBoard({ ...BASE, search: 'zzz-no-such-customer' }));
    expect(board.counts.ALL).toBe(0);
    expect(board.statuses.every((l) => l.items.length === 0)).toBe(true);
  });

  it('returns an empty lane page with totalPages 0 when nothing matches (paginatedReadModels)', async () => {
    const board = await settle(loadBoard({ ...BASE, search: 'zzz-no-such-customer' }));
    expect(board.statuses[0]).toMatchObject({ total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false });
  });

  it('sorts lane items by rating descending when requested', async () => {
    const { statuses } = await settle(loadBoard({ ...BASE, sort: 'rating:DESC' }));
    for (const lane of statuses) {
      const ratings = lane.items.map((i) => i.rating);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    }
  });

  it('sorts lane items by updatedAt ascending when requested', async () => {
    const { statuses } = await settle(loadBoard({ ...BASE, sort: 'updatedAt:ASC' }));
    for (const lane of statuses) {
      const times = lane.items.map((i) => Date.parse(i.updatedAt));
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it('sorts lane items by createdAt ascending by default (searchSort fallback)', async () => {
    const { statuses } = await settle(loadBoard(BASE));
    const created = new Map(CUSTOMERS_FAKE_DB.map((c) => [c.id, Date.parse(c.createdAt)]));
    for (const lane of statuses) {
      const times = lane.items.map((i) => created.get(i.id)!);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });
});

describe('customers fake: status page', () => {
  useTimers();

  it('returns the requested page for a single status lane', async () => {
    const lane = await settle(loadStatusPage('PROSPECT', BASE, 1));
    expect(lane.status).toBe('PROSPECT');
    expect(lane.page).toBe(1);
    expect(lane.items.every((i) => i.status === 'PROSPECT')).toBe(true);
  });

  it('returns an empty items list beyond the last page', async () => {
    const lane = await settle(loadStatusPage('PROSPECT', BASE, 99));
    expect(lane.items).toEqual([]);
    expect(lane.hasNext).toBe(false);
    expect(lane.hasPrev).toBe(true);
  });

  it('matches the board lane total for the same status', async () => {
    const board = await settle(loadBoard(BASE));
    const lane = await settle(loadStatusPage('INACTIVE', BASE, 1));
    expect(lane.total).toBe(board.counts.INACTIVE);
  });

  it('rejects an unknown status with a validation error', async () => {
    await expect(settle(loadStatusPage('NOPE' as never, BASE, 1))).rejects.toMatchObject({
      status: 400,
      code: 'CRM_VALIDATION_FAILED',
    });
  });

  it('pages through a lane without duplicating items once it exceeds the limit', async () => {
    for (let i = 0; i < CUSTOMER_BOARD_LIMIT; i++) await createCorporate(`Paging Co ${i}`);
    const p1 = await settle(loadStatusPage('PROSPECT', BASE, 1));
    const p2 = await settle(loadStatusPage('PROSPECT', BASE, 2));
    expect(p1.items.length).toBe(CUSTOMER_BOARD_LIMIT);
    expect(p1.hasNext).toBe(true);
    expect(p2.hasPrev).toBe(true);
    const ids1 = new Set(p1.items.map((i) => i.id));
    expect(p2.items.some((i) => ids1.has(i.id))).toBe(false);
    expect(p1.items.length + p2.items.length).toBe(Math.min(p1.total, 2 * CUSTOMER_BOARD_LIMIT));
  });
});

describe('customers fake: search', () => {
  useTimers();

  it('omits counts unless includeStatusCounts is requested', async () => {
    const res = await settle(searchCustomers(BASE));
    expect(res.counts).toBeUndefined();
  });

  it('includes status counts when includeStatusCounts is true', async () => {
    const res = await settle(searchCustomers({ ...BASE, includeStatusCounts: true }));
    expect(res.counts).toBeDefined();
    expect(res.counts!.ALL).toBe(res.total);
  });

  it('keeps counts across all statuses while the status filter narrows the items', async () => {
    const all = await settle(searchCustomers({ ...BASE, includeStatusCounts: true }));
    const filtered = await settle(searchCustomers({ ...BASE, includeStatusCounts: true, status: 'BLACKLISTED' }));
    expect(filtered.counts).toEqual(all.counts);
    expect(filtered.total).toBe(all.counts!.BLACKLISTED);
    expect(filtered.items.every((i) => i.status === 'BLACKLISTED')).toBe(true);
  });

  it('applies the default list limit', async () => {
    const res = await settle(searchCustomers(BASE));
    expect(res.limit).toBe(CUSTOMER_LIST_LIMIT);
    expect(res.items.length).toBeLessThanOrEqual(CUSTOMER_LIST_LIMIT);
  });

  it('honours the page and limit given in the body', async () => {
    const res = await settle(searchCustomers({ ...BASE, page: 2, limit: 5 }));
    expect(res).toMatchObject({ page: 2, limit: 5, hasPrev: true });
    expect(res.items.length).toBeLessThanOrEqual(5);
  });

  it('prefers explicit page and limit arguments over the body', async () => {
    const res = await settle(searchCustomers({ ...BASE, page: 2, limit: 5 }, 1, 3));
    expect(res).toMatchObject({ page: 1, limit: 3 });
  });

  it('finds a customer by a case-insensitive name term', async () => {
    const acme = await settle(getCustomer(ACME_CUSTOMER_ID));
    const term = acme.displayName.slice(0, 4).toUpperCase();
    const res = await settle(searchCustomers({ ...BASE, search: term, searchField: 'customer', limit: 100 }));
    expect(res.items.some((i) => i.id === ACME_CUSTOMER_ID)).toBe(true);
  });

  it('returns no items and zero counts for a term that matches nothing', async () => {
    const res = await settle(searchCustomers({ ...BASE, search: 'zzz-no-such', includeStatusCounts: true }));
    expect(res.items).toEqual([]);
    expect(res.counts!.ALL).toBe(0);
  });

  it('sorts by rating ascending', async () => {
    const res = await settle(searchCustomers({ ...BASE, sort: 'rating:ASC', limit: 100 }));
    const ratings = res.items.map((i) => i.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
  });

  it('sorts by status following the canonical status order', async () => {
    const res = await settle(searchCustomers({ ...BASE, sort: 'status:ASC', limit: 100 }));
    const idx = res.items.map((i) => CUSTOMER_STATUS_ORDER.indexOf(i.status));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('sorts by status descending with the last canonical status first', async () => {
    const res = await settle(searchCustomers({ ...BASE, sort: 'status:DESC', limit: 100 }));
    expect(res.items[0].status).toBe('BLACKLISTED');
  });

  it('sorts by updatedAt ascending', async () => {
    const res = await settle(searchCustomers({ ...BASE, sort: 'updatedAt:ASC', limit: 100 }));
    const t = res.items.map((i) => Date.parse(i.updatedAt));
    expect(t).toEqual([...t].sort((a, b) => a - b));
  });

  it('puts a just-patched customer first under updatedAt:DESC', async () => {
    const target = await createCorporate('Recency Probe Co');
    vi.advanceTimersByTime(24 * 60 * 60 * 1000); // clear timestamps left in the shared fake DB by earlier tests
    const patched = await settle(patchCustomer(target.id, { description: 'touched' }));
    const res = await settle(searchCustomers({ ...BASE, sort: 'updatedAt:DESC', limit: 5 }));
    expect(res.items[0].id).toBe(patched.id);
  });
});

describe('customers fake: create', () => {
  useTimers();

  it('persists rating and card colour on create', async () => {
    const c = await createCorporate('Rated Co', { rating: 2, cardColor: 'TEAL' });
    expect(c).toMatchObject({ rating: 2, cardColor: 'TEAL' });
  });

  it('defaults rating to 0, card colour to null and status to PROSPECT', async () => {
    const c = await createCorporate('Plain Co');
    expect(c).toMatchObject({ rating: 0, cardColor: null, status: 'PROSPECT' });
  });

  it('attaches the requested tags', async () => {
    const tags = await settle(fakeListTags());
    const c = await createCorporate('Tagged Co', { tagIds: [tags[0].id, tags[1].id] });
    expect(c.tags.map((t) => t.id)).toEqual([tags[0].id, tags[1].id]);
  });

  it('rejects repeated tag ids (ArrayUnique) with 400 { tagIds }', async () => {
    const tags = await settle(fakeListTags());
    const error = await createCorporate('Dup Tag Co', { tagIds: [tags[0].id, tags[0].id] }).catch((e: ApiError) => e);
    expect(error).toMatchObject({ status: 400, code: 'CRM_VALIDATION_FAILED' });
    expect((error as ApiError).details).toHaveProperty('tagIds');
  });

  it('rejects an unknown tag id', async () => {
    await expect(createCorporate('Bad Tag Co', { tagIds: ['nope'] })).rejects.toMatchObject({
      status: 422,
      code: 'CRM_TAG_UNKNOWN',
      details: { tagIds: ['nope'] },
    });
  });

  it('stores a validated address with country and state names', async () => {
    const c = await createCorporate('Addr Co', { address: { countryId: 'geo-eg', stateId: 'geo-eg-c' } });
    expect(c.address?.countryId).toBe('geo-eg');
    expect(c.address?.stateId).toBe('geo-eg-c');
    expect(c.address?.countryName?.nameEn).toBe('Egypt');
  });

  it('rejects a state that belongs to another country', async () => {
    await expect(
      createCorporate('Bad Addr Co', { address: { countryId: 'geo-sa', stateId: 'geo-eg-c' } }),
    ).rejects.toMatchObject({ status: 422, code: 'LEAD_ADDRESS_GEO_INVALID', details: { field: ['stateId'] } });
  });

  it('stores no address when every address id is empty', async () => {
    const c = await createCorporate('Empty Addr Co', { address: {} });
    expect(c.address).toBeNull();
  });

  it('rejects a rating above 3', async () => {
    await expect(createCorporate('Over Rated Co', { rating: 4 })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an unknown card colour', async () => {
    await expect(createCorporate('Bad Colour Co', { cardColor: 'MAUVE' as never })).rejects.toMatchObject({
      status: 400,
      code: 'CRM_VALIDATION_FAILED',
    });
  });

  it('sets createdAt equal to updatedAt on a new customer', async () => {
    const c = await createCorporate('Stamp Co');
    expect(c.updatedAt).toBe(c.createdAt);
  });

  it('adds the new customer to the board prospect lane count', async () => {
    const before = await settle(loadBoard(BASE));
    await createCorporate('Count Co');
    const after = await settle(loadBoard(BASE));
    expect(after.counts.PROSPECT).toBe(before.counts.PROSPECT + 1);
    expect(after.counts.ALL).toBe(before.counts.ALL + 1);
  });

  it('returns the same customer for a repeated idempotency key and body', async () => {
    const key = nextKey();
    const body: CreateCustomerBody = {
      branchId: DEFAULT_CUSTOMER_BRANCH_ID,
      profileType: 'CORPORATE',
      companyName: 'Idem Co',
    };
    const a = await settle(createCustomer(body, key));
    const b = await settle(createCustomer(body, key));
    expect(b.id).toBe(a.id);
  });

  it('rejects a reused idempotency key with a different body', async () => {
    const key = nextKey();
    const body: CreateCustomerBody = {
      branchId: DEFAULT_CUSTOMER_BRANCH_ID,
      profileType: 'CORPORATE',
      companyName: 'Idem A',
    };
    await settle(createCustomer(body, key));
    await expect(settle(createCustomer({ ...body, companyName: 'Idem B' }, key))).rejects.toMatchObject({
      status: 422,
      code: 'GW.IDEM.MISMATCH',
    });
  });

  it('rejects a malformed idempotency key', async () => {
    await expect(
      settle(createCustomer({ branchId: DEFAULT_CUSTOMER_BRANCH_ID, profileType: 'CORPORATE', companyName: 'X' }, 'abc')),
    ).rejects.toMatchObject({ status: 400, code: 'GW.IDEM.MISSING' });
  });

  it('refuses to create an ACTIVE_CUSTOMER directly', async () => {
    await expect(createCorporate('Active Co', { status: 'ACTIVE_CUSTOMER' as never })).rejects.toMatchObject({
      status: 422,
      code: 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON',
    });
  });
});

describe('customers fake: patch and conflicts', () => {
  useTimers();

  it('applies rating and colour changes and bumps updatedAt', async () => {
    const c = await createCorporate('Patch Co');
    vi.advanceTimersByTime(1_000);
    const p = await settle(patchCustomer(c.id, { rating: 3, cardColor: 'PINK' }));
    expect(p).toMatchObject({ rating: 3, cardColor: 'PINK' });
    expect(Date.parse(p.updatedAt)).toBeGreaterThan(Date.parse(c.updatedAt));
  });

  it('clears the card colour when null is sent', async () => {
    const c = await createCorporate('Clear Colour Co', { cardColor: 'RED' });
    const p = await settle(patchCustomer(c.id, { cardColor: null }));
    expect(p.cardColor).toBeNull();
  });

  it('accepts a patch whose expectedUpdatedAt matches the stored value', async () => {
    const c = await createCorporate('Match Co');
    const p = await settle(patchCustomer(c.id, { rating: 1, expectedUpdatedAt: c.updatedAt }));
    expect(p.rating).toBe(1);
  });

  it('rejects a patch with a stale expectedUpdatedAt as a concurrent update', async () => {
    const c = await createCorporate('Stale Co');
    vi.advanceTimersByTime(1_000);
    await settle(patchCustomer(c.id, { rating: 1 }));
    await expect(settle(patchCustomer(c.id, { rating: 2, expectedUpdatedAt: c.updatedAt }))).rejects.toMatchObject({
      status: 409,
      code: 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE',
    });
  });

  it('does not apply a patch that conflicted', async () => {
    const c = await createCorporate('No Apply Co');
    vi.advanceTimersByTime(1_000);
    const first = await settle(patchCustomer(c.id, { rating: 1 }));
    await expect(settle(patchCustomer(c.id, { rating: 3, expectedUpdatedAt: c.updatedAt }))).rejects.toBeInstanceOf(
      ApiError,
    );
    const after = await settle(getCustomer(c.id));
    expect(after.rating).toBe(1);
    expect(after.updatedAt).toBe(first.updatedAt);
  });

  it('reports a conflict on a status change with a stale expectedUpdatedAt', async () => {
    const c = await createCorporate('Stale Status Co');
    vi.advanceTimersByTime(1_000);
    await settle(patchCustomer(c.id, { rating: 2 }));
    await expect(settle(setCustomerStatus(c.id, 'INACTIVE', c.updatedAt))).rejects.toMatchObject({ status: 409 });
  });

  it('moves a customer to another board lane after a status change', async () => {
    const c = await createCorporate('Move Co');
    const before = await settle(loadBoard(BASE));
    await settle(setCustomerStatus(c.id, 'INACTIVE', c.updatedAt));
    const after = await settle(loadBoard(BASE));
    expect(after.counts.INACTIVE).toBe(before.counts.INACTIVE + 1);
    expect(after.counts.PROSPECT).toBe(before.counts.PROSPECT - 1);
  });

  it('refuses to set ACTIVE_CUSTOMER manually', async () => {
    const c = await createCorporate('Manual Active Co');
    await expect(settle(setCustomerStatus(c.id, 'ACTIVE_CUSTOMER'))).rejects.toMatchObject({
      status: 422,
      code: 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON',
    });
  });

  it('returns 404 CUSTOMER_PROFILE_NOT_FOUND when patching an unknown customer', async () => {
    await expect(settle(patchCustomer('missing-id', { rating: 1 }))).rejects.toMatchObject({
      status: 404,
      code: 'CUSTOMER_PROFILE_NOT_FOUND',
    });
  });

  it('marks ACTIVE_CUSTOMER as non-manual in the status helpers', () => {
    expect(isManualStatus('ACTIVE_CUSTOMER')).toBe(false);
    expect(MANUAL_STATUSES.every((s) => isManualStatus(s))).toBe(true);
  });
});

describe('customers fake: contactChange', () => {
  useTimers();

  it('makes the first added contact the primary one', async () => {
    const c = await createCorporate('First Contact Co');
    const p = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Aya Samir' } }));
    expect(p.contacts).toHaveLength(1);
    expect(p.contacts[0].isPrimary).toBe(true);
    expect(p.primaryContactName).toBe('Aya Samir');
  });

  it('adds exactly one contact per ADD action', async () => {
    const c = await createCorporate('One At A Time Co');
    await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'One One' } }));
    const p = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Two Two' } }));
    expect(p.contacts.map((x) => x.displayName)).toEqual(['One One', 'Two Two']);
  });

  it('keeps the existing primary when a non-primary contact is added', async () => {
    const c = await createCorporate('Keep Primary Co');
    await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Primary P' } }));
    const p = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Other O' } }));
    expect(p.contacts.filter((x) => x.isPrimary).map((x) => x.displayName)).toEqual(['Primary P']);
  });

  it('moves the primary flag when a new primary contact is added', async () => {
    const c = await createCorporate('Move Primary Co');
    await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Old Primary' } }));
    const p = await settle(
      changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'New Primary', isPrimary: true } }),
    );
    expect(p.contacts.filter((x) => x.isPrimary).map((x) => x.displayName)).toEqual(['New Primary']);
  });

  it('updates only the targeted contact', async () => {
    const c = await createCorporate('Update Contact Co');
    await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Keep Me' } }));
    const withTwo = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Change Me' } }));
    const target = withTwo.contacts[1];
    const p = await settle(
      changeCustomerContact(c.id, { op: 'UPDATE', contactPartyId: target.partyId, contact: { jobTitle: 'CFO' } }),
    );
    expect(p.contacts[0].jobTitle).toBeNull();
    expect(p.contacts[1]).toMatchObject({ partyId: target.partyId, jobTitle: 'CFO', displayName: 'Change Me' });
  });

  it('switches the primary contact with SET_PRIMARY', async () => {
    const c = await createCorporate('Set Primary Co');
    await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'A A' } }));
    const two = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'B B' } }));
    const p = await settle(changeCustomerContact(c.id, { op: 'SET_PRIMARY', contactPartyId: two.contacts[1].partyId }));
    expect(p.contacts.map((x) => x.isPrimary)).toEqual([false, true]);
    expect(p.primaryContactName).toBe('B B');
  });

  it('promotes the next contact when the primary is removed', async () => {
    const c = await createCorporate('Remove Primary Co');
    const one = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'A A' } }));
    await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'B B' } }));
    const p = await settle(changeCustomerContact(c.id, { op: 'REMOVE', contactPartyId: one.contacts[0].partyId }));
    expect(p.contacts).toHaveLength(1);
    expect(p.contacts[0]).toMatchObject({ displayName: 'B B', isPrimary: true });
  });

  it('clears the primary contact when the last contact is removed', async () => {
    const c = await createCorporate('Remove Last Co');
    const one = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'Solo S' } }));
    const p = await settle(changeCustomerContact(c.id, { op: 'REMOVE', contactPartyId: one.contacts[0].partyId }));
    expect(p.contacts).toEqual([]);
    expect(p.primaryContact).toBeNull();
  });

  it('rejects a contact change targeting an unlinked contact', async () => {
    const c = await createCorporate('Unlinked Co');
    await expect(
      settle(changeCustomerContact(c.id, { op: 'REMOVE', contactPartyId: 'not-linked' })),
    ).rejects.toMatchObject({ status: 404, code: 'CRM_CONTACT_NOT_LINKED' });
  });

  it('rejects ADD without a name', async () => {
    const c = await createCorporate('No Name Co');
    await expect(settle(changeCustomerContact(c.id, { op: 'ADD', contact: {} }))).rejects.toMatchObject({
      status: 422,
      code: 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED',
    });
  });

  it('rejects sending contactChange together with the contacts list', async () => {
    const c = await createCorporate('Both Co');
    await expect(
      settle(
        patchCustomer(c.id, {
          contacts: [{ fullName: 'X Y' }],
          contactChange: { op: 'ADD', contact: { fullName: 'Z Z' } },
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: 'CRM_CONTACT_CHANGE_CONFLICT' });
  });

  it('rejects a contact change on an individual customer', async () => {
    const individual = await settle(
      createCustomer(
        { branchId: DEFAULT_CUSTOMER_BRANCH_ID, profileType: 'INDIVIDUAL', displayName: 'Indy Person' },
        nextKey(),
      ),
    );
    await expect(
      settle(changeCustomerContact(individual.id, { op: 'ADD', contact: { fullName: 'A B' } })),
    ).rejects.toMatchObject({ code: 'CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN' });
  });

  it('rejects a contact change with a stale expectedUpdatedAt', async () => {
    const c = await createCorporate('Contact Stale Co');
    vi.advanceTimersByTime(1_000);
    await settle(patchCustomer(c.id, { rating: 1 }));
    await expect(
      settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'A B' } }, c.updatedAt)),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('bumps updatedAt after a contact change', async () => {
    const c = await createCorporate('Contact Stamp Co');
    vi.advanceTimersByTime(1_000);
    const p = await settle(changeCustomerContact(c.id, { op: 'ADD', contact: { fullName: 'A B' } }, c.updatedAt));
    expect(Date.parse(p.updatedAt)).toBeGreaterThan(Date.parse(c.updatedAt));
  });
});

describe('customers fake: owner and currency options', () => {
  useTimers();

  it('returns branch owners in the shared { userId, name } shape', async () => {
    const owners = await settle(listBranchOwners(DEFAULT_CUSTOMER_BRANCH_ID));
    expect(owners.length).toBeGreaterThan(0);
    for (const o of owners) {
      expect(typeof o.userId).toBe('string');
      expect(o.userId.length).toBeGreaterThan(0);
      expect(typeof o.name).toBe('string');
      expect(o.name.length).toBeGreaterThan(0);
    }
  });

  it('sorts branch owners by name', async () => {
    const owners = await settle(listBranchOwners(DEFAULT_CUSTOMER_BRANCH_ID));
    const names = owners.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('returns currencies in the shared { id, label, decimals } shape with one default', async () => {
    const currencies = await settle(listCurrencies());
    expect(currencies.length).toBeGreaterThan(0);
    for (const c of currencies) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(Number.isInteger(c.decimals)).toBe(true);
    }
    expect(currencies.filter((c) => c.isDefault)).toHaveLength(1);
  });
});
