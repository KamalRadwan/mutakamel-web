import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import type { LedgerEntry, MovementSource, UomConversionRevision } from './inventory.model';

// Contract checks for inventory.fake.ts against the trade-inventory briefs
// (0-data, 0r reasons, 0s sourceType, c-uom, d-movements).

type Api = typeof import('./inventory.api');

let api: Api;
let foundation: typeof import('../shared/trade-foundation.fake');
let keyCounter = 0;

const PAGE = { page: 1, limit: 200 };
const NOW = '2026-11-21T10:00:00.000Z';
const EFFECTIVE = '2026-11-20T09:00:00.000Z';
/** Read projections print numeric(24,8) with all eight decimals. */
const READ_DECIMAL = /^-?(0|[1-9]\d*)\.\d{8}$/;

function key(): string {
  keyCounter += 1;
  return `ck-${keyCounter}`;
}

async function settle<T>(
  p: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  const wrapped = p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(300);
  return wrapped;
}

async function ok<T>(p: Promise<T>): Promise<T> {
  const r = await settle(p);
  if (!r.ok) throw r.error;
  return r.value;
}

async function fail(
  p: Promise<unknown>,
): Promise<{ status: number; code: string; details?: unknown }> {
  const r = await settle(p);
  if (r.ok) throw new Error('expected the call to reject');
  return r.error as { status: number; code: string; details?: unknown };
}

/** Decimal string → integer scaled by 10^8 (test-side, independent of the fake). */
function scaled(raw: string): bigint {
  const m = /^(-)?(\d+)(?:\.(\d{1,8}))?$/.exec(raw);
  if (!m) throw new Error(`not a decimal string: ${raw}`);
  const abs = BigInt(m[2]) * 100_000_000n + BigInt((m[3] ?? '').padEnd(8, '0'));
  return m[1] ? -abs : abs;
}

async function ledger(): Promise<LedgerEntry[]> {
  return (await ok(api.listMovements(PAGE))).items;
}

async function publishedConversion(): Promise<UomConversionRevision> {
  return (await ok(api.listUomConversions({ ...PAGE, status: 'PUBLISHED' }))).items[0];
}

function profileOf(itemId: string) {
  return foundation.TRADE_FAKE_DB.companyProfiles.find(
    (p) => p.itemId === itemId && p.trackInventory,
  )!;
}

function baseUomOf(itemId: string): string {
  return foundation.TRADE_FAKE_DB.items.find((i) => i.id === itemId)!.baseUomId;
}

/** A fresh active node, so opening balances never collide with seeded balances. */
async function freshNode(code: string): Promise<string> {
  const node = await ok(
    api.createNode(
      { code, name: `Node ${code}`, nodeType: 'WAREHOUSE', timezone: 'Africa/Cairo', branchIds: ['b1'] },
      key(),
    ),
  );
  return node.id;
}

