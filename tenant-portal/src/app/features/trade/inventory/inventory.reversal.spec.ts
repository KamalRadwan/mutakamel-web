import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementSource } from './inventory.model';

type Api = typeof import('./inventory.api');

let api: Api;
let keyCounter = 0;

const PAGE = { page: 1, limit: 200 };
const NOW = '2026-11-21T10:00:00.000Z';
const REVERSE_AT = '2026-11-20T09:00:00.000Z';

function key(): string {
  keyCounter += 1;
  return `rk-${keyCounter}`;
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

async function loadSources(kind: 'RECEIPT' | 'DELIVERY'): Promise<MovementSource[]> {
  // Ids are discovered from the ledger so the spec does not depend on seed id spelling.
  const page = await ok(api.listMovements({ ...PAGE, sourceType: kind }));
  const ids = [...new Set(page.items.map((e) => e.sourceId).filter((id): id is string => !!id))].sort();
  const out: MovementSource[] = [];
  for (const id of ids) out.push(await ok(api.getMovementSource(kind, id)));
  return out;
}

async function pick(
  kind: 'RECEIPT' | 'DELIVERY',
  pred: (s: MovementSource) => boolean,
): Promise<MovementSource> {
  const found = (await loadSources(kind)).find(pred);
  if (!found) throw new Error(`no seeded ${kind} matches the predicate`);
  return found;
}

const hasSerials = (l: MovementSource['lines'][number]) => (l.tracking.serialKeys?.length ?? 0) > 0;
const untracked = (s: MovementSource) =>
  s.status === 'POSTED' && s.lines.every((l) => !l.tracking.lotKey && !hasSerials(l));
const isLot = (s: MovementSource) =>
  s.status === 'POSTED' && s.lines.every((l) => !!l.tracking.lotKey);
const availableSerials = (l: MovementSource['lines'][number]) =>
  (l.tracking.serialKeys ?? []).filter((k) => !l.reversedSerialKeys.includes(k));
const isSerial = (s: MovementSource) =>
  s.status !== 'REVERSED' && s.lines.some((l) => availableSerials(l).length > 0);
const serialLine = (s: MovementSource) => s.lines.find((l) => availableSerials(l).length > 0)!;

/** Receipt reversal of a serial needs the unit ON_HAND at the node (backend serial balance onHand 1, reserved 0). */
async function onHandSerialReceipt(min = 1) {
  const units = (await ok(api.listSerials({ ...PAGE, state: 'ON_HAND' }))).items;
  for (const src of await loadSources('RECEIPT')) {
    if (src.status === 'REVERSED') continue;
    for (const line of src.lines) {
      const keys = availableSerials(line).filter((k) =>
        units.some(
          (u) => u.itemId === line.itemId && u.serialKey === k && u.currentFulfillmentNodeId === src.fulfillmentNodeId,
        ),
      );
      if (keys.length >= min) return { src, line, keys };
    }
  }
  throw new Error('no seeded receipt has an ON_HAND serial');
}

function whole(reasonCode = 'OTHER') {
  return { reasonCode, businessEffectiveAt: REVERSE_AT };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  api = await import('./inventory.api');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('inventory fake reversal of whole documents', () => {
  it('seeds sources whose status matches their reversed quantities', async () => {
    for (const kind of ['RECEIPT', 'DELIVERY'] as const) {
      for (const s of await loadSources(kind)) {
        const anyReversed = s.lines.some((l) => Number(l.normalizedReversedQuantity) !== 0);
        expect(anyReversed).toBe(s.status !== 'POSTED');
      }
    }
  });

  it('reverses a whole receipt and marks it REVERSED with a bumped version', async () => {
    const src = await pick('RECEIPT', untracked);
    const done = await ok(
      api.reverseMovementSource('RECEIPT', src.id, src.version, whole('DAMAGED'), key()),
    );
    expect(done.status).toBe('REVERSED');
    expect(done.version).toBe(src.version + 1);
  });

  it('writes one negative reversal entry per receipt line', async () => {
    const src = await pick('RECEIPT', untracked);
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole('DAMAGED'), key()));
    const ledger = await ok(api.listMovements({ ...PAGE, sourceId: src.id }));
    const reversals = ledger.items.filter((e) => e.movementType === 'PURCHASE_RECEIPT_REVERSAL');
    expect(reversals.length).toBe(src.lines.length);
    for (const r of reversals) {
      expect(r.signedQuantity.startsWith('-')).toBe(true);
      expect(r.sourceType).toBe('RECEIPT_REVERSAL');
      expect(r.occurredAt).toBe(REVERSE_AT);
      expect(r.reversalOfId).not.toBeNull();
    }
  });

  it('writes positive reversal entries for a delivery', async () => {
    const src = await pick('DELIVERY', untracked);
    await ok(api.reverseMovementSource('DELIVERY', src.id, src.version, whole('WRONG_ITEM'), key()));
    const ledger = await ok(api.listMovements({ ...PAGE, sourceId: src.id }));
    const reversals = ledger.items.filter((e) => e.movementType === 'SALES_DELIVERY_REVERSAL');
    expect(reversals.length).toBe(src.lines.length);
    expect(
      reversals.every((e) => !e.signedQuantity.startsWith('-') && e.sourceType === 'DELIVERY_REVERSAL'),
    ).toBe(true);
  });

  it('shows base and reversal entries together under the matching sourceType filter', async () => {
    const src = await pick('RECEIPT', untracked);
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    const page = await ok(api.listMovements({ ...PAGE, sourceType: 'RECEIPT', sourceId: src.id }));
    expect(new Set(page.items.map((e) => e.sourceType))).toEqual(
      new Set(['RECEIPT', 'RECEIPT_REVERSAL']),
    );
  });

  it('exposes the reversal on the base movement detail and marks the source REVERSED', async () => {
    const src = await pick('RECEIPT', untracked);
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    const base = (await ok(api.listMovements({ ...PAGE, sourceId: src.id }))).items.find(
      (e) => e.movementType === 'PURCHASE_RECEIPT',
    )!;
    const detail = await ok(api.getMovement(base.id));
    expect(detail.reversals.length).toBe(1);
    expect(detail.source?.status).toBe('REVERSED');
  });

  it('lowers the on-hand balance by the reversed receipt quantity', async () => {
    const src = await pick('RECEIPT', untracked);
    const itemId = src.lines[0].itemId;
    const query = { ...PAGE, nodeId: src.fulfillmentNodeId, itemId };
    const before = (await ok(api.listBalances(query))).items[0];
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    const after = (await ok(api.listBalances(query))).items[0];
    const reversed = src.lines
      .filter((l) => l.itemId === itemId)
      .reduce((sum, l) => sum + Number(l.normalizedQuantity), 0);
    expect(Number(before.onHandQuantity) - Number(after.onHandQuantity)).toBe(reversed);
  });

  it('replays an identical reversal without a second ledger entry', async () => {
    const src = await pick('RECEIPT', untracked);
    const k = key();
    const first = await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), k));
    const count = (await ok(api.listMovements({ ...PAGE, sourceId: src.id }))).total;
    const second = await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), k));
    expect(second).toEqual(first);
    expect((await ok(api.listMovements({ ...PAGE, sourceId: src.id }))).total).toBe(count);
  });
});

