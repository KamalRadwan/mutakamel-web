import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest, textOf } from '../testing/phone-testing';
import { DialDisplay } from './dial-display';

type Internals = Record<string, any>;

let h: PhoneHarness;
let ctx: PhoneSpecContext;
let phone: PhoneState;

beforeEach(async () => {
  vi.useFakeTimers();
  h = setUpPhoneTest();
  TestBed.configureTestingModule({ providers: h.providers });
  ctx = phoneSpecContext((ms) => vi.advanceTimersByTimeAsync(ms));
  phone = await ctx.start();
});

afterEach(() => {
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

function mountDisplay() {
  const fixture = ctx.mount(DialDisplay);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, c: fixture.componentInstance as unknown as Internals, input: el.querySelector('input')! };
}

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('DialDisplay', () => {
  it('typing sets the dial value; Enter calls', async () => {
    const { input } = mountDisplay();
    typeInto(input, '1002');
    expect(phone.dialValue()).toBe('1002');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await ctx.flush();
    expect(phone.callState()).toBe('calling');
  });

  it('Enter with an empty number does nothing', async () => {
    const { input } = mountDisplay();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await ctx.flush();
    expect(phone.busy()).toBe(false);
  });

  it('in a call it shows the remote number and name, ignores typing, and sends DTMF once active', async () => {
    const { input, c, fixture } = mountDisplay();
    await phone.call('+201005550142');
    await ctx.flush();
    expect(c['inCall']()).toBe(true);
    expect(c['displayNumber']()).toBe('+201005550142');

    typeInto(input, '999');
    expect(phone.dialValue()).not.toBe('999');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, cancelable: true }));
    expect(phone.sentTones()).toBe(''); // still calling

    await ctx.flush(300);
    await ctx.flush(); // lookup at answer
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, cancelable: true }));
    expect(phone.sentTones()).toBe('7');
    expect(textOf(fixture)).toContain('+201005550142');
  });

  it('call name hides when it only repeats the number', () => {
    const { c } = mountDisplay();
    expect(c['callName']()).toBeNull();
  });

  it('a chosen record can be cleared before calling', async () => {
    const { el } = mountDisplay();
    phone.dialSource.set({ type: 'LEAD', id: 'l1', label: 'Lead A' });
    await ctx.flush();
    expect(el.textContent).toContain('Lead A');

    buttonByKey(el, 'webPhone.dialer.clearSource')!.click();
    await ctx.flush();
    expect(phone.dialSource()).toBeNull();
  });

  it('the delete button removes the last digit', async () => {
    const { el, input } = mountDisplay();
    typeInto(input, '1002');
    await ctx.flush();
    buttonByKey(el, 'webPhone.dialer.deleteDigit')!.click();
    expect(phone.dialValue()).toBe('100');
  });
});
