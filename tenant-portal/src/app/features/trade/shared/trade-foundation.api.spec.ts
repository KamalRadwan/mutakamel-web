import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './trade-api';
import { getItemSummary, listReasons, listUoms, searchItemSummaries, uomById } from './trade-foundation.api';
import { TRADE_FAKE_DB } from './trade-foundation.fake';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(1000);
  const outcome = await guarded;
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

const C1 = { companyId: 'c1' };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('searchItemSummaries', () => {
  it('finds a doc item by canonical code under company c1', async () => {
    const page = await settle(searchItemSummaries(C1, { search: 'st-220' }));
    expect(page.total).toBe(1);
    expect(page.items[0].sku).toBe('ST-220');
    expect(page.items[0].trackingMode).toBe('LOT');
  });

  it('finds an item by its Arabic name', async () => {
    const page = await settle(searchItemSummaries(C1, { search: 'حديد تسليح' }));
    expect(page.items.map((i) => i.sku)).toEqual(['RB-12']);
  });

  it('returns only items with a profile in the requested company', async () => {
    const page = await settle(searchItemSummaries({ companyId: 'c2' }, { search: 'ST-220' }));
    expect(page.total).toBe(0);
  });

  it('rejects a purpose filter without a company with 422 COMPANY_PROFILE_INVALID', async () => {
    const err = await settle(searchItemSummaries({}, { purpose: 'SALES' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).code).toBe('TRADE.CATALOG.COMPANY_PROFILE_INVALID');
  });

  it('rejects an out-of-range limit with 400 VALIDATION_FAILED', async () => {
    const err = await settle(searchItemSummaries(C1, { limit: 101 })).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('respects page and limit', async () => {
    const page = await settle(searchItemSummaries(C1, { page: 2, limit: 3 }));
    expect(page.page).toBe(2);
    expect(page.limit).toBe(3);
    expect(page.items.length).toBe(3);
    expect(page.total).toBeGreaterThan(6);
  });

  it('does not resolve before the fake delay elapses', async () => {
    let done = false;
    void searchItemSummaries(C1).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});

describe('getItemSummary', () => {
  it('returns ST-220 with lot tracking, base unit as default and VAT14 sales tax', async () => {
    const s = await settle(getItemSummary(C1, 'item-49'));
    expect(s.sku).toBe('ST-220');
    expect(s.trackingMode).toBe('LOT');
    expect(s.baseUomId).toBe('uom-pcs');
    expect(s.defaultUomId).toBe('uom-pcs');
    expect(s.salesTaxDefault?.code).toBe('VAT14');
    expect(s.salesTaxDefault?.isInclusive).toBe(false);
  });

  it('returns BX-12 with the box as its default sales unit', async () => {
    const s = await settle(getItemSummary(C1, 'item-50'));
    expect(s.sku).toBe('BX-12');
    expect(s.baseUomId).toBe('uom-pcs');
    expect(s.defaultUomId).toBe('uom-box');
    expect(s.defaultPurchaseUomId).toBe('uom-pcs');
    expect(s.companyProfile?.salesPrice).toBe('12599.000');
  });

  it('returns RB-12 with kilogram sales unit, ton base and inclusive tax', async () => {
    const s = await settle(getItemSummary(C1, 'item-54'));
    expect(s.sku).toBe('RB-12');
    expect(s.baseUomId).toBe('uom-ton');
    expect(s.defaultUomId).toBe('uom-kg');
    expect(s.salesTaxDefault?.code).toBe('VAT14I');
    expect(s.salesTaxDefault?.isInclusive).toBe(true);
  });

  it('returns SW-OFF as a service with no tax default', async () => {
    const s = await settle(getItemSummary(C1, 'item-53'));
    expect(s.sku).toBe('SW-OFF');
    expect(s.itemKind).toBe('SERVICE');
    expect(s.salesTaxDefault).toBeNull();
    expect(s.purchaseTaxDefault).toBeNull();
  });

  it('returns LP-14 with serial tracking', async () => {
    const s = await settle(getItemSummary(C1, 'item-52'));
    expect(s.sku).toBe('LP-14');
    expect(s.trackingMode).toBe('SERIAL');
    expect(s.companyProfile?.trackInventory).toBe(true);
  });

  it('returns no company profile and NONE tracking without a company', async () => {
    const s = await settle(getItemSummary({}, 'item-49'));
    expect(s.companyProfile).toBeNull();
    expect(s.trackingMode).toBe('NONE');
    expect(s.defaultUomId).toBe('uom-pcs');
  });

  it('rejects an unknown id with 404 ITEM_NOT_FOUND', async () => {
    const err = await settle(getItemSummary(C1, 'item-missing')).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).code).toBe('TRADE.CATALOG.ITEM_NOT_FOUND');
  });
});

describe('listUoms', () => {
  it('returns all units without filters', async () => {
    const all = await settle(listUoms());
    expect(all.length).toBe(16);
  });

  it('filters by status', async () => {
    const retired = await settle(listUoms({ status: 'RETIRED' }));
    expect(retired.map((u) => u.code)).toEqual(['DOZ']);
  });

  it('makes returned units resolvable through uomById', async () => {
    await settle(listUoms());
    expect(uomById('uom-kg')?.code).toBe('KG');
    expect(uomById('uom-nope')).toBeUndefined();
  });

  it('returns base and default sales units for SALES purpose', async () => {
    const uoms = await settle(listUoms({ itemId: 'item-54', purpose: 'SALES' }, C1));
    expect(uoms.map((u) => u.id).sort()).toEqual(['uom-kg', 'uom-ton']);
  });

  it('returns only the base unit for PURCHASE purpose when no purchase default exists', async () => {
    const uoms = await settle(listUoms({ itemId: 'item-54', purpose: 'PURCHASE' }, C1));
    expect(uoms.map((u) => u.id)).toEqual(['uom-ton']);
  });

  it('treats a missing purpose as ANY', async () => {
    const uoms = await settle(listUoms({ itemId: 'item-50' }, C1));
    expect(uoms.map((u) => u.id).sort()).toEqual(['uom-box', 'uom-pcs']);
  });

  it('takes the company from q.companyId when no context is passed', async () => {
    const uoms = await settle(listUoms({ itemId: 'item-54', purpose: 'SALES', companyId: 'c1' }));
    expect(uoms.map((u) => u.id).sort()).toEqual(['uom-kg', 'uom-ton']);
  });

  it('returns only the base unit for a company without a profile', async () => {
    const uoms = await settle(listUoms({ itemId: 'item-54', purpose: 'SALES' }, { companyId: 'c2' }));
    expect(uoms.map((u) => u.id)).toEqual(['uom-ton']);
  });

  it('rejects an unknown item with 404 ITEM_NOT_FOUND', async () => {
    const err = await settle(listUoms({ itemId: 'item-missing' }, C1)).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).code).toBe('TRADE.CATALOG.ITEM_NOT_FOUND');
  });

  it('does not itself raise COMPANY_PROFILE_INVALID when the company is missing', async () => {
    // Documents current behaviour: the 422 lives in searchItems, not listUoms.
    const uoms = await settle(listUoms({ itemId: 'item-50', purpose: 'SALES' }));
    expect(uoms.length).toBeGreaterThan(0);
  });
});

describe('listReasons', () => {
  it('returns only reasons of the requested kind ordered by sortOrder', async () => {
    const rows = await settle(listReasons('DOCUMENT_CANCEL'));
    expect(rows.every((r) => r.kind === 'DOCUMENT_CANCEL')).toBe(true);
    expect(rows.map((r) => r.code)).toEqual([
      'CUSTOMER_REQUEST',
      'DATA_ERROR',
      'DUPLICATE',
      'PRICE_NOT_ACCEPTED',
      'OTHER',
    ]);
  });

  it('requires a note for OTHER on non-inventory kinds', async () => {
    const rows = await settle(listReasons('DOCUMENT_CANCEL'));
    expect(rows.find((r) => r.code === 'OTHER')?.requiresNote).toBe(true);
  });

  it('never requires a note on INVENTORY_* kinds', async () => {
    for (const kind of [
      'INVENTORY_PERIOD_CLOSE',
      'INVENTORY_PERIOD_REOPEN',
      'INVENTORY_UOM_PUBLISH',
      'INVENTORY_UOM_RETIRE',
      'INVENTORY_REVERSAL',
    ] as const) {
      const rows = await settle(listReasons(kind));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((r) => r.requiresNote)).toBe(false);
    }
  });

  it('flags OTHER as a system reason, including on INVENTORY_* kinds', async () => {
    const rows = await settle(listReasons('INVENTORY_REVERSAL'));
    expect(rows.find((r) => r.code === 'OTHER')?.isSystem).toBe(true);
    expect(rows.find((r) => r.code === 'DAMAGED')?.isSystem).toBe(false);
  });

  it('hides inactive reasons unless includeInactive is set', async () => {
    const target = TRADE_FAKE_DB.reasons.find((r) => r.kind === 'ACCOUNT_BLOCK' && r.code === 'LEGAL');
    expect(target).toBeDefined();
    target!.isActive = false;
    try {
      const hidden = await settle(listReasons('ACCOUNT_BLOCK'));
      expect(hidden.some((r) => r.code === 'LEGAL')).toBe(false);
      const shown = await settle(listReasons('ACCOUNT_BLOCK', { includeInactive: true }));
      expect(shown.some((r) => r.code === 'LEGAL')).toBe(true);
    } finally {
      target!.isActive = true;
    }
  });
});
