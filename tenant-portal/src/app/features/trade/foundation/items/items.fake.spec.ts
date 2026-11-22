import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../shared/trade-foundation.fake';
import { countItemsByStatus } from './items.api';
import {
  fakeCountItemsByStatus,
  fakeCreateItem,
  fakeGetItemDetail,
  fakeListItems,
  fakeMoveItemStatus,
  fakePatchItem,
  fakePutItemImage,
} from './items.fake';
import type { ItemCreateBody } from './items.model';

/** Contract of trade-app catalog (catalog.controller, catalog.service, catalog.repository) as the fake mirrors it. */

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

function liveItem(status: string) {
  const item = TRADE_FAKE_DB.items.find((entry) => entry.deletedAt === null && entry.status === status);
  if (!item) throw new Error(`no ${status} item in the seed`);
  return item;
}

const body = (code: string): ItemCreateBody => ({
  canonicalCode: code,
  itemKind: 'PRODUCT',
  localizedNames: { en: 'Contract item', ar: 'صنف العقد' },
  baseUomId: TRADE_FAKE_DB.uoms.find((uom) => uom.status === 'ACTIVE')!.id,
});

describe('items fake contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('needs a UUIDv7 x-idempotency-key: missing 400 KEY_MISSING, malformed 422 KEY_REQUIRED', async () => {
    expect(await failure(fakeCreateItem(body('KEY-A'), ''))).toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });
    expect(await failure(fakeCreateItem(body('KEY-B'), 'not-a-uuid'))).toMatchObject({
      status: 422,
      code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
    });
  });

  it('scopes a key by operation: the same key on another item is a new request, a changed body is 422 MISMATCH', async () => {
    const key = newIdempotencyKey();
    const created = await run(fakeCreateItem(body('KEY-SCOPE'), key));
    await expect(run(fakeCreateItem(body('KEY-SCOPE'), key))).resolves.toMatchObject({ id: created.id });
    expect(await failure(fakeCreateItem(body('KEY-OTHER'), key))).toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.MISMATCH' });
    await expect(run(fakePatchItem(created.id, created.version, { notes: 'x' }, key))).resolves.toBeTruthy();
  });

  it('rejects localized names as the service does: not an object 400, bad content 422 ITEM_IDENTITY_INVALID', async () => {
    const notObject = { ...body('LN-A'), localizedNames: 'x' as unknown as Record<string, string> };
    expect(await failure(fakeCreateItem(notObject, newIdempotencyKey()))).toEqual({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { localizedNames: ['invalid'] },
    });
    const empty = { ...body('LN-B'), localizedNames: {} };
    expect(await failure(fakeCreateItem(empty, newIdempotencyKey()))).toMatchObject({
      status: 422,
      code: 'TRADE.CATALOG.ITEM_IDENTITY_INVALID',
    });
  });

  it('sends details.field status on a forbidden status move, and no reason details', async () => {
    const item = liveItem('DISCONTINUED');
    expect(await failure(fakeMoveItemStatus(item.id, item.version, 'ACTIVE', newIdempotencyKey()))).toEqual({
      status: 422,
      code: 'TRADE.CATALOG.ITEM_IDENTITY_INVALID',
      details: { field: ['status'] },
    });
  });

  it('lists every item when scope=COMPANY has no company header (no profile join), DESC by default', async () => {
    const page = await run(fakeListItems({}, { page: 1, limit: 100, scope: 'COMPANY', sort: 'canonicalCode' }));
    expect(page.total).toBe(TRADE_FAKE_DB.items.filter((item) => item.deletedAt === null).length);
    const codes = page.items.map((item) => item.canonicalCode);
    expect(codes[0].localeCompare(codes[codes.length - 1], undefined, { sensitivity: 'base' })).toBeGreaterThan(0);
  });

  it('status-counts rejects list-only fields; the api strips sort and direction', async () => {
    expect(await failure(fakeCountItemsByStatus({}, { sort: 'name' }))).toEqual({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { sort: ['invalid'] },
    });
    const counts = countItemsByStatus({}, { sort: 'name', direction: 'asc' });
    await expect(run(counts)).resolves.toMatchObject({ ALL: expect.any(Number) });
  });

  it('item detail has no list eligibility projection', async () => {
    const detail = await run(fakeGetItemDetail({ companyId: 'c1' }, liveItem('ACTIVE').id));
    expect('eligibility' in detail).toBe(false);
  });

  it('an image of a wrong type is 415 ITEM_IMAGE_INVALID without the upper-case reason the filter would rewrite', async () => {
    const item = liveItem('ACTIVE');
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' });
    expect(await failure(fakePutItemImage(item.id, item.version, file, newIdempotencyKey()))).toEqual({
      status: 415,
      code: 'TRADE.CATALOG.ITEM_IMAGE_INVALID',
      details: undefined,
    });
  });
});