describe('inventory fake reversal of partial lines', () => {
  it('records the reversed quantity on the line in the document unit', async () => {
    const src = await pick('RECEIPT', (s) => untracked(s) && Number(s.lines[0].quantity) >= 2);
    const line = src.lines[0];
    const result = await ok(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole('WRONG_QUANTITY'), lines: [{ lineId: line.id, quantity: '1' }] },
        key(),
      ),
    );
    const record = result.lines.find((l) => l.id === line.id)!;
    expect(record.reversedQuantity).toBe('1');
    // The base-unit part is proportional: 1 x normalizedQuantity / quantity.
    expect(Number(record.normalizedReversedQuantity)).toBe(
      Number(line.normalizedQuantity) / Number(line.quantity),
    );
  });

  it('returns the raw records without read-projection display fields', async () => {
    const src = await pick('RECEIPT', untracked);
    const result = await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    expect(result).toMatchObject({ id: src.id, purchaseOrderId: src.documentId, status: 'REVERSED' });
    expect(result).not.toHaveProperty('nodeCode');
    expect(result).not.toHaveProperty('documentNumber');
    expect(result.lines[0]).toMatchObject({ receiptId: src.id, purchaseOrderLineId: src.lines[0].documentLineId });
    expect(result.lines[0]).not.toHaveProperty('itemCode');
  });

  it('leaves the source PARTIALLY_REVERSED while quantity remains', async () => {
    const src = await pick('RECEIPT', (s) => untracked(s) && Number(s.lines[0].normalizedQuantity) >= 2);
    const line = src.lines[0];
    const result = await ok(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole('WRONG_QUANTITY'), lines: [{ lineId: line.id, quantity: '1' }] },
        key(),
      ),
    );
    expect(result.status).toBe('PARTIALLY_REVERSED');
  });

  it('rejects reversing more than the line quantity with QUANTITY_INVALID', async () => {
    const src = await pick('RECEIPT', untracked);
    const line = src.lines[0];
    const over = String(Number(line.quantity) + 1);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: over }] },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.QUANTITY_INVALID' });
  });

  it('rejects reversing more than the remaining quantity', async () => {
    const src = await pick('RECEIPT', (s) => untracked(s) && Number(s.lines[0].quantity) >= 2);
    const line = src.lines[0];
    const first = await ok(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: '1' }] },
        key(),
      ),
    );
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        first.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: String(Number(line.quantity)) }] },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 409, code: 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED' });
  });

  it('rejects a quantity with leading zeros', async () => {
    const src = await pick('RECEIPT', untracked);
    const line = src.lines[0];
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: '01' }] },
        key(),
      ),
    );
    // POSITIVE_DECIMAL_16_8 has no leading zeros: transport validation, 400.
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('rejects a zero, negative or malformed reverse quantity', async () => {
    const src = await pick('RECEIPT', untracked);
    const line = src.lines[0];
    for (const quantity of ['0', '-1', 'abc']) {
      const err = await fail(
        api.reverseMovementSource(
          'RECEIPT',
          src.id,
          src.version,
          { ...whole(), lines: [{ lineId: line.id, quantity }] },
          key(),
        ),
      );
      expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
    }
  });

  it('rejects an empty lines array', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, { ...whole(), lines: [] }, key()),
    );
    // ReverseMovementDto: @ArrayMinSize(1).
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('rejects an unknown line id', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: 'nope', quantity: '1' }] },
        key(),
      ),
    );
    expect(err.code).toBe('TRADE.INVENTORY.REVERSAL_NOT_ALLOWED');
  });

  it('rejects a duplicate line id in one request', async () => {
    const src = await pick('RECEIPT', untracked);
    const line = src.lines[0];
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        {
          ...whole(),
          lines: [
            { lineId: line.id, quantity: '1' },
            { lineId: line.id, quantity: '1' },
          ],
        },
        key(),
      ),
    );
    // assertUnique(lineIds, INVENTORY_REVERSAL_NOT_ALLOWED) runs before the work.
    expect(err).toMatchObject({ status: 409, code: 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED' });
  });

  it('rejects reversing a source that is already fully reversed', async () => {
    const src = await pick('RECEIPT', untracked);
    const done = await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, done.version, whole(), key()),
    );
    expect(err).toMatchObject({ status: 409, code: 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED' });
  });
});

