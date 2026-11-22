import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/settings-api';
import { createReason, listReasons, updateReason } from './reasons.api';

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

async function errorOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error : undefined;
  }
}

const input = {
  reasonKind: 'LOSS' as const,
  code: 'CONTRACT_SPEC',
  nameEn: 'Contract spec',
  nameAr: 'اختبار العقد',
  sortOrder: 10,
};

describe('reasons contract (backend governance/reasons)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('list returns { items } and filters with the active query param', async () => {
    const all = await settle(listReasons());
    expect(Array.isArray(all.items)).toBe(true);

    const active = await settle(listReasons({ active: 'true' }));
    expect(active.items.every((item) => item.isActive)).toBe(true);

    const inactive = await settle(listReasons({ active: 'false' }));
    expect(inactive.items.every((item) => !item.isActive)).toBe(true);
    expect(active.items.length + inactive.items.length).toBe(all.items.length);

    const loss = await settle(listReasons({ kind: 'LOSS' }));
    expect(loss.items.every((item) => item.reasonKind === 'LOSS')).toBe(true);
  });

  it('a missing or malformed idempotency key is CRM_IDEMPOTENCY_KEY_INVALID', async () => {
    expect((await errorOf(createReason(input, '')))?.code).toBe('CRM_IDEMPOTENCY_KEY_INVALID');
    expect((await errorOf(createReason(input, 'not-a-uuid')))?.code).toBe('CRM_IDEMPOTENCY_KEY_INVALID');
  });

  it('a stale revision carries no details', async () => {
    const { items } = await settle(listReasons());
    const target = items[0];
    const error = await errorOf(updateReason(target.id, target.revision + 99, { nameEn: 'x' }));
    expect(error?.code).toBe('CRM_REASON_REVISION_STALE');
    expect(error?.details).toBeUndefined();
  });
});
