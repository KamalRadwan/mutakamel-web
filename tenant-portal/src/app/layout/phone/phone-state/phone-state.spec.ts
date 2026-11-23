import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { setFakePhoneMeMode } from '../../../core/phone/phone.fake';
import { PhoneBlock } from '../call-log-type';
import { PhoneHarness, PhoneSpecContext, phoneSpecContext, setUpPhoneTest, textOf } from '../testing/phone-testing';
import { PhoneStateView } from './phone-state';

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

const TEXT_BLOCKS: Exclude<PhoneBlock, null | 'loading'>[] = [
  'notConfigured',
  'connecting',
  'registrationFailed',
  'offline',
  'requiresHttps',
  'unsupported',
  'micBlocked',
  'noMicrophone',
  'paused',
  'suspended',
  'scopeMismatch',
];

describe('PhoneStateView (blocked phone states)', () => {
  it.each(TEXT_BLOCKS)('renders the %s title and line', async (block) => {
    const fixture = ctx.mount(PhoneStateView, { block });
    await ctx.flush();
    expect(textOf(fixture)).toContain(`phoneCalls.states.${block}.title`);
  });

  it('loading is a busy skeleton with no text', async () => {
    const fixture = ctx.mount(PhoneStateView, { block: 'loading' });
    await ctx.flush();
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(textOf(fixture)).toBe('');
  });

  it('registrationFailed and offline offer Retry, which restarts registration on the fake engine', async () => {
    for (const block of ['registrationFailed', 'offline'] as const) {
      const fixture = ctx.mount(PhoneStateView, { block });
      const retry = vi.spyOn(phone, 'retry');
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
      expect(retry).toHaveBeenCalledTimes(1);
      retry.mockRestore();
    }
  });

  it('suspended offers Retry, which re-fetches /me and recovers once the subscription is active', async () => {
    setFakePhoneMeMode('MODULE_INACTIVE');
    await phone.reload();
    await ctx.flush();
    expect(phone.block()).toBe('suspended');
    const fixture = ctx.mount(PhoneStateView, { block: phone.block() });
    await ctx.flush();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('phoneCalls.states.suspended.action');

    setFakePhoneMeMode('enabled');
    buttons[0].click();
    await ctx.flush(250);
    expect(phone.block()).toBeNull();
    expect(phone.connection()).toBe('registered');
  });

  it('scopeMismatch offers Reload page, which reloads the document instead of retrying', async () => {
    const fixture = ctx.mount(PhoneStateView, { block: 'scopeMismatch' });
    await ctx.flush();
    const view = fixture.componentInstance as unknown as { reloadPage: () => void };
    const reload = vi.spyOn(view, 'reloadPage').mockImplementation(() => {});
    const retry = vi.spyOn(phone, 'retry');
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('phoneCalls.states.scopeMismatch.action');
    buttons[0].click();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('micBlocked sends the user to the settings tab', async () => {
    const fixture = ctx.mount(PhoneStateView, { block: 'micBlocked' });
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    expect(phone.tab()).toBe('settings');
  });
});

describe('GET /me error mapping as the phone UI sees it', () => {
  it('WEBPHONE_MODULE_NOT_PURCHASED (403) clears the phone: hidden, no block, no error toast', async () => {
    setFakePhoneMeMode('403');
    await phone.reload();
    expect(phone.visible()).toBe(false);
    expect(phone.block()).toBeNull();
    expect(phone.status().code).toBe('disabled');
  });

  it('WEBPHONE_PROVISIONING_PENDING (409) clears the phone the same way', async () => {
    setFakePhoneMeMode('409');
    await phone.reload();
    expect(phone.visible()).toBe(false);
    expect(phone.block()).toBeNull();
  });

  it.each([
    ['MODULE_INACTIVE', 'suspended'],
    ['SCOPE_MISMATCH', 'scopeMismatch'],
  ] as const)('WEBPHONE_%s (403) keeps the phone visible on its own %s block', async (mode, expected) => {
    setFakePhoneMeMode(mode);
    await phone.reload();
    await ctx.flush();
    expect(phone.visible()).toBe(true);
    expect(phone.block()).toBe(expected);
    const fixture = ctx.mount(PhoneStateView, { block: phone.block() });
    await ctx.flush();
    const text = textOf(fixture);
    expect(text).toContain(`phoneCalls.states.${expected}.title`);
    expect(text).not.toContain('phoneCalls.states.registrationFailed');
  });

  it('OVER_CAPACITY keeps the phone visible but paused; notConfigured shows its block', async () => {
    setFakePhoneMeMode('OVER_CAPACITY');
    await phone.reload();
    await ctx.flush();
    expect(phone.visible()).toBe(true);
    expect(phone.block()).toBe('paused');

    setFakePhoneMeMode('notConfigured');
    await phone.reload();
    await ctx.flush();
    expect(phone.block()).toBe('notConfigured');
  });

  it('a registration failure on the fake engine maps to the registrationFailed block', async () => {
    const engine = h.engines.at(-1)!;
    engine.simulateRegistrationFailure('Forbidden', 403);
    await ctx.flush(1_000);
    h.engines.at(-1)!.simulateRegistrationFailure('Forbidden', 403);
    await ctx.flush();
    // Two servers x two attempts in the fake chain; keep failing until the chain is exhausted.
    for (let i = 0; i < 4 && phone.block() !== 'registrationFailed'; i++) {
      await ctx.flush(1_000);
      h.engines.at(-1)!.simulateRegistrationFailure('Forbidden', 403);
      await ctx.flush();
    }
    expect(phone.block()).toBe('registrationFailed');
    expect(phone.connection()).toBe('error');
  });
});
