import { DOCUMENT, Injectable } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { fakeGetSeatUsage, fakeListSeatHolders, fakeSwitchToDerived, resetSeatsFake, setFakeMigrationShort, setFakeSeatMode } from '../../../seats/seats.fake';
import { SeatPreviewApi } from '../../../seats/seats.api';
import { OrganizationReadApi } from '../../../staff/shared/organization-read.api';
import { BillingApi } from '../../billing.api';
import { SeatUsage } from '../../../seats/seats.model';
import { StaffSession } from '../../../staff/shared/staff-session';
import { resetStaffFake, setFakeOverCapacity } from '../../../staff/shared/staff.fake';
import { SeatMigrationPage } from './seat-migration-page';

/*
 * Runs on the real seats fake (vi.mock of relative modules is not supported by the Angular unit-test
 * builder): MANUAL mode plus setFakeMigrationShort(true) makes POST /seats/switch-to-derived answer
 * 409 SEAT_MIGRATION_NOT_READY with the parallel string-array details {moduleKey, needed, free, capacity,
 * userModuleKey, userIds, userNames, used, usedAfter, shortfall}.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  /** Async like the HTTP loader: a synchronous loader emits during a render and throws NG0600. */
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

// Protected members are reached through this view on purpose: the spec reads the page state directly.
type Internals = SeatMigrationPage;

interface RowView {
  module: string;
  holders: string;
  seats: string;
  short: string;
}

let fixture: ComponentFixture<SeatMigrationPage>;
let c: Internals;
let fixtureOwner: boolean;
let cascadeConfirm: ReturnType<typeof vi.fn>;

async function flush(ms = 2000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

async function usageNow(): Promise<SeatUsage> {
  const pending = fakeGetSeatUsage();
  await vi.advanceTimersByTimeAsync(400);
  return pending;
}

function root(): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function bodyRows(): RowView[] {
  const table = root().querySelector('[role="table"]')!;
  return Array.from(table.querySelectorAll('[role="row"]:not([aria-hidden="true"])'))
    .slice(1)
    .map((row) => {
      const cells = Array.from(row.querySelectorAll('[role="cell"]')).map((cell) => cell.textContent?.trim() ?? '');
      return { module: cells[0], holders: cells[1], seats: cells[2], short: cells[3] };
    });
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  );
}

function toasts(type: string): string[] {
  return TestBed.inject(Notify)
    .toasts()
    .filter((t) => t.type === type)
    .map((t) => t.title);
}

async function render(owner = true): Promise<void> {
  fixtureOwner = owner;
  fixture = TestBed.createComponent(SeatMigrationPage);
  c = fixture.componentInstance;
  await flush();
}

async function clickSwitch(): Promise<void> {
  button('sb.mig.go')!.click();
  await flush();
}

