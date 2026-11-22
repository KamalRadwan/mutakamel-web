import { Injector } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommercialOperation, getSubscription, prepareChange } from '../billing.api';
import { setFakeBillingFailNext } from '../billing.fake';
import { OperationPoller } from './operation-poller';

// vi.mock is not available for relative imports under the Angular unit-test builder, so the poller
// runs against the billing fakes: a prepared operation is PREPARING, then READY from its 2nd poll.
async function prepareOperation(): Promise<CommercialOperation> {
  const sub = await getSubscription();
  const item = sub.baseItems[0];
  return prepareChange(
    {
      expectedSubscriptionRevision: sub.subscriptionRevision,
      changes: [
        { sourceKind: 'APPLICATION', operation: 'CHANGE', selectionKey: 'k1', itemId: item.id, seats: item.seats + 1 },
      ],
    },
    crypto.randomUUID(),
  );
}

async function prepared(): Promise<CommercialOperation> {
  const p = prepareOperation();
  await vi.runAllTimersAsync();
  return p;
}

function create(): { poller: OperationPoller; destroy: () => void } {
  // DestroyRef resolves to the owning environment injector, so destroying it fires onDestroy.
  const injector = Injector.create({ providers: [{ provide: OperationPoller }] }) as Injector & {
    destroy: () => void;
  };
  return { poller: injector.get(OperationPoller), destroy: () => injector.destroy() };
}

describe('OperationPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeBillingFailNext(false);
  });
  afterEach(() => {
    setFakeBillingFailNext(false);
    vi.useRealTimers();
  });

  it('polls a preparing operation until it is ready and reports each tick', async () => {
    const op = await prepared();
    const states: string[] = [];
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 0, onTick: (o) => states.push(o.state) });
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result.kind).toBe('ready');
    expect(states).toEqual(['PREPARING', 'READY']);
  });

  it('skips the sleep when the initial delay is zero', async () => {
    const op = await prepared();
    const onTick = vi.fn();
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 0, onTick });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onTick).toHaveBeenCalled();
    await vi.runAllTimersAsync();
    await p;
  });

  it('does not request before the initial delay has elapsed', async () => {
    const op = await prepared();
    const onTick = vi.fn();
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 60_000, onTick });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(onTick).not.toHaveBeenCalled();
    poller.stop();
    expect((await p).kind).toBe('cancelled');
  });

  it('times out with the last operation when attempts run out', async () => {
    const op = await prepared();
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 0, maxAttempts: 1 });
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result.kind).toBe('timeout');
    expect(result.kind === 'timeout' && result.operation?.state).toBe('PREPARING');
  });

  it('treats a non-positive maxAttempts as one attempt', async () => {
    const op = await prepared();
    const onTick = vi.fn();
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 0, maxAttempts: 0, onTick });
    await vi.runAllTimersAsync();
    expect((await p).kind).toBe('timeout');
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('returns an error result for an unknown operation', async () => {
    const { poller } = create();
    const p = poller.poll('op-missing', { initialDelayMs: 0 });
    await vi.runAllTimersAsync();
    expect((await p).kind).toBe('error');
  });

  it('returns an error result when the request fails', async () => {
    const op = await prepared();
    setFakeBillingFailNext(true);
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 0 });
    await vi.runAllTimersAsync();
    expect((await p).kind).toBe('error');
  });

  it('cancels a poll that is sleeping when stop is called', async () => {
    const { poller } = create();
    const p = poller.poll('op-any', { initialDelayMs: 5000 });
    poller.stop();
    expect(await p).toEqual({ kind: 'cancelled' });
  });

  it('cancels a poll whose request is in flight and ignores its response', async () => {
    const op = await prepared();
    const onTick = vi.fn();
    const { poller } = create();
    const p = poller.poll(op.operationId, { initialDelayMs: 0, onTick });
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ kind: 'cancelled' });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('reports cancelled instead of error when stopped before a failing request settles', async () => {
    const { poller } = create();
    const p = poller.poll('op-missing', { initialDelayMs: 0 });
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();
    await vi.runAllTimersAsync();
    expect((await p).kind).toBe('cancelled');
  });

  it('cancels the previous poll when a new poll starts', async () => {
    const op = await prepared();
    const { poller } = create();
    const first = poller.poll(op.operationId, { initialDelayMs: 5000 });
    const second = poller.poll(op.operationId, { initialDelayMs: 0, maxAttempts: 1 });
    await vi.runAllTimersAsync();
    expect((await first).kind).toBe('cancelled');
    expect((await second).kind).toBe('timeout');
  });

  it('cancels an active poll when the owner is destroyed', async () => {
    const { poller, destroy } = create();
    const p = poller.poll('op-any', { initialDelayMs: 5000 });
    destroy();
    expect((await p).kind).toBe('cancelled');
  });

  it('returns cancelled immediately when polling after destroy', async () => {
    const { poller, destroy } = create();
    destroy();
    expect(await poller.poll('op-any', { initialDelayMs: 0 })).toEqual({ kind: 'cancelled' });
  });

  it('leaves no pending sleep timer after stop', async () => {
    const { poller } = create();
    const before = vi.getTimerCount();
    void poller.poll('op-any', { initialDelayMs: 5000 });
    expect(vi.getTimerCount()).toBe(before + 1);
    poller.stop();
    expect(vi.getTimerCount()).toBe(before);
  });
});
