import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REASON_AREAS, REASON_CODE_PATTERN, REASON_KINDS, REASON_NAME_MAX } from './reasons/reason-kinds';
import { ApiError, newIdempotencyKey } from './trade-api';
import { TRADE_FAKE_DB, fakeCountReasonCodes, fakeListReasonCodes } from './trade-foundation.fake';
import { countReasons, createReason, deleteReason, listReasonsAdmin, updateReason } from './reasons/reasons-admin.api';

// Snapshot of the Foundation seed before any feature module can append its own kinds.
const SEEDED = TRADE_FAKE_DB.reasons.slice();
const SEEDED_KINDS = [...new Set(SEEDED.map((r) => r.kind))];

// Backend TradeReasonKind (trade.enums.ts): 25 kinds, DOCUMENT_DISCOUNT included.
const FOUNDATION_KINDS = [
  'CATEGORY_STATUS',
  'CATEGORY_DELETE',
  'ACCOUNT_BLOCK',
  'ACCOUNT_UNBLOCK',
  'ITEM_DISCONTINUE',
  'DOCUMENT_CANCEL',
  'QUOTATION_REJECT',
  'DOCUMENT_HOLD',
  'DOCUMENT_HOLD_RELEASE',
  'DOCUMENT_DISCOUNT',
  'PURCHASE_ORDER_REJECT',
  'INVENTORY_PERIOD_CLOSE',
  'INVENTORY_PERIOD_REOPEN',
  'INVENTORY_UOM_PUBLISH',
  'INVENTORY_UOM_RETIRE',
  'INVENTORY_REVERSAL',
  'PRICE_VERSION_RETIRE',
  'POLICY_VERSION_REJECT',
  'WORKFLOW_VERSION_REJECT',
  'POLICY_VERSION_RETIRE',
  'WORKFLOW_VERSION_RETIRE',
  'POLICY_VERSION_ROLLBACK',
  'WORKFLOW_VERSION_ROLLBACK',
  'WEBHOOK_DELIVERY_RETRY',
  'CONTROL_TOWER_RESOLVE',
];

