import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadDetail, LeadRow } from '../leads.model';
import { LeadBoard } from './lead-board';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { LeadListTestHttp, LIST_CAPABILITIES } from './lead-list.testing';

let disposeHttp: () => void;

/*
 * The board runs on the real leads fake. A drop into the Disqualified lane is simulated with an optimistic
 * applyMove before the move output (the record board no longer does that for a 'confirm' lane, so this also
 * proves the host undoes a stray one), and the disqualify dialog is stubbed so the spec controls when it
 * confirms or cancels.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

// Protected members are reached through this view on purpose: the spec drives the board state directly.
type Internals = Record<string, any>;

const FROM = 'stage-new';
const TO = 'stage-disqualified';

let fixture: ComponentFixture<LeadBoard>;
let c: Internals;

async function flush(): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(2000);
  fixture.detectChanges();
}

/** Lane ids as the record board shows them, optimistic moves included. */
function shownLaneOf(id: string): string | undefined {
  const lanes = c['recordBoard']()['displayLanes']() as { id: string; items: LeadRow[] }[];
  return lanes.find((lane) => lane.items.some((item) => item.id === id))?.id;
}

function laneOf(id: string): string | undefined {
  return (c['lanes']() as { stage: { id: string }; items: LeadRow[] }[]).find((lane) =>
    lane.items.some((item) => item.id === id),
  )?.stage.id;
}

/** Drops the first New lead on the Disqualified lane with a dialog that settles when the spec says so. */
function dropOnDisqualified() {
  const lead = (c['lanes']() as { stage: { id: string }; items: LeadRow[] }[]).find((lane) => lane.stage.id === FROM)!
    .items[0];
  let settle!: (saved: LeadDetail | null) => void;
  const open = vi
    .spyOn(c['disqualifyDialog'](), 'open')
    .mockReturnValue(new Promise<LeadDetail | null>((resolve) => (settle = resolve)));
  c['recordBoard']().applyMove(lead.id, FROM, TO);
  const moving = c['move'](lead.id, TO) as Promise<void>;
  fixture.detectChanges();
  return { lead, open, settle, moving };
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.useFakeTimers();
  disposeHttp = bindCrmHttpForTest(new LeadListTestHttp());
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  fixture = TestBed.createComponent(LeadBoard);
  fixture.componentRef.setInput('body', { branchId: 'b1' });
  fixture.componentRef.setInput('capabilities', LIST_CAPABILITIES);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(() => {
  disposeHttp();
  fixture.destroy();
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lead board: drop on Disqualified', () => {
  it('keeps the card in its lane while the dialog is open, and nothing moves on cancel', async () => {
    const { lead, open, settle, moving } = dropOnDisqualified();

    expect(open).toHaveBeenCalledOnce();
    expect(shownLaneOf(lead.id)).toBe(FROM);

    settle(null);
    await moving;
    fixture.detectChanges();

    expect(shownLaneOf(lead.id)).toBe(FROM);
    expect(laneOf(lead.id)).toBe(FROM);
  });

  it('moves the card into Disqualified only after the dialog confirms', async () => {
    const { lead, settle, moving } = dropOnDisqualified();
    expect(shownLaneOf(lead.id)).toBe(FROM);

    settle({ ...lead, stageId: TO, stageFlag: 'DISQUALIFIED' } as unknown as LeadDetail);
    await moving;
    fixture.detectChanges();

    expect(laneOf(lead.id)).toBe(TO);
    expect(shownLaneOf(lead.id)).toBe(TO);
  });
});
