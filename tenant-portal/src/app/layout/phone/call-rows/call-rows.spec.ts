import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneHarness, PhoneSpecContext, leg, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { CallRows } from './call-rows';

type Internals = Record<string, any>;

let h: PhoneHarness;
let ctx: PhoneSpecContext;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
  h = setUpPhoneTest();
  TestBed.configureTestingModule({ providers: h.providers });
  ctx = phoneSpecContext((ms) => vi.advanceTimersByTimeAsync(ms));
});

afterEach(() => {
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

const primary = leg({ id: 'p', state: 'active', held: true, answeredAt: '2026-11-22T09:58:55Z' });
const consult = leg({ id: 'c', role: 'consult', number: '1002', displayName: null, state: 'ringing' });

function mountRows(inputs: Record<string, unknown> = {}) {
  const fixture = ctx.mount(CallRows, { legs: [primary, consult], ...inputs });
  const focus = vi.fn();
  const remove = vi.fn();
  fixture.componentInstance.focus.subscribe(focus);
  fixture.componentInstance.remove.subscribe(remove);
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    c: fixture.componentInstance as unknown as Internals,
    focus,
    remove,
  };
}

describe('CallRows', () => {
  it('badges each leg: on hold, ringing, talking, left', () => {
    const { c } = mountRows();
    expect(c['badgeKind'](primary)).toBe('onHold');
    expect(c['badgeKind'](consult)).toBe('ringing');
    expect(c['badgeKind'](leg({ state: 'active' }))).toBe('talking');
    expect(c['badgeKind'](leg({ state: 'ended' }))).toBe('left');
    expect(c['badgeKind'](leg({ state: 'failed', held: true }))).toBe('left');
  });

  it('shows the answered duration and ticks every second; unanswered legs have none', async () => {
    const { c } = mountRows();
    expect(c['legDuration'](primary)).toBe('01:05');
    expect(c['legDuration'](consult)).toBe('');
    await ctx.flush(1_000);
    expect(c['legDuration'](primary)).toBe('01:06');
  });

  it('is a radio group: aria-checked on the focused leg; click emits focus', () => {
    const { el, focus } = mountRows({ focusedId: 'c' });
    const radios = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    radios[0].click();
    expect(focus).toHaveBeenCalledWith('p');
  });

  it('arrow keys move focus and wrap (LTR)', () => {
    const { el, focus } = mountRows();
    document.documentElement.dir = 'ltr';
    const radios = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(focus.mock.calls).toEqual([['p'], ['c'], ['c']]);
    document.documentElement.removeAttribute('dir');
  });

  it('in RTL ArrowLeft is "next"', () => {
    const { el, focus } = mountRows();
    document.documentElement.dir = 'rtl';
    const radios = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(focus).toHaveBeenCalledWith('c');
    document.documentElement.removeAttribute('dir');
  });

  it('not focusable: no radios and no focus events', () => {
    const { el, c, focus } = mountRows({ focusable: false });
    expect(el.querySelector('[role="radio"]')).toBeNull();
    c['onFocusRow']('p');
    expect(focus).not.toHaveBeenCalled();
  });

  it('removable rows emit remove without also focusing the row', () => {
    const { el, focus, remove } = mountRows({ removable: true });
    const removeButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('button:not([role="radio"])'));
    expect(removeButtons.length).toBe(2);
    removeButtons[1].click();
    expect(remove).toHaveBeenCalledWith('c');
    expect(focus).not.toHaveBeenCalled();
  });

  it('uses the record type look when the leg is linked', () => {
    const { c } = mountRows();
    expect(c['lookOf'](leg({ source: { type: 'OPPORTUNITY', id: 'o', label: 'Deal' } }))).toEqual({
      icon: 'tablerTarget',
      tile: 'bg-icon-red',
    });
    expect(c['lookOf'](leg())).toEqual({ icon: 'tablerUser', tile: 'bg-icon-blue' });
  });
});
