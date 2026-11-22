import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { AudioRow } from './audio-row';

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

async function mountRow(kind: 'mic' | 'speaker') {
  const fixture = ctx.mount(AudioRow, { kind });
  const el = fixture.nativeElement as HTMLElement;
  await ctx.flush();
  return {
    el,
    c: fixture.componentInstance as unknown as Internals,
    toggle: el.querySelector<HTMLButtonElement>('button')!,
    slider: el.querySelector<HTMLInputElement>('input')!,
  };
}

describe('AudioRow', () => {
  it('mic: toggles mute on the phone, with icon, label and aria-pressed following it', async () => {
    const { toggle, c } = await mountRow('mic');
    expect(toggle.getAttribute('aria-label')).toBe('webPhone.audio.muteMic');
    expect(c['iconName']()).toBe('tablerMicrophone');

    toggle.click();
    await ctx.flush();
    expect(phone.muted()).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('webPhone.audio.unmuteMic');
    expect(c['iconName']()).toBe('tablerMicrophoneOff');
    expect(c['levelPct']()).toBe(0);
  });

  it('speaker: toggles the speaker, not the mic', async () => {
    const { toggle, c } = await mountRow('speaker');
    toggle.click();
    await ctx.flush();
    expect(phone.speakerMuted()).toBe(true);
    expect(phone.muted()).toBe(false);
    expect(c['iconName']()).toBe('tablerVolumeOff');
    expect(toggle.getAttribute('aria-label')).toBe('webPhone.audio.unmuteSpeaker');
  });

  it('the slider writes the volume preference, rounded and clamped to 0..100; junk is ignored', async () => {
    const { slider } = await mountRow('speaker');
    const input = (value: string) => {
      Object.defineProperty(slider, 'value', { value, configurable: true });
      slider.dispatchEvent(new Event('input'));
    };
    input('42.6');
    expect(phone.prefs().speakerVolume).toBe(43);
    input('150');
    expect(phone.prefs().speakerVolume).toBe(100);
    input('-5');
    expect(phone.prefs().speakerVolume).toBe(0);
    input('abc');
    expect(phone.prefs().speakerVolume).toBe(0);
  });

  it('the mic slider writes micVolume and labels itself', async () => {
    const { slider } = await mountRow('mic');
    expect(slider.getAttribute('aria-label')).toBe('webPhone.audio.micVolume');
    Object.defineProperty(slider, 'value', { value: '30', configurable: true });
    slider.dispatchEvent(new Event('input'));
    expect(phone.prefs().micVolume).toBe(30);
  });
});
