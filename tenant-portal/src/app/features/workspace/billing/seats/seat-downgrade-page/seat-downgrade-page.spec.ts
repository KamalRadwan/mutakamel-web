import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { fakeFreeUp, fakeGetSeatUsage, fakeListSeatHolders } from '../../../seats/seats.fake';
import { CascadeAddonItem, SeatHolder, SeatUsage } from '../../../seats/seats.model';
import { StaffSession } from '../../../staff/shared/staff-session';
import { SeatDowngradePage } from './seat-downgrade-page';

/*
 * Runs on the real seats fake (vi.mock of relative modules is not supported by the Angular unit-test
 * builder). The fake's state is module-level, so every expectation is read back from the fake at the
 * time of the test instead of being hard-coded.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  /** Async like the HTTP loader: a synchronous loader emits during a render and throws NG0600. */
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

// Protected members are reached through this view on purpose: the spec reads the page state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<SeatDowngradePage>;
let c: Internals;
let fixtureOwner: boolean;
let cascadeConfirm: ReturnType<typeof vi.fn<(addons: readonly CascadeAddonItem[]) => Promise<boolean>>>;

async function flush(ms = 2000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(400);
  return promise;
}

async function usageNow(): Promise<SeatUsage> {
  return settle(fakeGetSeatUsage());
}

async function holdersOf(moduleKey: string): Promise<SeatHolder[]> {
  return (await settle(fakeListSeatHolders(moduleKey, { page: 1, limit: 100 }))).data;
}

function earliest(holders: readonly SeatHolder[], n: number): string[] {
  return holders
    .slice()
    .sort((a, b) => Date.parse(a.grantedAt) - Date.parse(b.grantedAt))
    .slice(0, n)
    .map((h) => h.userId);
}

function root(): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  );
}

function targetInput(): HTMLInputElement {
  return root().querySelector<HTMLInputElement>('input[type="number"]')!;
}

function toasts(type: string): string[] {
  return TestBed.inject(Notify)
    .toasts()
    .filter((t) => t.type === type)
    .map((t) => t.title);
}

async function render(opts: { owner?: boolean; url?: string } = {}): Promise<void> {
  fixtureOwner = opts.owner !== false;
  if (opts.url) {
    const navigating = TestBed.inject(Router).navigateByUrl(opts.url);
    await vi.advanceTimersByTimeAsync(0);
    await navigating;
  }
  fixture = TestBed.createComponent(SeatDowngradePage);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
}

async function typeTarget(value: string): Promise<void> {
  const input = targetInput();
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await flush(0);
}

async function next(): Promise<void> {
  button('sb.common.next')!.click();
  await flush();
}

/** Clicks the free-seats button, accepts the confirm dialog and lets the fake answer. */
async function freeAndConfirm(): Promise<void> {
  const submitting = c['submitFreeUp']() as Promise<void>;
  await flush(0);
  const dialog = root().querySelector('ui-confirm-dialog dialog[open]')!;
  const confirmBtn = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === 'sb.down.free',
  )!;
  confirmBtn.click();
  await flush();
  await submitting;
  await flush(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    // Browsers fire "close" from a queued task, after the dialog's own click handler has finished.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
  cascadeConfirm = vi.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [
      { provide: StaffSession, useValue: { isOwner: () => fixtureOwner } },
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['en', 'ar'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
      { provide: SeatCascadeConfirm, useValue: { confirm: cascadeConfirm } },
    ],
  });
});

afterEach(() => {
  fixture?.destroy();
  TestBed.resetTestingModule();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.useRealTimers();
});

describe('SeatDowngradePage, step 1', () => {
  it('presets the first module with a target one seat below its capacity', async () => {
    await render();
    const first = (await usageNow()).modules[0];

    expect(c['step']()).toBe(1);
    expect(c['moduleKey']()).toBe(first.moduleKey);
    expect(targetInput().value).toBe(String(first.capacity - 1));
    expect(targetInput().max).toBe(String(first.capacity - 1));
    expect(c['step1Valid']()).toBe(true);
    expect(c['choicesMade']()).toBe(false);
  });

  it('presets the module named by ?module=', async () => {
    await render({ url: '/?module=trade' });
    const trade = (await usageNow()).modules.find((m) => m.moduleKey === 'trade')!;

    expect(c['moduleKey']()).toBe('trade');
    expect(targetInput().value).toBe(String(trade.capacity - 1));
  });

  it('rejects a target outside 1..capacity-1 and stays on step 1', async () => {
    await render();
    const max = (await usageNow()).modules[0].capacity - 1;

    for (const bad of ['0', String(max + 1), 'abc', '']) {
      await typeTarget(bad);
      expect(c['targetError']()).toBe('sb.down.targetInvalid');
      expect(button('sb.common.next')!.disabled).toBe(true);
    }
    await c['goToStep2']();
    expect(c['step']()).toBe(1);

    await typeTarget(String(max));
    expect(c['targetError']()).toBeNull();
    expect(button('sb.common.next')!.disabled).toBe(false);
  });

  it('switching module resets the target to the new capacity - 1 and counts as a change', async () => {
    await render();
    const trade = (await usageNow()).modules.find((m) => m.moduleKey === 'trade')!;

    c['onModuleChange']('trade');
    await flush(0);

    expect(c['selectedModule']().moduleKey).toBe('trade');
    expect(targetInput().value).toBe(String(trade.capacity - 1));
    expect(c['choicesMade']()).toBe(true);
  });

  it('shows the permission message and no Next button to a non-owner', async () => {
    await render({ owner: false });

    expect(root().textContent).toContain('settings.errors.permission');
    expect(button('sb.common.next')).toBeUndefined();
    await c['goToStep2']();
    expect(c['step']()).toBe(1);
  });
});