describe('TRADE_FAKE_DB.reasons seed', () => {
  it('seeds exactly the backend TradeReasonKind kinds', () => {
    expect([...SEEDED_KINDS].sort()).toEqual([...FOUNDATION_KINDS].sort());
    expect(SEEDED.length).toBe(98);
  });

  it('uses only kinds from the shared REASON_KINDS catalogue, each in one area', () => {
    const known = new Set<string>(REASON_KINDS);
    for (const kind of SEEDED_KINDS) {
      expect(known.has(kind)).toBe(true);
      const areas = Object.entries(REASON_AREAS).filter(([, kinds]) => kinds.includes(kind));
      expect(areas.length).toBe(1);
    }
  });

  it('puts every INVENTORY_* kind in the inventory area', () => {
    for (const kind of SEEDED_KINDS.filter((k) => k.startsWith('INVENTORY_'))) {
      expect(REASON_AREAS.inventory).toContain(kind);
    }
  });

  it('requires a note only for OTHER on non-INVENTORY kinds (requiresNote = isOther && kind not INVENTORY_*)', () => {
    for (const reason of SEEDED) {
      const expected = reason.code === 'OTHER' && !reason.kind.startsWith('INVENTORY_');
      expect({ id: reason.id, requiresNote: reason.requiresNote }).toEqual({ id: reason.id, requiresNote: expected });
    }
  });

  it('never requires a note on any INVENTORY_* reason, OTHER included', () => {
    const inventory = SEEDED.filter((r) => r.kind.startsWith('INVENTORY_'));
    expect(inventory.length).toBe(21);
    expect(inventory.some((r) => r.requiresNote)).toBe(false);
    expect(inventory.filter((r) => r.code === 'OTHER').length).toBe(5);
  });

  it('gives every kind exactly one OTHER, which is the only system reason', () => {
    for (const kind of SEEDED_KINDS) {
      const rows = SEEDED.filter((r) => r.kind === kind);
      const others = rows.filter((r) => r.code === 'OTHER');
      expect(others.length).toBe(1);
      expect(others[0].isSystem).toBe(true);
      expect(rows.filter((r) => r.isSystem).map((r) => r.code)).toEqual(['OTHER']);
    }
  });

  it('places OTHER last within its kind', () => {
    for (const kind of SEEDED_KINDS) {
      const rows = SEEDED.filter((r) => r.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
      expect(rows[rows.length - 1].code).toBe('OTHER');
    }
  });

  it('seeds every reason as active at version 1', () => {
    expect(SEEDED.every((r) => r.isActive)).toBe(true);
    expect(SEEDED.every((r) => r.version === 1)).toBe(true);
  });

  it('builds unique ids of the form rsn-<kind>-<code> in lower case', () => {
    const ids = SEEDED.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reason of SEEDED) {
      expect(reason.id).toBe(`rsn-${reason.kind.toLowerCase()}-${reason.code.toLowerCase()}`);
    }
  });

  it('keeps codes unique per kind but lets the same code appear in several kinds', () => {
    for (const kind of SEEDED_KINDS) {
      const codes = SEEDED.filter((r) => r.kind === kind).map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
    const priceNotAccepted = SEEDED.filter((r) => r.code === 'PRICE_NOT_ACCEPTED').map((r) => r.kind);
    expect(priceNotAccepted.sort()).toEqual(['DOCUMENT_CANCEL', 'PURCHASE_ORDER_REJECT', 'QUOTATION_REJECT']);
  });

  it('numbers sortOrder per kind in steps of 1024 starting at 1024', () => {
    for (const kind of SEEDED_KINDS) {
      const orders = SEEDED.filter((r) => r.kind === kind).map((r) => r.sortOrder);
      expect(orders).toEqual(orders.map((_, i) => (i + 1) * 1024));
    }
  });

  it('uses valid codes and non-empty English and Arabic names within the length limit', () => {
    for (const reason of SEEDED) {
      expect(reason.code).toMatch(REASON_CODE_PATTERN);
      const en = reason.localizedNames['en'] ?? '';
      const ar = reason.localizedNames['ar'] ?? '';
      expect(en.trim().length).toBeGreaterThan(0);
      expect(ar.trim().length).toBeGreaterThan(0);
      expect(en.length).toBeLessThanOrEqual(REASON_NAME_MAX);
      expect(ar.length).toBeLessThanOrEqual(REASON_NAME_MAX);
      expect(ar).toMatch(/[؀-ۿ]/);
    }
  });
});

async function settle<T>(promise: Promise<T>): Promise<T> {
  const caught = promise.catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(1000);
  const result = await caught;
  if (result instanceof Error) throw result;
  return result as T;
}

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  const caught = promise.then(
    () => null,
    (e: unknown) => e,
  );
  await vi.advanceTimersByTimeAsync(1000);
  const result = await caught;
  expect(result).toBeInstanceOf(ApiError);
  return result as ApiError;
}

