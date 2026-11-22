import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './governance-fake-actors';
import {
  changeEntries,
  changePromotions,
  cloneVersion,
  createPriceBook,
  createVersion,
  getDiff,
  getPriceBook,
  getPriceVersion,
  listEntries,
  listPriceBooks,
  publishVersion,
  retireVersion,
  testVersion,
  updateVersion,
  deleteVersion,
  listCompanyDefaults,
  upsertCompanyDefault,
  updatePriceBook,
} from './pricing.api';
import { setFakeSoloOwnerEligible } from './pricing.fake';
import type { EntryInput, PriceBookDossier, PromotionInput, SavedPriceVersion } from './pricing.model';
import { bookGovernanceState } from './pricing.service';

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

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

const NOW = '2026-11-21T12:00:00.000Z';
let codeSeq = 0;

function entry(minimumQuantity = '1', unitPrice = '10.000', extra: Partial<EntryInput> = {}): EntryInput {
  return { itemId: 'item-22', uomId: 'uom-pack', currencyCode: 'EGP', minimumQuantity, unitPrice, ...extra };
}

function promo(code: string, priority: number, extra: Partial<PromotionInput> = {}): PromotionInput {
  return { code, name: code, benefitType: 'PERCENTAGE', discountValue: '5', priority, ...extra };
}

function stateOf(dossier: PriceBookDossier) {
  return bookGovernanceState({ status: dossier.book.status, versions: dossier.versions });
}

const BOUNDED: EntryInput[] = [entry('1', '10.000', { maximumQuantity: '10' })];

async function newBook(): Promise<string> {
  codeSeq += 1;
  const book = await settle(
    createPriceBook({ code: `SPEC-PB-${codeSeq}`, purpose: 'SALES', currencyCode: 'EGP' }),
  );
  return book.id;
}

async function newDraft(
  bookId: string,
  effectiveFrom: string,
  opts: { effectiveTo?: string | null; entries?: EntryInput[] } = {},
): Promise<SavedPriceVersion> {
  return settle(
    createVersion(bookId, {
      effectiveFrom,
      effectiveTo: opts.effectiveTo ?? null,
      entries: opts.entries ?? [entry()],
    }),
  );
}

/** Draft -> tested (as the creator) -> published (as a colleague, maker-checker). */
async function publishNew(
  bookId: string,
  effectiveFrom: string,
  opts: { supersedes?: string; effectiveTo?: string | null } = {},
): Promise<string> {
  setFakeActor(FAKE_ME);
  const draft = await newDraft(bookId, effectiveFrom, { effectiveTo: opts.effectiveTo });
  await settle(testVersion(draft.id));
  setFakeActor(FAKE_COLLEAGUE);
  await settle(publishVersion(draft.id, opts.supersedes ? { supersedesVersionId: opts.supersedes } : {}));
  setFakeActor(FAKE_ME);
  return draft.id;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
});

afterEach(() => {
  setFakeSoloOwnerEligible(FAKE_ME, false);
  setFakeActor(FAKE_ME);
  vi.useRealTimers();
});

