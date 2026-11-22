import { ApiError } from '../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../shared/trade-foundation.fake';
import { fakeCreateCategory, fakeListCategories } from './categories.fake';

/** Contract of trade-app CategoryQueryService / CategoryCommandService as the fake mirrors it. */

async function failure(promise: Promise<unknown>): Promise<{ status: number; code: string; details?: Record<string, string[]> }> {
  const settled = promise.then(
    () => null,
    (error: unknown) => error,
  );
  await vi.advanceTimersByTimeAsync(400);
  const error = await settled;
  if (error instanceof ApiError) return { status: error.status, code: error.code, details: error.details };
  throw new Error('expected an ApiError');
}

describe('categories fake contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('DTO page bounds are 400; the offset window is 422 CATEGORY_QUERY_INVALID', async () => {
    expect(await failure(fakeListCategories({ page: 10_001, limit: 1 }, 'en'))).toEqual({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { page: ['invalid'] },
    });
    expect(await failure(fakeListCategories({ page: 101, limit: 100 }, 'en'))).toMatchObject({
      status: 422,
      code: 'TRADE.CATALOG.CATEGORY_QUERY_INVALID',
    });
  });

  it('a key that is not a UUIDv7 is 422 KEY_REQUIRED; a missing key is 400 KEY_MISSING', async () => {
    const body = {
      expectedTreeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
      code: 'CTR',
      displayName: 'Contract',
      localizedNames: { en: 'Contract' },
    };
    expect(await failure(fakeCreateCategory(body, 'nope'))).toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });
    expect(await failure(fakeCreateCategory(body, ''))).toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });
  });
});
