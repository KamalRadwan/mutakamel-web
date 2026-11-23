import { DOCUMENT, Injectable } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { fakeFreeUp, fakeFreeUpPreview, fakeGetSeatUsage, fakeListSeatHolders, resetSeatsFake } from '../../../seats/seats.fake';
import { SeatPreviewApi } from '../../../seats/seats.api';
import { OrganizationReadApi } from '../../../staff/shared/organization-read.api';
import { BillingApi } from '../../billing.api';
import { CascadeAddonItem, SeatHolder, SeatUsage } from '../../../seats/seats.model';
import { StaffSession } from '../../../staff/shared/staff-session';
import { resetStaffFake } from '../../../staff/shared/staff.fake';
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
type Internals = SeatDowngradePage;

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
  c = fixture.componentInstance;
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
  resetStaffFake();
  resetSeatsFake();
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
      provideHttpClient(), provideHttpClientTesting(),
      { provide: SeatPreviewApi, useValue: { getSeatUsage: fakeGetSeatUsage, listSeatHolders: fakeListSeatHolders, freeUpPreview: fakeFreeUpPreview, freeUp: fakeFreeUp } },
      { provide: OrganizationReadApi, useValue: { listCompanies: async () => ({ data: [], meta: { hasNext: false } }), listBranches: async () => ({ data: [], meta: { hasNext: false } }) } },
      { provide: BillingApi, useValue: { getSubscription: async () => ({ baseItems: ['crm', 'trade'].map((applicationKey) => ({ applicationKey, id: `base-${applicationKey}` })) }) } },
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
  resetStaffFake();
  resetSeatsFake();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SeatDowngradePage HTTP contract', () => {
  const base = '/api/tenant/core/v1/seats';
  const usage = { mode: 'DERIVED', revision: 31, modules: [{ moduleKey: 'crm', kind: 'ROLE_DERIVED',
    nameI18n: { en: 'CRM', ar: 'CRM' }, capacity: 2, used: 2, overCapacity: 0,
    graceUntil: null, overCapacitySince: null, pendingCapacity: null }] };
  const holder = { userId: 'oldest', name: 'Oldest', email: 'oldest@example.invalid', status: 'ACTIVE',
    accessState: 'ACTIVE', grantedAt: '2026-01-01T00:00:00Z', cause: null, roles: [] };
  const meta = { page: 1, limit: 100, total: 2, totalPages: 2, hasNext: true, hasPrev: false };
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.overrideProvider(SeatPreviewApi, { useFactory: () => new SeatPreviewApi() });
    TestBed.overrideComponent(SeatDowngradePage, { set: { template: '', imports: [] } });
    const document = TestBed.inject(DOCUMENT);
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(`${document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixtureOwner = true;
    fixture = TestBed.createComponent(SeatDowngradePage); c = fixture.componentInstance;
    Object.defineProperty(c, 'confirmFreeDialog', { value: () => ({ open: async () => true }) });
    Object.defineProperty(c, 'conflictModal', { value: () => ({ open: vi.fn(), close: vi.fn() }), configurable: true });
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${base}/usage`).flush({ success: true, data: usage });
  });
  afterEach(() => http.verify());

  async function selectKeepers(): Promise<void> {
    await flush(0);
    const pending = c['goToStep2']();
    http.expectOne((req) => req.url.endsWith('/holders')).flush({ success: true, data: [holder], meta });
    await flush(0);
    const next = http.expectOne((req) => req.url.endsWith('/holders'));
    expect(next.request.params.get('page')).toBe('2');
    next.flush({ success: true, data: [{ ...holder, userId: 'newest', grantedAt: '2026-11-01T00:00:00Z' }], meta: { ...meta, page: 2, hasNext: false } });
    await flush(0);
    const preview = http.expectOne(`${base}/free-up/preview`);
    expect(preview.request.body).toEqual({ moduleKey: 'crm', targetSeats: 1, keepUserIds: ['oldest'] });
    expect(preview.request.headers.has('x-idempotency-key')).toBe(false);
    preview.flush({ success: true, data: { fits: true, removals: [] } });
    await pending;
  }

  it('paginates live holders, previews, and frees seats with the usage revision', async () => {
    await selectKeepers();
    await c['goToStep3']();
    expect(c['step']()).toBe(3);
    const pending = c['submitFreeUp'](); await flush(0);
    const request = http.expectOne(`${base}/free-up`);
    expect(request.request.body).toEqual({ moduleKey: 'crm', targetSeats: 1, keepUserIds: ['oldest'], expectedUsageRevision: 31 });
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    request.flush({ success: true, data: { ...usage, revision: 32 } });
    await pending;
    expect(c['usage']()?.revision).toBe(32);
    expect(c['freed']()).toBe(true);
  });

  it('does not advance or free seats after a failed preview', async () => {
    await selectKeepers();
    const preview = c['refreshPreview']('crm', 1, ['oldest']);
    http.expectOne(`${base}/free-up/preview`).flush({ errorCode: 'SEAT_CAPACITY_INSUFFICIENT' }, { status: 422, statusText: 'Invalid' });
    await preview;
    expect(c['preview']()).toBeNull();
    const review = c['goToStep3']();
    http.expectOne(`${base}/free-up/preview`).flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' }, { status: 503, statusText: 'Unavailable' });
    await review;
    expect(c['step']()).toBe(2);
    await c['submitFreeUp']();
    http.expectNone(`${base}/free-up`);
  });

  it('opens the conflict dialog on stale usage without marking seats freed', async () => {
    await selectKeepers();
    const open = vi.fn();
    Object.defineProperty(c, 'conflictModal', { value: () => ({ open }), configurable: true });
    const pending = c['submitFreeUp'](); await flush(0);
    http.expectOne(`${base}/free-up`).flush({ errorCode: 'SEAT_USAGE_STALE' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(open).toHaveBeenCalledOnce();
    expect(c['freed']()).toBe(false);
  });
  it('discards an old preview after usage is reloaded', async () => {
    await selectKeepers();
    const pending = c['refreshPreview']('crm', 1, ['oldest']);
    const old = http.expectOne(`${base}/free-up/preview`);
    const reload = c['loadUsage']();
    http.expectOne(`${base}/usage`).flush({ success: true, data: { ...usage, revision: 32 } });
    old.flush({ success: true, data: { fits: true, removals: [] } });
    await Promise.all([pending, reload]);
    expect(c['usage']()?.revision).toBe(32);
    expect(c['preview']()).toBeNull();
    expect(c['step']()).toBe(1);
  });
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

    expect(c['selectedModule']()?.moduleKey).toBe('trade');
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
    expect(c['usage']()?.revision).toBe(usage.revision + 1);
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
    expect(c['usage']()?.modules.find((m: { moduleKey: string }) => m.moduleKey === 'crm')?.used).toBe(keep.length);
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