describe('pricing version lifecycle', () => {
  it('creates a new version as DRAFT with the next version number', async () => {
    const bookId = await newBook();

    const first = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    const second = await newDraft(bookId, '2027-01-01T00:00:00.000Z');

    expect(first.status).toBe('DRAFT');
    expect(first.versionNumber).toBe(1);
    expect(second.versionNumber).toBe(2);
    expect(first.supersededAt).toBeNull();
  });

  it('moves a draft to TESTED when the test passes', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const result = await settle(testVersion(draft.id));
    const detail = await settle(getPriceVersion(draft.id));

    expect(result.passed).toBe(true);
    expect(detail.version.status).toBe('TESTED');
    expect(detail.latestTestEvidence?.passed).toBe(true);
  });

  it('keeps a version in DRAFT when the test fails on an empty version', async () => {
    const bookId = await newBook();
    const empty = await settle(
      cloneVersion(bookId, { sourceMode: 'EMPTY_DRAFT', effectiveFrom: '2026-12-01T00:00:00.000Z' }),
    );

    const result = await settle(testVersion(empty.id));
    const detail = await settle(getPriceVersion(empty.id));

    // testVersion: passing needs at least one entry; an empty version has no conflict line.
    expect(result.passed).toBe(false);
    expect(result.conflicts).toEqual([]);
    expect(detail.version.status).toBe('DRAFT');
  });

  it('refuses to publish a draft that was never tested', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(publishVersion(draft.id, { soloOwnerAttestation: true }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_tested']);
  });

  it('requires a second person to publish unless the solo-owner attestation is given', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    await settle(testVersion(draft.id));

    const error = await rejection(publishVersion(draft.id));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  });

  it('schedules a tested version whose effective start is in the future', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-12-01T00:00:00.000Z');

    const detail = await settle(getPriceVersion(id));

    expect(detail.version.status).toBe('SCHEDULED');
  });

  it('publishes straight away when the effective start is already past', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const detail = await settle(getPriceVersion(id));

    expect(detail.version.status).toBe('PUBLISHED');
  });

  it('activates a scheduled version to PUBLISHED once its start time has passed', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-12-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-12-01T00:00:01.000Z'));
    const detail = await settle(getPriceVersion(id));
    const dossier = await settle(getPriceBook(bookId));

    expect(detail.version.status).toBe('PUBLISHED');
    expect(stateOf(dossier)).toBe('PUBLISHED');
  });

  it('reports the book as SCHEDULED while its only live-to-be version is in the future', async () => {
    const bookId = await newBook();
    await publishNew(bookId, '2026-12-01T00:00:00.000Z');

    const dossier = await settle(getPriceBook(bookId));

    expect(stateOf(dossier)).toBe('SCHEDULED');
  });

  it('rejects a publish whose window overlaps another live version without supersession', async () => {
    const bookId = await newBook();
    await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    setFakeActor(FAKE_ME);
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    await settle(testVersion(draft.id));
    setFakeActor(FAKE_COLLEAGUE);
    const error = await rejection(publishVersion(draft.id));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.VERSION_OVERLAP');
  });

  it('allows a non-overlapping window after a closed one', async () => {
    const bookId = await newBook();
    await publishNew(bookId, '2026-11-01T00:00:00.000Z', { effectiveTo: '2026-12-01T00:00:00.000Z' });

    const id = await publishNew(bookId, '2026-12-01T00:00:00.000Z');
    const detail = await settle(getPriceVersion(id));

    expect(detail.version.status).toBe('SCHEDULED');
  });
});

describe('pricing supersession', () => {
  it('stamps supersededAt and supersededByVersionId on the replaced version', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });
    const old = await settle(getPriceVersion(oldId));

    expect(old.version.supersededAt).toBe('2026-12-01T00:00:00.000Z');
    expect(old.version.supersededByVersionId).toBe(newId);
  });

  it('keeps the new version scheduled while the superseded one is still current', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });
    const created = await settle(getPriceVersion(newId));

    expect(created.version.status).toBe('SCHEDULED');
  });

  // Supersession is expressed only through superseded_at; effective_to is never edited by a publish.
  it('leaves effectiveTo of the superseded version untouched', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });
    const old = await settle(getPriceVersion(oldId));

    expect(old.version.effectiveTo).toBeNull();
  });

  it('refuses to supersede a version that is not live (draft target)', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-11-01T00:00:00.000Z');

    setFakeActor(FAKE_ME);
    const next = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    await settle(testVersion(next.id));
    setFakeActor(FAKE_COLLEAGUE);
    const error = await rejection(publishVersion(next.id, { supersedesVersionId: draft.id }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
  });

  it('refuses to supersede an already superseded version', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');
    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });

    setFakeActor(FAKE_ME);
    const third = await newDraft(bookId, '2027-01-01T00:00:00.000Z');
    await settle(testVersion(third.id));
    setFakeActor(FAKE_COLLEAGUE);
    const error = await rejection(publishVersion(third.id, { supersedesVersionId: oldId }));

    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
  });

  it('refuses a retroactive supersession with a single detail reason', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-10T00:00:00.000Z');

    setFakeActor(FAKE_ME);
    const earlier = await newDraft(bookId, '2026-11-05T00:00:00.000Z');
    await settle(testVersion(earlier.id));
    setFakeActor(FAKE_COLLEAGUE);
    const error = await rejection(publishVersion(earlier.id, { supersedesVersionId: oldId }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toHaveLength(1);
  });

  it('emits detail reasons in lowercase', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-10T00:00:00.000Z');

    setFakeActor(FAKE_ME);
    const earlier = await newDraft(bookId, '2026-11-05T00:00:00.000Z');
    await settle(testVersion(earlier.id));
    setFakeActor(FAKE_COLLEAGUE);
    const error = await rejection(publishVersion(earlier.id, { supersedesVersionId: oldId }));

    expect(error.details?.['reason']?.[0]).toBe('retroactive_supersession');
  });

  it('no longer counts a superseded version as the live one for the book state', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');
    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });

    vi.setSystemTime(new Date('2026-12-02T00:00:00.000Z'));
    const dossier = await settle(getPriceBook(bookId));
    const head = dossier.versions.find((v) => v.id === oldId);

    expect(head?.supersededAt).not.toBeNull();
    expect(stateOf(dossier)).toBe('PUBLISHED');
  });
});

