import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { setFakePhoneMeMode } from '../../../core/phone/phone.fake';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { PhonePanel } from './phone-panel';

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
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

async function mountPanel() {
  const fixture = ctx.mount(PhonePanel);
  await ctx.flush();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, c: fixture.componentInstance as unknown as Internals };
}

const body = (el: HTMLElement) => el.querySelector('[role="dialog"]')!;

describe('PhonePanel body switch (call UI state machine)', () => {
  it('idle: dialer; ringing: incoming card; answered: dialer in call; hung up: dialer idle', async () => {
    const { el } = await mountPanel();
    expect(body(el).querySelector('app-dialer')).not.toBeNull();

    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await ctx.flush();
    expect(body(el).querySelector('app-incoming-call')).not.toBeNull();
    expect(body(el).querySelector('app-dialer')).toBeNull();

    buttonByKey(el, 'webPhone.incoming.answer')!.click();
    await ctx.flush(300);
    expect(phone.callState()).toBe('active');
    expect(body(el).querySelector('app-dialer')).not.toBeNull();
    expect(buttonByKey(el, 'webPhone.inCall.hangup')).toBeDefined();

    buttonByKey(el, 'webPhone.inCall.hangup')!.click();
    await ctx.flush();
    expect(buttonByKey(el, 'webPhone.dialer.call')).toBeDefined();
  });

  it('a phone block replaces the call UI', async () => {
    const { el } = await mountPanel();
    setFakePhoneMeMode('notConfigured');
    await phone.reload();
    await ctx.flush();
    expect(phone.block()).toBe('notConfigured');
    expect(body(el).querySelector('app-phone-state')).not.toBeNull();
    expect(body(el).querySelector('app-dialer')).toBeNull();
  });

  it('Transfer from the dialer opens the transfer view; it closes when the call ends', async () => {
    const { el, c } = await mountPanel();
    await phone.call('+201005550142');
    await ctx.flush(300);

    buttonByKey(el, 'webPhone.inCall.transfer')!.click();
    await ctx.flush();
    expect(c['transferOpen']()).toBe(true);
    expect(body(el).querySelector('app-transfer')).not.toBeNull();

    phone.hangup();
    await ctx.flush();
    expect(c['transferOpen']()).toBe(false);
    expect(body(el).querySelector('app-transfer')).toBeNull();
  });

  it('consult and conference modes show their own views', async () => {
    const { el } = await mountPanel();
    await phone.call('+201005550142');
    await ctx.flush(300);
    await phone.startConsult('1002');
    await ctx.flush(300);
    expect(body(el).querySelector('app-consult-call')).not.toBeNull();

    phone.mergeConference();
    await ctx.flush();
    expect(body(el).querySelector('app-conference')).not.toBeNull();
  });

  it('tabs: Calls clears the missed count and shows the log; ringing shows an embedded card there', async () => {
    const { el } = await mountPanel();
    const engine = h.engines.at(-1)!;
    engine.simulateIncoming('+201005550142').simulateRemoteHangup();
    await ctx.flush();
    expect(phone.missedCount()).toBe(1);
    const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs()[1].textContent).toContain('1');

    tabs()[1].click();
    await ctx.flush();
    expect(phone.tab()).toBe('calls');
    expect(phone.missedCount()).toBe(0);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('app-call-log')).not.toBeNull();

    engine.simulateIncoming('+201005550142');
    await ctx.flush();
    expect(el.querySelector('app-incoming-call')).not.toBeNull();
  });

  it('arrow keys, Home and End move between tabs', async () => {
    const { el } = await mountPanel();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(phone.tab()).toBe('calls');
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(phone.tab()).toBe('phone');
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(phone.tab()).toBe('calls');
  });

  it('settings tab hides the tab list and shows the devices', async () => {
    const { el } = await mountPanel();
    phone.setTab('settings');
    await ctx.flush();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(el.querySelector('app-phone-devices')).not.toBeNull();
  });

  it('Escape folds the panel', async () => {
    const { el } = await mountPanel();
    body(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(phone.panelOpen()).toBe(false);
  });

  it('the missed badge starts at 0', async () => {
    const { c } = await mountPanel();
    expect(c['missedBadge']()).toBe('0');
  });
});
