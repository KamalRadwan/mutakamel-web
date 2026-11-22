import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './governance-fake-actors';
import {
  createPriceBook,
  createVersion,
  deleteVersion,
  evaluate,
  getPriceBook,
  getPriceVersion,
  publishVersion,
  retireVersion,
  testVersion,
} from './pricing.api';
import { bookGovernanceState } from './pricing.service';

/**
 * Supersession rules from pricing.service.ts publishVersion:
 * - a replacement must not start in the past (retroactive_supersession);
 * - the replaced version must be PUBLISHED/SCHEDULED, not yet replaced, start before the
 *   successor, and still apply when it starts; an earlier end (a gap, or an already ended
 *   version) is predecessor_invalid;
 * - the replaced version then applies until supersededAt = the successor start
 *   (COALESCE(supersededAt, effectiveTo)); effectiveTo is never rewritten.
 */

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
const ITEM = 'item-22';
const UOM = 'uom-pack';
let seq = 0;

async function newBook(): Promise<string> {
  seq += 1;
  const book = await settle(createPriceBook({ code: `SUP-PB-${seq}`, purpose: 'SALES', currencyCode: 'EGP' }));
  return book.id;
}

async function newDraft(bookId: string, from: string, to: string | null = null, unitPrice = '10.000'): Promise<string> {
  const v = await settle(
    createVersion(bookId, {
      effectiveFrom: from,
      effectiveTo: to,
      entries: [{ itemId: ITEM, uomId: UOM, currencyCode: 'EGP', minimumQuantity: '1', unitPrice }],
    }),
  );
  return v.id;
}

/** Draft (FAKE_ME) -> tested -> published by FAKE_COLLEAGUE. */
async function publishNew(
  bookId: string,
  from: string,
  opts: { to?: string | null; supersedes?: string; unitPrice?: string } = {},
): Promise<string> {
  setFakeActor(FAKE_ME);
  const id = await newDraft(bookId, from, opts.to ?? null, opts.unitPrice);
  await settle(testVersion(id));
  setFakeActor(FAKE_COLLEAGUE);
  await settle(publishVersion(id, opts.supersedes ? { supersedesVersionId: opts.supersedes } : {}));
  setFakeActor(FAKE_ME);
  return id;
}

async function testedDraft(bookId: string, from: string, to: string | null = null): Promise<string> {
  setFakeActor(FAKE_ME);
  const id = await newDraft(bookId, from, to);
  await settle(testVersion(id));
  setFakeActor(FAKE_COLLEAGUE);
  return id;
}

function priceAt(bookId: string, pricingAt?: string) {
  return evaluate({ purpose: 'SALES', currencyCode: 'EGP', itemId: ITEM, uomId: UOM, quantity: '1', priceBookId: bookId, pricingAt });
}

async function head(id: string) {
  return (await settle(getPriceVersion(id))).version;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
});

afterEach(() => {
  setFakeActor(FAKE_ME);
  vi.useRealTimers();
});

describe('pricing supersession: effective end', () => {
  it('stamps supersededAt with the successor start and never writes effectiveTo', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2027-01-01T00:00:00.000Z' });

    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', { to: '2026-12-20T00:00:00.000Z', supersedes: oldId });
    const old = await head(oldId);

    expect(old.supersededAt).toBe('2026-12-01T00:00:00.000Z');
    expect(old.supersededByVersionId).toBe(newId);
    expect(old.effectiveTo).toBe('2027-01-01T00:00:00.000Z');
    expect(old.status).toBe('PUBLISHED');
  });

  it('keeps the superseded version live (and the book PUBLISHED) until supersededAt', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { unitPrice: '10.000' });
    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId, unitPrice: '20.000' });

    const decision = await settle(priceAt(bookId));
    const dossier = await settle(getPriceBook(bookId));

    expect(decision.priceBookVersionId).toBe(oldId);
    expect(bookGovernanceState({ status: dossier.book.status, versions: dossier.versions })).toBe('PUBLISHED');
  });

  it('lets supersededAt win over a later effectiveTo', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2027-01-01T00:00:00.000Z', unitPrice: '10.000' });
    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', {
      to: '2026-12-10T00:00:00.000Z',
      supersedes: oldId,
      unitPrice: '20.000',
    });

    // 2026-12-15 is inside the old effectiveTo but after supersededAt and after the successor ends.
    const gap = await rejection(priceAt(bookId, '2026-12-15T00:00:00.000Z'));
    const inSuccessor = await settle(priceAt(bookId, '2026-12-05T00:00:00.000Z'));

    expect(gap.code).toBe('TRADE.PRICE.NO_ELIGIBLE_PRICE');
    expect(inSuccessor.priceBookVersionId).toBe(newId);
  });
});

