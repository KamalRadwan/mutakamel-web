import { ApiError } from '../../../shared/trade-api';
import { toItemBulkFilter } from './item-bulk.model';
import { validateQueryChannel } from './items-bulk.fake-module';

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.code : 'UNEXPECTED';
  }
}

describe('items bulk QUERY channelId', () => {
  it('adds channelId only for a POS-purpose list filter', () => {
    expect(toItemBulkFilter({ purpose: 'POS', search: 'a' }, 'ch-c1-pos')).toEqual({
      purpose: 'POS',
      search: 'a',
      channelId: 'ch-c1-pos',
    });
    expect(toItemBulkFilter({ purpose: 'SALES' }, 'ch-c1-pos')).toEqual({ purpose: 'SALES' });
    expect(toItemBulkFilter({ purpose: 'POS' }, '  ')).toEqual({ purpose: 'POS' });
    expect(toItemBulkFilter({ purpose: 'SALES', channelId: 'stale' })).toEqual({ purpose: 'SALES' });
  });

  it('rejects a POS-purpose query without channelId', () => {
    expect(codeOf(() => validateQueryChannel({ companyId: 'c1' }, { purpose: 'POS' }))).toBe(
      'TRADE.CATALOG.CHANNEL_INVALID',
    );
  });

  it('accepts an active POS channel of the company linked to the branch', () => {
    const filter = { purpose: 'POS', channelId: 'ch-c1-pos' };
    expect(codeOf(() => validateQueryChannel({ companyId: 'c1' }, filter))).toBeNull();
    expect(codeOf(() => validateQueryChannel({ companyId: 'c1', branchId: 'b1' }, filter))).toBeNull();
  });

  it('rejects a foreign, non-POS or unlinked channel', () => {
    const invalid = 'TRADE.CATALOG.CHANNEL_INVALID';
    expect(codeOf(() => validateQueryChannel({ companyId: 'c2' }, { purpose: 'POS', channelId: 'ch-c1-pos' }))).toBe(
      invalid,
    );
    expect(codeOf(() => validateQueryChannel({ companyId: 'c1' }, { purpose: 'POS', channelId: 'ch-c1-web' }))).toBe(
      invalid,
    );
    expect(
      codeOf(() => validateQueryChannel({ companyId: 'c1', branchId: 'b2' }, { channelId: 'ch-c1-web' })),
    ).toBe(invalid);
  });

  it('leaves queries without purpose POS or channelId alone', () => {
    expect(codeOf(() => validateQueryChannel({ companyId: 'c1' }, { purpose: 'SALES' }))).toBeNull();
  });
});
