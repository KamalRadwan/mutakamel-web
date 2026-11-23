import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../settings/shared/settings-api';
import { fakeBoard, fakeGetLead, fakeListDisqualificationReasons, fakeListLeadStages } from '../leads.fake';
import { LeadDetail, LeadMoveError, LeadStage } from '../leads.model';
import { LeadDisqualify, reasonErrorCode } from './lead-disqualify';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { LeadListTestHttp } from '../lead-board/lead-list.testing';

let disposeHttp: () => void;
let http: LeadListTestHttp;

/*
 * The dialog runs on the real leads fake (vi.mock of relative modules is not supported by the Angular
 * unit-test builder), so every move goes through POST /leads/:id/stage as the fake models the backend.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

// Protected members are reached through this view on purpose: the spec drives the dialog state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<LeadDisqualify>;
let c: Internals;

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(2000);
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function flush(): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(2000);
  fixture.detectChanges();
}

async function stage(id: string): Promise<LeadStage> {
  return (await settle(fakeListLeadStages())).find((item) => item.id === id)!;
}

async function newLead(index = 0): Promise<{ id: string; displayName: string }> {
  const board = await settle(fakeBoard({ branchId: 'b1' }));
  const lead = board.stages.find((lane) => lane.stage.id === 'stage-new')!.items[index];
  return { id: lead.id, displayName: lead.displayName };
}

async function open(lead: { id: string; displayName: string }, target: LeadStage) {
  const result = fixture.componentInstance.open(lead, target);
  await flush();
  return { result, reasonId: c['reasons']()[0].id as string };
}

/** confirm() awaits the fake's timer, so it is driven together with the clock. */
async function confirm(): Promise<void> {
  const done = c['confirm']() as Promise<void>;
  await vi.advanceTimersByTimeAsync(2000);
  await done;
  fixture.detectChanges();
}

beforeEach(async () => {
  vi.useFakeTimers();
  http = new LeadListTestHttp();
  disposeHttp = bindCrmHttpForTest(http);
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  fixture = TestBed.createComponent(LeadDisqualify);
  c = fixture.componentInstance as unknown as Internals;
  fixture.detectChanges();
});

afterEach(() => {
  disposeHttp();
  fixture.destroy();
  TestBed.resetTestingModule();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.useRealTimers();
});

