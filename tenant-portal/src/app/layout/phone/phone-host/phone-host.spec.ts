import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { setFakePhoneMeMode } from '../../../core/phone/phone.fake';
import { PhoneHarness, drainPhone, leg, setUpPhoneTest, syncedState } from '../testing/phone-testing';
import { ENDED_AUTO_COLLAPSE_MS, PhoneHost } from './phone-host';

/*
 * The whole phone UI (bar, panel, popup) on the real PhoneState + FakeSipEngine. The tab leader is the
 * harness fake, so the same host can be a leader tab (rings, owns the SIP leg) or a follower tab (shows the
 * leader's snapshot and sends commands over the tab bus).
 */

let h: PhoneHarness;
let fixture: ComponentFixture<PhoneHost>;
let phone: PhoneState;

async function flush(ms = 0): Promise<void> {
  await drainPhone((t) => vi.advanceTimersByTimeAsync(t), ms, () => TestBed.flushEffects());
  fixture.detectChanges();
  await drainPhone((t) => vi.advanceTimersByTimeAsync(t), 0, () => TestBed.flushEffects());
  fixture.detectChanges();
}

function el(): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function incomingPopover(): HTMLElement {
  return el().querySelector('.phone-incoming-popover') as HTMLElement;
}

function dock(): HTMLElement {
  return el().querySelector('.phone-dock-popover') as HTMLElement;
}

function click(root: ParentNode, selector: string): void {
  const target = root.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`missing ${selector}`);
  target.click();
}

/** The button whose text or aria-label carries this i18n key (translations are empty, so keys render). */
function button(root: ParentNode, key: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === key || b.getAttribute('aria-label') === key,
  );
}

async function mount(): Promise<void> {
  fixture = TestBed.createComponent(PhoneHost);
  phone = TestBed.inject(PhoneState);
  fixture.detectChanges();
  await flush(250); // fake connect (100 ms) + register (100 ms)
}

beforeEach(() => {
  vi.useFakeTimers();
  h = setUpPhoneTest();
  TestBed.configureTestingModule({ providers: h.providers });
});