async function receiptSource(): Promise<MovementSource> {
  const entries = (await ok(api.listMovements({ ...PAGE, movementType: 'PURCHASE_RECEIPT' }))).items;
  for (const id of [...new Set(entries.map((e) => e.sourceId!))]) {
    const src = await ok(api.getMovementSource('RECEIPT', id));
    if (src.status === 'POSTED' && src.lines.every((l) => !(l.tracking.serialKeys?.length ?? 0))) return src;
  }
  throw new Error('no reversible untracked receipt in the seed');
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  foundation = await import('../shared/trade-foundation.fake');
  api = await import('./inventory.api');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('inventory contract: ledger sourceType', () => {
  it('uses only the backend sourceType values', async () => {
    const allowed = new Set([null, 'RECEIPT', 'RECEIPT_REVERSAL', 'DELIVERY', 'DELIVERY_REVERSAL']);
    for (const e of await ledger()) expect(allowed.has(e.sourceType)).toBe(true);
  });

  it('pairs every sourceType with its movement type', async () => {
    const expected: Record<string, LedgerEntry['sourceType']> = {
      OPENING_BALANCE: null,
      PURCHASE_RECEIPT: 'RECEIPT',
      PURCHASE_RECEIPT_REVERSAL: 'RECEIPT_REVERSAL',
      SALES_DELIVERY: 'DELIVERY',
      SALES_DELIVERY_REVERSAL: 'DELIVERY_REVERSAL',
    };
    for (const e of await ledger()) expect(e.sourceType).toBe(expected[e.movementType]);
  });

  it('gives opening balances null source fields', async () => {
    const openings = (await ledger()).filter((e) => e.movementType === 'OPENING_BALANCE');
    expect(openings.length).toBeGreaterThan(0);
    for (const e of openings) {
      expect(e).toMatchObject({ sourceType: null, sourceId: null, sourceLineId: null, sourceNumber: null, reversalOfId: null });
    }
  });

  it('gives base receipt and delivery rows a source id, line id and number', async () => {
    for (const e of (await ledger()).filter((x) => x.sourceType === 'RECEIPT' || x.sourceType === 'DELIVERY')) {
      expect(e.sourceId).toBeTruthy();
      expect(e.sourceLineId).toBeTruthy();
      expect(e.sourceNumber).toBeTruthy();
      expect(e.reversalOfId).toBeNull();
    }
  });

  it('makes seeded reversal rows keep the original source id and number with no line id', async () => {
    const all = await ledger();
    const reversals = all.filter((e) => e.sourceType?.endsWith('_REVERSAL'));
    expect(reversals.length).toBeGreaterThan(0);
    for (const r of reversals) {
      const base = all.find((e) => e.id === r.reversalOfId)!;
      expect(base).toBeDefined();
      expect(r.sourceLineId).toBeNull();
      expect(r.sourceId).toBe(base.sourceId);
      expect(r.sourceNumber).toBe(base.sourceNumber);
      expect(r.sourceType).toBe(`${base.sourceType}_REVERSAL`);
    }
  });

  it('records a new opening balance with null source fields', async () => {
    const conv = await publishedConversion();
    const nodeId = await freshNode('CT-OPEN');
    const res = await ok(
      api.recordOpeningBalance(
        {
          nodeId,
          itemId: conv.itemId,
          uomId: conv.toUomId,
          quantity: '5',
          itemProfileVersion: profileOf(conv.itemId).version,
          businessEffectiveAt: EFFECTIVE,
          operationKey: newIdempotencyKey(),
          tracking: {},
        },
        key(),
      ),
    );
    // POST returns the raw ledger record: no read-projection fields such as sourceNumber.
    expect(res.ledger).toMatchObject({
      movementType: 'OPENING_BALANCE',
      sourceType: null,
      sourceId: null,
      reversalOfId: null,
    });
    expect(res.ledger).not.toHaveProperty('sourceNumber');
    expect(res.ledger).not.toHaveProperty('nodeCode');
    expect(res.balance).toMatchObject({ fulfillmentNodeId: nodeId, lotKey: 'none', serialKey: 'none', version: 1 });
  });

  it('derives the detail source kind without the _REVERSAL suffix', async () => {
    const reversal = (await ledger()).find((e) => e.sourceType === 'DELIVERY_REVERSAL')!;
    const detail = await ok(api.getMovement(reversal.id));
    expect(detail.source?.kind).toBe('DELIVERY');
    expect(detail.source?.id).toBe(reversal.sourceId);
  });
});

describe('inventory contract: serial lifecycle sources', () => {
  async function allLifecycles() {
    const units = (await ok(api.listSerials(PAGE))).items;
    const out = [];
    for (const u of units) out.push(...(await ok(api.getSerial(u.id))).lifecycle);
    return out;
  }

  it('gives seeded OPENING events the LEDGER source pointing at their ledger entry', async () => {
    const openings = (await allLifecycles()).filter((e) => e.eventType === 'OPENING');
    expect(openings.length).toBeGreaterThan(0);
    for (const e of openings) {
      expect(e.sourceType).toBe('LEDGER');
      expect(e.ledgerEntryId).toBeTruthy();
      expect(e.sourceId).toBe(e.ledgerEntryId);
    }
  });

  it('gives seeded reversal events the ledger reversal sourceType', async () => {
    const reversals = (await allLifecycles()).filter((e) => e.eventType.endsWith('_REVERSAL'));
    expect(reversals.length).toBeGreaterThan(0);
    for (const e of reversals) expect(e.sourceType).toBe(e.eventType);
  });

  it('gives every event a source', async () => {
    for (const e of await allLifecycles()) {
      expect(e.sourceType).toBeTruthy();
      expect(e.sourceId).toBeTruthy();
    }
  });

  it('writes OPENING events with the LEDGER source for serials of a new opening balance', async () => {
    const serialUnit = (await ok(api.listSerials({ ...PAGE, limit: 1 }))).items[0];
    const itemId = serialUnit.itemId;
    const nodeId = await freshNode('CT-SER');
    const res = await ok(
      api.recordOpeningBalance(
        {
          nodeId,
          itemId,
          uomId: baseUomOf(itemId),
          quantity: '2',
          itemProfileVersion: profileOf(itemId).version,
          businessEffectiveAt: EFFECTIVE,
          operationKey: newIdempotencyKey(),
          tracking: { serialKeys: ['CT-SN-A', 'CT-SN-B'] },
        },
        key(),
      ),
    );
    for (const serialKey of ['CT-SN-A', 'CT-SN-B']) {
      const unit = (await ok(api.listSerials({ ...PAGE, serialKey }))).items[0];
      const detail = await ok(api.getSerial(unit.id));
      expect(detail.lifecycle).toHaveLength(1);
      expect(detail.lifecycle[0]).toMatchObject({
        eventType: 'OPENING',
        sourceType: 'LEDGER',
        sourceId: res.ledger.id,
        ledgerEntryId: res.ledger.id,
        fromState: null,
        toState: 'ON_HAND',
      });
    }
  });
});

describe('inventory contract: reversal rows', () => {
  it('offers a reversible quantity only on receipt and delivery rows', async () => {
    for (const e of await ledger()) {
      const reversible = e.movementType === 'PURCHASE_RECEIPT' || e.movementType === 'SALES_DELIVERY';
      if (reversible) expect(e.remainingReversibleQuantity).toMatch(READ_DECIMAL);
      else expect(e.remainingReversibleQuantity).toBeNull();
    }
  });

  it('does not resolve a receipt id under the DELIVERY kind', async () => {
    const src = await receiptSource();
    const err = await fail(api.reverseMovementSource('DELIVERY', src.id, src.version, { reasonCode: 'OTHER', businessEffectiveAt: EFFECTIVE }, key()));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.DELIVERY_NOT_FOUND' });
  });

  it('seeds every INVENTORY_REVERSAL reason, OTHER included, without a required note', () => {
    const rows = foundation.TRADE_FAKE_DB.reasons.filter((r) => r.kind === 'INVENTORY_REVERSAL');
    expect(rows.map((r) => r.code)).toEqual(
      expect.arrayContaining(['WRONG_QUANTITY', 'WRONG_ITEM', 'DAMAGED', 'DUPLICATE_ENTRY', 'OTHER']),
    );
    for (const r of rows) expect(r.requiresNote).toBe(false);
  });

  it.each([' other ', 'other', 'OTHER '])('rejects reason code %j that fails the backend code format', async (reasonCode) => {
    const src = await receiptSource();
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, { reasonCode, businessEffectiveAt: EFFECTIVE }, key()),
    );
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('rejects an unknown reason code with backend details', async () => {
    const src = await receiptSource();
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, { reasonCode: 'NO_SUCH_REASON', businessEffectiveAt: EFFECTIVE }, key()),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.NOT_FOUND' });
    expect(err.details).toEqual({ field: ['reasonCode'] });
  });

  it('accepts OTHER with no note and stamps the reason on new reversal rows', async () => {
    const src = await receiptSource();
    await ok(
      api.reverseMovementSource('RECEIPT', src.id, src.version, { reasonCode: 'OTHER', businessEffectiveAt: EFFECTIVE }, key()),
    );
    const rows = (await ok(api.listMovements({ ...PAGE, sourceId: src.id }))).items.filter(
      (e) => e.sourceType === 'RECEIPT_REVERSAL',
    );
    expect(rows.length).toBe(src.lines.length);
    for (const r of rows) {
      expect(r.tracking.reversalReasonCode).toBe('OTHER');
      expect(r).toMatchObject({ sourceLineId: null, sourceNumber: src.documentNumber, remainingReversibleQuantity: null });
    }
  });

  it('drops the base row reversible quantity to zero after a whole reversal', async () => {
    const src = await receiptSource();
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, { reasonCode: 'DAMAGED', businessEffectiveAt: EFFECTIVE }, key()));
    const bases = (await ok(api.listMovements({ ...PAGE, sourceId: src.id }))).items.filter(
      (e) => e.movementType === 'PURCHASE_RECEIPT',
    );
    for (const b of bases) expect(b.remainingReversibleQuantity).toBe('0.00000000');
  });

  it('rejects a reason of the INVENTORY_REVERSAL kind once it is inactive', async () => {
    const src = await receiptSource();
    const row = foundation.TRADE_FAKE_DB.reasons.find((r) => r.kind === 'INVENTORY_REVERSAL' && r.code === 'DAMAGED')!;
    row.isActive = false;
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, { reasonCode: 'DAMAGED', businessEffectiveAt: EFFECTIVE }, key()),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.INACTIVE' });
    expect(err.details).toEqual({ field: ['reasonCode'] });
  });

  it('rejects a period-close reason for a reversal', async () => {
    const src = await receiptSource();
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, { reasonCode: 'MONTH_END_CLOSE', businessEffectiveAt: EFFECTIVE }, key()),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID' });
    expect(err.details).toEqual({ field: ['reasonCode'], reason: ['kind_mismatch'] });
  });
});