describe('lead disqualify dialog', () => {
  it.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('LeadDisqualify › no reasons access %s / %s', async (lang, theme) => {
    const old = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    try {
      vi.spyOn(http, 'read').mockRejectedValue(new ApiError(403, 'PERMISSION_DENIED'));
      const result = fixture.componentInstance.open(await newLead(), await stage('stage-disqualified'));
      await flush();
      c['selectedReasonId'].set('stale-reason');
      await confirm();
      expect(c['reasonsUnavailable']()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('leads.disqualify.noAccess');
      expect(http.recordedWrites()).toEqual([]);
      c['cancel'](); await expect(result).resolves.toBeNull();
    } finally {
      ['lang', 'dir', 'data-theme'].forEach((key, i) => old[i] === null
        ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, old[i]!));
    }
  });

  it.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('LeadDisqualify › reason flow %s / %s', async (lang, theme) => {
    const old = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    try {
      const { result, reasonId } = await open(await newLead(), await stage('stage-disqualified'));
      c['onReasonChange'](reasonId); await confirm();
      const saved = await result;
      expect(saved?.stageFlag).toBe('DISQUALIFIED');
      expect(http.recordedWrites()[0]).toMatchObject({ path: `/leads/${saved!.id}/stage`, body: {
        stageId: 'stage-disqualified', disqualificationReasonId: reasonId,
      } });
      expect(http.recordedWrites()[0].options.key).toBeTruthy();
      for (const code of ['CRM_REASON_REQUIRED', 'CRM_REASON_KIND_MISMATCH', 'CRM_REASON_UNAVAILABLE']) {
        expect(reasonErrorCode(new ApiError(422, code))).toBe(code);
      }
    } finally {
      ['lang', 'dir', 'data-theme'].forEach((key, i) => old[i] === null
        ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, old[i]!));
    }
  });

  it('lists the active DISQUALIFICATION reasons and starts with none chosen', async () => {
    const expected = await settle(fakeListDisqualificationReasons());
    await open(await newLead(), await stage('stage-disqualified'));

    expect(c['reasons']().map((r: { id: string }) => r.id)).toEqual(expected.map((r) => r.id));
    expect(c['selectedReasonId']()).toBe('');
  });

  it('puts the initial focus on the reason dropdown, not on the "!" hint', async () => {
    const { result } = await open(await newLead(), await stage('stage-disqualified'));
    await flush();

    expect(document.activeElement?.id).toBe(c['reasonId']);
    c['cancel']();
    await expect(result).resolves.toBeNull();
  });

  it('needs a reason: Confirm without one shows CRM_REASON_REQUIRED and leaves the lead where it was', async () => {
    const lead = await newLead();
    const { result } = await open(lead, await stage('stage-disqualified'));

    await confirm();

    expect(c['errorCode']()).toBe('CRM_REASON_REQUIRED');
    expect(c['reasonError']()).toBe('leads.move.errors.CRM_REASON_REQUIRED');
    expect(fixture.nativeElement.textContent).toContain('leads.move.errors.CRM_REASON_REQUIRED');
    expect(c['request']()).not.toBeNull();
    expect((await settle(fakeGetLead(lead.id))).stageId).toBe('stage-new');
    c['cancel']();
    await expect(result).resolves.toBeNull();
  });

  it('Confirm moves the lead with the chosen reason and resolves with the saved lead', async () => {
    const lead = await newLead(1);
    const { result, reasonId } = await open(lead, await stage('stage-disqualified'));
    c['onReasonChange'](reasonId);

    await confirm();

    // Without the reason the fake refuses with CRM_REASON_REQUIRED, so a disqualified lead proves it was sent.
    const saved = (await result) as LeadDetail;
    expect(saved).toMatchObject({ id: lead.id, stageId: 'stage-disqualified', status: 'DISQUALIFIED' });
    expect(c['request']()).toBeNull();
  });

  it('Cancel resolves with null and never moves', async () => {
    const lead = await newLead(2);
    const { result } = await open(lead, await stage('stage-disqualified'));

    c['cancel']();

    await expect(result).resolves.toBeNull();
    expect((await settle(fakeGetLead(lead.id))).stageId).toBe('stage-new');
  });

  it('shows CRM_REASON_UNAVAILABLE on the reason field, clears the choice and reloads the reasons', async () => {
    await open(await newLead(3), await stage('stage-disqualified'));
    c['onReasonChange']('reason-gone');

    await confirm();

    expect(c['request']()).not.toBeNull();
    expect(c['errorCode']()).toBe('CRM_REASON_UNAVAILABLE');
    expect(c['reasonError']()).toBe('leads.move.errors.CRM_REASON_UNAVAILABLE');
    expect(c['selectedReasonId']()).toBe('');
    await flush();
    expect(c['reasonsLoading']()).toBe(false);
    expect(c['reasons']().length).toBeGreaterThan(0);
  });

  it('shows CRM_REASON_KIND_MISMATCH on the reason field when the stage does not disqualify', async () => {
    const { reasonId } = await open(await newLead(4), await stage('stage-qualified'));
    c['onReasonChange'](reasonId);

    await confirm();

    expect(c['request']()).not.toBeNull();
    expect(c['errorCode']()).toBe('CRM_REASON_KIND_MISMATCH');
    expect(fixture.nativeElement.textContent).toContain('leads.move.errors.CRM_REASON_KIND_MISMATCH');
  });

  it('closes and rejects with any other error so the caller can show it', async () => {
    const { result, reasonId } = await open({ id: 'lead-gone', displayName: 'Gone' }, await stage('stage-disqualified'));
    c['onReasonChange'](reasonId);
    const settled = result.catch((e: unknown) => e);

    await confirm();

    await expect(settled).resolves.toMatchObject({ status: 404, code: 'LEAD_NOT_FOUND' });
    expect(c['request']()).toBeNull();
  });

  it('maps only the three reason codes to the reason field', () => {
    expect(reasonErrorCode(new LeadMoveError('CRM_REASON_REQUIRED'))).toBe('CRM_REASON_REQUIRED');
    expect(reasonErrorCode(new LeadMoveError('CRM_REASON_UNAVAILABLE'))).toBe('CRM_REASON_UNAVAILABLE');
    expect(reasonErrorCode(new LeadMoveError('CRM_REASON_KIND_MISMATCH'))).toBe('CRM_REASON_KIND_MISMATCH');
    expect(reasonErrorCode(new LeadMoveError('LEAD_STAGE_INVALID'))).toBeNull();
    expect(reasonErrorCode(new ApiError(404, 'LEAD_NOT_FOUND'))).toBeNull();
  });
});
