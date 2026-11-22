import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { Conference } from './conference';

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
  await ctx.flush(300);
  phone.mergeConference();
  await ctx.flush();
});

afterEach(() => {
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

async function mountConference() {
  const fixture = ctx.mount(Conference);
  await ctx.flush();
  return { el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Internals };
}

describe('Conference', () => {
  it('counts the participants including me', async () => {
    const { c } = await mountConference();
    expect(phone.mode()).toBe('conference');
    expect(c['participantCount']()).toBe(3);
  });

  it('Hold all / Resume all', async () => {
    const { el, c } = await mountConference();
    buttonByKey(el, 'webPhone.conference.holdAll')!.click();
    await ctx.flush();
    expect(c['allHeld']()).toBe(true);
    expect(phone.legs().every((l) => l.held)).toBe(true);

    buttonByKey(el, 'webPhone.conference.resumeAll')!.click();
    await ctx.flush();
    expect(phone.legs().every((l) => !l.held)).toBe(true);
  });

  it('adds a party up to the maximum, then Add is disabled with the hint', async () => {
    const { el, c } = await mountConference();
    buttonByKey(el, 'webPhone.inCall.add')!.click();
    await ctx.flush();
    expect(c['subView']()).toBe('addParty');
    c['pressPartyKey']('1');
    c['pressPartyKey']('0');
    c['pressPartyKey']('0');
    c['pressPartyKey']('3');

    const done = c['submitAddParty']() as Promise<void>;
    await ctx.flush(300);
    await done;
    await ctx.flush();

    expect(c['subView']()).toBe('main');
    expect(phone.legs()).toHaveLength(3);
    expect(c['atMaxParties']()).toBe(true);
    const add = buttonByKey(el, 'webPhone.inCall.add')!;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute('title')).toBe('webPhone.conference.maxPartiesHint');
  });

  it('tones go to the focused leg by default, or the chosen one while it exists', async () => {
    const { c } = await mountConference();
    const [first, second] = phone.legs();
    expect([first.id, second.id]).toContain(c['selectedToneTarget']());

    c['onSelectToneTarget'](second.id);
    expect(c['selectedToneTarget']()).toBe(second.id);
    expect(c['toneOptions']().map((o: { value: string }) => o.value)).toEqual([first.id, second.id]);
  });

  it('End for all asks first; confirm ends every leg as conferenceEnded', async () => {
    const { el, c } = await mountConference();
    const done = c['confirmEnd']() as Promise<void>;
    await ctx.flush();
    const dialog = el.querySelector('dialog[open]')!;
    expect(dialog).not.toBeNull();
    buttonByKey(dialog, 'webPhone.conference.endForAll')!.click();
    await done;
    await ctx.flush();
    expect(phone.busy()).toBe(false);
    expect(phone.ended()?.reason).toBe('conferenceEnded');
  });

  it('End for all, then cancel, keeps the conference', async () => {
    const { el, c } = await mountConference();
    const done = c['confirmEnd']() as Promise<void>;
    await ctx.flush();
    buttonByKey(el.querySelector('dialog[open]')!, 'webPhone.common.cancel')!.click();
    await done;
    expect(phone.mode()).toBe('conference');
  });
});