describe('pricing supersession: predecessor end', () => {
  it('adjacent end: a predecessor ending exactly at the successor start is replaced at that start', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2026-12-01T00:00:00.000Z' });

    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });
    const old = await head(oldId);

    expect(old.supersededAt).toBe('2026-12-01T00:00:00.000Z');
    expect(old.supersededByVersionId).toBe(newId);
    expect(old.effectiveTo).toBe('2026-12-01T00:00:00.000Z');
  });

  it('gap: refuses a predecessor that ends before the successor starts and leaves it untouched', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2026-12-01T00:00:00.000Z' });

    const id = await testedDraft(bookId, '2026-12-05T00:00:00.000Z');
    const error = await rejection(publishVersion(id, { supersedesVersionId: oldId }));
    const old = await head(oldId);

    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['predecessor_invalid']);
    expect(old.supersededAt).toBeNull();
    expect(old.supersededByVersionId).toBeNull();
  });

  it('already ended: refuses a predecessor whose end has passed (it always leaves a gap)', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2026-11-15T00:00:00.000Z' });

    const id = await testedDraft(bookId, '2026-12-01T00:00:00.000Z');
    const error = await rejection(publishVersion(id, { supersedesVersionId: oldId }));

    expect(error.details?.['reason']).toEqual(['predecessor_invalid']);
  });

  it('still-live predecessor: stamps supersededAt with the successor start', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2027-01-01T00:00:00.000Z' });

    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });
    const old = await head(oldId);

    expect(old.supersededAt).toBe('2026-12-01T00:00:00.000Z');
    expect(old.supersededByVersionId).toBe(newId);
    expect(old.effectiveTo).toBe('2027-01-01T00:00:00.000Z');
  });

  it('scheduled predecessor: a later scheduled successor can replace it', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-12-01T00:00:00.000Z');

    const newId = await publishNew(bookId, '2027-01-01T00:00:00.000Z', { supersedes: oldId });
    const old = await head(oldId);

    expect(old.status).toBe('SCHEDULED');
    expect(old.supersededAt).toBe('2027-01-01T00:00:00.000Z');
    expect(old.supersededByVersionId).toBe(newId);
  });
});

describe('pricing supersession: evaluation time (pricingAt)', () => {
  it('picks the version live at the evaluation time', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { unitPrice: '10.000' });
    const newId = await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId, unitPrice: '20.000' });

    const before = await settle(priceAt(bookId, '2026-11-30T23:59:59.000Z'));
    const atBoundary = await settle(priceAt(bookId, '2026-12-01T00:00:00.000Z'));
    const after = await settle(priceAt(bookId, '2027-03-01T00:00:00.000Z'));

    expect(before.priceBookVersionId).toBe(oldId);
    expect(before.baselineUnitPrice).toMatch(/^10(\.0+)?$/);
    expect(atBoundary.priceBookVersionId).toBe(newId);
    expect(after.priceBookVersionId).toBe(newId);
    expect(after.baselineUnitPrice).toMatch(/^20(\.0+)?$/);
  });

  it('finds no price before the first version starts', async () => {
    const bookId = await newBook();
    await publishNew(bookId, '2026-11-10T00:00:00.000Z');

    const error = await rejection(priceAt(bookId, '2026-11-09T00:00:00.000Z'));

    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.PRICE.NO_ELIGIBLE_PRICE');
  });
});

