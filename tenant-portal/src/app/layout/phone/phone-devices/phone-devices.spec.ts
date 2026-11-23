import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { PhoneHarness, PhoneSpecContext, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { PhoneDevices } from './phone-devices';

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
  try {
    ctx?.destroy();
    TestBed.resetTestingModule();
    h?.restore();
  } finally {
    vi.useRealTimers();
  }
});

function device(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: 'g', toJSON: () => ({}) } as MediaDeviceInfo;
}

async function mountDevices() {
  const fixture = ctx.mount(PhoneDevices);
  await ctx.flush();
  return { el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Internals };
}

describe('PhoneDevices', () => {
  it('device options start with "system default", skip duplicates and "default", and name unlabeled devices', async () => {
    const { c } = await mountDevices();
    const options = c['buildDeviceOptions']([
      device('audioinput', 'default', 'Default'),
      device('audioinput', 'mic-1', 'USB mic'),
      device('audioinput', 'mic-1', 'USB mic (again)'),
      device('audioinput', 'mic-2', '  '),
      device('audioinput', 'mic-3', ''),
    ]);
    expect(options.map((o: { value: string }) => o.value)).toEqual(['', 'mic-1', 'mic-2', 'mic-3']);
    expect(options[0].label).toBe('phoneCalls.settings.systemDefault');
    expect(options[1].label).toBe('USB mic');
    expect(options[2].label).toBe('phoneCalls.settings.deviceFallback');
  });

  it('a saved device that is no longer plugged in shows as system default', async () => {
    const { c } = await mountDevices();
    phone.setPref('micId', 'gone');
    phone.setPref('speakerId', 'gone');
    phone.setPref('ringId', 'gone');
    expect(c['selectedMicId']()).toBe('');
    expect(c['selectedSpeakerId']()).toBe('');
    expect(c['selectedRingId']()).toBe('');
  });

  it('changing devices writes the preferences ("" means system default -> null)', async () => {
    const { c } = await mountDevices();
    c['onMicChange']('mic-1');
    c['onSpeakerChange']('spk-1');
    c['onRingChange']('');
    expect(phone.prefs().micId).toBe('mic-1');
    expect(phone.prefs().speakerId).toBe('spk-1');
    expect(phone.prefs().ringId).toBeNull();
  });

  it('ring volume accepts off/low/high only', async () => {
    const { c } = await mountDevices();
    c['onRingVolumeChange']('low');
    expect(phone.prefs().ringVolume).toBe('low');
    c['onRingVolumeChange']('loud');
    c['onRingVolumeChange'](null);
    expect(phone.prefs().ringVolume).toBe('low');
    expect(c['ringVolumeOptions']().map((o: { value: string }) => o.value)).toEqual(['off', 'low', 'high']);
  });

  it('turning notifications on asks for permission only while it is still "default"', async () => {
    const { c } = await mountDevices();
    const ask = vi.spyOn(phone, 'requestNotifyPermission').mockResolvedValue();
    c['onNotificationsChange'](false);
    expect(ask).not.toHaveBeenCalled();
    expect(phone.prefs().notifications).toBe(false);

    c['onNotificationsChange'](true);
    expect(phone.prefs().notifications).toBe(true);
    expect(ask).toHaveBeenCalledTimes(phone.notifyPermission() === 'default' ? 1 : 0);

    ask.mockClear();
    c['onAllowNotifications']();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('the microphone permission badge follows the permission state', async () => {
    const { c } = await mountDevices();
    const expected: Record<string, string> = {
      granted: 'phoneCalls.settings.micPermission.allowed',
      simulated: 'phoneCalls.settings.micPermission.simulated',
      denied: 'phoneCalls.settings.micPermission.blocked',
    };
    const key = expected[phone.micPermission()] ?? 'phoneCalls.settings.micPermission.notAsked';
    expect(c['micPermissionBadge']().labelKey).toBe(key);
  });
});