describe('inventory fake reversal guards', () => {
  it('rejects a stale source version', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version + 5, whole(), key()),
    );
    expect(err).toMatchObject({ status: 409, code: 'TRADE.CONCURRENCY.STALE_VERSION' });
  });

  it('rejects an unknown source', async () => {
    const err = await fail(api.reverseMovementSource('DELIVERY', 'nope', 1, whole(), key()));
    expect(err.code).toBe('TRADE.INVENTORY.DELIVERY_NOT_FOUND');
  });

  it('rejects a reason code of another kind', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, whole('MONTH_END_CLOSE'), key()),
    );
    expect(err.code).toBe('TRADE.REASON.KIND_INVALID');
  });

  it('rejects an unknown reason code', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, whole('NOPE'), key()),
    );
    expect(err.code).toBe('TRADE.REASON.NOT_FOUND');
  });

  it('rejects an effective date before the original document before the version and period checks', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version + 99,
        { reasonCode: 'OTHER', businessEffectiveAt: '2026-10-15T09:00:00.000Z' },
        key(),
      ),
    );
    expect(err).toMatchObject({
      status: 409,
      code: 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED',
      details: { reason: ['reversal_before_original'] },
    });
  });

  it('rejects an effective date in the future', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { reasonCode: 'OTHER', businessEffectiveAt: '2026-11-25T09:00:00.000Z' },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 409, details: { reason: ['future_date'] } });
  });

  it('rejects a source that is no longer POSTED or PARTIALLY_REVERSED', async () => {
    const src = await pick('RECEIPT', untracked);
    const done = await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    expect(done.status).toBe('REVERSED');
    const err = await fail(api.reverseMovementSource('RECEIPT', src.id, done.version, whole(), key()));
    expect(err).toMatchObject({ status: 409, code: 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED' });
  });

  it('rejects serial keys on a line whose item is not serial-tracked', async () => {
    const src = await pick('RECEIPT', untracked);
    const line = src.lines[0];
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: '1', serialKeys: ['SN-X'] }] },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_UNSUPPORTED' });
  });

  it('rejects an effective date older than the backdate limit', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { reasonCode: 'OTHER', businessEffectiveAt: '2026-11-10T09:00:00.000Z' },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 409, details: { reason: ['backdate_limit'] } });
  });

  it('rejects an unparsable effective date', async () => {
    const src = await pick('RECEIPT', untracked);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { reasonCode: 'OTHER', businessEffectiveAt: 'yesterday' },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
  });

  it('blocks reversal while the period is closed and allows it after reopen', async () => {
    const src = await pick('RECEIPT', untracked);
    await ok(api.closePeriod('per-2026-11', 1, 'MONTH_END_CLOSE', key()));
    const blocked = await fail(
      api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()),
    );
    expect(blocked.details).toEqual({ reason: ['period_closed'] });
    await ok(api.reopenPeriod('per-2026-11', 2, 'LATE_DOCUMENT', key()));
    const done = await ok(
      api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()),
    );
    expect(done.status).toBe('REVERSED');
  });
});

