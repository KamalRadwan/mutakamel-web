import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { Dialer } from './dialer';

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
  phone.open('phone');
});

afterEach(() => {
  try {
    ctx?.destroy();
    TestBed.resetTestingModule();
    h?.restore();
  } finally {
    vi.useRealTimers();
  }
});

function mountDialer() {
  const fixture = ctx.mount(Dialer);
  return { fixture, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Internals };
}

function key(k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(event);
  return event;
}

describe('Dialer', () => {
  it('Call is disabled until a number is dialled', async () => {
    const { el } = mountDialer();
    await ctx.flush();
    expect(buttonByKey(el, 'webPhone.dialer.call')!.disabled).toBe(true);
    phone.dialValue.set('1002');
    await ctx.flush();
    expect(buttonByKey(el, 'webPhone.dialer.call')!.disabled).toBe(false);
  });

  it('Call is disabled with the reason once the microphone is denied', async () => {
    const { el, c } = mountDialer();
    (navigator.mediaDevices as unknown as Record<string, unknown>)['getUserMedia'] = async () => {
      throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    };
    await phone.call('+201005550142');
    await ctx.flush();
    phone.dialValue.set('1002');
    await ctx.flush();

    expect(c['micBlockReasonKey']()).toBe('webPhone.mediaNotice.permissionDenied');
    const call = buttonByKey(el, 'webPhone.dialer.call')!;
    expect(call.disabled).toBe(true);
    expect(call.getAttribute('title')).toBe('webPhone.mediaNotice.permissionDenied');
  });

  it('typing on the page dials, Backspace deletes, Enter calls', async () => {
    mountDialer();
    await ctx.flush();
    for (const k of ['1', '0', '0', '2']) key(k);
    expect(phone.dialValue()).toBe('1002');
    key('Backspace');
    expect(phone.dialValue()).toBe('100');
    key('3');
    key('Enter');
    await ctx.flush();
    expect(phone.callState()).toBe('calling');
  });

  it('ignores page keys with modifiers, while the panel is closed, and in inputs', async () => {
    mountDialer();
    await ctx.flush();
    key('1', { ctrlKey: true });
    phone.close();
    key('2');
    phone.open('phone');
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    input.remove();
    expect(phone.dialValue()).toBe('');
  });

  it('in an active call, digit keys send DTMF tones and do not change the dial value', async () => {
    mountDialer();
    await phone.call('+201005550142');
    await ctx.flush(300);
    const dialled = phone.dialValue();

    key('5');
    key('#');
    await ctx.flush();
    expect(phone.sentTones()).toBe('5#');
    expect(phone.dialValue()).toBe(dialled);
  });

  it('active call controls: hold/resume toggles aria-pressed, Transfer emits openTransfer, Hang up ends it', async () => {
    const { fixture, el } = mountDialer();
    const openTransfer = vi.fn();
    fixture.componentInstance.openTransfer.subscribe(openTransfer);
    await phone.call('+201005550142');
    await ctx.flush(300);

    buttonByKey(el, 'webPhone.inCall.hold')!.click();
    await ctx.flush();
    expect(phone.focusedLeg()?.held).toBe(true);
    expect(buttonByKey(el, 'webPhone.inCall.resume')!.getAttribute('aria-pressed')).toBe('true');

    buttonByKey(el, 'webPhone.inCall.transfer')!.click();
    expect(openTransfer).toHaveBeenCalledTimes(1);

    buttonByKey(el, 'webPhone.inCall.hangup')!.click();
    await ctx.flush();
    expect(phone.busy()).toBe(false);
  });

  it('Add party dials a third party and merges into a conference', async () => {
    const { el, c } = mountDialer();
    await phone.call('+201005550142');
    await ctx.flush(300);

    buttonByKey(el, 'webPhone.inCall.add')!.click();
    await ctx.flush();
    expect(c['addingParty']()).toBe(true);
    c['pressPartyKey']('1');
    c['pressPartyKey']('0');
    c['pressPartyKey']('0');
    c['pressPartyKey']('3');
    c['deletePartyKey']();
    c['pressPartyKey']('3');
    expect(c['partyNumber']()).toBe('1003');

    const done = c['submitAddParty']() as Promise<void>;
    await ctx.flush(300);
    await done;
    await ctx.flush();
    expect(c['addingParty']()).toBe(false);
    expect(phone.legs().some((l) => l.number === '1003')).toBe(true);
  });

  it('the add-party view closes itself when the call stops being active', async () => {
    const { c } = mountDialer();
    await phone.call('+201005550142');
    await ctx.flush(300);
    c['openAddParty']();
    await ctx.flush();
    phone.hangup();
    await ctx.flush();
    expect(c['addingParty']()).toBe(false);
  });

  it('auto-answer and do-not-disturb switches write the preferences', async () => {
    const { el } = mountDialer();
    await ctx.flush();
    const toggle = (label: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')).find((b) => b.textContent?.includes(label))!;
    expect(toggle('webPhone.dialer.autoAnswer').getAttribute('aria-pressed')).toBe('false');

    toggle('webPhone.dialer.autoAnswer').click();
    toggle('webPhone.dialer.dnd').click();
    await ctx.flush();
    expect(phone.prefs().autoAnswer).toBe(true);
    expect(phone.prefs().dnd).toBe(true);
    expect(toggle('webPhone.dialer.dnd').getAttribute('aria-pressed')).toBe('true');
  });
});
