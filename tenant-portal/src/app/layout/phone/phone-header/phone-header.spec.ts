import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest, syncedState, textOf } from '../testing/phone-testing';
import { PhoneHeader } from './phone-header';

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

describe('PhoneHeader', () => {
  it('shows my name and extension from GET /me and a green dot when registered', () => {
    const fixture = ctx.mount(PhoneHeader);
    const c = fixture.componentInstance as unknown as Internals;
    expect(phone.identity().extension).not.toBe('');
    expect(textOf(fixture)).toContain(phone.identity().extension);
    expect(c['dotClass']()).toBe('bg-success');
  });

  it('the devices button opens settings; back returns to the phone tab', async () => {
    const fixture = ctx.mount(PhoneHeader);
    const el = fixture.nativeElement as HTMLElement;
    await ctx.flush();
    buttonByKey(el, 'webPhone.header.devices')!.click();
    await ctx.flush();
    expect(phone.tab()).toBe('settings');
    buttonByKey(el, 'webPhone.common.back')!.click();
    await ctx.flush();
    expect(phone.tab()).toBe('phone');
  });

  it('dot: violet while ringing, grey when paused, red on error (follower snapshot)', async () => {
    const fixture = ctx.mount(PhoneHeader);
    const c = fixture.componentInstance as unknown as Internals;
    h.engines.at(-1)!.simulateIncoming('+201005550142');
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-icon-violet');

    h.leader.setFollower();
    h.bus.publish('phone.state', syncedState({ paused: true }));
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-status-none');

    h.bus.publish('phone.state', syncedState({ connection: 'error' }));
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-danger');

    h.bus.publish('phone.state', syncedState({ connection: 'connecting' }));
    await ctx.flush();
    expect(c['dotClass']()).toBe('bg-warning');
  });
});
