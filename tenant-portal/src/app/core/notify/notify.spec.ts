import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from './notify';

let notify: Notify;

beforeEach(() => {
  vi.useFakeTimers();
  notify = TestBed.inject(Notify);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

describe('Notify connection toast', () => {
  it('updates the existing pinned toast with the same id and no repeat counter', () => {
    notify.connectionLost('Lost', 'Retrying');
    const id = notify.toasts()[0].id;
    notify.connectionLost('Offline', 'Still retrying');
    expect(notify.toasts()).toEqual([
      { id, type: 'error', title: 'Offline', text: 'Still retrying', count: 1, pinned: true },
    ]);
  });

  it('removes only the pinned toast on restoration and tolerates a second call', () => {
    notify.connectionLost('Lost', 'Retrying');
    notify.error('Save failed');
    notify.connectionRestored();
    const remaining = notify.toasts();
    notify.connectionRestored();
    expect(notify.toasts()).toBe(remaining);
    expect(notify.toasts().map((toast) => toast.title)).toEqual(['Save failed']);
  });

  it('keeps the pinned toast and newest two transients, clearing the dropped timer', () => {
    notify.connectionLost('Lost', 'Retrying');
    const pinned = notify.toasts()[0];
    notify.info('Oldest');
    notify.success('Newer');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    notify.warning('Newest');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(2);
    expect(notify.toasts().map((toast) => toast.title)).toEqual(['Lost', 'Newer', 'Newest']);
    expect(notify.toasts()[0]).toBe(pinned);
    clear.mockRestore();
  });

  it('preserves insertion order when pinned after transient toasts and updated later', () => {
    notify.info('Oldest');
    notify.info('Before');
    notify.info('Before again');
    notify.connectionLost('Lost', 'Retrying');
    notify.info('After');
    const id = notify.toasts()[1].id;
    notify.connectionLost('Offline', 'Retrying');
    expect(notify.toasts().map((toast) => toast.title)).toEqual(['Before again', 'Offline', 'After']);
    expect(notify.toasts()[1].id).toBe(id);
    expect(vi.getTimerCount()).toBe(2);
  });

  it('ignores close for the pinned toast', () => {
    notify.connectionLost('Lost', 'Retrying');
    const pinned = notify.toasts()[0];
    notify.close(pinned.id);
    expect(notify.toasts()).toEqual([pinned]);
  });

  it('has no timer and stays after sixty seconds', () => {
    notify.connectionLost('Lost', 'Retrying');
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(notify.toasts()).toHaveLength(1);
    expect(notify.durationOf(notify.toasts()[0])).toBeNull();
  });

  it('never merges a transient error with the pinned toast', () => {
    notify.connectionLost('Lost', 'Retrying');
    notify.error('Lost', 'Retrying');
    notify.error('Lost', 'Retrying');
    expect(notify.toasts().map(({ pinned, count }) => ({ pinned, count }))).toEqual([
      { pinned: true, count: 1 }, { pinned: false, count: 2 },
    ]);
  });
});

describe('Notify transient toasts', () => {
  it.each(['success', 'info'] as const)('dismisses %s after four seconds', (type) => {
    notify[type]('Done');
    expect(notify.toasts()[0].pinned).toBe(false);
    expect(notify.durationOf(notify.toasts()[0])).toBe(4000);
    vi.advanceTimersByTime(3999);
    expect(notify.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(notify.toasts()).toEqual([]);
  });

  it('dismisses warning after eight seconds', () => {
    notify.warning('Careful');
    expect(notify.durationOf(notify.toasts()[0])).toBe(8000);
    vi.advanceTimersByTime(7999);
    expect(notify.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(notify.toasts()).toEqual([]);
  });

  it('keeps an error until it is closed', () => {
    notify.error('Failed');
    expect(notify.durationOf(notify.toasts()[0])).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(notify.toasts()).toHaveLength(1);
    notify.close(notify.toasts()[0].id);
    expect(notify.toasts()).toEqual([]);
  });

  it('merges identical repeats with a new id, incremented count and restarted duration', () => {
    notify.info('Info', 'Details');
    const id = notify.toasts()[0].id;
    vi.advanceTimersByTime(3000);
    notify.info('Info', 'Details');
    expect(notify.toasts()).toHaveLength(1);
    expect(notify.toasts()[0]).toMatchObject({ count: 2, pinned: false });
    expect(notify.toasts()[0].id).not.toBe(id);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3999);
    expect(notify.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(notify.toasts()).toEqual([]);
  });

  it('pauses and resumes only the remaining duration', () => {
    notify.success('Saved');
    const id = notify.toasts()[0].id;
    vi.advanceTimersByTime(3000);
    notify.pause(id);
    notify.pause(id);
    vi.advanceTimersByTime(60_000);
    expect(notify.toasts()).toHaveLength(1);
    notify.resume(id);
    notify.resume(id);
    vi.advanceTimersByTime(999);
    expect(notify.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(notify.toasts()).toEqual([]);
  });
});
