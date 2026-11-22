import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { listCallLogs } from '../../../core/phone/phone.api';
import { setFakeCallLogsMode } from '../../../core/phone/phone.fake';
import { CallLogRow } from '../../../shared/widgets/call-log/call-log.model';
import { PhoneHarness, PhoneSpecContext, buttonByKey, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { CallLog } from './call-log';

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

async function mountLog() {
  const fixture = ctx.mount(CallLog);
  await ctx.flush();
  return { fixture, c: fixture.componentInstance as unknown as Internals };
}

/** Scrolls the list to its end (jsdom has no layout, so the sizes are set by hand). */
function scrollToEnd(fixture: { nativeElement: HTMLElement }): void {
  const list = fixture.nativeElement.querySelector('[class*="overflow-y-auto"]') as HTMLElement;
  Object.defineProperty(list, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(list, 'clientHeight', { value: 400, configurable: true });
  list.scrollTop = 600;
  list.dispatchEvent(new Event('scroll'));
}

describe('CallLog (recent calls tab)', () => {
  it('loads the first page of 20, newest first, grouped by day', async () => {
    const direct = await listCallLogs({ page: 1, limit: 20 });
    const { c } = await mountLog();

    expect(c['loading']()).toBe(false);
    expect(c['items']().map((row: CallLogRow) => row.id)).toEqual(direct.data.map((row) => row.id));
    expect(c['total']()).toBe(direct.meta.total);
    const keys = c['groups']().map((g: { key: string }) => g.key);
    expect(keys).toEqual(['today', 'yesterday', 'earlier'].filter((k) => keys.includes(k)));
  });

  it('loads the next page on scroll to the end and does not duplicate rows', async () => {
    const { fixture, c } = await mountLog();
    expect(c['total']()).toBeGreaterThan(20);

    scrollToEnd(fixture);
    await ctx.flush();

    const ids: string[] = c['items']().map((row: CallLogRow) => row.id);
    expect(c['page']()).toBe(2);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows the failed state when the API errors, and Retry reloads', async () => {
    setFakeCallLogsMode('error');
    const { fixture, c } = await mountLog();

    expect(c['failed']()).toBe(true);
    expect(c['items']()).toEqual([]);

    setFakeCallLogsMode('normal');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click(); // the failed state's Retry
    await ctx.flush();
    expect(c['failed']()).toBe(false);
    expect(c['items']().length).toBeGreaterThan(0);
  });

  it('an empty log is not a failure', async () => {
    setFakeCallLogsMode('empty');
    const { c } = await mountLog();
    expect(c['failed']()).toBe(false);
    expect(c['items']()).toEqual([]);
    expect(c['groups']()).toEqual([]);
  });

  it('reloads each time the user comes back to the calls tab (not on first render)', async () => {
    const { c } = await mountLog();
    const reload = vi.spyOn(c as { reload(): Promise<void> }, 'reload');

    phone.setTab('phone');
    await ctx.flush();
    expect(reload).not.toHaveBeenCalled();

    phone.setTab('calls');
    await ctx.flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('call back switches to the phone tab and dials the number with its record', async () => {
    const { c } = await mountLog();
    phone.setTab('calls');
    const row: CallLogRow = c['items']()[0];

    c['onCallBack'](row);
    await ctx.flush();

    expect(phone.tab()).toBe('phone');
    expect(phone.callState()).toBe('calling');
    expect(phone.focusedLeg()?.number).toBe(row.number);
  });

  it('has a full-history button that opens the history modal', async () => {
    const { fixture } = await mountLog();
    buttonByKey(fixture.nativeElement as HTMLElement, 'phoneCalls.actions.viewAll')!.click();
    await ctx.flush();
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog[open]')).not.toBeNull();
  });
});