beforeEach(() => {
  resetStaffFake();
  resetSeatsFake();
  vi.useFakeTimers();
  setFakeSeatMode('MANUAL');
  setFakeMigrationShort(true);
  cascadeConfirm = vi.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: SeatPreviewApi, useValue: { getSeatUsage: fakeGetSeatUsage, listSeatHolders: fakeListSeatHolders, switchToDerived: fakeSwitchToDerived } },
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SeatMigrationPage HTTP contract', () => {
  const base = '/api/tenant/core/v1/seats';
  const usage = { mode: 'MANUAL', revision: 4, modules: [] };
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.overrideProvider(SeatPreviewApi, { useFactory: () => new SeatPreviewApi() });
    TestBed.overrideComponent(SeatMigrationPage, { set: { template: '', imports: [] } });
    const document = TestBed.inject(DOCUMENT);
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(`${document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixtureOwner = true;
    fixture = TestBed.createComponent(SeatMigrationPage); c = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${base}/usage`).flush({ success: true, data: usage });
  });
  afterEach(() => http.verify());

  it('switches through HTTP with no body, a UUIDv7 key, and the returned revision', async () => {
    await flush(0);
    const pending = c['switchNow']();
    const request = http.expectOne(`${base}/switch-to-derived`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    request.flush({ success: true, data: { ...usage, mode: 'DERIVED', revision: 5 } });
    await pending;
    expect(c['usage']()?.revision).toBe(5);
    expect(navigate).toHaveBeenCalledWith(['/workspace/billing/subscription']);
  });

  it('confirms a cascade with a fresh key and explicit confirmation query', async () => {
    await flush(0);
    const pending = c['switchNow']();
    const first = http.expectOne(`${base}/switch-to-derived`);
    const key = first.request.headers.get('x-idempotency-key');
    first.flush({ errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details: { userIds: ['user'], userNames: ['User'], addonKeys: ['addon'], addonNames: ['Addon'] } }, { status: 409, statusText: 'Conflict' });
    await flush(0);
    const second = http.expectOne((req) => req.url === `${base}/switch-to-derived`);
    expect(cascadeConfirm).toHaveBeenCalledOnce();
    expect(second.request.params.get('confirmAddonCascade')).toBe('true');
    expect(second.request.headers.get('x-idempotency-key')).not.toBe(key);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    second.flush({ success: true, data: { ...usage, mode: 'DERIVED', revision: 5 } });
    await pending;
  });

  it('maps live migration shortfall details without pretending the switch succeeded', async () => {
    await flush(0);
    const pending = c['switchNow']();
    http.expectOne(`${base}/switch-to-derived`).flush({ errorCode: 'SEAT_MIGRATION_NOT_READY', details: {
      moduleKey: ['crm'], needed: ['3'], free: ['1'], capacity: ['4'], usedAfter: ['6'], shortfall: ['2'],
    } }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(c['migrationNotReady']()).toBe(true);
    expect(c['rows']()).toEqual([{ moduleKey: 'crm', nameI18n: null, holders: 6, seats: 4, shortBy: 2 }]);
    expect(c['usage']()?.mode).toBe('MANUAL');
  });
});

