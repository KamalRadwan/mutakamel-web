import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listUserCallLogs, toCallLogTypeParam } from './staff-phone.api';
import { resetStaffPhoneFake } from './staff-phone.fake';

describe('staff-phone.api contract (Core webphone)', () => {
  beforeEach(() => resetStaffPhoneFake());
  afterEach(() => resetStaffPhoneFake());

  it('returns the paged { data, meta } body for users/:userId/call-logs without another envelope', async () => {
    const result = await listUserCallLogs('u-owner', { page: 2, limit: 10 });
    expect(Object.keys(result).sort()).toEqual(['data', 'meta']);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: expect.any(Number) });
    expect(result.data).toHaveLength(10);
  });

  it('filters by the comma-list `type` query', async () => {
    const type = toCallLogTypeParam(['IN_NOANS', 'OUT_BUSY']);
    expect(type).toBe('IN_NOANS,OUT_BUSY');
    const result = await listUserCallLogs('u-owner', { page: 1, limit: 100, type });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((row) => row.type === 'IN_NOANS' || row.type === 'OUT_BUSY')).toBe(true);
  });
});
