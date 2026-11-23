import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { getMovementSource, reverseMovementSource } from './inventory.api';

const ctx = { companyId: 'c1', branchId: 'b1' };
const body = {
  reasonCode: 'OTHER', businessEffectiveAt: '2026-11-23T10:00:00.000Z',
  lines: [{ lineId: 'line-1', quantity: '0.12345678', serialKeys: ['S1'] }],
};

describe('inventory reversal linked contracts', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;
  beforeEach(() => { stub = new TradeHttpStub(); dispose = bindTradeHttpForTest(stub); });
  afterEach(() => dispose());

  for (const kind of ['RECEIPT', 'DELIVERY'] as const) {
    const path = '/inventory/' + (kind === 'RECEIPT' ? 'receipts' : 'deliveries') + '/source%2F1';
    it(kind + ' reads the source version and posts exact decimal quantities, serials and reason', async () => {
      const source = { id: 'source/1', kind, version: 5, lines: [{ id: 'line-1', quantity: '0.12345678' }] };
      const reversed = { id: source.id, version: 6, status: 'REVERSED', lines: [] };
      stub.register('GET', path, source).register('POST', path + '/reverse', reversed);
      const latest = await getMovementSource(kind, source.id, ctx);
      const key = newIdempotencyKey();
      expect(await reverseMovementSource(kind, latest.id, latest.version, body, key, ctx)).toEqual(reversed);
      expect(stub.recordedWrites()).toEqual([{
        method: 'POST', path: path + '/reverse', body, key, ifMatch: '"5"', scope: ctx, query: undefined,
      }]);
    });

    for (const [status, code, details] of [
      [409, 'TRADE.CONCURRENCY.STALE_VERSION', { version: ['stale'] }],
      [422, 'TRADE.REASON.KIND_INVALID', { reasonCode: ['invalid'] }],
      [409, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY', { quantity: ['insufficient'] }],
      [422, 'TRADE.INVENTORY.ITEM_TRACKING_CONFLICT', { serialKeys: ['invalid'] }],
      [422, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['period_closed'] }],
      [403, 'TRADE.AUTH.TARGET_DENIED', {}],
    ] as const) {
      it(kind + ' preserves ' + code + ' without retrying', async () => {
        const error = new ApiError(status, code, Object.fromEntries(
          Object.entries(details).map(([field, messages]) => [field, [...messages]]),
        ));
        stub.register('POST', path + '/reverse', error);
        await expect(reverseMovementSource(kind, 'source/1', 5, body, newIdempotencyKey(), ctx)).rejects.toBe(error);
        expect(stub.recordedWrites()).toHaveLength(1);
      });
    }

    it(kind + ' omits optional lines for a whole reversal and strips UI-only fields', async () => {
      stub.register('POST', path + '/reverse', { id: 'source/1', version: 6 });
      await reverseMovementSource(kind, 'source/1', 5, { ...body, lines: undefined, note: 'UI only' } as never, newIdempotencyKey(), ctx);
      expect(stub.recordedWrites()[0].body).toEqual({ reasonCode: body.reasonCode, businessEffectiveAt: body.businessEffectiveAt });
    });
  }

  it('reuses a caller key for the same retry body and accepts a successful replay', async () => {
    const path = '/inventory/receipts/r1/reverse';
    const result = { id: 'r1', status: 'REVERSED', version: 6 };
    stub.register('POST', path, result);
    const key = newIdempotencyKey();
    expect(await reverseMovementSource('RECEIPT', 'r1', 5, body, key, ctx)).toEqual(result);
    expect(await reverseMovementSource('RECEIPT', 'r1', 5, body, key, ctx)).toEqual(result);
    expect(stub.recordedWrites().map((write) => ({ key: write.key, body: write.body }))).toEqual([{ key, body }, { key, body }]);
  });
});
