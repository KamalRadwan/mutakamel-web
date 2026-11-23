import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerBoardItem, CustomerDetail, CustomerStatus } from '../customers.model';
import { CustomerBoard } from './customer-board';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CUSTOMERS_FAKE_DB, fakeLoadBoard, fakeSetCustomerStatus } from '../customers.fake';
import { CustomerSearchBody } from '../customers.model';

/*
 * The board runs on the real customers fake. A drop on Blacklisted is simulated through the record board's own
 * drop handler, and the blacklist confirm dialog is stubbed so the spec controls when it confirms or cancels.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

// Protected members are reached through this view on purpose: the spec drives the board state directly.
type Internals = Record<string, any>;
type Lane = { id: string; items: CustomerBoardItem[] };

const TO: CustomerStatus = 'BLACKLISTED';

let fixture: ComponentFixture<CustomerBoard>;
let c: Internals;
let dispose: () => void;
let customersBefore: CustomerDetail[];

async function flush(): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(2000);
  fixture.detectChanges();
}

/** Lane ids as the record board shows them, optimistic moves included. */
function shownLaneOf(id: string): string | undefined {
  const lanes = c['recordBoard']()['displayLanes']() as Lane[];
  return lanes.find((lane) => lane.items.some((item) => item.id === id))?.id;
}

function laneOf(id: string): string | undefined {
  return (c['lanes']() as { status: string; items: CustomerBoardItem[] }[]).find((lane) =>
    lane.items.some((item) => item.id === id),
  )?.status;
}

/** Drops the first card of a lane that may move to Blacklisted, with a dialog that settles when the spec says so. */
function dropOnBlacklisted() {
  const from = (c['lanes']() as { status: CustomerStatus; items: CustomerBoardItem[] }[]).find(
    (lane) => lane.status !== TO && lane.status !== 'ACTIVE_CUSTOMER' && lane.items.length > 0,
  )!;
  const item = from.items[0];
  let settle!: (ok: boolean) => void;
  const open = vi
    .spyOn(c['blacklistDialog'](), 'open')
    .mockReturnValue(new Promise<boolean>((resolve) => (settle = resolve)));
  const board = c['recordBoard']();
  const target = (board['displayLanes']() as Lane[]).find((lane) => lane.id === TO)!;
  board['onDropped'](target, { recordId: item.id, fromLaneId: from.status, height: 40 });
  fixture.detectChanges();
  return { from: from.status, item, open, settle };
}

beforeEach(async () => {
  customersBefore = structuredClone(CUSTOMERS_FAKE_DB);
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  TestBed.configureTestingModule({
    providers: [
      { provide: TenantScopeState, useValue: { me: () => ({ isTenantOwner: true }) } },
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  const stub = new CrmHttpStub();
  vi.spyOn(stub, 'write').mockImplementation(async <T>(_method: unknown, path: string, body: unknown) => ({
    status: 200,
    data: (path.endsWith('/board') ? await fakeLoadBoard(body as CustomerSearchBody)
      : await fakeSetCustomerStatus(path.split('/').at(-1)!, (body as { status: CustomerStatus }).status,
        (body as { expectedUpdatedAt: string }).expectedUpdatedAt)) as T,
    etag: null, location: null,
  }));
  dispose = bindCrmHttpForTest(stub);
  fixture = TestBed.createComponent(CustomerBoard);
  fixture.componentRef.setInput('body', { branchId: 'b1' });
  fixture.componentRef.setInput('capabilities', { branchId: 'b1', customerProfiles: {
    create: { scope: 'all', ownerUserIds: null }, update: { scope: 'all', ownerUserIds: null },
    delete: { scope: 'all', ownerUserIds: null },
  } });
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(() => {
  fixture.destroy();
  CUSTOMERS_FAKE_DB.splice(0, CUSTOMERS_FAKE_DB.length, ...customersBefore);
  vi.unstubAllGlobals();
  dispose();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('customer board: drop on Blacklisted', () => {
  it('keeps the card in its lane while the dialog is open, and nothing moves on cancel', async () => {
    const { from, item, open, settle } = dropOnBlacklisted();

    expect(open).toHaveBeenCalledOnce();
    expect(shownLaneOf(item.id)).toBe(from);

    settle(false);
    await flush();

    expect(shownLaneOf(item.id)).toBe(from);
    expect(laneOf(item.id)).toBe(from);
  });

  it('moves the card into Blacklisted only after the dialog confirms', async () => {
    const { item, settle } = dropOnBlacklisted();
    expect(shownLaneOf(item.id)).not.toBe(TO);

    settle(true);
    await flush();

    expect(laneOf(item.id)).toBe(TO);
    expect(shownLaneOf(item.id)).toBe(TO);
  });
});
