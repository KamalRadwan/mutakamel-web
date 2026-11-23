import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { publishVersion } from './pricing.api';
import type { VersionHead } from './pricing.model';
import { bookGovernanceState } from './pricing.service';

const now = Date.parse('2026-11-23T12:00:00Z');
const before = '2026-11-22T12:00:00Z';
const after = '2026-11-24T12:00:00Z';
function version(overrides: Partial<VersionHead> = {}): VersionHead {
  return { id: 'version-1', versionNumber: 1, status: 'PUBLISHED', effectiveFrom: before, effectiveTo: null, supersededAt: null, version: 3, ...overrides };
}

describe('pricing supersession presentation', () => {
  it('keeps the predecessor live until supersededAt, without rewriting effectiveTo', () => {
    const predecessor = version({ supersededAt: after });
    expect(bookGovernanceState({ status: 'ACTIVE', versions: [predecessor] }, now)).toBe('PUBLISHED');
    expect(bookGovernanceState({ status: 'ACTIVE', versions: [predecessor] }, Date.parse(after))).toBe('DRAFT_ONLY');
    expect(predecessor.effectiveTo).toBeNull();
  });
  it('gives supersededAt precedence over a later effectiveTo', () => {
    expect(bookGovernanceState({ status: 'ACTIVE', versions: [version({ supersededAt: before, effectiveTo: after })] }, now)).toBe('DRAFT_ONLY');
  });
  it('shows a future scheduled successor as scheduled and an effective one as published', () => {
    const successor = version({ status: 'SCHEDULED', effectiveFrom: after });
    expect(bookGovernanceState({ status: 'ACTIVE', versions: [successor] }, now)).toBe('SCHEDULED');
    expect(bookGovernanceState({ status: 'ACTIVE', versions: [successor] }, Date.parse(after))).toBe('PUBLISHED');
  });
});

describe('pricing supersession server validation', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;
  beforeEach(() => { stub = new TradeHttpStub(); dispose = bindTradeHttpForTest(stub); });
  afterEach(() => dispose());
  it.each(['predecessor_invalid', 'retroactive_supersession'])('preserves %s and sends one publish command', async (reason) => {
    const error = new ApiError(422, 'TRADE.PRICE.SUPERSESSION_INVALID', { reason: [reason] });
    stub.register('POST', '/price-book-versions/successor/publish', error);
    await expect(publishVersion('successor', { supersedesVersionId: 'predecessor' }, { ifMatch: 3, ctx: { companyId: 'company-1' } })).rejects.toBe(error);
    expect(stub.recordedWrites()).toHaveLength(1);
    expect(stub.recordedWrites()[0]).toMatchObject({ body: { supersedesVersionId: 'predecessor' }, ifMatch: '"3"' });
  });
});
