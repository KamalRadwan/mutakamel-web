import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './governance-fake-actors';
import { createPriceBook, createVersion, evaluate, publishVersion, testVersion } from './pricing.api';
import { PRICING_ENGINE_VERSION, type PromotionInput } from './pricing.model';

/**
 * POST /pricing/evaluate returns trade-app `PricingDecision` (pricing.service.ts
 * evaluateWithManager): ids only, money as decimal strings, promotion discounts
 * rounded to the currency quantum and the final price not rounded again.
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
  const book = await settle(createPriceBook({ code: `EVAL-PB-${seq}`, purpose: 'SALES', currencyCode: 'EGP' }));
  return book.id;
}

async function newDraft(
  bookId: string,
  opts: { unitPrice?: string; floor?: string | null; promotions?: PromotionInput[] } = {},
): Promise<string> {
  const v = await settle(
    createVersion(bookId, {
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      entries: [
        {
          itemId: ITEM,
          uomId: UOM,
          currencyCode: 'EGP',
          minimumQuantity: '1',
          unitPrice: opts.unitPrice ?? '10',
          minimumAllowedPrice: opts.floor ?? null,
        },
      ],
      promotions: opts.promotions ?? [],
    }),
  );
  return v.id;
}

async function publishNew(bookId: string, opts: Parameters<typeof newDraft>[1] = {}): Promise<string> {
  setFakeActor(FAKE_ME);
  const id = await newDraft(bookId, opts);
  await settle(testVersion(id));
  setFakeActor(FAKE_COLLEAGUE);
  await settle(publishVersion(id, {}));
  setFakeActor(FAKE_ME);
  return id;
}

function priceIn(bookId: string, extra: Partial<Parameters<typeof evaluate>[0]> = {}) {
  return evaluate({
    purpose: 'SALES',
    currencyCode: 'EGP',
    itemId: ITEM,
    uomId: UOM,
    quantity: '1',
    priceBookId: bookId,
    ...extra,
  });
}

function promo(code: string, extra: Partial<PromotionInput> = {}): PromotionInput {
  return { code, name: code, benefitType: 'PERCENTAGE', discountValue: '10', ...extra };
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

describe('pricing evaluate: decision shape', () => {
  it('returns exactly the backend PricingDecision fields', async () => {
    const bookId = await newBook();
    const versionId = await publishNew(bookId);

    const decision = await settle(priceIn(bookId, { pricingAt: '2026-11-21T10:00:00.000Z' }));

    expect(Object.keys(decision).sort()).toEqual(
      [
        'baselineUnitPrice',
        'checksum',
        'components',
        'currencyCode',
        'decisionId',
        'decisionType',
        'engineVersion',
        'evaluatedAt',
        'inputFingerprint',
        'matchedEntryId',
        'matchedPromotions',
        'minimumAllowedPrice',
        'outcome',
        'priceBookId',
        'priceBookSource',
        'priceBookVersion',
        'priceBookVersionId',
        'rejectedCandidates',
        'rejectedPromotions',
        'taxFinal',
        'unitPrice',
      ].sort(),
    );
    expect(decision).toMatchObject({
      decisionType: 'SALES_PRICE',
      outcome: 'ALLOW',
      engineVersion: PRICING_ENGINE_VERSION,
      priceBookSource: 'EXPLICIT',
      priceBookId: bookId,
      priceBookVersionId: versionId,
      priceBookVersion: 1,
      unitPrice: '10',
      baselineUnitPrice: '10',
      minimumAllowedPrice: null,
      currencyCode: 'EGP',
      taxFinal: false,
      evaluatedAt: '2026-11-21T10:00:00.000Z',
      matchedPromotions: [],
      rejectedPromotions: [],
      rejectedCandidates: [],
    });
    expect(decision.components).toEqual([
      { kind: 'BASE_PRICE', referenceId: decision.matchedEntryId, amount: '10' },
    ]);
    expect(typeof decision.checksum).toBe('string');
    expect(decision.previewOfStatus).toBeUndefined();
  });

  it('rounds a percentage discount to the currency quantum and keeps the final price unrounded', async () => {
    const bookId = await newBook();
    await publishNew(bookId, { unitPrice: '12.3456', promotions: [promo('TEN')] });

    const decision = await settle(priceIn(bookId));

    // 10% of 12.3456 = 1.23456, rounded half up to EGP's 3 places = 1.235.
    expect(decision.matchedPromotions).toHaveLength(1);
    const [matched] = decision.matchedPromotions;
    expect(Object.keys(matched).sort()).toEqual(
      ['code', 'discountAmount', 'promotionDefinitionId', 'promotionVersionId'].sort(),
    );
    expect(matched.code).toBe('TEN');
    expect(matched.discountAmount).toBe('1.235');
    expect(decision.unitPrice).toBe('11.1106');
    expect(decision.baselineUnitPrice).toBe('12.3456');
    expect(decision.components).toEqual([
      { kind: 'BASE_PRICE', referenceId: decision.matchedEntryId, amount: '12.3456' },
      { kind: 'PROMOTION_DISCOUNT', referenceId: matched.promotionVersionId, amount: '1.235' },
    ]);
  });

  it('reports rejected promotions by promotion version id with the backend reasons', async () => {
    const bookId = await newBook();
    await publishNew(bookId, {
      unitPrice: '100',
      floor: '95',
      promotions: [
        promo('BIG', { discountValue: '20', priority: 1, stackGroup: 'A' }),
        promo('SMALL', { discountValue: '2', priority: 2, stackGroup: 'B', exclusive: true }),
        promo('AFTER', { discountValue: '1', priority: 3, stackGroup: 'C' }),
      ],
    });

    const decision = await settle(priceIn(bookId));

    expect(decision.matchedPromotions.map((p) => p.code)).toEqual(['SMALL']);
    expect(decision.unitPrice).toBe('98');
    expect(decision.rejectedPromotions.map((p) => [p.code, p.reason])).toEqual([
      ['BIG', 'MINIMUM_PRICE_GUARD'],
      ['AFTER', 'EXCLUSIVE_PROMOTION_APPLIED'],
    ]);
    for (const rejected of decision.rejectedPromotions) {
      expect(Object.keys(rejected).sort()).toEqual(['code', 'promotionVersionId', 'reason']);
    }
  });

  it('marks an explicit version preview with previewOfStatus', async () => {
    const bookId = await newBook();
    const draftId = await newDraft(bookId);

    const decision = await settle(priceIn(bookId, { priceBookVersionId: draftId }));

    expect(decision.previewOfStatus).toBe('DRAFT');
    expect(decision.priceBookSource).toBe('EXPLICIT');
    expect(decision.priceBookVersionId).toBe(draftId);
  });
});

describe('pricing evaluate: errors', () => {
  it('rejects a zero or malformed quantity and a lowercase currency as TRADE.VALIDATION_FAILED', async () => {
    const bookId = await newBook();
    await publishNew(bookId);

    expect((await rejection(priceIn(bookId, { quantity: '0' }))).code).toBe('TRADE.VALIDATION_FAILED');
    expect((await rejection(priceIn(bookId, { quantity: ' 1' }))).status).toBe(400);
    expect((await rejection(priceIn(bookId, { currencyCode: 'egp' }))).code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects a preview version from another book with reason version_not_in_book', async () => {
    const bookId = await newBook();
    const otherBookId = await newBook();
    const draftId = await newDraft(otherBookId);

    const error = await rejection(priceIn(bookId, { priceBookVersionId: draftId }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.PRICE.BOOK_INVALID');
    expect(error.details?.['reason']).toEqual(['version_not_in_book']);
  });

  it('returns TRADE.PRICE.BOOK_NOT_FOUND for an unknown preview version', async () => {
    const bookId = await newBook();
    const error = await rejection(priceIn(bookId, { priceBookVersionId: 'missing-version' }));
    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.PRICE.BOOK_NOT_FOUND');
  });

  it('rejects a party without an active account as TRADE.PRICE.ENTRY_INVALID', async () => {
    const bookId = await newBook();
    await publishNew(bookId);
    const error = await rejection(priceIn(bookId, { partyId: 'party-without-account' }));
    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.PRICE.ENTRY_INVALID');
  });

  it('rejects an unknown explicit price book as TRADE.PRICE.BOOK_INVALID', async () => {
    const error = await rejection(priceIn('missing-book'));
    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.PRICE.BOOK_INVALID');
  });

  it('returns TRADE.PRICE.NO_ELIGIBLE_PRICE when no line covers the quantity', async () => {
    const bookId = await newBook();
    await publishNew(bookId);
    const error = await rejection(priceIn(bookId, { quantity: '0.5' }));
    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.PRICE.NO_ELIGIBLE_PRICE');
  });
});