describe('pricing supersession: overlap uses COALESCE(supersededAt, effectiveTo)', () => {
  it('rejects a new window inside the superseded version before supersededAt', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');
    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { to: '2026-12-10T00:00:00.000Z', supersedes: oldId });

    const id = await testedDraft(bookId, '2026-11-25T00:00:00.000Z', '2026-11-28T00:00:00.000Z');
    const error = await rejection(publishVersion(id, {}));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.VERSION_OVERLAP');
  });

  it('accepts a window after supersededAt even though the old effectiveTo is later', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z', { to: '2027-01-01T00:00:00.000Z' });
    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { to: '2026-12-10T00:00:00.000Z', supersedes: oldId });

    const id = await testedDraft(bookId, '2026-12-15T00:00:00.000Z', '2026-12-20T00:00:00.000Z');
    const row = await settle(publishVersion(id, {}));

    expect(row.status).toBe('SCHEDULED');
  });
});

describe('pricing supersession: publish guards', () => {
  it('refuses to supersede an already replaced target (predecessor_invalid)', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-01T00:00:00.000Z');
    await publishNew(bookId, '2026-12-01T00:00:00.000Z', { supersedes: oldId });

    const id = await testedDraft(bookId, '2027-01-01T00:00:00.000Z');
    const error = await rejection(publishVersion(id, { supersedesVersionId: oldId }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['predecessor_invalid']);
  });

  it('refuses a future successor that starts with the target (predecessor_invalid)', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-12-01T00:00:00.000Z');

    const id = await testedDraft(bookId, '2026-12-01T00:00:00.000Z');
    const error = await rejection(publishVersion(id, { supersedesVersionId: oldId }));

    expect(error.details?.['reason']).toEqual(['predecessor_invalid']);
  });

  it('refuses a successor whose start is already past (retroactive_supersession)', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-10T00:00:00.000Z');

    const id = await testedDraft(bookId, '2026-11-15T00:00:00.000Z');
    const error = await rejection(publishVersion(id, { supersedesVersionId: oldId }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.PRICE.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['retroactive_supersession']);
  });

  it('leaves the target untouched when the supersession is refused', async () => {
    const bookId = await newBook();
    const oldId = await publishNew(bookId, '2026-11-10T00:00:00.000Z');

    const id = await testedDraft(bookId, '2026-11-05T00:00:00.000Z');
    await rejection(publishVersion(id, { supersedesVersionId: oldId }));
    const old = await head(oldId);

    expect(old.supersededAt).toBeNull();
    expect(old.supersededByVersionId).toBeNull();
  });
});

describe('pricing delete draft', () => {
  it('deletes the latest version when it is a draft', async () => {
    const bookId = await newBook();
    await publishNew(bookId, '2026-11-01T00:00:00.000Z');
    const draft = await newDraft(bookId, '2026-12-01T00:00:00.000Z');

    const result = await settle(deleteVersion(draft));
    const dossier = await settle(getPriceBook(bookId));

    expect(result).toEqual({ id: draft, deleted: true });
    expect(dossier.versions.some((v) => v.id === draft)).toBe(false);
  });

  // Backend rule: any DRAFT may be deleted. Offering Delete only on the latest version (brief g1)
  // is a UI choice, not an API rule.
  it('deletes a draft that is not the latest version (backend allows it)', async () => {
    const bookId = await newBook();
    const older = await newDraft(bookId, '2026-12-01T00:00:00.000Z');
    const newer = await newDraft(bookId, '2027-01-01T00:00:00.000Z');

    await settle(deleteVersion(older));
    const dossier = await settle(getPriceBook(bookId));

    expect(dossier.versions.map((v) => v.id)).toEqual([newer]);
  });
});

describe('pricing reason body {reasonCode, reasonNote}', () => {
  it('accepts a 500-character note and audits the reason code', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const row = await settle(retireVersion(id, { reasonCode: 'CAMPAIGN_ENDED', reasonNote: 'x'.repeat(500) }));
    const detail = await settle(getPriceVersion(id));

    expect(row.status).toBe('RETIRED');
    expect(detail.auditTrail[0]).toMatchObject({ action: 'RETIRE', reasonCode: 'CAMPAIGN_ENDED' });
  });

  it('rejects a 501-character note with 400 VALIDATION_FAILED', async () => {
    const bookId = await newBook();
    const id = await publishNew(bookId, '2026-11-01T00:00:00.000Z');

    const error = await rejection(retireVersion(id, { reasonCode: 'CAMPAIGN_ENDED', reasonNote: 'x'.repeat(501) }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });
});