describe('reason-codes endpoints (backend TradeReasonsController / TradeReasonsAdminService)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('GET /reason-codes returns { items }, active only by default, ordered by sortOrder, code, kind', () => {
    const body = fakeListReasonCodes({ kind: 'DOCUMENT_HOLD' });
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items.map((r) => r.code)).toEqual(['CREDIT_REVIEW', 'CUSTOMER_REQUEST', 'STOCK_ISSUE', 'OTHER']);
    const all = fakeListReasonCodes();
    expect(all.items.length).toBe(TRADE_FAKE_DB.reasons.filter((r) => r.isActive).length);
  });

  it('GET /reason-codes with an unknown kind is 422 KIND_INVALID with details.field kind', () => {
    try {
      fakeListReasonCodes({ kind: 'NOPE' });
      throw new Error('expected an error');
    } catch (error) {
      expect(error).toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID', details: { field: ['kind'] } });
    }
  });

  it('GET /reason-codes/counts includes inactive by default and lists every kind', () => {
    const counts = fakeCountReasonCodes();
    expect(Object.keys(counts.byKind).sort()).toEqual([...REASON_KINDS].sort());
    expect(counts.total).toBe(Object.values(counts.byKind).reduce((a, b) => a + b, 0));
  });

  it('POST validates the DTO first, then the key (400 KEY_MISSING / 422 KEY_REQUIRED), then the kind', async () => {
    const names = { en: 'Spec', ar: 'اختبار' };
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'lower', localizedNames: names }, newIdempotencyKey())))
      .toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'SPEC_A', localizedNames: names }, '')))
      .toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'SPEC_A', localizedNames: names }, 'k1')))
      .toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });
    expect(await settleError(createReason({ kind: 'NOPE', code: 'SPEC_A', localizedNames: names }, newIdempotencyKey())))
      .toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID', details: { field: ['kind'] } });
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'OTHER', localizedNames: names }, newIdempotencyKey())))
      .toMatchObject({ status: 409, code: 'TRADE.REASON.CODE_TAKEN', details: { field: ['code'] } });
  });

  it('POST defaults requiresNote false, isActive true, sortOrder 0, replays the same key, then PATCH and DELETE', async () => {
    const key = newIdempotencyKey();
    const input = { kind: 'DOCUMENT_HOLD', code: 'SPEC_B', localizedNames: { en: ' Spec B ', ar: 'اختبار' } };
    const created = await settle(createReason(input, key));
    expect(created).toMatchObject({ requiresNote: false, isActive: true, sortOrder: 0, isSystem: false, version: 1 });
    expect(created.localizedNames).toEqual({ en: 'Spec B', ar: 'اختبار' });
    expect((await settle(createReason(input, key))).id).toBe(created.id);
    expect(await settleError(createReason({ ...input, sortOrder: 5 }, key)))
      .toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.MISMATCH' });

    expect(await settleError(updateReason(created.id, 0, { sortOrder: 1 })))
      .toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });
    expect(await settleError(updateReason(created.id, 9, { sortOrder: 1 })))
      .toMatchObject({ status: 409, code: 'TRADE.CONCURRENCY.STALE_VERSION' });
    expect(await settleError(updateReason('missing', 1, {})))
      .toMatchObject({ status: 422, code: 'TRADE.REASON.NOT_FOUND', details: { field: ['id'] } });
    const updated = await settle(updateReason(created.id, 1, { sortOrder: 10 }));
    expect(updated).toMatchObject({ sortOrder: 10, version: 2 });

    const deleted = await settle(deleteReason(created.id, 2));
    expect(deleted).toMatchObject({ id: created.id, version: 3 });
    expect((await settle(listReasonsAdmin('DOCUMENT_HOLD', true))).some((r) => r.id === created.id)).toBe(false);
  });

  it('system reasons cannot be turned off or deleted: 409 SYSTEM_IMMUTABLE with details.field isSystem', async () => {
    const other = TRADE_FAKE_DB.reasons.find((r) => r.kind === 'DOCUMENT_HOLD' && r.code === 'OTHER')!;
    expect(await settleError(updateReason(other.id, other.version, { isActive: false })))
      .toMatchObject({ status: 409, code: 'TRADE.REASON.SYSTEM_IMMUTABLE', details: { field: ['isSystem'] } });
    expect(await settleError(deleteReason(other.id, other.version)))
      .toMatchObject({ status: 409, code: 'TRADE.REASON.SYSTEM_IMMUTABLE', details: { field: ['isSystem'] } });
    expect((await settle(countReasons())).total).toBe(TRADE_FAKE_DB.reasons.length);
  });
});