describe('inventory contract: quantity math as decimal strings', () => {
  it('returns every balance quantity as a canonical decimal string', async () => {
    for (const row of (await ok(api.listBalances(PAGE))).items) {
      expect(row.onHandQuantity).toMatch(READ_DECIMAL);
      expect(row.reservedQuantity).toMatch(READ_DECIMAL);
      expect(row.availableQuantity).toMatch(READ_DECIMAL);
    }
  });

  it('derives on hand from the ledger sum per node, item, unit and lot', async () => {
    const sums = new Map<string, bigint>();
    for (const e of await ledger()) {
      const k = `${e.fulfillmentNodeId}|${e.itemId}|${e.normalizedUomId}|${e.tracking.lotKey ?? ''}`;
      sums.set(k, (sums.get(k) ?? 0n) + scaled(e.normalizedSignedQuantity));
    }
    const rows = (await ok(api.listBalances(PAGE))).items;
    expect(rows.length).toBe(sums.size);
    for (const row of rows) {
      const k = `${row.nodeId}|${row.itemId}|${row.uomId}|${row.lotKey ?? ''}`;
      expect(scaled(row.onHandQuantity)).toBe(sums.get(k));
    }
  });

  it('keeps available exactly equal to on hand minus reserved', async () => {
    for (const row of (await ok(api.listBalances(PAGE))).items) {
      expect(scaled(row.availableQuantity)).toBe(scaled(row.onHandQuantity) - scaled(row.reservedQuantity));
    }
  });

  it('carries a fractional opening quantity without float drift', async () => {
    const conv = await publishedConversion();
    const nodeId = await freshNode('CT-FRAC');
    await ok(
      api.recordOpeningBalance(
        {
          nodeId,
          itemId: conv.itemId,
          uomId: conv.toUomId,
          quantity: '0.30000000',
          itemProfileVersion: profileOf(conv.itemId).version,
          businessEffectiveAt: EFFECTIVE,
          operationKey: newIdempotencyKey(),
          tracking: {},
        },
        key(),
      ),
    );
    const row = (await ok(api.listBalances({ ...PAGE, nodeId }))).items[0];
    expect(row).toMatchObject({
      onHandQuantity: '0.30000000',
      reservedQuantity: '0.00000000',
      availableQuantity: '0.30000000',
    });
  });
});

