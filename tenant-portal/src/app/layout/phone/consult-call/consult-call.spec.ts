import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { ConsultCall } from './consult-call';

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
  await phone.startConsult('1002');
  await ctx.flush();
});

afterEach(() => {
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

async function mountConsult() {
  const fixture = ctx.mount(ConsultCall);
  await ctx.flush();
  return { el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Internals };
}

describe('ConsultCall', () => {
  it('Complete transfer waits until the consulted party answers', async () => {
    const { el, c } = await mountConsult();
    expect(c['consultLeg']()?.number).toBe('1002');
    const complete = () => buttonByKey(el, 'webPhone.consult.completeTransfer')!;
    expect(complete().disabled).toBe(true);
    expect(complete().getAttribute('title')).toBe('webPhone.consult.transferWaitHint');

    await ctx.flush(300);
    expect(c['canCompleteTransfer']()).toBe(true);
    expect(complete().disabled).toBe(false);

    complete().click();
    await ctx.flush(150);
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('transferred');
  });

  it('Swap moves talk to the other leg; focusing the already focused leg does nothing', async () => {
    const { el, c } = await mountConsult();
    await ctx.flush(300);
    const consultId = phone.focusedLegId();

    c['onFocusLeg'](consultId);
    expect(phone.focusedLegId()).toBe(consultId);

    buttonByKey(el, 'webPhone.consult.swap')!.click();
    await ctx.flush();
    expect(phone.focusedLegId()).not.toBe(consultId);
    expect(phone.legs().find((l) => l.id === consultId)?.held).toBe(true);
  });

  it('Cancel consult returns to the single primary call, resumed', async () => {
    const { el } = await mountConsult();
    await ctx.flush(300);
    buttonByKey(el, 'webPhone.consult.cancelConsult')!.click();
    await ctx.flush();
    expect(phone.mode()).toBe('single');
    expect(phone.legs()).toHaveLength(1);
    expect(phone.legs()[0].held).toBe(false);
  });

  it('Merge makes a conference with nobody held', async () => {
    const { el } = await mountConsult();
    await ctx.flush(300);
    buttonByKey(el, 'webPhone.consult.merge')!.click();
    await ctx.flush();
    expect(phone.mode()).toBe('conference');
    expect(phone.legs().every((l) => !l.held)).toBe(true);
  });

  it('Keypad opens and hides', async () => {
    const { el, c } = await mountConsult();
    buttonByKey(el, 'webPhone.inCall.keypad')!.click();
    await ctx.flush();
    expect(c['showKeypad']()).toBe(true);
    expect(el.querySelector('app-keypad')).not.toBeNull();
    buttonByKey(el, 'webPhone.inCall.hideKeypad')!.click();
    await ctx.flush();
    expect(c['showKeypad']()).toBe(false);
  });

  it('the hang-up label names the focused party', async () => {
    const { c } = await mountConsult();
    expect(c['focusedName']()).toBe('1002');
  });
});