describe('inventory fake reversal with LOT tracking', () => {
  it('keeps the lot key on every reversal entry', async () => {
    const src = await pick('RECEIPT', isLot);
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    const ledger = await ok(api.listMovements({ ...PAGE, sourceId: src.id, group: 'REVERSAL' }));
    const lots = new Set(src.lines.map((l) => l.tracking.lotKey));
    expect(ledger.items.length).toBe(src.lines.length);
    expect(ledger.items.every((e) => lots.has(e.tracking.lotKey))).toBe(true);
  });

  it('lowers the matching lot balance', async () => {
    const src = await pick('RECEIPT', isLot);
    const lot = src.lines[0].tracking.lotKey!;
    const query = { ...PAGE, nodeId: src.fulfillmentNodeId, lotKey: lot };
    const before = (await ok(api.listBalances(query))).items[0];
    await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, whole(), key()));
    const after = (await ok(api.listBalances(query))).items[0];
    expect(Number(after.onHandQuantity)).toBeLessThan(Number(before.onHandQuantity));
  });
});

describe('inventory fake reversal with SERIAL tracking', () => {
  it('requires serial keys when reversing a serial line by quantity', async () => {
    const src = await pick('RECEIPT', isSerial);
    const line = serialLine(src);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: '1' }] },
        key(),
      ),
    );
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_REQUIRED' });
  });

  it('rejects a serial key count that differs from the quantity', async () => {
    const src = await pick('RECEIPT', isSerial);
    const line = serialLine(src);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        {
          ...whole(),
          lines: [{ lineId: line.id, quantity: '1', serialKeys: availableSerials(line).slice(0, 2) }],
        },
        key(),
      ),
    );
    expect(err.code).toBe('TRADE.INVENTORY.TRACKING_REQUIRED');
  });

  it('rejects a fractional quantity on a serial line', async () => {
    const src = await pick('RECEIPT', isSerial);
    const line = serialLine(src);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: '0.5', serialKeys: [] }] },
        key(),
      ),
    );
    expect(err.code).toBe('TRADE.INVENTORY.TRACKING_REQUIRED');
  });

  it('rejects a serial key that is not on the line', async () => {
    const src = await pick('RECEIPT', isSerial);
    const line = serialLine(src);
    const err = await fail(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole(), lines: [{ lineId: line.id, quantity: '1', serialKeys: ['NOT-A-SERIAL'] }] },
        key(),
      ),
    );
    // selectSerialKeys: a key outside the remaining set is TRACKING_REQUIRED.
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_REQUIRED' });
  });

  it('voids the serial unit on receipt reversal', async () => {
    const { src, line, keys } = await onHandSerialReceipt();
    const serial = keys[0];
    await ok(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole('DAMAGED'), lines: [{ lineId: line.id, quantity: '1', serialKeys: [serial] }] },
        key(),
      ),
    );
    const unit = (await ok(api.listSerials({ ...PAGE, serialKey: serial }))).items[0];
    expect(unit.state).toBe('VOIDED');
  });

  it('appends a RECEIPT_REVERSAL lifecycle event to the serial', async () => {
    const { src, line, keys } = await onHandSerialReceipt();
    const serial = keys[0];
    await ok(
      api.reverseMovementSource(
        'RECEIPT',
        src.id,
        src.version,
        { ...whole('DAMAGED'), lines: [{ lineId: line.id, quantity: '1', serialKeys: [serial] }] },
        key(),
      ),
    );
    const unit = (await ok(api.listSerials({ ...PAGE, serialKey: serial }))).items[0];
    const detail = await ok(api.getSerial(unit.id));
    expect(detail.lifecycle.at(-1)).toMatchObject({
      eventType: 'RECEIPT_REVERSAL',
      sourceType: 'RECEIPT_REVERSAL',
      sourceId: src.id,
      toState: 'VOIDED',
    });
  });

  it('rejects reversing the same serial key twice', async () => {
    const { src, line, keys } = await onHandSerialReceipt(2);
    const body = {
      ...whole('DAMAGED'),
      lines: [{ lineId: line.id, quantity: '1', serialKeys: [keys[0]] }],
    };
    const first = await ok(api.reverseMovementSource('RECEIPT', src.id, src.version, body, key()));
    const err = await fail(api.reverseMovementSource('RECEIPT', src.id, first.version, body, key()));
    // The reversed key left the remaining set: selectSerialKeys rejects it.
    expect(err).toMatchObject({ status: 422, code: 'TRADE.INVENTORY.TRACKING_REQUIRED' });
  });
});