describe('inventory contract: UoM conversion rules', () => {
  function createBody(conv: UomConversionRevision, over: Record<string, string> = {}) {
    return {
      itemCompanyProfileId: conv.itemCompanyProfileId,
      fromUomId: conv.fromUomId,
      toUomId: conv.toUomId,
      factorNumerator: '24',
      factorDenominator: '1',
      effectiveFrom: '2026-11-10T00:00:00.000Z',
      ...over,
    };
  }

  it('rejects a conversion from the base unit to itself', async () => {
    const conv = await publishedConversion();
    const err = await fail(api.createUomConversion(createBody(conv, { fromUomId: conv.toUomId }), key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', details: { reason: ['identity_not_required'] } });
  });

  it('rejects a target unit that is not the item base unit', async () => {
    const conv = await publishedConversion();
    const err = await fail(
      api.createUomConversion(createBody(conv, { fromUomId: conv.toUomId, toUomId: conv.fromUomId }), key()),
    );
    expect(err).toMatchObject({ status: 422, details: { reason: ['uom_not_registered_for_item'] } });
  });

  it('rejects a from unit that is not the base or a default sales/purchase unit', async () => {
    const conv = await publishedConversion();
    const profile = foundation.TRADE_FAKE_DB.companyProfiles.find((p) => p.id === conv.itemCompanyProfileId)!;
    const registered = new Set([conv.toUomId, profile.defaultSalesUomId, profile.defaultPurchaseUomId]);
    const stranger = foundation.TRADE_FAKE_DB.uoms.find((u) => !registered.has(u.id))!;
    const err = await fail(api.createUomConversion(createBody(conv, { fromUomId: stranger.id }), key()));
    expect(err).toMatchObject({ status: 422, details: { reason: ['uom_not_registered_for_item'] } });
  });

  it.each(['0', '1.5', '012', '-3', ''])('rejects factor numerator %j', async (factorNumerator) => {
    const conv = await publishedConversion();
    const err = await fail(api.createUomConversion(createBody(conv, { factorNumerator }), key()));
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('creates a DRAFT numbered after the latest revision of the pair', async () => {
    const conv = await publishedConversion();
    const draft = await ok(api.createUomConversion(createBody(conv), key()));
    expect(draft).toMatchObject({ status: 'DRAFT', revisionNumber: conv.revisionNumber + 1, version: 1, publishedAt: null });
  });

  it('converts an opening quantity with the published factor', async () => {
    const conv = await publishedConversion();
    const nodeId = await freshNode('CT-UOM');
    const res = await ok(
      api.recordOpeningBalance(
        {
          nodeId,
          itemId: conv.itemId,
          uomId: conv.fromUomId,
          quantity: '2.5',
          itemProfileVersion: profileOf(conv.itemId).version,
          businessEffectiveAt: EFFECTIVE,
          operationKey: newIdempotencyKey(),
          tracking: {},
        },
        key(),
      ),
    );
    const expected = (scaled('2.5') * BigInt(conv.factorNumerator)) / BigInt(conv.factorDenominator);
    expect(res.ledger.signedQuantity).toBe('2.5');
    expect(scaled(res.ledger.normalizedSignedQuantity)).toBe(expected);
    expect(res.ledger).toMatchObject({ uomId: conv.fromUomId, normalizedUomId: conv.toUomId, uomConversionRevisionId: conv.id });
  });

  it('refuses a non-base unit whose only conversion is a draft', async () => {
    const draft = (await ok(api.listUomConversions({ ...PAGE, status: 'DRAFT' }))).items[0];
    const nodeId = await freshNode('CT-DRAFT');
    const err = await fail(
      api.recordOpeningBalance(
        {
          nodeId,
          itemId: draft.itemId,
          uomId: draft.fromUomId,
          quantity: '1',
          itemProfileVersion: profileOf(draft.itemId).version,
          businessEffectiveAt: EFFECTIVE,
          operationKey: newIdempotencyKey(),
          tracking: { lotKey: 'CT-LOT' },
        },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE' });
  });

  it.each([
    ['7', '3'],
    ['1', '8'],
    ['1', '300000000'],
  ])('creates factor %s/%s as a draft; exactness is checked only when a quantity converts', async (factorNumerator, factorDenominator) => {
    const conv = await publishedConversion();
    const draft = await ok(api.createUomConversion(createBody(conv, { factorNumerator, factorDenominator }), key()));
    expect(draft).toMatchObject({ status: 'DRAFT', factorNumerator, factorDenominator });
  });

  it('refuses an opening quantity that does not convert exactly with NON_EXACT_RESULT', async () => {
    const conv = await publishedConversion();
    const draft = await ok(api.createUomConversion(createBody(conv, { factorNumerator: '7', factorDenominator: '3' }), key()));
    await ok(api.publishUomConversion(draft.id, draft.version, 'NEW_PACKAGING', key()));
    const nodeId = await freshNode('CT-INEXACT');
    const body = {
      nodeId,
      itemId: conv.itemId,
      uomId: conv.fromUomId,
      quantity: '1',
      itemProfileVersion: profileOf(conv.itemId).version,
      businessEffectiveAt: EFFECTIVE,
      operationKey: newIdempotencyKey(),
      tracking: {},
    };
    const err = await fail(api.recordOpeningBalance(body, key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.UOM_CONVERSION_INVALID' });
    expect(err.details).toEqual({ reason: ['non_exact_result'] });
    const res = await ok(api.recordOpeningBalance({ ...body, quantity: '3' }, key()));
    expect(res.ledger.normalizedSignedQuantity).toBe('7');
  });
});

describe('inventory contract: movement filters', () => {
  it('filters by node', async () => {
    const nodeId = (await ledger())[0].fulfillmentNodeId;
    const page = await ok(api.listMovements({ ...PAGE, nodeId }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const e of page.items) expect(e.fulfillmentNodeId).toBe(nodeId);
  });

  it('filters by item', async () => {
    const itemId = (await ledger())[0].itemId;
    const page = await ok(api.listMovements({ ...PAGE, itemId }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const e of page.items) expect(e.itemId).toBe(itemId);
  });

  it('filters by exact movement type, excluding its reversal type', async () => {
    const page = await ok(api.listMovements({ ...PAGE, movementType: 'SALES_DELIVERY' }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const e of page.items) expect(e.movementType).toBe('SALES_DELIVERY');
  });

  it('combines node and group filters', async () => {
    const all = await ledger();
    const nodeId = all.find((e) => e.movementType === 'PURCHASE_RECEIPT')!.fulfillmentNodeId;
    const page = await ok(api.listMovements({ ...PAGE, nodeId, group: 'RECEIPT' }));
    const expected = all.filter((e) => e.fulfillmentNodeId === nodeId && e.movementType === 'PURCHASE_RECEIPT');
    expect(page.items.map((e) => e.id).sort()).toEqual(expected.map((e) => e.id).sort());
  });

  it('accepts an open-ended from or to date', async () => {
    const all = await ledger();
    const fromOnly = await ok(api.listMovements({ ...PAGE, from: '2026-11-15' }));
    const toOnly = await ok(api.listMovements({ ...PAGE, to: '2026-11-14' }));
    for (const e of fromOnly.items) expect(e.occurredAt.slice(0, 10) >= '2026-11-15').toBe(true);
    for (const e of toOnly.items) expect(e.occurredAt.slice(0, 10) <= '2026-11-14').toBe(true);
    expect(fromOnly.total + toOnly.total).toBe(all.length);
  });

  it('matches the source number prefix case-insensitively', async () => {
    const withNumber = (await ledger()).find((e) => e.sourceNumber)!;
    const prefix = withNumber.sourceNumber!.slice(0, 4).toLowerCase();
    const page = await ok(api.listMovements({ ...PAGE, search: prefix }));
    expect(page.items.some((e) => e.id === withNumber.id)).toBe(true);
    for (const e of page.items) expect(e.sourceNumber!.toLowerCase().startsWith(prefix)).toBe(true);
  });

  it('pages without overlap and keeps the total', async () => {
    const all = await ledger();
    const p1 = await ok(api.listMovements({ page: 1, limit: 10 }));
    const p2 = await ok(api.listMovements({ page: 2, limit: 10 }));
    expect(p1.total).toBe(all.length);
    expect(p2.total).toBe(all.length);
    expect(p1.items.map((e) => e.id)).toEqual(all.slice(0, 10).map((e) => e.id));
    expect(p2.items.map((e) => e.id)).toEqual(all.slice(10, 20).map((e) => e.id));
  });

  it('returns an empty page for an unknown source id', async () => {
    const page = await ok(api.listMovements({ ...PAGE, sourceId: 'missing' }));
    expect(page).toMatchObject({ items: [], total: 0 });
  });
});
