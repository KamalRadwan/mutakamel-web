import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listPartyCalls, toCallLogTypeParam } from './party-calls.api';
import { resetPartyCallsFake, setFakePartyCallsDelay } from './party-calls.fake';

describe('party-calls.api contract (CRM calls)', () => {
  beforeEach(() => {
    resetPartyCallsFake();
    setFakePartyCallsDelay(0);
  });
  afterEach(() => resetPartyCallsFake());

  it('filters party calls by the comma-list `type` query', async () => {
    const all = await listPartyCalls({ partyType: 'LEAD', partyId: 'lead-001', page: 1, limit: 100 });
    const type = toCallLogTypeParam(['IN_NOANS']);
    const missed = await listPartyCalls({ partyType: 'LEAD', partyId: 'lead-001', page: 1, limit: 100, type });
    expect(missed.data.every((row) => row.type === 'IN_NOANS')).toBe(true);
    expect(missed.meta.total).toBe(all.data.filter((row) => row.type === 'IN_NOANS').length);
  });
});