describe('pricing draft editing', () => {
  it('resets a TESTED version back to DRAFT when it is updated', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    await settle(testVersion(draft.id));

    const saved = await settle(updateVersion(draft.id, { notes: 'edited' }));

    expect(saved.status).toBe('DRAFT');
    expect(saved.notes).toBe('edited');
  });

  it('refuses to edit a published version', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(updateVersion(id, { notes: 'x' }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_editable']);
  });

  it('rejects a window whose end is not after its start', async () => {
    const bookId = await newBook();

    const error = await rejection(
      createVersion(bookId, {
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: '2026-12-01T00:00:00.000Z',
        entries: [entry()],
      }),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.PRICE.BOOK_INVALID');
  });

  it('deletes a draft but refuses to delete a tested version', async () => {
    const bookId = await newBook();
    const a = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    const b = await newDraft(bookId, '2027-01-01T00:00:00.000Z');
    await settle(testVersion(b.id));

    await settle(deleteVersion(a.id));
    const error = await rejection(deleteVersion(b.id));
    const dossier = await settle(getPriceBook(bookId));

    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(dossier.versions.map((v) => v.id)).toEqual([b.id]);
  });

  it('rejects a stale If-Match version with 409', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(updateVersion(draft.id, { notes: 'x' }, draft.version + 5));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });
});

