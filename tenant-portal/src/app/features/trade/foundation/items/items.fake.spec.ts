import { describe, expect, it } from 'vitest';
import { countItemsByStatus } from './items.api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';

describe('items API status counts', () => {
  it('strips list-only sort and direction and maps total to ALL', async () => {
    const expected = { total: 10, DRAFT: 1, ACTIVE: 5, INACTIVE: 3, DISCONTINUED: 1 };
    const stub = new TradeHttpStub({ 'GET /items/status-counts': expected });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const { total, ...byStatus } = expected;
      await expect(countItemsByStatus({}, { sort: 'name', direction: 'asc' })).resolves.toEqual({ ...byStatus, ALL: total });
      expect(stub.recordedReads()[0]?.query).toBeUndefined();
    } finally {
      dispose();
    }
  });
});