afterEach(() => {
  fixture?.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

describe('PhoneHost (leader tab)', () => {
  it('registers on the fake engine and shows the bar, not the panel', async () => {
    await mount();

    expect(phone.connection()).toBe('registered');
    expect(dock().querySelector('app-phone-bar')).not.toBeNull();
    expect(dock().querySelector('app-phone-panel')).toBeNull();
  });

  it('rings: the floating popup shows with an assertive announcement, answering opens the panel in call', async () => {
    await mount();

    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await flush();

    expect(phone.ringing()?.number).toBe('+201005550142');
    expect(incomingPopover().querySelector('app-incoming-call')).not.toBeNull();
    expect(el().querySelector('[aria-live="assertive"]')?.textContent).toContain('webPhone.launcher.incomingFrom');

    click(incomingPopover(), '[data-phone-answer]');
    await flush(300);

    expect(phone.callState()).toBe('active');
    expect(phone.ringing()).toBeNull();
    expect(phone.panelOpen()).toBe(true);
    expect(incomingPopover().querySelector('app-incoming-call')).toBeNull();
    expect(dock().querySelector('app-phone-panel app-dialer')).not.toBeNull();
  });

  it('dismissing the popup (silence) hides it for that call only; the next call shows it again', async () => {
    await mount();
    const engine = h.engines.at(-1)!;

    const first = engine.simulateIncoming('+201005550142');
    await flush();
    button(incomingPopover(), 'webPhone.incoming.silence')!.click();
    await flush();
    expect(phone.ringSilenced()).toBe(true);
    expect(incomingPopover().querySelector('app-incoming-call')).toBeNull();

    first.simulateRemoteHangup();
    await flush();
    expect(phone.missedCount()).toBe(1);

    engine.simulateIncoming('+201005550142');
    await flush();
    expect(incomingPopover().querySelector('app-incoming-call')).not.toBeNull();
  });

  it('Answer and transfer from the popup answers and lands on the transfer view', async () => {
    await mount();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await flush();

    button(incomingPopover(), 'webPhone.inCall.transfer')!.click();
    await flush(300);

    expect(phone.callState()).toBe('active');
    expect(dock().querySelector('app-phone-panel app-transfer')).not.toBeNull();
  });

  it('Alt+Shift+A moves focus to the Answer button of the popup', async () => {
    await mount();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await flush();

    // jsdom does not move focus into a popover that was never shown, so the focus() call itself is checked.
    const answer = incomingPopover().querySelector<HTMLButtonElement>('[data-phone-answer]')!;
    const focus = vi.spyOn(answer, 'focus');
    const event = new KeyboardEvent('keydown', { key: 'A', code: 'KeyA', altKey: true, shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(phone.callState()).toBe('incoming'); // focus only, never answers by itself
  });

  it('declines from the popup: the call ends as declined and the popup goes away', async () => {
    await mount();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await flush();

    button(incomingPopover(), 'webPhone.incoming.decline')!.click();
    await flush();

    expect(phone.ringing()).toBeNull();
    expect(phone.busy()).toBe(false);
    expect(incomingPopover().querySelector('app-incoming-call')).toBeNull();
  });

  it('runs a call through the panel: dial, calling, active, hold, mute, hang up', async () => {
    await mount();
    phone.open('phone');
    await flush();

    const callBtn = () => button(dock(), 'webPhone.dialer.call')!;
    expect(callBtn().disabled).toBe(true); // nothing dialled yet

    phone.dialValue.set('+201005550142');
    await flush();
    expect(callBtn().disabled).toBe(false);
    callBtn().click();
    await flush();
    expect(phone.callState()).toBe('calling');
    expect(button(dock(), 'webPhone.inCall.hangup')).toBeDefined();
    expect(button(dock(), 'webPhone.inCall.hold')).toBeUndefined(); // hold only once answered

    await flush(300); // progress (100 ms) + accept (250 ms)
    expect(phone.callState()).toBe('active');

    button(dock(), 'webPhone.inCall.hold')!.click();
    await flush();
    expect(phone.focusedLeg()?.held).toBe(true);
    expect(button(dock(), 'webPhone.inCall.resume')?.getAttribute('aria-pressed')).toBe('true');
    button(dock(), 'webPhone.inCall.resume')!.click();
    await flush();
    expect(phone.focusedLeg()?.held).toBe(false);

    button(dock(), 'webPhone.audio.muteMic')!.click();
    await flush();
    expect(phone.muted()).toBe(true);
    expect(button(dock(), 'webPhone.audio.unmuteMic')).toBeDefined();

    button(dock(), 'webPhone.inCall.hangup')!.click();
    await flush();
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('ended');
    expect(button(dock(), 'webPhone.dialer.call')).toBeDefined();
  });

  it(`folds the open panel back to the bar ${ENDED_AUTO_COLLAPSE_MS} ms after the last call ends`, async () => {
    await mount();
    phone.open('phone');
    await phone.call('+201005550142');
    await flush(300);
    expect(phone.callState()).toBe('active');

    phone.hangup();
    await flush();
    expect(phone.panelOpen()).toBe(true);

    await flush(ENDED_AUTO_COLLAPSE_MS);
    expect(phone.panelOpen()).toBe(false);
    expect(dock().querySelector('app-phone-bar')).not.toBeNull();
  });

  it('carries out commands a follower tab sends over phone.command (answer, then hang up)', async () => {
    await mount();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await flush();

    h.bus.dispatch('phone.command', { name: 'answer', args: [] }, 'tab-follower');
    await flush(300);
    expect(phone.callState()).toBe('active');

    h.bus.dispatch('phone.command', { name: 'hangup', args: [] }, 'tab-follower');
    await flush();
    expect(phone.busy()).toBe(false);
  });

  it('publishes its state on phone.state so follower tabs can render the popup', async () => {
    await mount();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await flush();

    const last = h.bus.published.filter((m) => m.topic === 'phone.state').at(-1)?.payload as ReturnType<
      typeof syncedState
    >;
    expect(last.ringing?.number).toBe('+201005550142');
  });
});

describe('PhoneHost (follower tab)', () => {
  /** The leader's snapshot while a call rings there; PhoneState derives `ringing` from the incoming leg. */
  const ringingSnapshot = (overrides: Parameters<typeof syncedState>[0] = {}) => {
    const incoming = leg();
    return syncedState({
      legs: [incoming],
      focusedLegId: incoming.id,
      ringing: incoming,
      call: 'incoming',
      busy: true,
      status: { code: 'incomingCall' },
      ...overrides,
    });
  };

  async function mountFollower(): Promise<void> {
    await mount();
    h.leader.setFollower();
    await flush();
  }

  it('shows the incoming popup from the leader snapshot (popup in every tab) without a SIP leg here', async () => {
    await mountFollower();
    const enginesBefore = h.engines.length;

    h.bus.publish('phone.state', ringingSnapshot());
    await flush();

    expect(phone.isLeader()).toBe(false);
    expect(phone.ringing()?.id).toBe('leg-1');
    expect(incomingPopover().querySelector('app-incoming-call')).not.toBeNull();
    expect(h.engines.length).toBe(enginesBefore);
  });

  it('answer in a follower opens its panel and sends `answer` to the leader instead of answering locally', async () => {
    await mountFollower();
    h.bus.publish('phone.state', ringingSnapshot());
    await flush();
    h.bus.sent.length = 0;

    click(incomingPopover(), '[data-phone-answer]');
    await flush();

    expect(h.bus.sent).toContainEqual({ topic: 'phone.command', payload: { name: 'answer', args: [] } });
    expect(phone.panelOpen()).toBe(true);
  });

  it('hides Answer when the leader says this tab cannot answer here, keeps Decline', async () => {
    await mountFollower();
    h.bus.publish('phone.state', ringingSnapshot({ canAnswerHere: false }));
    await flush();

    expect(incomingPopover().querySelector('[data-phone-answer]')).toBeNull();
    expect(button(incomingPopover(), 'webPhone.incoming.decline')).toBeDefined();
  });

  it('mute and hang up in a follower bar are forwarded as commands', async () => {
    await mountFollower();
    const active = leg({ state: 'active', direction: 'outgoing', answeredAt: new Date().toISOString() });
    h.bus.publish(
      'phone.state',
      syncedState({ legs: [active], focusedLegId: active.id, call: 'active', busy: true, status: { code: 'inCall' } }),
    );
    await flush();
    h.bus.sent.length = 0;

    const bar = dock().querySelector('app-phone-bar')!;
    button(bar, 'webPhone.pill.mute')!.click();
    button(bar, 'webPhone.pill.hangupWith')!.click();
    await flush();

    expect(h.bus.sent.map((m) => (m.payload as { name: string }).name)).toEqual(['toggleMute', 'hangup']);
  });
});

describe('PhoneHost: WEBPHONE_* gates on GET /me', () => {
  it('WEBPHONE_MODULE_NOT_PURCHASED (403): renders nothing, silently', async () => {
    setFakePhoneMeMode('403');
    await mount();

    expect(phone.visible()).toBe(false);
    expect(dock().children.length).toBe(0);
    expect(incomingPopover().children.length).toBe(0);
  });

  it('WEBPHONE_PROVISIONING_PENDING (409): renders nothing, silently', async () => {
    setFakePhoneMeMode('409');
    await mount();

    expect(phone.visible()).toBe(false);
    expect(dock().children.length).toBe(0);
  });

  it('a visible phone that gets 403 on a later reload is hidden (no stale bar)', async () => {
    await mount();
    expect(dock().querySelector('app-phone-bar')).not.toBeNull();

    setFakePhoneMeMode('403');
    await phone.reload();
    await flush();

    expect(phone.visible()).toBe(false);
    expect(dock().querySelector('app-phone-bar')).toBeNull();
  });
});
