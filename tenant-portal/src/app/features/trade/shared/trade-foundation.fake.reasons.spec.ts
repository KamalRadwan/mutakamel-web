import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REASON_KINDS } from './reasons/reason-kinds';
import { ApiError, newIdempotencyKey } from './trade-api';
import { countReasons, createReason, deleteReason, listReasonsAdmin, updateReason } from './reasons/reasons-admin.api';
import { bindTradeHttpForTest } from './trade-http';
import { TradeHttpStub } from './testing/trade-http-testing';

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
  let stub: TradeHttpStub;
  let dispose: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });
  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  it('POST propagates DTO, kind and conflict errors and validates the request key locally', async () => {
    const names = { en: 'Spec', ar: 'اختبار' };
    stub.register('POST', '/reason-codes', new ApiError(400, 'TRADE.VALIDATION_FAILED'));
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'lower', localizedNames: names }, newIdempotencyKey())))
      .toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'SPEC_A', localizedNames: names }, '')))
      .toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'SPEC_A', localizedNames: names }, 'k1')))
      .toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });
    stub.register('POST', '/reason-codes', new ApiError(422, 'TRADE.REASON.KIND_INVALID', { field: ['kind'] }));
    // @ts-expect-error Exercise invalid runtime input outside the contract union.
    expect(await settleError(createReason({ kind: 'NOPE', code: 'SPEC_A', localizedNames: names }, newIdempotencyKey())))
      .toMatchObject({ status: 422, code: 'TRADE.REASON.KIND_INVALID', details: { field: ['kind'] } });
    stub.register('POST', '/reason-codes', new ApiError(409, 'TRADE.REASON.CODE_TAKEN', { field: ['code'] }));
    expect(await settleError(createReason({ kind: 'DOCUMENT_HOLD', code: 'OTHER', localizedNames: names }, newIdempotencyKey())))
      .toMatchObject({ status: 409, code: 'TRADE.REASON.CODE_TAKEN', details: { field: ['code'] } });
  });

  it('POST receives server defaults, preserves the replay key, then PATCHes and DELETEs with concurrency headers', async () => {
    const key = newIdempotencyKey();
    const input = { kind: 'DOCUMENT_HOLD' as const, code: 'SPEC_B', localizedNames: { en: ' Spec B ', ar: 'اختبار' } };
    stub.register('POST', '/reason-codes', {
      ...input, id: 'spec-b', localizedNames: { en: 'Spec B', ar: 'اختبار' },
      requiresNote: false, isActive: true, sortOrder: 0, isSystem: false, version: 1,
      updatedAt: '2026-11-23T10:00:00.000Z',
    });
    const created = await settle(createReason(input, key));
    expect(stub.recordedWrites()[0]).toMatchObject({ body: input, key });
    expect(created).toMatchObject({ requiresNote: false, isActive: true, sortOrder: 0, isSystem: false, version: 1 });
    expect(created.localizedNames).toEqual({ en: 'Spec B', ar: 'اختبار' });
    expect((await settle(createReason(input, key))).id).toBe(created.id);
    expect(stub.recordedWrites().map((write) => write.key)).toEqual([key, key]);
    stub.register('POST', '/reason-codes', new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH'));
    expect(await settleError(createReason({ ...input, sortOrder: 5 }, key)))
      .toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.MISMATCH' });

    stub.register('PATCH', `/reason-codes/${created.id}`, new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED'));
    expect(await settleError(updateReason(created.id, 0, { sortOrder: 1 })))
      .toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });
    stub.register('PATCH', `/reason-codes/${created.id}`, new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
    expect(await settleError(updateReason(created.id, 9, { sortOrder: 1 })))
      .toMatchObject({ status: 409, code: 'TRADE.CONCURRENCY.STALE_VERSION' });
    stub.register('PATCH', '/reason-codes/missing', new ApiError(422, 'TRADE.REASON.NOT_FOUND', { field: ['id'] }));
    expect(await settleError(updateReason('missing', 1, {})))
      .toMatchObject({ status: 422, code: 'TRADE.REASON.NOT_FOUND', details: { field: ['id'] } });
    stub.register('PATCH', `/reason-codes/${created.id}`, { ...created, sortOrder: 10, version: 2 });
    const updated = await settle(updateReason(created.id, 1, { sortOrder: 10 }));
    expect(stub.recordedWrites().at(-1)).toMatchObject({ method: 'PATCH', ifMatch: '"1"', body: { sortOrder: 10 } });
    expect(updated).toMatchObject({ sortOrder: 10, version: 2 });

    stub.register('DELETE', `/reason-codes/${created.id}`, { ...updated, isActive: false, version: 3 });
    stub.register('GET', '/reason-codes', { items: [] });
    const deleted = await settle(deleteReason(created.id, 2));
    expect(stub.recordedWrites().at(-1)).toMatchObject({ method: 'DELETE', ifMatch: '"2"' });
    expect(deleted).toMatchObject({ id: created.id, version: 3 });
    expect((await settle(listReasonsAdmin('DOCUMENT_HOLD', true))).some((r) => r.id === created.id)).toBe(false);
  });

  it('system reasons cannot be turned off or deleted: 409 SYSTEM_IMMUTABLE with details.field isSystem', async () => {
    const other = { id: 'document-hold-other', version: 1 };
    const counts = {
      total: 1,
      byKind: Object.fromEntries(REASON_KINDS.map((kind) => [kind, kind === 'DOCUMENT_HOLD' ? 1 : 0])),
    };
    const immutable = new ApiError(409, 'TRADE.REASON.SYSTEM_IMMUTABLE', { field: ['isSystem'] });
    stub.register('PATCH', `/reason-codes/${other.id}`, immutable);
    stub.register('DELETE', `/reason-codes/${other.id}`, immutable);
    stub.register('GET', '/reason-codes/counts', counts);
    expect(await settleError(updateReason(other.id, other.version, { isActive: false })))
      .toMatchObject({ status: 409, code: 'TRADE.REASON.SYSTEM_IMMUTABLE', details: { field: ['isSystem'] } });
    expect(await settleError(deleteReason(other.id, other.version)))
      .toMatchObject({ status: 409, code: 'TRADE.REASON.SYSTEM_IMMUTABLE', details: { field: ['isSystem'] } });
    expect((await settle(countReasons())).total).toBe(counts.total);
  });
});
