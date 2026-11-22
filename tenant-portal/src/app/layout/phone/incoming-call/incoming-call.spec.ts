import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest, textOf } from '../testing/phone-testing';
import { IncomingCall } from './incoming-call';

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

async function ring(number = '+201005550142') {
  const leg = h.engines.at(-1)!.simulateIncoming(number);
  await ctx.flush();
  return leg;
}

describe('IncomingCall', () => {
  it('renders nothing while no call rings', async () => {
    const fixture = ctx.mount(IncomingCall);
    await ctx.flush();
    expect(textOf(fixture)).toBe('');
  });

  it('shows the caller with the looked-up record (fake lookup) and links it', async () => {
    const fixture = ctx.mount(IncomingCall);
    await ring();
    expect(phone.ringing()?.source?.label).toBe('أحمد علي');
    expect(textOf(fixture)).toContain('أحمد علي');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href]')).not.toBeNull();
  });

  it('Answer: ringing -> active and the panel opens on the phone tab', async () => {
    const fixture = ctx.mount(IncomingCall);
    await ring();
    phone.setTab('calls');

    buttonByKey(fixture.nativeElement as HTMLElement, 'webPhone.incoming.answer')!.click();
    await ctx.flush(300);

    expect(phone.callState()).toBe('active');
    expect(phone.panelOpen()).toBe(true);
    expect(phone.tab()).toBe('phone');
    expect(textOf(fixture)).toBe('');
  });

  it('Decline ends the ringing call (603) without counting it as missed', async () => {
    const fixture = ctx.mount(IncomingCall);
    await ring();

    buttonByKey(fixture.nativeElement as HTMLElement, 'webPhone.incoming.decline')!.click();
    await ctx.flush();

    expect(phone.ringing()).toBeNull();
    expect(phone.busy()).toBe(false);
    expect(phone.missedCount()).toBe(0);
  });

  it('Silence stops the ring but keeps the call ringing; the floating card also asks to be dismissed', async () => {
    const fixture = ctx.mount(IncomingCall, { floating: true });
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
    await ring();

    const silence = buttonByKey(fixture.nativeElement as HTMLElement, 'webPhone.incoming.silence')!;
    silence.click();
    await ctx.flush();

    expect(phone.ringSilenced()).toBe(true);
    expect(phone.ringing()).not.toBeNull();
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(silence.disabled).toBe(true);
  });

  it('the embedded card does not emit dismissed on silence', async () => {
    const fixture = ctx.mount(IncomingCall, { floating: false, embedded: true });
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
    await ring();
    buttonByKey(fixture.nativeElement as HTMLElement, 'webPhone.incoming.silence')!.click();
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('Answer and transfer answers, opens the panel and emits answerAndTransfer', async () => {
    const fixture = ctx.mount(IncomingCall, { floating: true });
    const transfer = vi.fn();
    fixture.componentInstance.answerAndTransfer.subscribe(transfer);
    await ring();

    buttonByKey(fixture.nativeElement as HTMLElement, 'webPhone.inCall.transfer')!.click();
    await ctx.flush(300);

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(phone.callState()).toBe('active');
  });

  it('routes each record type to its page', () => {
    const fixture = ctx.mount(IncomingCall);
    const c = fixture.componentInstance as unknown as Internals;
    expect(c['sourceRoute']({ type: 'LEAD', id: 'a', label: '' })).toEqual(['/crm/leads', 'a']);
    expect(c['sourceRoute']({ type: 'CUSTOMER_PROFILE', id: 'b', label: '' })).toEqual(['/crm/customers', 'b']);
    expect(c['sourceRoute']({ type: 'OPPORTUNITY', id: 'c', label: '' })).toEqual(['/crm/opportunities', 'c']);
    expect(c['sourceRoute']({ type: 'PARTY', id: 'd', label: '' })).toEqual(['/workspace/operations/party-directory']);
    expect(c['sourceIcon']('LEAD')).toBe('tablerUserPlus');
  });
});
