import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { listSessions, logoutAll, revokeSession } from './sessions.api';
import { SESSION_HISTORY_PAGE_SIZE } from './sessions.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

// The fake store is module state with no reset, so these run in order on one store.
describe('sessions fake (backend contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns active sessions (current first) plus one ended page', async () => {
    const list = await settle(listSessions());
    expect(list.endedHistory).toEqual({ page: 1, pageSize: SESSION_HISTORY_PAGE_SIZE, hasMore: true });
    const active = list.items.filter((s) => s.endedAt === null);
    expect(active[0].current).toBe(true);
    expect(list.items.length).toBe(active.length + SESSION_HISTORY_PAGE_SIZE);
    expect(typeof list.items[0].refreshUseCount).toBe('string');
  });

  it('rejects historyPage 0 with 400 CORE_VALIDATION_FAILED', async () => {
    const error = await failure(listSessions(0));
    expect([error.status, error.code, error.details]).toEqual([400, 'CORE_VALIDATION_FAILED', { historyPage: ['min'] }]);
  });

  it('rejects a non-v7 id with 400 COMMON.VALIDATION.UUID_V7_INVALID', async () => {
    const error = await failure(revokeSession('123e4567-e89b-42d3-a456-426614174000'));
    expect([error.status, error.code]).toEqual([400, 'COMMON.VALIDATION.UUID_V7_INVALID']);
  });

  it('ends a session with DEVICE_REVOKED and is a no-op for an unknown v7 id', async () => {
    const before = await settle(listSessions());
    const other = before.items.find((s) => s.endedAt === null && !s.current)!;
    await settle(revokeSession(other.id.toUpperCase()));
    await settle(revokeSession('01900000-0000-7000-8000-000000000000'));
    const after = await settle(listSessions());
    expect(after.items.find((s) => s.id === other.id)?.endReason).toBe('DEVICE_REVOKED');
  });

  it('logout-all ends every active session with LOGOUT_ALL', async () => {
    await settle(logoutAll());
    const list = await settle(listSessions());
    expect(list.items.some((s) => s.endedAt === null)).toBe(false);
    expect(list.items.filter((s) => s.endReason === 'LOGOUT_ALL').length).toBeGreaterThan(0);
  });
});
