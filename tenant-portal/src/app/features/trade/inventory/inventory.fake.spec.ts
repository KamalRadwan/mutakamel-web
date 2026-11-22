import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../core/api/idempotency';

type Api = typeof import('./inventory.api');

let api: Api;
let foundation: typeof import('../shared/trade-foundation.fake');
let keyCounter = 0;

const PAGE = { page: 1, limit: 200 };
const NOW = '2026-11-21T10:00:00.000Z';
// the fake delays 300ms before stamping, so timestamps land at NOW + 300ms
const LATER = '2026-11-21T10:00:00.300Z';

function key(): string {
  keyCounter += 1;
  return `k-${keyCounter}`;
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


async function sourceEntries(kind: 'RECEIPT' | 'DELIVERY') {
  return (await ok(api.listMovements({ ...PAGE, sourceType: kind }))).items;
}

/** First source of the kind that already has a reversal entry in the seed ledger. */
async function reversedSeedSource(kind: 'RECEIPT' | 'DELIVERY') {
  const entries = await sourceEntries(kind);
  const reversal = entries.find((e) => e.reversalOfId !== null)!;
  const base = entries.find((e) => e.id === reversal.reversalOfId)!;
  return { entries, reversal, base, sourceId: reversal.sourceId! };
}

async function anySourceId(kind: 'RECEIPT' | 'DELIVERY'): Promise<string> {
  return (await sourceEntries(kind))[0].sourceId!;
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

describe('inventory fake balances', () => {
  it('returns every balance row ordered by node, item and lot', async () => {
    const page = await ok(api.listBalances(PAGE));
    const keys = page.items.map((r) => `${r.nodeCode}|${r.itemCode}|${r.lotKey ?? ''}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    expect(page.total).toBe(page.items.length);
  });

  it('computes available as on hand minus reserved', async () => {
    const page = await ok(api.listBalances(PAGE));
    const row = page.items.find((r) => r.nodeCode === 'ST-DT' && r.lotKey === 'LOT-2026-A');
    expect(row).toMatchObject({
      onHandQuantity: '30.00000000',
      reservedQuantity: '10.00000000',
      availableQuantity: '20.00000000',
    });
  });

  it('flags negative on-hand rows', async () => {
    const page = await ok(api.listBalances(PAGE));
    const negative = page.items.filter((r) => r.negative);
    expect(negative.map((r) => `${r.nodeCode}|${r.itemCode}`)).toEqual(['ST-DT|BX-12']);
  });

  it('filters by node', async () => {
    const page = await ok(api.listBalances({ ...PAGE, nodeId: 'node-st-dt' }));
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((r) => r.nodeId === 'node-st-dt')).toBe(true);
  });

  it('filters by lot key', async () => {
    const page = await ok(api.listBalances({ ...PAGE, lotKey: 'LOT-2026-B' }));
    expect(page.items.length).toBe(2);
    expect(page.items.every((r) => r.lotKey === 'LOT-2026-B')).toBe(true);
  });

  it('hides empty rows when only in stock is requested', async () => {
    const all = await ok(api.listBalances(PAGE));
    const inStock = await ok(api.listBalances({ ...PAGE, onlyInStock: true }));
    const empty = all.items.filter((r) => Number(r.onHandQuantity) === 0 && Number(r.reservedQuantity) === 0);
    expect(empty.length).toBeGreaterThan(0);
    expect(inStock.items.length).toBe(all.items.length - empty.length);
  });

  it('searches by item code prefix case-insensitively', async () => {
    const page = await ok(api.listBalances({ ...PAGE, search: 'phn-a54' }));
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((r) => r.itemCode === 'PHN-A54-128')).toBe(true);
  });

  it('searches by lot key prefix', async () => {
    const page = await ok(api.listBalances({ ...PAGE, search: 'lot-2026-c' }));
    expect(page.items.map((r) => r.lotKey)).toEqual(['LOT-2026-C']);
  });

  it('paginates and reports the total', async () => {
    const first = await ok(api.listBalances({ page: 1, limit: 2 }));
    const second = await ok(api.listBalances({ page: 2, limit: 2 }));
    expect(first.items.length).toBe(2);
    expect(second.items[0]).not.toEqual(first.items[0]);
    expect(first.total).toBe(second.total);
  });

  it('reports tracking mode per row for LOT, SERIAL and NONE items', async () => {
    const page = await ok(api.listBalances(PAGE));
    const modes = new Map(page.items.map((r) => [r.itemCode, r.trackingMode]));
    expect(modes.get('DRK-WTR-500')).toBe('LOT');
    expect(modes.get('PHN-A54-128')).toBe('SERIAL');
    expect(modes.get('BX-12')).toBe('NONE');
  });

  it('gives lot rows a lot key and no serial count', async () => {
    const page = await ok(api.listBalances(PAGE));
    const lotRows = page.items.filter((r) => r.trackingMode === 'LOT');
    expect(lotRows.every((r) => r.lotKey !== null && r.serialCount === 0)).toBe(true);
  });

  it('gives serial rows no lot key', async () => {
    const page = await ok(api.listBalances(PAGE));
    const serialRows = page.items.filter((r) => r.trackingMode === 'SERIAL');
    expect(serialRows.length).toBeGreaterThan(0);
    expect(serialRows.every((r) => r.lotKey === null && r.serialCount > 0)).toBe(true);
  });

  it('rejects with the queued failure once and then recovers', async () => {
    const { ApiError } = await import('../shared/trade-api');
    api.FAKE_INVENTORY_FAIL_NEXT(new ApiError(500, 'BOOM'));
    expect((await fail(api.listBalances(PAGE))).code).toBe('BOOM');
    expect((await ok(api.listBalances(PAGE))).items.length).toBeGreaterThan(0);
  });
});

describe('inventory fake nodes', () => {
  it('lists the nodes of the current branch ordered by code', async () => {
    const nodes = await ok(api.listNodes());
    expect(nodes.map((n) => n.code)).toEqual(['ST-DT', 'VR-TRANSIT', 'WH-MAIN']);
  });

  it('filters company nodes by status', async () => {
    const inactive = await ok(api.listCompanyNodes({ ...PAGE, status: 'INACTIVE' }));
    expect(inactive.items.map((n) => n.code)).toEqual(['VR-TRANSIT']);
    const active = await ok(api.listCompanyNodes({ ...PAGE, status: 'ACTIVE' }));
    expect(active.items.map((n) => n.code)).toEqual(['ST-DT', 'WH-MAIN']);
  });

  it('filters company nodes by type', async () => {
    const stores = await ok(api.listCompanyNodes({ ...PAGE, nodeType: 'STORE' }));
    expect(stores.items.map((n) => n.code)).toEqual(['ST-DT']);
  });

  it('searches company nodes by code prefix or name fragment', async () => {
    const byCode = await ok(api.listCompanyNodes({ ...PAGE, search: 'wh-' }));
    expect(byCode.items.map((n) => n.code)).toEqual(['WH-MAIN']);
    const byName = await ok(api.listCompanyNodes({ ...PAGE, search: 'warehouse' }));
    expect(byName.items.map((n) => n.code)).toContain('WH-MAIN');
  });

  it('exposes only active branch links with a matching branch count', async () => {
    const page = await ok(api.listCompanyNodes(PAGE));
    for (const n of page.items) {
      expect(n.branches.every((b) => b.isActive)).toBe(true);
      expect(n.branchCount).toBe(n.branches.length);
    }
  });

  it('rejects a missing node with NODE_NOT_FOUND', async () => {
    const err = await fail(api.getNode('nope'));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.NODE_NOT_FOUND' });
  });

  it('returns availability for an active node', async () => {
    const bal = (await ok(api.listBalances({ ...PAGE, nodeId: 'node-wh-main' }))).items.find(
      (r) => r.itemCode === 'BX-12',
    )!;
    const avail = await ok(api.getAvailability({ nodeId: 'node-wh-main', itemId: bal.itemId }));
    // Balance record numerics are numeric text; available is computed by subtractQuantity.
    expect(avail).toMatchObject({
      onHandQuantity: '144.00000000',
      reservedQuantity: '24.00000000',
      availableQuantity: '120',
    });
    expect(avail.version).toBeGreaterThan(0);
  });

  it('rejects availability for an inactive node', async () => {
    const bal = (await ok(api.listBalances(PAGE))).items[0];
    const err = await fail(api.getAvailability({ nodeId: 'node-vr-transit', itemId: bal.itemId }));
    expect(err.code).toBe('TRADE.INVENTORY.NODE_NOT_FOUND');
  });
});

describe('inventory fake movements list', () => {
  it('sorts newest first', async () => {
    const page = await ok(api.listMovements(PAGE));
    const dates = page.items.map((e) => e.occurredAt);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it('sourceType RECEIPT returns receipts and their reversals only', async () => {
    const page = await ok(api.listMovements({ ...PAGE, sourceType: 'RECEIPT' }));
    expect(page.items.length).toBeGreaterThan(0);
    expect(new Set(page.items.map((e) => e.sourceType))).toEqual(
      new Set(['RECEIPT', 'RECEIPT_REVERSAL']),
    );
  });

  it('sourceType DELIVERY returns deliveries and their reversals only', async () => {
    const page = await ok(api.listMovements({ ...PAGE, sourceType: 'DELIVERY' }));
    expect(new Set(page.items.map((e) => e.sourceType))).toEqual(
      new Set(['DELIVERY', 'DELIVERY_REVERSAL']),
    );
  });

  it('excludes opening balances when a sourceType is requested', async () => {
    const page = await ok(api.listMovements({ ...PAGE, sourceType: 'RECEIPT' }));
    expect(page.items.some((e) => e.movementType === 'OPENING_BALANCE')).toBe(false);
  });

  it('filters the reversal group', async () => {
    const reversals = await ok(api.listMovements({ ...PAGE, group: 'REVERSAL' }));
    expect(reversals.items.length).toBeGreaterThan(0);
    expect(reversals.items.every((e) => e.reversalOfId !== null)).toBe(true);
  });

  it('filters the opening group', async () => {
    const opening = await ok(api.listMovements({ ...PAGE, group: 'OPENING' }));
    expect(opening.items.length).toBe(4);
    expect(opening.items.every((e) => e.movementType === 'OPENING_BALANCE')).toBe(true);
  });

  it('rejects movementType together with group', async () => {
    const err = await fail(
      api.listMovements({ ...PAGE, movementType: 'SALES_DELIVERY', group: 'DELIVERY' }),
    );
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('rejects a to date before the from date', async () => {
    const err = await fail(api.listMovements({ ...PAGE, from: '2026-11-10', to: '2026-11-01' }));
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('filters by inclusive date range', async () => {
    const page = await ok(api.listMovements({ ...PAGE, from: '2026-11-05', to: '2026-11-07' }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const e of page.items) {
      const day = e.occurredAt.slice(0, 10);
      expect(day >= '2026-11-05' && day <= '2026-11-07').toBe(true);
    }
  });

  it('filters by source id and includes both base and reversal entries', async () => {
    const { sourceId } = await reversedSeedSource('RECEIPT');
    const page = await ok(api.listMovements({ ...PAGE, sourceId }));
    const types = new Set(page.items.map((e) => e.movementType));
    expect(types).toEqual(new Set(['PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL']));
    expect(page.items.every((e) => e.sourceId === sourceId)).toBe(true);
  });

  it('searches by source document number prefix', async () => {
    const { sourceId } = await reversedSeedSource('RECEIPT');
    const src = await ok(api.getMovementSource('RECEIPT', sourceId));
    const page = await ok(
      api.listMovements({ ...PAGE, search: src.documentNumber.slice(0, 8).toLowerCase() }),
    );
    expect(page.items.some((e) => e.sourceId === sourceId)).toBe(true);
  });

  it('searches by exact operation key only', async () => {
    const first = (await ok(api.listMovements(PAGE))).items[0];
    const exact = await ok(api.listMovements({ ...PAGE, search: first.operationKey }));
    expect(exact.items.map((e) => e.id)).toContain(first.id);
    const partial = await ok(
      api.listMovements({ ...PAGE, search: first.operationKey.slice(0, -1) }),
    );
    expect(partial.items.map((e) => e.id)).not.toContain(first.id);
  });

  it('gives reversal and opening entries no reversible quantity', async () => {
    const page = await ok(api.listMovements(PAGE));
    const others = page.items.filter(
      (e) => e.movementType !== 'PURCHASE_RECEIPT' && e.movementType !== 'SALES_DELIVERY',
    );
    expect(others.every((e) => e.remainingReversibleQuantity === null)).toBe(true);
  });

  it('gives base entries a non-negative reversible quantity', async () => {
    const page = await ok(api.listMovements({ ...PAGE, group: 'RECEIPT' }));
    expect(page.items.every((e) => Number(e.remainingReversibleQuantity) >= 0)).toBe(true);
  });
});

describe('inventory fake movement detail', () => {
  it('links a base movement to its reversals and its source', async () => {
    const { reversal, base, sourceId } = await reversedSeedSource('RECEIPT');
    const detail = await ok(api.getMovement(base.id));
    expect(detail.reversals.map((r) => r.id)).toContain(reversal.id);
    expect(detail.source).toMatchObject({ kind: 'RECEIPT', id: sourceId });
  });

  it('shows the reversal entry pointing back at the original', async () => {
    const { reversal, base } = await reversedSeedSource('RECEIPT');
    const detail = await ok(api.getMovement(reversal.id));
    expect(detail.reversalOfId).toBe(base.id);
    expect(detail.reversals).toEqual([]);
  });

  it('resolves the inventory period code', async () => {
    const { base } = await reversedSeedSource('RECEIPT');
    const detail = await ok(api.getMovement(base.id));
    expect(detail.periodCode).toBe('P-2026-11');
  });

  it('has no source for an opening balance', async () => {
    const opening = (await ok(api.listMovements({ ...PAGE, group: 'OPENING' }))).items[0];
    const detail = await ok(api.getMovement(opening.id));
    expect(detail.source).toBeNull();
  });

  it('rejects an unknown movement', async () => {
    const err = await fail(api.getMovement('nope'));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.MOVEMENT_NOT_FOUND' });
  });
});

describe('inventory fake receipts, deliveries and reservations', () => {
  it('returns a receipt with lines and no reservation links', async () => {
    const src = await ok(api.getMovementSource('RECEIPT', await anySourceId('RECEIPT')));
    expect(src.kind).toBe('RECEIPT');
    expect(src.lines.length).toBe(src.lineCount);
    expect(src.lines.every((l) => !l.reservationId)).toBe(true);
  });

  it('returns a delivery whose lines all carry a reservation id', async () => {
    const src = await ok(api.getMovementSource('DELIVERY', await anySourceId('DELIVERY')));
    expect(src.kind).toBe('DELIVERY');
    expect(src.lines.length).toBeGreaterThan(0);
    expect(src.lines.every((l) => typeof l.reservationId === 'string' && l.reservationId !== '')).toBe(true);
  });

  it('does not resolve a delivery id as a receipt', async () => {
    const err = await fail(api.getMovementSource('RECEIPT', await anySourceId('DELIVERY')));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.RECEIPT_NOT_FOUND' });
  });

  it('does not resolve a receipt id as a delivery', async () => {
    const err = await fail(api.getMovementSource('DELIVERY', await anySourceId('RECEIPT')));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.DELIVERY_NOT_FOUND' });
  });

  it('returns a copy so callers cannot mutate stored state', async () => {
    const id = await anySourceId('RECEIPT');
    const a = await ok(api.getMovementSource('RECEIPT', id));
    a.lines[0].quantity = '999999';
    const b = await ok(api.getMovementSource('RECEIPT', id));
    expect(b.lines[0].quantity).not.toBe('999999');
  });
});

describe('inventory fake periods', () => {
  it('lists periods newest first', async () => {
    const page = await ok(api.listPeriods(PAGE));
    expect(page.items.map((p) => p.code)).toEqual(['P-2026-11', 'P-2026-10', 'P-2026-09']);
  });

  it('filters periods by status', async () => {
    const closed = await ok(api.listPeriods({ ...PAGE, status: 'CLOSED' }));
    expect(closed.items.map((p) => p.code)).toEqual(['P-2026-10', 'P-2026-09']);
  });

  it('filters periods by effective date', async () => {
    const page = await ok(api.listPeriods({ ...PAGE, effectiveAt: '2026-10-15T08:00:00Z' }));
    expect(page.items.map((p) => p.code)).toEqual(['P-2026-10']);
  });

  it('closes an open period with a close reason and bumps the version', async () => {
    const closed = await ok(api.closePeriod('per-2026-11', 1, 'MONTH_END_CLOSE', key()));
    expect(closed).toMatchObject({
      status: 'CLOSED',
      closeReason: 'MONTH_END_CLOSE',
      version: 2,
      closedBy: 'usr-1',
      closedAt: LATER,
    });
  });

  it('reopens a closed period and clears the close fields', async () => {
    const reopened = await ok(api.reopenPeriod('per-2026-10', 2, 'CORRECTION', key()));
    expect(reopened).toMatchObject({
      status: 'OPEN',
      closedAt: null,
      closedBy: null,
      closeReason: null,
      version: 3,
    });
  });

  it('accepts the OTHER reason without any note on close and reopen', async () => {
    const closed = await ok(api.closePeriod('per-2026-11', 1, 'OTHER', key()));
    expect(closed.closeReason).toBe('OTHER');
    const reopened = await ok(api.reopenPeriod('per-2026-11', 2, 'OTHER', key()));
    expect(reopened.status).toBe('OPEN');
  });

  it.each([' month_end_close ', 'month_end_close', ' MONTH_END_CLOSE'])(
    'rejects reason code %j like the backend code format check',
    async (code) => {
      const err = await fail(api.closePeriod('per-2026-11', 1, code, key()));
      expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
      expect(err.details).toBeUndefined();
    },
  );

  it('rejects closing an already closed period', async () => {
    const err = await fail(api.closePeriod('per-2026-10', 2, 'MONTH_END_CLOSE', key()));
    expect(err).toMatchObject({
      status: 422,
      code: 'TRADE.INVENTORY.PERIOD_CLOSED',
      details: { reason: ['transition_not_allowed'] },
    });
  });

  it('rejects reopening an open period', async () => {
    const err = await fail(api.reopenPeriod('per-2026-11', 1, 'CORRECTION', key()));
    expect(err).toMatchObject({ status: 422, details: { reason: ['transition_not_allowed'] } });
  });

  it('rejects a stale version', async () => {
    const err = await fail(api.closePeriod('per-2026-11', 7, 'MONTH_END_CLOSE', key()));
    expect(err).toMatchObject({ status: 409, code: 'TRADE.CONCURRENCY.STALE_VERSION' });
  });

  it('rejects an unknown period', async () => {
    const err = await fail(api.closePeriod('nope', 1, 'MONTH_END_CLOSE', key()));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.SCOPE_NOT_FOUND' });
  });

  it('rejects an unknown reason code', async () => {
    const err = await fail(api.closePeriod('per-2026-11', 1, 'NOT_A_REASON', key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.NOT_FOUND' });
    expect(err.details).toEqual({ field: ['reasonCode'] });
  });

  it('rejects a reason code that belongs to another kind', async () => {
    const err = await fail(api.closePeriod('per-2026-11', 1, 'CORRECTION', key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID' });
    expect(err.details).toEqual({ field: ['reasonCode'], reason: ['kind_mismatch'] });
  });

  it('rejects an inactive reason code', async () => {
    const row = foundation.TRADE_FAKE_DB.reasons.find(
      (r) => r.kind === 'INVENTORY_PERIOD_CLOSE' && r.code === 'AUDIT_HOLD',
    )!;
    row.isActive = false;
    const err = await fail(api.closePeriod('per-2026-11', 1, 'AUDIT_HOLD', key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.INACTIVE' });
    expect(err.details).toEqual({ field: ['reasonCode'] });
  });

  it('does not change the period when the reason is rejected', async () => {
    await fail(api.closePeriod('per-2026-11', 1, 'NOT_A_REASON', key()));
    const page = await ok(api.listPeriods({ ...PAGE, status: 'OPEN' }));
    expect(page.items.map((p) => p.version)).toEqual([1]);
  });

  it('replays the same close without applying it twice', async () => {
    const k = key();
    const first = await ok(api.closePeriod('per-2026-11', 1, 'MONTH_END_CLOSE', k));
    const second = await ok(api.closePeriod('per-2026-11', 1, 'MONTH_END_CLOSE', k));
    expect(second).toEqual(first);
    expect(second.version).toBe(2);
  });

  it('creates a period with the code exactly as sent', async () => {
    const created = await ok(
      api.createPeriod(
        { code: 'P-2026-12', startsOn: '2026-12-01', endsOn: '2026-12-31', maxBackdateDays: 3 },
        key(),
      ),
    );
    expect(created).toMatchObject({ code: 'P-2026-12', status: 'OPEN', version: 1 });
  });

  it('does not upper-case a lower-case code: the DTO pattern rejects it', async () => {
    const err = await fail(
      api.createPeriod(
        { code: 'p-2026-12', startsOn: '2026-12-01', endsOn: '2026-12-31', maxBackdateDays: 3 },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('rejects a duplicate period code with PERIOD_CODE_TAKEN on the code field', async () => {
    const existing = (await ok(api.listPeriods(PAGE))).items[0];
    const err = await fail(
      api.createPeriod(
        { code: existing.code, startsOn: '2027-05-01', endsOn: '2027-05-31', maxBackdateDays: 3 },
        key(),
      ),
    );
    expect(err).toMatchObject({
      status: 409,
      code: 'TRADE.INVENTORY.PERIOD_CODE_TAKEN',
      details: { field: ['code'] },
    });
  });

  it('rejects creating an overlapping period', async () => {
    const err = await fail(
      api.createPeriod(
        { code: 'P-X', startsOn: '2026-11-15', endsOn: '2026-12-15', maxBackdateDays: 3 },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, details: { reason: ['overlapping_period'] } });
  });

  it('rejects a period whose end is before its start', async () => {
    const err = await fail(
      api.createPeriod(
        { code: 'P-BAD', startsOn: '2027-02-10', endsOn: '2027-02-01', maxBackdateDays: 3 },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, details: { reason: ['invalid_range'] } });
  });
});

describe('inventory fake UoM conversions', () => {
  it('lists revisions newest first within an item profile', async () => {
    const page = await ok(api.listUomConversions(PAGE));
    const two = page.items.filter((c) => c.id === 'uomc-1' || c.id === 'uomc-2');
    expect(two.map((c) => c.revisionNumber)).toEqual([2, 1]);
  });

  it('filters conversions by status', async () => {
    const draft = await ok(api.listUomConversions({ ...PAGE, status: 'DRAFT' }));
    expect(draft.items.map((c) => c.id)).toEqual(['uomc-3']);
  });

  it('publishes a draft with a publish reason', async () => {
    const pub = await ok(api.publishUomConversion('uomc-3', 1, 'NEW_PACKAGING', key()));
    expect(pub).toMatchObject({
      status: 'PUBLISHED',
      publishReasonCode: 'NEW_PACKAGING',
      version: 2,
      publishedBy: 'usr-1',
      publishedAt: LATER,
    });
  });

  it('accepts OTHER on publish without a note', async () => {
    const pub = await ok(api.publishUomConversion('uomc-3', 1, 'OTHER', key()));
    expect(pub.publishReasonCode).toBe('OTHER');
  });

  it('rejects publishing with a retire-kind reason', async () => {
    const err = await fail(api.publishUomConversion('uomc-3', 1, 'REPLACED', key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID' });
  });

  it('rejects publishing a revision that is not a draft', async () => {
    const err = await fail(api.publishUomConversion('uomc-2', 2, 'NEW_PACKAGING', key()));
    expect(err).toMatchObject({
      status: 422,
      code: 'TRADE.INVENTORY.UOM_CONVERSION_INVALID',
      details: { reason: ['transition_not_allowed'] },
    });
  });

  it('retires a published revision with a retire reason', async () => {
    const retired = await ok(
      api.retireUomConversion('uomc-2', 2, 'PACKAGING_DISCONTINUED', key()),
    );
    expect(retired).toMatchObject({
      status: 'RETIRED',
      retireReasonCode: 'PACKAGING_DISCONTINUED',
      version: 3,
      retiredAt: LATER,
    });
  });

  it('rejects retiring with a publish-kind reason', async () => {
    const err = await fail(api.retireUomConversion('uomc-2', 2, 'NEW_PACKAGING', key()));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID' });
  });

  it('rejects retiring a draft', async () => {
    const err = await fail(api.retireUomConversion('uomc-3', 1, 'CORRECTION', key()));
    expect(err).toMatchObject({ status: 422, details: { reason: ['transition_not_allowed'] } });
  });

  it('rejects a stale version on retire', async () => {
    const err = await fail(api.retireUomConversion('uomc-2', 1, 'CORRECTION', key()));
    expect(err).toMatchObject({ status: 409, code: 'TRADE.CONCURRENCY.STALE_VERSION' });
  });

  it('rejects an unknown conversion', async () => {
    const err = await fail(api.publishUomConversion('nope', 1, 'OTHER', key()));
    expect(err).toMatchObject({ status: 404, code: 'TRADE.INVENTORY.SCOPE_NOT_FOUND' });
  });

  describe('replacing a published revision', () => {
    async function draftFor(effectiveFrom: string) {
      const current = (await ok(api.listUomConversions({ ...PAGE, status: 'PUBLISHED' }))).items[0];
      const draft = await ok(
        api.createUomConversion(
          {
            itemCompanyProfileId: current.itemCompanyProfileId,
            fromUomId: current.fromUomId,
            toUomId: current.toUomId,
            factorNumerator: '24',
            factorDenominator: '1',
            effectiveFrom,
          },
          key(),
        ),
      );
      return { current, draft };
    }

    it('numbers the new draft after the latest revision', async () => {
      const { current, draft } = await draftFor('2026-11-01T00:00:00.000Z');
      expect(draft.status).toBe('DRAFT');
      expect(draft.revisionNumber).toBe(current.revisionNumber + 1);
    });

    it('retires the predecessor with the REPLACED reason', async () => {
      const { current, draft } = await draftFor('2026-11-01T00:00:00.000Z');
      await ok(api.publishUomConversion(draft.id, draft.version, 'SUPPLIER_CHANGE', key()));
      const page = await ok(api.listUomConversions(PAGE));
      const old = page.items.find((c) => c.id === current.id)!;
      expect(old).toMatchObject({ status: 'RETIRED', retireReasonCode: 'REPLACED' });
    });

    it('rejects a future-dated replacement', async () => {
      const { draft } = await draftFor('2027-01-01T00:00:00.000Z');
      const err = await fail(api.publishUomConversion(draft.id, draft.version, 'OTHER', key()));
      expect(err).toMatchObject({
        status: 422,
        details: { reason: ['future_replacement_unsupported'] },
      });
    });

    it('rejects a replacement not effective after its predecessor', async () => {
      const { draft } = await draftFor('2026-09-01T00:00:00.000Z');
      const err = await fail(api.publishUomConversion(draft.id, draft.version, 'OTHER', key()));
      expect(err).toMatchObject({
        status: 422,
        details: { reason: ['effective_from_not_after_predecessor'] },
      });
    });
  });
});

describe('inventory fake serials and decisions', () => {
  it('filters serials by state', async () => {
    const all = await ok(api.listSerials(PAGE));
    expect(all.items.length).toBeGreaterThan(0);
    const onHand = await ok(api.listSerials({ ...PAGE, state: 'ON_HAND' }));
    expect(onHand.items.every((s) => s.state === 'ON_HAND')).toBe(true);
  });

  it('finds a serial by exact key only', async () => {
    const first = (await ok(api.listSerials(PAGE))).items[0];
    const hit = await ok(api.listSerials({ ...PAGE, serialKey: first.serialKey }));
    expect(hit.items.map((s) => s.id)).toEqual([first.id]);
    const miss = await ok(api.listSerials({ ...PAGE, serialKey: first.serialKey.slice(1) }));
    expect(miss.items).toEqual([]);
  });

  it('omits the lifecycle from list rows but includes it in detail', async () => {
    const first = (await ok(api.listSerials(PAGE))).items[0];
    expect('lifecycle' in first).toBe(false);
    const detail = await ok(api.getSerial(first.id));
    expect(Array.isArray(detail.lifecycle)).toBe(true);
  });

  it('rejects an unknown serial and an unknown decision', async () => {
    expect((await fail(api.getSerial('nope'))).code).toBe('TRADE.INVENTORY.SCOPE_NOT_FOUND');
    expect((await fail(api.getDecision('nope'))).code).toBe('TRADE.INVENTORY.SCOPE_NOT_FOUND');
  });

  it('lists decisions newest first', async () => {
    const page = await ok(api.listDecisions(PAGE));
    const dates = page.items.map((d) => d.evaluatedAt);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });
});

describe('opening balance request shape (S3)', () => {
  const base = {
    nodeId: 'n',
    itemId: 'i',
    uomId: 'u',
    quantity: '1',
    itemProfileVersion: 1,
    businessEffectiveAt: NOW,
    operationKey: newIdempotencyKey(),
  };

  it.each([null, 'LOT-1', 5, ['LOT-1']])('rejects tracking %j with 400 VALIDATION_FAILED', async (tracking) => {
    const error = await fail(api.recordOpeningBalance({ ...base, tracking } as never, key()));
    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// Backend alignment: read projections, filters, availability, opening balances.
// ---------------------------------------------------------------------------

const OPEN_EFFECTIVE = '2026-11-20T09:00:00.000Z';
const READ_DECIMAL = /^-?(0|[1-9]\d*)\.\d{8}$/;

async function rowOfMode(mode: 'NONE' | 'LOT' | 'SERIAL') {
  return (await ok(api.listBalances(PAGE))).items.find((r) => r.trackingMode === mode)!;
}

function stockProfile(itemId: string) {
  return foundation.TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === itemId && p.trackInventory)!;
}

function untrackedItemId(): string {
  return foundation.TRADE_FAKE_DB.companyProfiles.find((p) => p.companyId === 'c1' && !p.trackInventory)!.itemId;
}

async function newNode(code: string): Promise<string> {
  return (
    await ok(
      api.createNode(
        { code, name: `Node ${code}`, nodeType: 'WAREHOUSE', timezone: 'Africa/Cairo', branchIds: ['b1'] },
        key(),
      ),
    )
  ).id;
}

function openingBody(nodeId: string, itemId: string, extra: Record<string, unknown> = {}) {
  const item = foundation.TRADE_FAKE_DB.items.find((i) => i.id === itemId)!;
  return {
    nodeId,
    itemId,
    uomId: item.baseUomId,
    quantity: '2',
    itemProfileVersion: stockProfile(itemId).version,
    businessEffectiveAt: OPEN_EFFECTIVE,
    operationKey: newIdempotencyKey(),
    tracking: {},
    ...extra,
  };
}

describe('inventory fake read projections (numeric(24,8) text)', () => {
  it('prints balance quantities with eight decimals', async () => {
    for (const row of (await ok(api.listBalances(PAGE))).items) {
      expect(row.onHandQuantity).toMatch(READ_DECIMAL);
      expect(row.availableQuantity).toMatch(READ_DECIMAL);
    }
  });

  it('prints movement and source line quantities with eight decimals', async () => {
    const entry = (await ok(api.listMovements({ ...PAGE, movementType: 'PURCHASE_RECEIPT' }))).items[0];
    expect(entry.signedQuantity).toMatch(READ_DECIMAL);
    expect(entry.normalizedSignedQuantity).toMatch(READ_DECIMAL);
    const src = await ok(api.getMovementSource('RECEIPT', entry.sourceId!));
    expect(src.lines[0].quantity).toMatch(READ_DECIMAL);
    expect(src.lines[0].normalizedReversedQuantity).toMatch(READ_DECIMAL);
  });

  it('gives the movement detail its record version', async () => {
    const entry = (await ok(api.listMovements(PAGE))).items[0];
    expect((await ok(api.getMovement(entry.id))).version).toBe(1);
  });
});

describe('inventory fake list filters (backend query params)', () => {
  it('filters movements by exact operation key and by item company profile', async () => {
    const entry = (await ok(api.listMovements(PAGE))).items[0];
    const byKey = await ok(api.listMovements({ ...PAGE, operationKey: entry.operationKey }));
    expect(byKey.items.every((e) => e.operationKey === entry.operationKey)).toBe(true);
    const byProfile = await ok(api.listMovements({ ...PAGE, itemCompanyProfileId: entry.itemCompanyProfileId }));
    expect(byProfile.total).toBeGreaterThan(0);
    expect(byProfile.items.every((e) => e.itemCompanyProfileId === entry.itemCompanyProfileId)).toBe(true);
  });

  it('filters balances by item company profile', async () => {
    const row = (await ok(api.listBalances(PAGE))).items[0];
    const page = await ok(api.listBalances({ ...PAGE, itemCompanyProfileId: row.itemCompanyProfileId }));
    expect(page.items.every((r) => r.itemCompanyProfileId === row.itemCompanyProfileId)).toBe(true);
  });

  it('filters branch nodes by status', async () => {
    const active = await ok(api.listNodes({ status: 'ACTIVE' }));
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((n) => n.status === 'ACTIVE')).toBe(true);
  });
});

describe('inventory fake availability (backend rules)', () => {
  it('rejects an item that does not track stock with 422 ITEM_NOT_STOCK_TRACKED', async () => {
    const err = await fail(api.getAvailability({ nodeId: 'node-wh-main', itemId: untrackedItemId() }));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED' });
  });

  it('requires a lot key for a LOT item and a serial key for a SERIAL item', async () => {
    const lot = await rowOfMode('LOT');
    const serial = await rowOfMode('SERIAL');
    for (const row of [lot, serial]) {
      const err = await fail(api.getAvailability({ nodeId: row.nodeId, itemId: row.itemId }));
      expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_REQUIRED' });
    }
  });

  it('rejects a lot key on an untracked-mode item with TRACKING_UNSUPPORTED', async () => {
    const row = await rowOfMode('NONE');
    const err = await fail(api.getAvailability({ nodeId: row.nodeId, itemId: row.itemId, lotKey: 'L-1' }));
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_UNSUPPORTED' });
  });

  it('matches the lot exactly and never converts units', async () => {
    const lot = await rowOfMode('LOT');
    const hit = await ok(api.getAvailability({ nodeId: lot.nodeId, itemId: lot.itemId, lotKey: lot.lotKey! }));
    expect(hit.onHandQuantity).toBe(lot.onHandQuantity);
    const other = foundation.TRADE_FAKE_DB.uoms.find((u) => u.id !== lot.uomId)!;
    const miss = await ok(
      api.getAvailability({ nodeId: lot.nodeId, itemId: lot.itemId, lotKey: lot.lotKey!, uomId: other.id }),
    );
    expect(miss).toMatchObject({ uomId: other.id, onHandQuantity: '0', availableQuantity: '0', version: 0 });
  });
});

describe('inventory fake opening balance (backend rules)', () => {
  it('rejects an operation key that is not a UUIDv7 and a quantity with leading zeros', async () => {
    const row = await rowOfMode('NONE');
    const nodeId = await newNode('OB-SHAPE');
    const badKey = await fail(api.recordOpeningBalance(openingBody(nodeId, row.itemId, { operationKey: 'op-1' }), key()));
    expect(badKey).toMatchObject({ status: 400, details: { operationKey: ['invalid'] } });
    const badQty = await fail(api.recordOpeningBalance(openingBody(nodeId, row.itemId, { quantity: '02' }), key()));
    expect(badQty).toMatchObject({ status: 400, details: { quantity: ['invalid'] } });
  });

  it('rejects an item that does not track stock with 422 ITEM_NOT_STOCK_TRACKED', async () => {
    const nodeId = await newNode('OB-UNTRACKED');
    const itemId = untrackedItemId();
    const item = foundation.TRADE_FAKE_DB.items.find((i) => i.id === itemId)!;
    const err = await fail(
      api.recordOpeningBalance(
        { ...openingBody(nodeId, (await rowOfMode('NONE')).itemId), itemId, uomId: item.baseUomId },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED' });
  });

  it('rejects an untrimmed lot key instead of trimming it', async () => {
    const lot = await rowOfMode('LOT');
    const nodeId = await newNode('OB-TRIM');
    const err = await fail(
      api.recordOpeningBalance(openingBody(nodeId, lot.itemId, { tracking: { lotKey: ' L-TRIM ' } }), key()),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_REQUIRED' });
  });

  it('rejects serial keys or a lot key on an item tracked another way with TRACKING_UNSUPPORTED', async () => {
    const lot = await rowOfMode('LOT');
    const none = await rowOfMode('NONE');
    const nodeId = await newNode('OB-UNSUP');
    const serialsOnLot = await fail(
      api.recordOpeningBalance(
        openingBody(nodeId, lot.itemId, { tracking: { lotKey: 'L-1', serialKeys: ['S-1', 'S-2'] } }),
        key(),
      ),
    );
    expect(serialsOnLot).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_UNSUPPORTED' });
    const lotOnNone = await fail(
      api.recordOpeningBalance(openingBody(nodeId, none.itemId, { tracking: { lotKey: 'L-1' } }), key()),
    );
    expect(lotOnNone).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_UNSUPPORTED' });
  });

  it('counts serial keys against the quantity as sent', async () => {
    const serial = await rowOfMode('SERIAL');
    const nodeId = await newNode('OB-SER');
    const err = await fail(
      api.recordOpeningBalance(
        openingBody(nodeId, serial.itemId, { quantity: '3', tracking: { serialKeys: ['OB-S1', 'OB-S2'] } }),
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_REQUIRED' });
  });

  it('returns the raw balance and ledger records', async () => {
    const serial = await rowOfMode('SERIAL');
    const nodeId = await newNode('OB-RAW');
    const res = await ok(
      api.recordOpeningBalance(
        openingBody(nodeId, serial.itemId, { tracking: { serialKeys: ['OB-R2', 'OB-R1'] } }),
        key(),
      ),
    );
    expect(res.balances.map((b) => b.serialKey)).toEqual(['OB-R1', 'OB-R2']);
    expect(res.balance).toEqual(res.balances[0]);
    expect(res.balances.every((b) => b.onHandQuantity === '1' && b.version === 1)).toBe(true);
    expect(res.ledger).toMatchObject({ movementType: 'OPENING_BALANCE', signedQuantity: '2', fulfillmentNodeId: nodeId });
    expect(res.ledger.tracking.serialUnits?.map((u) => u.serialKey)).toEqual(['OB-R1', 'OB-R2']);
    expect(res.ledger).not.toHaveProperty('itemCode');
  });
});
