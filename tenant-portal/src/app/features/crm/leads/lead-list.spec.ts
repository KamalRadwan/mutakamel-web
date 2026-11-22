import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../core/notify/notify';
import type { LeadDisqualify } from './lead-disqualify/lead-disqualify';
import { leadList } from './lead-list';
import { fakeGetLead, fakeListLeadStages } from './leads.fake';
import { LeadDetail, LeadRow, LeadStage } from './leads.model';

/* Cards and Table views: a move into Disqualified changes nothing until the dialog confirms. */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const TO = 'stage-disqualified';

let stages: LeadStage[];

async function settle<T>(promise: Promise<T>): Promise<T> {
  const done = promise;
  await vi.advanceTimersByTimeAsync(2000);
  return done;
}

function setup(open: LeadDisqualify['open']) {
  const onChanged = vi.fn();
  const dialog = { open } as unknown as LeadDisqualify;
  const list = TestBed.runInInjectionContext(() =>
    leadList(signal({ branchId: 'b1' }), signal(stages), undefined, undefined, undefined, undefined, onChanged, () => dialog),
  );
  TestBed.tick();
  return { list, onChanged };
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
  stages = await settle(fakeListLeadStages());
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('lead list: move into Disqualified', () => {
  it('cancel leaves the row and the page untouched', async () => {
    const open = vi.fn().mockResolvedValue(null);
    const { list, onChanged } = setup(open);
    await vi.advanceTimersByTimeAsync(2000);
    const lead = list.items().find((item: LeadRow) => item.stageId === 'stage-new')!;
    const before = list.items();
    const success = vi.spyOn(TestBed.inject(Notify), 'success');

    await list.move(lead, TO);
    TestBed.tick();

    expect(open).toHaveBeenCalledOnce();
    expect(onChanged).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(list.items()).toBe(before);
    expect((await settle(fakeGetLead(lead.id))).stageId).toBe('stage-new');
  });

  it('a confirmed dialog reports the move and reloads the page', async () => {
    const open = vi.fn((lead: LeadRow) => Promise.resolve({ ...lead, stageId: TO } as unknown as LeadDetail));
    const { list, onChanged } = setup(open as unknown as LeadDisqualify['open']);
    await vi.advanceTimersByTimeAsync(2000);
    const lead = list.items().find((item: LeadRow) => item.stageId === 'stage-new')!;
    const success = vi.spyOn(TestBed.inject(Notify), 'success');

    await list.move(lead, TO);

    expect(open).toHaveBeenCalledOnce();
    expect(onChanged).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
  });
});
