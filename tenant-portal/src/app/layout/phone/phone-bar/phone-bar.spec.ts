import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { PhoneBar } from './phone-bar';

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

function mountBar() {
  const fixture = ctx.mount(PhoneBar);
  return { fixture, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Internals };
}

describe('PhoneBar', () => {
  it('idle and registered: green dot, "registered" status, no call buttons; clicking opens the panel', async () => {
    const { el, c } = mountBar();
    await ctx.flush();

    expect(c['dotClass']()).toBe('bg-success');
    expect(c['statusWord']()).toBe('webPhone.launcher.registered');
    expect(buttonByKey(el, 'webPhone.pill.mute')).toBeUndefined();

    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(phone.panelOpen()).toBe(true);
  });

  it('ringing: success dot and the incoming aria label', async () => {
    const { c } = mountBar();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await ctx.flush();

    expect(c['dotClass']()).toBe('bg-on-success');
    expect(c['ariaLabel']()).toBe('webPhone.bar.openLabel');
  });

  it('calling shows only hang up; active adds mute; the timer counts mm:ss', async () => {
    const { el, c } = mountBar();
    await phone.call('+201005550142');
    await ctx.flush();
    expect(phone.callState()).toBe('calling');
    expect(buttonByKey(el, 'webPhone.pill.mute')).toBeUndefined();
    expect(buttonByKey(el, 'webPhone.pill.hangupWith')).toBeDefined();

    await ctx.flush(300);
    expect(phone.callState()).toBe('active');
    expect(buttonByKey(el, 'webPhone.pill.mute')).toBeDefined();

    await ctx.flush(65_000);
    expect(c['formattedTime']()).toMatch(/^01:0\d$/);
  });

  it('mute toggles aria-pressed; hang up ends the call without opening the panel', async () => {
    const { el } = mountBar();
    await phone.call('+201005550142'); // call() opens the panel; fold it so the bar's own clicks are visible
    await ctx.flush(300);
    phone.close();
    await ctx.flush();

    buttonByKey(el, 'webPhone.pill.mute')!.click();
    await ctx.flush();
    expect(phone.muted()).toBe(true);
    expect(buttonByKey(el, 'webPhone.pill.unmute')!.getAttribute('aria-pressed')).toBe('true');
    expect(phone.panelOpen()).toBe(false); // the click does not bubble to "open"

    buttonByKey(el, 'webPhone.pill.hangupWith')!.click();
    await ctx.flush();
    expect(phone.busy()).toBe(false);
    expect(phone.panelOpen()).toBe(false);
  });

  it('held call: warning dot', async () => {
    const { c } = mountBar();
    await phone.call('+201005550142');
    await ctx.flush(300);
    phone.toggleHold();
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-warning');
  });

  it('conference hang up asks first: cancel keeps the conference, confirm ends it for all', async () => {
    const { el } = mountBar();
    await phone.call('+201005550142');
    await ctx.flush(300);
    await phone.startConsult('1002');
    await ctx.flush(300);
    phone.mergeConference();
    await ctx.flush();
    expect(phone.mode()).toBe('conference');

    buttonByKey(el, 'webPhone.conference.endForAll')!.click();
    await ctx.flush();
    const dialog = el.querySelector('dialog[open]')!;
    expect(dialog).not.toBeNull();
    buttonByKey(dialog, 'webPhone.common.cancel')!.click();
    await ctx.flush();
    expect(phone.mode()).toBe('conference');

    buttonByKey(el, 'webPhone.conference.endForAll')!.click();
    await ctx.flush();
    buttonByKey(el.querySelector('dialog[open]')!, 'webPhone.conference.endForAll')!.click();
    await ctx.flush();
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('conferenceEnded');
  });

  it('the missed badge counts missed calls', async () => {
    const { c } = mountBar();
    expect(c['badgeText']()).toBe('0');
    const engine = h.engines.at(-1)!;
    engine.simulateIncoming('+201005550142').simulateRemoteHangup();
    await ctx.flush();
    expect(c['badgeText']()).toBe('1');
  });

  it('the timer reads 00:00 while idle', () => {
    const { c } = mountBar();
    expect(c['formattedTime']()).toBe('00:00');
  });
});