describe('pricing price lines delta save', () => {
  it('applies upserts and deletes in one call and returns the changed ids', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', {
      entries: [entry('1', '10.000', { maximumQuantity: '10' }), entry('10', '9.000', { maximumQuantity: '100' })],
    });
    const before = await settle(listEntries(draft.id));
    const [first, second] = before.items;

    const result = await settle(
      changeEntries(draft.id, {
        upserts: [{ ...entry('1', '12.500', { maximumQuantity: '10' }), id: first.id }, entry('100', '8.000')],
        deletes: [second.id],
      }),
    );

    const after = await settle(listEntries(draft.id));

    expect(result.entryCount).toBe(2);
    expect(result.changedEntryIds).toHaveLength(3);
    expect(result.changedEntryIds).toContain(first.id);
    expect(result.changedEntryIds).toContain(second.id);
    expect(after.items.find((e) => e.id === first.id)?.unitPrice).toBe('12.500');
    expect(after.items.some((e) => e.id === second.id)).toBe(false);
  });

  it('keeps the id of an upserted existing line instead of creating a new one', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    const { items } = await settle(listEntries(draft.id));

    await settle(changeEntries(draft.id, { upserts: [{ ...entry('1', '11.000'), id: items[0].id }] }));
    const after = await settle(listEntries(draft.id));

    expect(after.items).toHaveLength(1);
    expect(after.items[0].id).toBe(items[0].id);
  });

  it('bumps the version, refreshes the checksum and falls back to DRAFT', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', { entries: BOUNDED });
    await settle(testVersion(draft.id));
    const tested = await settle(getPriceVersion(draft.id));

    const result = await settle(changeEntries(draft.id, { upserts: [entry('50', '7.000')] }));

    expect(result.status).toBe('DRAFT');
    expect(result.version).toBe(tested.version.version + 1);
    expect(result.checksum).not.toBe(tested.version.checksum);
  });

  it('does not touch lines that are not named in the delta', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', {
      entries: [entry('1', '10.000', { maximumQuantity: '10' }), entry('10', '9.000')],
    });
    const before = await settle(listEntries(draft.id));

    await settle(changeEntries(draft.id, { deletes: [before.items[0].id] }));
    const after = await settle(listEntries(draft.id));

    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toEqual(before.items[1]);
  });

  it('rejects overlapping quantity tiers with 422 TIER_OVERLAP', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', {
      entries: [entry('1', '10.000', { maximumQuantity: '10' })],
    });

    const error = await rejection(changeEntries(draft.id, { upserts: [entry('5', '9.000', { maximumQuantity: '20' })] }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.PRICE.TIER_OVERLAP');
  });

  it('rejects a floor price above the unit price', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(
      changeEntries(draft.id, { upserts: [entry('5', '9.000', { minimumAllowedPrice: '9.500' })] }),
    );

    expect(error.code).toBe('TRADE.PRICE.ENTRY_INVALID');
  });

  it('rejects more than 1000 deletes with 400 (DTO ArrayMaxSize)', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    const deletes = Array.from({ length: 1001 }, (_, i) => `missing-${i}`);

    const error = await rejection(changeEntries(draft.id, { deletes }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects an empty delta with operations_required', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(changeEntries(draft.id, {}));

    expect(error.code).toBe('TRADE.PRICE.ENTRY_INVALID');
    expect(error.details?.['reason']).toEqual(['operations_required']);
  });

  it('rejects a line id that is not in the version with entry_not_in_version', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(changeEntries(draft.id, { deletes: ['missing-line'] }));

    expect(error.details?.['reason']).toEqual(['entry_not_in_version']);
  });

  it('rejects the same line named twice with duplicate_operation', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    const { items } = await settle(listEntries(draft.id));

    const error = await rejection(
      changeEntries(draft.id, { upserts: [{ ...entry('1', '11.000'), id: items[0].id }], deletes: [items[0].id] }),
    );

    expect(error.details?.['reason']).toEqual(['duplicate_operation']);
  });

  it('rejects a delta on a published version', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(changeEntries(id, { upserts: [entry('99', '1.000')] }));

    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_editable']);
  });

  it('rejects a stale If-Match on the delta', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(changeEntries(draft.id, { upserts: [entry('99', '1.000')] }, draft.version + 3));

    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });

  it('replays the same idempotency key without applying the delta twice', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', { entries: BOUNDED });
    const delta = { upserts: [entry('50', '7.000')] };

    const first = await settle(changeEntries(draft.id, delta, { idempotencyKey: 'idem-delta-1' }));
    const second = await settle(changeEntries(draft.id, delta, { idempotencyKey: 'idem-delta-1' }));

    expect(second).toEqual(first);
    expect((await settle(listEntries(draft.id))).total).toBe(2);
  });

  it('rejects the same idempotency key reused with a different payload', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', { entries: BOUNDED });
    await settle(changeEntries(draft.id, { upserts: [entry('50', '7.000')] }, { idempotencyKey: 'idem-delta-2' }));

    const error = await rejection(
      changeEntries(draft.id, { upserts: [entry('60', '6.000')] }, { idempotencyKey: 'idem-delta-2' }),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.IDEMPOTENCY.MISMATCH');
  });
});