describe('SeatMigrationPage', () => {
  it('lists every module from the usage read: holders = used, seats = capacity, short = used - capacity', async () => {
    await render();
    const usage = await usageNow();

    expect(bodyRows()).toEqual(
      usage.modules.map((mod) => ({
        module: mod.nameI18n.en,
        holders: String(mod.used),
        seats: String(mod.capacity),
        short: String(Math.max(0, mod.used - mod.capacity)),
      })),
    );
    expect(c['hasShortfall']()).toBe(false);
    expect(root().textContent).not.toContain('sb.mig.short');
  });

  it('builds the shortfall rows from the parallel string-array details {moduleKey, needed, free}', async () => {
    // Over capacity drops CRM to 3 seats in the fake, so CRM is really short.
    setFakeOverCapacity(true);
    await render();
    const usage = await usageNow();
    const short = usage.modules
      .map((mod) => ({ mod, needed: Math.max(0, mod.used - mod.capacity), free: Math.max(0, mod.capacity - mod.used) }))
      .filter((m) => m.needed > 0);
    // The fake falls back to the first module when nothing is short; the spec relies on a real shortfall.
    expect(short.length).toBeGreaterThan(0);

    await clickSwitch();

    expect(c['hasShortfall']()).toBe(true);
    expect(root().textContent).toContain('sb.mig.short');
    expect(bodyRows()).toEqual(
      short.map(({ mod, needed, free }) => ({
        module: mod.nameI18n.en,
        holders: String(mod.capacity + (needed - free)),
        seats: String(mod.capacity),
        short: String(needed - free),
      })),
    );
    // Untranslated in the spec, seatErrorMessage falls back to the code itself.
    expect(toasts('error')).toEqual(['SEAT_MIGRATION_NOT_READY']);
    expect(c['usage']()?.mode).toBe('MANUAL');
  });

  it('reads the detail arrays by index, ignores empty module keys and treats bad counts as 0', async () => {
    await render();
    const usage = await usageNow();
    const [first, second] = usage.modules;
    const error = new ApiError(409, 'SEAT_MIGRATION_NOT_READY', {
      moduleKey: [second.moduleKey, '', first.moduleKey, 'hr'],
      needed: ['5', '9', 'x'],
      free: ['2', '0', '0', '1'],
    });

    const rows = c['rowsFromDetails'](error);

    expect(rows).toEqual([
      { moduleKey: second.moduleKey, nameI18n: second.nameI18n, holders: second.capacity + 3, seats: second.capacity, shortBy: 3 },
      { moduleKey: first.moduleKey, nameI18n: first.nameI18n, holders: first.capacity, seats: first.capacity, shortBy: 0 },
      // A module the usage read does not know: no name, no seats.
      { moduleKey: 'hr', nameI18n: null, holders: 0, seats: 0, shortBy: 0 },
    ]);
  });

  it('prefers the migration capacity, usedAfter and shortfall arrays over the usage read', async () => {
    await render();
    const usage = await usageNow();
    const [first] = usage.modules;
    const error = new ApiError(409, 'SEAT_MIGRATION_NOT_READY', {
      moduleKey: [first.moduleKey],
      needed: ['3'],
      free: ['1'],
      capacity: ['5'],
      userModuleKey: [],
      userIds: [],
      userNames: [],
      used: ['4'],
      usedAfter: ['7'],
      shortfall: ['2'],
    });

    expect(c['rowsFromDetails'](error)).toEqual([
      { moduleKey: first.moduleKey, nameI18n: first.nameI18n, holders: 7, seats: 5, shortBy: 2 },
    ]);
  });

  it('falls back to the usage-read rows when SEAT_MIGRATION_NOT_READY carries no details', async () => {
    await render();
    const before = bodyRows();

    // The fake always sends details, so the details-less error is passed through the page's own mapper.
    const rows = c['rowsFromDetails'](new ApiError(409, 'SEAT_MIGRATION_NOT_READY'));
    expect(rows).toEqual([]);
    c['migrationNotReady'].set(true);
    c['shortfallRows'].set(rows);
    await flush(0);

    expect(c['hasShortfall']()).toBe(true);
    expect(root().textContent).toContain('sb.mig.short');
    expect(bodyRows()).toEqual(before);
  });

  it('switches to role-based seats when nothing is short, then goes to the subscription page', async () => {
    setFakeMigrationShort(false);
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await clickSwitch();

    expect(toasts('success')).toEqual(['sb.mig.done']);
    expect(navigate).toHaveBeenCalledWith(['/workspace/billing/subscription']);
    expect(c['usage']()?.mode).toBe('DERIVED');
    expect(c['hasShortfall']()).toBe(false);
  });

  it('retry clears an earlier shortfall and shows the usage read again', async () => {
    await render();
    const before = bodyRows();
    await clickSwitch();
    expect(c['hasShortfall']()).toBe(true);

    const reloading = c['load']() as Promise<void>;
    await flush();
    await reloading;
    fixture.detectChanges();

    expect(c['hasShortfall']()).toBe(false);
    expect(bodyRows()).toEqual(before);
  });

  it('hides the switch button and the actions column from a non-owner', async () => {
    await render(false);

    expect(button('sb.mig.go')).toBeUndefined();
    expect(root().textContent).not.toContain('sb.mig.cols.actions');
    expect(bodyRows().length).toBeGreaterThan(0);
  });

  it('links each owner row to the change page with the add-seats query of its subscription item', async () => {
    await render();

    const links = Array.from(root().querySelectorAll<HTMLAnchorElement>('a[href*="/workspace/billing/subscription/change"]'));
    expect(links.map((a) => decodeURIComponent(a.getAttribute('href') ?? ''))).toEqual([
      '/workspace/billing/subscription/change?add=seats:base-crm',
      '/workspace/billing/subscription/change?add=seats:base-trade',
    ]);
  });
});
