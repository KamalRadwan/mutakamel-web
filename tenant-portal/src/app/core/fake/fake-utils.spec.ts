import { afterEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../api/idempotency';
import { fakeDelay, fakeId } from './fake-utils';

describe('shared fixture compatibility helpers', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the production ID generator rather than a separate implementation', () => {
    expect(fakeId).toBe(newIdempotencyKey);
  });

  it('preserves the default delay for remaining fixture consumers', async () => {
    vi.useFakeTimers();
    const resolved = vi.fn();
    const pending = fakeDelay().then(resolved);

    await vi.advanceTimersByTimeAsync(299);
    expect(resolved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toHaveBeenCalledOnce();
  });

  it('preserves an explicit zero delay without waiting for the default', async () => {
    vi.useFakeTimers();
    const resolved = vi.fn();
    const pending = fakeDelay(0).then(resolved);

    expect(resolved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    await pending;
    expect(resolved).toHaveBeenCalledOnce();
  });
});
