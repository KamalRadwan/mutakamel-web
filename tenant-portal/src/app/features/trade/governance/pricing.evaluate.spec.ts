import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { evaluate } from './pricing.api';
import { PRICING_ENGINE_VERSION, type PricingDecision } from './pricing.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeDecision(overrides: Partial<PricingDecision> = {}): PricingDecision {
  return {
    priceBookSource: 'EXPLICIT',
    engineVersion: PRICING_ENGINE_VERSION,
    decisionId: 'dec-1',
    decisionType: 'SALES_PRICE',
    outcome: 'ALLOW',
    unitPrice: '10',
    currencyCode: 'EGP',
    priceBookId: 'pb-1',
    priceBookVersionId: 'pv-1',
    priceBookVersion: 1,
    checksum: 'abc123',
    matchedEntryId: 'entry-1',
    baselineUnitPrice: '10',
    minimumAllowedPrice: null,
    matchedPromotions: [],
    rejectedPromotions: [],
    components: [{ kind: 'BASE_PRICE', referenceId: 'entry-1', amount: '10' }],
    rejectedCandidates: [],
    inputFingerprint: 'fp-1',
    evaluatedAt: '2026-11-23T10:00:00.000Z',
    taxFinal: false,
    ...overrides,
  };
}

describe('pricing evaluate: contract & error handling', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it('sends a single POST /pricing/evaluate request without polling and unwraps PricingDecision', async () => {
    const decision = makeDecision({
      unitPrice: '11.1106',
      baselineUnitPrice: '12.3456',
      matchedPromotions: [
        {
          promotionDefinitionId: 'def-1',
          promotionVersionId: 'prom-1',
          code: 'TEN',
          discountAmount: '1.235',
        },
      ],
      rejectedPromotions: [
        {
          promotionVersionId: 'prom-2',
          code: 'BIG',
          reason: 'MINIMUM_PRICE_GUARD',
        },
      ],
      components: [
        { kind: 'BASE_PRICE', referenceId: 'entry-1', amount: '12.3456' },
        { kind: 'PROMOTION_DISCOUNT', referenceId: 'prom-1', amount: '1.235' },
      ],
      previewOfStatus: 'DRAFT',
    });
    stub.register('POST', '/pricing/evaluate', decision);

    const res = await evaluate(
      {
        purpose: 'SALES',
        itemId: 'item-22',
        uomId: 'uom-pack',
        quantity: '1',
        currencyCode: 'EGP',
        priceBookId: 'pb-1',
        priceBookVersionId: 'pv-1',
        branchId: 'br-1',
      },
      { companyId: 'comp-1', branchId: 'br-1' },
    );

    expect(res).toEqual(decision);
    expect(stub.recordedReads()).toHaveLength(0);
    expect(stub.recordedWrites()).toHaveLength(1);
    const write = stub.recordedWrites()[0];
    expect(write.method).toBe('POST');
    expect(write.path).toBe('/pricing/evaluate');
    expect(write.key).toMatch(UUID_V7_REGEX);
    expect(write.ifMatch).toBeUndefined();
    expect(write.scope).toEqual({ companyId: 'comp-1', branchId: 'br-1' });
  });

  it('allows OPTIONAL scope when company/branch context is omitted', async () => {
    stub.register('POST', '/pricing/evaluate', makeDecision());

    const res = await evaluate({
      purpose: 'PURCHASE',
      itemId: 'item-1',
      uomId: 'uom-1',
      quantity: '5',
      currencyCode: 'USD',
    });

    expect(res.outcome).toBe('ALLOW');
    expect(stub.recordedWrites()[0].scope).toEqual({});
  });

  it('propagates business & forbidden errors cleanly with details', async () => {
    stub.register(
      'POST',
      '/pricing/evaluate',
      new ApiError(422, 'TRADE.PRICE.BOOK_INVALID', { reason: ['version_not_in_book'] }),
    );
    await expect(
      evaluate({
        purpose: 'SALES',
        itemId: 'i-1',
        uomId: 'u-1',
        quantity: '1',
        currencyCode: 'EGP',
        priceBookId: 'pb-1',
        priceBookVersionId: 'pv-other',
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'TRADE.PRICE.BOOK_INVALID',
      details: { reason: ['version_not_in_book'] },
    });

    stub.register('POST', '/pricing/evaluate', new ApiError(404, 'TRADE.PRICE.NO_ELIGIBLE_PRICE'));
    await expect(
      evaluate({
        purpose: 'SALES',
        itemId: 'i-1',
        uomId: 'u-1',
        quantity: '0.5',
        currencyCode: 'EGP',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'TRADE.PRICE.NO_ELIGIBLE_PRICE' });

    stub.register('POST', '/pricing/evaluate', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
    await expect(
      evaluate({
        purpose: 'SALES',
        itemId: 'i-1',
        uomId: 'u-1',
        quantity: '1',
        currencyCode: 'EGP',
      }),
    ).rejects.toMatchObject({ status: 403, code: 'TRADE.AUTH.TARGET_DENIED' });
  });
});
