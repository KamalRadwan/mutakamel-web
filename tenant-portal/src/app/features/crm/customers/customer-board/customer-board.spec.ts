import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerBoardItem, CustomerStatus } from '../customers.model';
import { CustomerBoard } from './customer-board';

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
  vi.useFakeTimers();
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  fixture = TestBed.createComponent(CustomerBoard);
  fixture.componentRef.setInput('body', { branchId: 'b1' });
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(() => {
  fixture.destroy();
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
