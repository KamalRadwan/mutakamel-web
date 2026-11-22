import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { Transfer } from './transfer';

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
  await phone.call('+201005550142');
  await ctx.flush(300);
});

afterEach(() => {
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

async function mountTransfer() {
  const fixture = ctx.mount(Transfer);
  const cancelled = vi.fn();
  fixture.componentInstance.cancelled.subscribe(cancelled);
  const el = fixture.nativeElement as HTMLElement;
  await ctx.flush();
  return { el, c: fixture.componentInstance as unknown as Internals, cancelled, input: el.querySelector('input')! };
}

async function submit(c: Internals): Promise<void> {
  const done = c['submit']() as Promise<void>;
  await ctx.flush(300);
  await done;
  await ctx.flush();
}

describe('Transfer', () => {
  it('starts on "talk first" (consult); the keypad and input build the target', async () => {
    const { c, input } = await mountTransfer();
    expect(c['transferKind']()).toBe('consult');
    expect(c['isDirect']()).toBe(false);

    input.value = '100';
    input.dispatchEvent(new Event('input'));
    c['pressKey']('2');
    expect(phone.transferValue()).toBe('1002');
    c['deleteKey']();
    expect(phone.transferValue()).toBe('100');
  });

  it('empty target: submit does nothing', async () => {
    const { c, cancelled } = await mountTransfer();
    await submit(c);
    expect(phone.mode()).toBe('single');
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('talk first: starts a consult call (primary held) and closes the transfer view', async () => {
    const { c, cancelled } = await mountTransfer();
    phone.transferValue.set(' 1002 ');
    await submit(c);

    expect(phone.mode()).toBe('consult');
    expect(phone.legs().find((l) => l.role === 'primary')?.held).toBe(true);
    expect(phone.legs().find((l) => l.role === 'consult')?.number).toBe('1002');
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('direct: blind transfer ends the call as transferred to the target', async () => {
    const { c } = await mountTransfer();
    c['transferKind'].set('blind');
    phone.transferValue.set('1002');
    await submit(c);

    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('transferred');
    expect(phone.ended()?.transferredTo).toBe('1002');
  });

  it('direct transfer that fails (target ending in 7) keeps the call', async () => {
    const { c } = await mountTransfer();
    c['transferKind'].set('blind');
    phone.transferValue.set('1007');
    await submit(c);
    expect(phone.callState()).toBe('active');
  });

  it('Cancel emits cancelled', async () => {
    const { el, cancelled } = await mountTransfer();
    buttonByKey(el, 'webPhone.common.cancel')!.click();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
