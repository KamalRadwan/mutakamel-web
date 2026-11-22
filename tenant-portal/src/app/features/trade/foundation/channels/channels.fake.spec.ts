import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import { fakeListChannelRows } from './channels.fake';
import type { ChannelListQuery, ChannelSortField } from './channels.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const caught = promise.catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(1000);
  const result = await caught;
  if (result instanceof Error) throw result;
  return result as T;
}

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  const caught = promise.then(
    () => null,
    (e: unknown) => e,
  );
  await vi.advanceTimersByTimeAsync(1000);
  const result = await caught;
  expect(result).toBeInstanceOf(ApiError);
  return result as ApiError;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('channels fake: list', () => {
  it('returns { items, total, page, limit } like the backend', async () => {
    const result = await settle(fakeListChannelRows({ companyId: 'c1' }));
    expect(Object.keys(result).sort()).toEqual(['items', 'limit', 'page', 'total']);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBe(result.items.length);
  });

  it.each<ChannelSortField>(['createdAt', 'code', 'name'])('accepts sort=%s', async (sort) => {
    const result = await settle(fakeListChannelRows({ companyId: 'c1' }, { sort, direction: 'asc' }));
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('sorts by code', async () => {
    const result = await settle(fakeListChannelRows({ companyId: 'c1' }, { sort: 'code', direction: 'asc' }));
    const codes = result.items.map((c) => c.code);
    expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
  });

  it.each(['updatedAt', 'channelType', 'status'])('rejects sort=%s with 400', async (sort) => {
    const query = { sort } as unknown as ChannelListQuery;
    const error = await settleError(fakeListChannelRows({ companyId: 'c1' }, query));
    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });
});
