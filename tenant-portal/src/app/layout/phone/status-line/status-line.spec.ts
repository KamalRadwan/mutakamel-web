import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, leg, phoneSpecContext, setUpPhoneTest, syncedState } from '../testing/phone-testing';
import { StatusLine, sourceRoute } from './status-line';

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

function mountLine() {
  const fixture = ctx.mount(StatusLine);
  return { el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Internals };
}

describe('StatusLine state text and dot', () => {
  it('idle registered: success dot, "registered" status', () => {
    const { c } = mountLine();
    expect(c['dotClass']()).toBe('bg-success');
    expect(c['stateText']()).toBe('webPhone.status.registered');
    expect(c['showTimer']()).toBe(false);
  });

  it('ringing: violet dot, "incoming call · caller"', async () => {
    const { c } = mountLine();
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-icon-violet');
    expect(c['stateText']()).toMatch(/^webPhone\.status\.incomingCall · /);
  });

  it('calling -> active -> held -> ended', async () => {
    const { c } = mountLine();
    await phone.call('+201005550142');
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-warning');
    expect(c['stateText']()).toContain('webPhone.inCall.calling');

    await ctx.flush(300);
    expect(phone.callState()).toBe('active');
    expect(c['showTimer']()).toBe(true);
    expect(c['stateText']()).toContain('webPhone.status.inCall');

    phone.toggleHold();
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-warning');
    expect(c['stateText']()).toContain('webPhone.inCall.onHold');

    phone.hangup();
    await ctx.flush();
    expect(c['showTimer']()).toBe(false);
    expect(c['stateText']()).toMatch(/^webPhone\.ended\.reasons\.ended · \d\d:\d\d$/);
  });

  it('busy outgoing (number ending in 0) ends as "call ended · busy"', async () => {
    const { c } = mountLine();
    await phone.call('+201005550140');
    await ctx.flush(300);
    expect(phone.ended()?.reason).toBe('busy');
    expect(c['stateText']()).toBe('webPhone.ended.reasons.ended · webPhone.ended.reasons.busy · 00:00');
  });

  it('blind transfer ends with the transfer target', async () => {
    const { c } = mountLine();
    await phone.call('+201005550142');
    await ctx.flush(300);
    phone.blindTransfer('1002');
    await ctx.flush(150);
    expect(phone.ended()?.reason).toBe('transferred');
    expect(c['endedPrefix'](phone.ended())).toBe('webPhone.ended.reasons.ended · webPhone.ended.reasons.transferredTo');
  });

  it('follower: mirrors the leader snapshot (quality colours the active dot)', async () => {
    const { c } = mountLine();
    h.leader.setFollower();
    const active = leg({ state: 'active', answeredAt: new Date().toISOString() });
    const snap = syncedState({ legs: [active], focusedLegId: active.id, call: 'active', busy: true });
    h.bus.publish('phone.state', { ...snap, quality: { level: 'poor', lossPct: 9, jitterMs: 80, rttMs: 400, mos: 2 } });
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-danger');
    h.bus.publish('phone.state', { ...snap, quality: null });
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-status-none');
  });

  it('redial calls the ended number again; disabled while the mic is blocked', async () => {
    const { c } = mountLine();
    expect(c['redialDisabled']()).toBe(false);
    c['redial']({ number: '1002', source: null });
    await ctx.flush();
    expect(phone.focusedLeg()?.number).toBe('1002');
  });

  it('formats durations as mm:ss and h:mm:ss', () => {
    const { c } = mountLine();
    expect(c['formatDuration'](59)).toBe('00:59');
    expect(c['formatDuration'](3_600)).toBe('1:00:00');
    expect(c['formatDuration'](-3)).toBe('00:00');
  });
});

describe('StatusLine tooltip', () => {
  it('toggles on click, closes on outside click, Escape dismisses until reopened', () => {
    const { el, c } = mountLine();
    const ev = new Event('click');
    c['toggleTooltip'](ev);
    expect(c['tooltipVisible']()).toBe(true);

    document.body.click();
    expect(c['tooltipOpen']()).toBe(false);

    c['toggleTooltip'](ev);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(c['tooltipVisible']()).toBe(false);
    expect(c['tooltipDismissed']()).toBe(true);

    c['toggleTooltip'](ev);
    expect(c['tooltipVisible']()).toBe(true);
    expect(el).toBeTruthy();
  });
});

describe('sourceRoute', () => {
  it('routes each record type', () => {
    expect(sourceRoute({ type: 'LEAD', id: '1', label: '' })).toEqual(['/crm/leads', '1']);
    expect(sourceRoute({ type: 'CUSTOMER_PROFILE', id: '2', label: '' })).toEqual(['/crm/customers', '2']);
    expect(sourceRoute({ type: 'OPPORTUNITY', id: '3', label: '' })).toEqual(['/crm/opportunities', '3']);
    expect(sourceRoute({ type: 'PARTY', id: '4', label: '' })).toEqual(['/workspace/operations/party-directory']);
  });
});