describe('SeatDowngradePage, steps 2 and 3', () => {
  it('pre-checks the earliest holders up to the target and previews the rest as removals', async () => {
    await render();
    const mod = (await usageNow()).modules[0];
    const holders = await holdersOf(mod.moduleKey);
    const target = mod.capacity - 1;

    await next();

    expect(c['step']()).toBe(2);
    expect(c['holders']().map((h: SeatHolder) => h.userId).sort()).toEqual(holders.map((h) => h.userId).sort());
    expect(c['keptUserIds']()).toEqual(earliest(holders, target));
    const kept = new Set(earliest(holders, target));
    expect(c['removals']().map((r: { userId: string }) => r.userId).sort()).toEqual(
      holders.filter((h) => !kept.has(h.userId)).map((h) => h.userId).sort(),
    );
    expect(root().textContent).toContain('sb.down.count');
  });

  it('blocks step 3 while more keepers are checked than the target', async () => {
    await render();
    const mod = (await usageNow()).modules[0];
    const holders = await holdersOf(mod.moduleKey);
    // Target 1 leaves at least one unchecked holder to add.
    expect(holders.length).toBeGreaterThan(1);
    await typeTarget('1');
    await next();
    const extra = holders.find((h) => !c['keptUserIds']().includes(h.userId))!;

    c['toggleKeeper'](extra.userId, true);
    await flush(0);

    expect(c['tooManySelected']()).toBe(true);
    expect(root().textContent).toContain('sb.down.tooMany');
    await c['goToStep3']();
    expect(c['step']()).toBe(2);

    c['toggleKeeper'](extra.userId, false);
    await flush();
    const going = c['goToStep3']() as Promise<void>;
    await flush(0);
    await going;
    expect(c['step']()).toBe(3);
  });

  it('opens the conflict modal on SEAT_USAGE_STALE, and Reload goes back to step 1 with fresh usage', async () => {
    await render();
    await next();
    const going = c['goToStep3']() as Promise<void>;
    await flush(0);
    await going;

    // Another change lands first: a no-op free-up on Trade moves the usage revision on.
    const usage = await usageNow();
    const tradeHolders = await holdersOf('trade');
    await settle(
      fakeFreeUp({
        moduleKey: 'trade',
        targetSeats: tradeHolders.length,
        keepUserIds: tradeHolders.map((h) => h.userId),
        expectedUsageRevision: usage.revision,
      }),
    );

    await freeAndConfirm();

    const conflict = root().querySelector('ui-modal dialog')!;
    expect(conflict.hasAttribute('open')).toBe(true);
    expect(c['freed']()).toBe(false);
    expect(toasts('error')).toEqual([]);

    button('sb.conflict.reload')!.click();
    await flush();

    expect(conflict.hasAttribute('open')).toBe(false);
    expect(c['step']()).toBe(1);
    expect(c['usage']().revision).toBe(usage.revision + 1);
  });

  it('asks about lost add-ons on SEAT_ADDON_CASCADE_REQUIRED, then frees the seats with confirmAddonCascade', async () => {
    await render();
    const mod = (await usageNow()).modules[0];
    const holders = await holdersOf(mod.moduleKey);
    // u-nada holds the CRM outbound-email add-on in the fake; keep everyone else.
    expect(mod.moduleKey).toBe('crm');
    expect(holders.some((h) => h.userId === 'u-nada')).toBe(true);
    const keep = holders.filter((h) => h.userId !== 'u-nada').map((h) => h.userId);
    await typeTarget(String(keep.length));
    await next();
    for (const holder of holders) c['toggleKeeper'](holder.userId, keep.includes(holder.userId));
    await flush();
    const going = c['goToStep3']() as Promise<void>;
    await flush(0);
    await going;
    expect(c['removals']().map((r: { userId: string }) => r.userId)).toEqual(['u-nada']);

    await freeAndConfirm();
    await flush();

    expect(cascadeConfirm).toHaveBeenCalledTimes(1);
    expect(cascadeConfirm.mock.calls[0][0]).toEqual([
      expect.objectContaining({ userId: 'u-nada', addonKey: 'crm.outbound_email' }),
    ]);
    expect(c['freed']()).toBe(true);
    expect(root().textContent).toContain('sb.down.done');
    const after = (await usageNow()).modules.find((m) => m.moduleKey === 'crm')!;
    expect(after.used).toBe(keep.length);
    expect(c['usage']().modules.find((m: { moduleKey: string }) => m.moduleKey === 'crm').used).toBe(keep.length);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });
});

describe('SeatDowngradePage, leaving', () => {
  it('lets the user leave freely before any change, and asks once a choice was made', async () => {
    await render();
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);

    await typeTarget('1');
    const leaving = fixture.componentInstance.canDeactivate();
    await flush(0);
    const unsaved = root().querySelector('ui-unsaved-dialog dialog')!;
    expect(unsaved.hasAttribute('open')).toBe(true);
    button('sb.down.unsaved.discard')!.click();
    await flush(0);
    expect(await leaving).toBe(true);
  });
});