describe('pricing price lines paging', () => {
  async function versionWithLines(count: number): Promise<string> {
    const bookId = await newBook();
    const entries = Array.from({ length: count }, (_, i) =>
      entry(String(i * 10), '10.000', { maximumQuantity: String(i * 10 + 5) }),
    );
    return (await newDraft(bookId, '2026-12-01T00:00:00.000Z', { entries })).id;
  }

  it('returns the requested slice with total, page and limit', async () => {
    const id = await versionWithLines(25);

    const page = await settle(listEntries(id, { page: 2, limit: 10 }));

    expect(page.items).toHaveLength(10);
    expect(page.total).toBe(25);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(10);
  });

  it('returns a short last page', async () => {
    const id = await versionWithLines(25);

    const page = await settle(listEntries(id, { page: 3, limit: 10 }));

    expect(page.items).toHaveLength(5);
  });

  it('returns an empty slice past the last page but keeps the total', async () => {
    const id = await versionWithLines(25);

    const page = await settle(listEntries(id, { page: 9, limit: 10 }));

    expect(page.items).toEqual([]);
    expect(page.total).toBe(25);
  });

  it('serves disjoint consecutive pages', async () => {
    const id = await versionWithLines(25);

    const one = await settle(listEntries(id, { page: 1, limit: 10 }));
    const two = await settle(listEntries(id, { page: 2, limit: 10 }));

    const ids = new Set(one.items.map((e) => e.id));
    expect(two.items.some((e) => ids.has(e.id))).toBe(false);
  });

  it('sorts by unit price descending before paging', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z', {
      entries: [
        entry('0', '5.000', { maximumQuantity: '5' }),
        entry('10', '30.000', { maximumQuantity: '15' }),
        entry('20', '15.000', { maximumQuantity: '25' }),
      ],
    });

    const page = await settle(listEntries(draft.id, { sort: 'unitPrice', dir: 'desc', limit: 2 }));

    expect(page.items.map((e) => e.unitPrice)).toEqual(['30.000', '15.000']);
  });

  it('rejects page 0 with 400', async () => {
    const id = await versionWithLines(1);

    const error = await rejection(listEntries(id, { page: 0 }));

    expect(error.status).toBe(400);
  });

  it('rejects a limit above 200 with 400', async () => {
    const id = await versionWithLines(1);

    const error = await rejection(listEntries(id, { limit: 201 }));

    expect(error.status).toBe(400);
  });

  it('rejects an unknown version with 404', async () => {
    const error = await rejection(listEntries('missing-version'));

    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.PRICE.BOOK_NOT_FOUND');
  });
});

describe('pricing price book list paging', () => {
  it('returns paging metadata and honours the limit', async () => {
    await newBook();
    await newBook();

    const page = await settle(listPriceBooks({ page: 1, limit: 2 }));

    expect(page.items).toHaveLength(2);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(2);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it('rejects a limit above 100 with 400', async () => {
    const error = await rejection(listPriceBooks({ limit: 101 }));

    expect(error.status).toBe(400);
  });
});

describe('pricing retire reason body', () => {
  it('retires a published version with a {reasonCode, reasonNote} body and audits the reason', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const row = await settle(retireVersion(id, { reasonCode: 'CAMPAIGN_ENDED', reasonNote: 'campaign over' }));
    const detail = await settle(getPriceVersion(id));

    expect(row.status).toBe('RETIRED');
    expect(detail.auditTrail[0]).toMatchObject({ action: 'RETIRE', reason: 'campaign over', reasonCode: 'CAMPAIGN_ENDED' });
  });

  it('retires without a note when only the reason code is given', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const row = await settle(retireVersion(id, { reasonCode: 'CAMPAIGN_ENDED' }));

    expect(row.status).toBe('RETIRED');
  });

  it('rejects retiring a draft version', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(retireVersion(draft.id, { reasonCode: 'CAMPAIGN_ENDED' }));

    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_live']);
  });

  it('rejects an unknown reason code with 422', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(retireVersion(id, { reasonCode: 'NO_SUCH_REASON' }));

    expect(error.status).toBe(422);
    expect(error.code).toMatch(/^TRADE\.REASON\./);
  });

  it('rejects a reason code of another reason kind with 422', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(retireVersion(id, { reasonCode: 'NO_LONGER_NEEDED' }));

    expect(error.status).toBe(422);
  });

  it('rejects a missing reason code with 400 VALIDATION_FAILED (DTO rule)', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(retireVersion(id, {} as never));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('accepts a reason note of exactly 500 characters', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const row = await settle(retireVersion(id, { reasonCode: 'CAMPAIGN_ENDED', reasonNote: 'x'.repeat(500) }));

    expect(row.status).toBe('RETIRED');
  });

  it('rejects a reason note longer than 500 characters with 400 VALIDATION_FAILED', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(retireVersion(id, { reasonCode: 'CAMPAIGN_ENDED', reasonNote: 'x'.repeat(501) }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });
});

