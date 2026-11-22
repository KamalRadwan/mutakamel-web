import { ApiError, ifMatch, newIdempotencyKey } from '../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../shared/trade-foundation.fake';
import { fakeCreateUom, fakeUomReferences, fakeUpdateUom } from './units.fake';

/** Contract of trade-app CatalogUomService (catalog-uom.service.ts) as the fake mirrors it. */

async function run<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(400);
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<{ status: number; code: string; details?: Record<string, string[]> }> {
  try {
    await run(promise);
  } catch (error) {
    if (error instanceof ApiError) return { status: error.status, code: error.code, details: error.details };
    throw error;
  }
  throw new Error('expected a failure');
}

describe('units fake contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns only reference kinds with a count, and blocking follows them', async () => {
    const refs = await run(fakeUomReferences('uom-kg'));
    expect(refs.groups.length).toBeGreaterThan(0);
    expect(refs.groups.every((group) => group.count > 0)).toBe(true);
    expect(refs.blocking).toBe(true);
  });

  it('a malformed key is 422 KEY_REQUIRED; a missing If-Match is 400', async () => {
    const body = { code: 'CTR', displayName: 'Contract', localizedNames: { en: 'Contract' } };
    expect(await failure(fakeCreateUom(body, 'nope'))).toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });
    const uom = TRADE_FAKE_DB.uoms[0];
    expect(await failure(fakeUpdateUom(uom.id, { displayName: 'X' }, '', newIdempotencyKey()))).toMatchObject({
      status: 400,
      code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
    });
  });

  it('display name: over 160 raw characters is the DTO 400, blank after trim is the service 422', async () => {
    const uom = TRADE_FAKE_DB.uoms[0];
    expect(await failure(fakeUpdateUom(uom.id, { displayName: 'x'.repeat(161) }, ifMatch(uom.version), newIdempotencyKey()))).toEqual({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { displayName: ['invalid'] },
    });
    expect(await failure(fakeUpdateUom(uom.id, { displayName: '   ' }, ifMatch(uom.version), newIdempotencyKey()))).toMatchObject({
      status: 422,
      code: 'TRADE.CATALOG.UOM_INVALID',
    });
  });

  it('retiring a referenced unit is 409 with the counts as string details', async () => {
    const uom = TRADE_FAKE_DB.uoms.find((entry) => entry.id === 'uom-kg')!;
    const error = await failure(fakeUpdateUom(uom.id, { status: 'RETIRED' }, ifMatch(uom.version), newIdempotencyKey()));
    expect(error).toMatchObject({ status: 409, code: 'TRADE.CATALOG.UOM_RETIRE_REFERENCED' });
    expect(Object.values(error.details ?? {}).every((value) => value.length === 1 && /^\d+$/.test(value[0]))).toBe(true);
  });
});
