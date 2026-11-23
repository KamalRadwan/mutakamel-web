import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { getVersion, runAction } from './policy.api';
import type { GovernedDomain } from './policy.model';

const CTX = { companyId: 'company-1', branchId: 'branch-1' };
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Supersession timing and overlap validation belong to the backend. These tests verify
// the live transport contract and preserve the server's returned scheduling fields.
describe.each<GovernedDomain>(['policy', 'workflow'])('%s supersession transport', (domain) => {
  let stub: TradeHttpStub;
  let dispose: () => void;
  const base = domain === 'policy' ? '/policy-versions' : '/workflow-versions';

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => dispose());

  it('publishes a replacement with the predecessor id and the last-read version', async () => {
    stub.register('POST', `${base}/successor/publish`, { id: 'successor', status: 'PUBLISHED', version: 5 });
    const result = await runAction(domain, 'successor', 'publish', {
      supersedesVersionId: 'predecessor',
    }, 4, undefined, CTX);
    expect(result).toMatchObject({ id: 'successor', status: 'PUBLISHED', version: 5 });
    expect(stub.recordedWrites()).toEqual([expect.objectContaining({
      method: 'POST', path: `${base}/successor/publish`,
      body: { supersedesVersionId: 'predecessor' },
      ifMatch: '"4"', scope: CTX, key: expect.stringMatching(UUID_V7),
    })]);
  });

  it('omits supersedesVersionId when publishing without a predecessor', async () => {
    stub.register('POST', `${base}/successor/publish`, { id: 'successor', version: 5 });
    await runAction(domain, 'successor', 'publish', {}, 4, undefined, CTX);
    expect(stub.recordedWrites()[0].body).toEqual({});
  });

  it.each(['PUBLISHED', 'SUPERSEDED'] as const)('preserves %s predecessor cut and effective interval from the server', async (status) => {
    const predecessor = {
      id: 'predecessor', status, version: 6,
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      effectiveTo: '2027-01-01T00:00:00.000Z',
      supersededAt: '2026-12-01T00:00:00.000Z',
      supersededByVersionId: 'successor',
    };
    stub.register('GET', `${base}/predecessor`, predecessor);
    expect(await getVersion(domain, 'predecessor', CTX)).toEqual(predecessor);
    expect(stub.recordedReads()).toEqual([expect.objectContaining({
      path: `${base}/predecessor`, scope: CTX,
    })]);
  });

  it('surfaces a stale publish response without retrying or changing the body', async () => {
    const conflict = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { version: ['stale'] });
    stub.register('POST', `${base}/successor/publish`, conflict);
    await expect(runAction(domain, 'successor', 'publish', {
      supersedesVersionId: 'predecessor',
    }, 4, undefined, CTX)).rejects.toBe(conflict);
    expect(stub.recordedWrites()).toHaveLength(1);
  });
});