describe('pricing diff', () => {
  it('summarises a changed price between two versions', async () => {
    const bookId = await newBook();
    setFakeActor(FAKE_ME);
    const a = await newDraft(bookId, '2026-12-01T00:00:00.000Z', { entries: [entry('1', '10.000')] });
    const b = await newDraft(bookId, '2027-01-01T00:00:00.000Z', { entries: [entry('1', '12.000')] });

    const diff = await settle(getDiff(b.id, a.id));

    expect(diff.targetVersion.id).toBe(b.id);
    expect(diff.baselineVersion.id).toBe(a.id);
    expect(diff.summary).toMatchObject({ totalCompared: 1, increased: 1 });
    expect(diff.entries[0]).toMatchObject({
      changeType: 'INCREASED',
      baselineUnitPrice: '10.000',
      targetUnitPrice: '12.000',
      deltaPct: 20,
    });
  });
});

describe('pricing maker-checker (publishVersion)', () => {
  async function ownTestedDraft(): Promise<string> {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    await settle(testVersion(draft.id));
    return draft.id;
  }

  it('refuses the maker an attestation when not an eligible solo owner', async () => {
    const id = await ownTestedDraft();

    const error = await rejection(publishVersion(id, { soloOwnerAttestation: true }));

    expect(error.code).toBe('TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  });

  it('refuses an eligible solo owner who does not attest', async () => {
    setFakeSoloOwnerEligible(FAKE_ME, true);
    const id = await ownTestedDraft();

    const error = await rejection(publishVersion(id, {}));

    expect(error.code).toBe('TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  });

  it('lets an eligible solo owner who attests publish and audits SOLO_OWNER_SCHEDULE', async () => {
    setFakeSoloOwnerEligible(FAKE_ME, true);
    const id = await ownTestedDraft();

    const row = await settle(publishVersion(id, { soloOwnerAttestation: true }));
    const detail = await settle(getPriceVersion(id));

    expect(row.status).toBe('SCHEDULED');
    expect(detail.soloOwnerGovernanceEligible).toBe(true);
    expect(detail.auditTrail[0].action).toBe('SOLO_OWNER_SCHEDULE');
  });

  it('labels a checker publish SCHEDULE even when an attestation is sent', async () => {
    const id = await ownTestedDraft();
    setFakeActor(FAKE_COLLEAGUE);

    await settle(publishVersion(id, { soloOwnerAttestation: true }));
    const detail = await settle(getPriceVersion(id));

    expect(detail.auditTrail[0].action).toBe('SCHEDULE');
  });

  it('returns the bare version row', async () => {
    const id = await ownTestedDraft();
    setFakeActor(FAKE_COLLEAGUE);

    const row = await settle(publishVersion(id, {}));

    expect(row).toMatchObject({ id, status: 'SCHEDULED', createdBy: FAKE_ME, supersededAt: null });
    expect(row).not.toHaveProperty('auditTrail');
  });
});

describe('pricing promotions changes', () => {
  async function draftWithPromotions(promotions: PromotionInput[]): Promise<string> {
    const bookId = await newBook();
    return (
      await settle(createVersion(bookId, { effectiveFrom: '2026-12-01T00:00:00.000Z', entries: [entry()], promotions }))
    ).id;
  }

  it('stores a flat body as selector and benefit', async () => {
    const id = await draftWithPromotions([
      promo('WIN10', 10, { branchId: 'b2', benefitType: 'FIXED_AMOUNT', discountValue: '5.000' }),
    ]);

    const detail = await settle(getPriceVersion(id));

    expect(detail.promotions[0]).toMatchObject({
      code: 'WIN10',
      status: 'DRAFT',
      selector: { branchId: 'b2', minimumQuantity: '0', maximumQuantity: null },
      benefit: { type: 'FIXED_AMOUNT', value: '5.000' },
    });
    expect(detail.promotions[0].selector).not.toHaveProperty('itemId');
  });

  it('applies upserts and deletes and returns changedPromotionIds', async () => {
    const id = await draftWithPromotions([promo('A', 10), promo('B', 20)]);
    const before = await settle(getPriceVersion(id));
    const [a, b] = before.promotions;

    const result = await settle(
      changePromotions(id, { upserts: [{ ...promo('A', 11), id: a.id }], deletes: [b.id] }, before.version.version),
    );

    expect(result.promotionCount).toBe(1);
    expect(result.changedPromotionIds).toEqual([a.id, b.id]);
    expect(result.status).toBe('DRAFT');
  });

  it('rejects two promotions with the same stack group and priority (equal_precedence)', async () => {
    const id = await draftWithPromotions([promo('A', 10)]);

    const error = await rejection(changePromotions(id, { upserts: [promo('B', 10)] }));

    expect(error.code).toBe('TRADE.PRICE.RULE_INVALID');
    expect(error.details?.['reason']).toEqual(['equal_precedence']);
  });

  it('rejects more than 500 operations in total (operation_limit_exceeded)', async () => {
    const id = await draftWithPromotions([promo('A', 10)]);
    const upserts = Array.from({ length: 300 }, (_, i) => promo(`N${i}`, 100 + i));
    const deletes = Array.from({ length: 201 }, (_, i) => `missing-${i}`);

    const error = await rejection(changePromotions(id, { upserts, deletes }));

    expect(error.details?.['reason']).toEqual(['operation_limit_exceeded']);
  });
});

describe('pricing supersession reasons (publishVersion)', () => {
  async function testedDraftAt(bookId: string, from: string): Promise<string> {
    setFakeActor(FAKE_ME);
    const draft = await newDraft(bookId, from);
    await settle(testVersion(draft.id));
    setFakeActor(FAKE_COLLEAGUE);
    return draft.id;
  }

  it('names predecessor_invalid when the target is a draft', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-11-01T00:00:00.000Z');
    const id = await testedDraftAt(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(publishVersion(id, { supersedesVersionId: draft.id }));

    expect(error.details?.['reason']).toEqual(['predecessor_invalid']);
  });

  it('names predecessor_invalid when the target ends before the successor starts (gap)', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { effectiveTo: '2026-12-01T00:00:00.000Z' });
    const id = await testedDraftAt(bookId, '2026-12-05T00:00:00.000Z');

    const error = await rejection(publishVersion(id, { supersedesVersionId: oldId }));

    expect(error.details?.['reason']).toEqual(['predecessor_invalid']);
  });

  it('names retroactive_supersession only for a successor that starts in the past', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');
    const past = await testedDraftAt(bookId, '2026-11-10T00:00:00.000Z');

    const error = await rejection(publishVersion(past, { supersedesVersionId: oldId }));

    expect(error.details?.['reason']).toEqual(['retroactive_supersession']);
  });
});

describe('pricing books and defaults', () => {
  it('filters the list by currencyCode and q', async () => {
    const page = await settle(listPriceBooks({ currencyCode: 'USD', q: 'export', limit: 100 }));

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((b) => b.currencyCode === 'USD')).toBe(true);
  });

  it('refuses to deactivate a company default with BOOK_IN_USE', async () => {
    const dossier = await settle(getPriceBook('pb-retail-egp'));

    const error = await rejection(updatePriceBook('pb-retail-egp', { status: 'INACTIVE' }, dossier.book.version));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.BOOK_IN_USE');
    expect(error.details?.['reason']).toEqual(['mapped_as_company_default']);
  });

  it('lists company defaults as {items} and replaces one with its mapping version', async () => {
    const bookId = await newBook();
    const list = await settle(listCompanyDefaults());
    const egp = list.items.find((d) => d.purpose === 'SALES' && d.currencyCode === 'EGP')!;

    const row = await settle(upsertCompanyDefault('SALES', 'EGP', bookId, egp.version));

    expect(row).toMatchObject({ priceBookId: bookId, version: egp.version + 1 });
    expect(row).not.toHaveProperty('priceBook');
  });

  it('rejects an unknown entries sort key with 400', async () => {
    const bookId = await newBook();
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const error = await rejection(listEntries(draft.id, { sort: 'uom' as never }));

    expect(error.status).toBe(400);
  });
});
