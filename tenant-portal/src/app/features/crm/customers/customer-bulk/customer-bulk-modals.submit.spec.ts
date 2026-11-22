import { Injectable, Type } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import type { BulkJobSubmit, BulkJobSubmitResult } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { toLocalDateTime } from '../../../../shared/widgets/activities/activity-form/activity-form.model';
import { ApiError } from '../../settings/shared/settings-api';
import { DEFAULT_CUSTOMER_BRANCH_ID } from '../customers.fake';
import { CustomerBulkActivityModal } from './activity-modal/customer-bulk-activity-modal';
import { CustomerBulkAssignModal } from './assign-modal/customer-bulk-assign-modal';
import { SelectedCustomerRow } from './customer-bulk.model';
import { CustomerSelection } from './customer-selection';
import { CustomerBulkDeleteModal } from './delete-modal/customer-bulk-delete-modal';
import { CustomerBulkStatusModal } from './status-modal/customer-bulk-status-modal';

/*
 * Body builders of the four customer bulk modals: each submit is exactly one BulkJobsTracker.submit('crm', …)
 * with the backend payload (crm.customer_profiles). The tracker is a spy; the modals run on the fake customers API.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const BRANCH = DEFAULT_CUSTOMER_BRANCH_ID;

const ROWS: SelectedCustomerRow[] = [
  { id: 'c-1', displayName: 'One', ownerUserId: 'u1', status: 'PROSPECT', updatedAt: '2026-11-01T00:00:00Z' },
  { id: 'c-2', displayName: 'Two', ownerUserId: 'u2', status: 'BLACKLISTED', updatedAt: '2026-11-01T00:00:00Z' },
];

type SubmitFn = (app: string, body: BulkJobSubmit, options?: { idempotencyKey?: string }) => Promise<BulkJobSubmitResult>;

const okResult = (jobId = 'job-1'): BulkJobSubmitResult =>
  ({ jobId, status: 'QUEUED', total: 2 }) as unknown as BulkJobSubmitResult;

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

let submit: ReturnType<typeof vi.fn<SubmitFn>>;
const fixtures: ComponentFixture<unknown>[] = [];

// Protected members are reached through this view on purpose: the spec drives the form state directly.
type Internals = Record<string, any>;

async function flush(fixture: ComponentFixture<unknown>, ms = 1000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

async function mount<T>(cmp: Type<T>): Promise<{ fixture: ComponentFixture<T>; c: Internals; selection: CustomerSelection; emitted: string[] }> {
  const fixture = TestBed.createComponent(cmp);
  fixtures.push(fixture as ComponentFixture<unknown>);
  fixture.componentRef.setInput('branchId', BRANCH);
  const emitted: string[] = [];
  (fixture.componentInstance as unknown as { submitted: { subscribe(fn: (id: string) => void): void } }).submitted.subscribe(
    (id) => emitted.push(id),
  );
  await flush(fixture as ComponentFixture<unknown>, 0);
  return { fixture, c: fixture.componentInstance as Internals, selection: TestBed.inject(CustomerSelection), emitted };
}

function lastBody(): BulkJobSubmit {
  return submit.mock.calls.at(-1)![1];
}

beforeEach(() => {
  vi.useFakeTimers();
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  submit = vi.fn<SubmitFn>().mockResolvedValue(okResult());
  TestBed.configureTestingModule({
    providers: [
      CustomerSelection,
      { provide: BulkJobsTracker, useValue: { submit, hasActive: () => false } },
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
});

afterEach(() => {
  while (fixtures.length) fixtures.pop()!.destroy();
  TestBed.resetTestingModule();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.useRealTimers();
});

describe('assign modal', () => {
  it('sends one ASSIGN job with IDS selection and { ownerUserId }', async () => {
    const { fixture, c, selection, emitted } = await mount(CustomerBulkAssignModal);
    selection.setRows(ROWS, true);
    c['open']();
    await flush(fixture);
    c['selectedOwnerId'].set('u2');

    await Promise.all([c['submit'](), c['submit']()]);
    await flush(fixture, 0);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toBe('crm');
    expect(lastBody()).toEqual({
      module: 'crm.customer_profiles',
      action: 'ASSIGN',
      scope: { branchId: BRANCH },
      selection: { kind: 'IDS', ids: ['c-1', 'c-2'] },
      params: { ownerUserId: 'u2' },
    });
    expect(emitted).toEqual(['job-1']);
  });

  it('sends nothing without an owner', async () => {
    const { fixture, c, selection } = await mount(CustomerBulkAssignModal);
    selection.setRows(ROWS, true);
    c['open']();
    await flush(fixture);
    await c['submit']();
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('status modal', () => {
  it('sends SET_STATUS with a QUERY selection { search (with branchId), sort } + excludedIds', async () => {
    const { fixture, c, selection } = await mount(CustomerBulkStatusModal);
    const body = { branchId: BRANCH, status: 'PROSPECT' as const };
    selection.selectAllMatching(body, 3, 'displayName:ASC');
    selection.toggle(ROWS[0]);
    c['open']();
    await flush(fixture);
    expect(c['rows']().length).toBeGreaterThan(0);
    c['selectStatus']('INACTIVE');

    await c['submit']();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(lastBody()).toEqual({
      module: 'crm.customer_profiles',
      action: 'SET_STATUS',
      scope: { branchId: BRANCH },
      selection: {
        kind: 'QUERY',
        query: { search: body, sort: 'displayName:ASC' },
        excludedIds: ['c-1'],
      },
      params: { status: 'INACTIVE' },
    });
    const sel = lastBody().selection;
    expect(sel.kind === 'QUERY' && (sel.query as { search: { branchId: string } }).search.branchId).toBe(
      lastBody().scope?.branchId,
    );
  });

  it('never offers ACTIVE_CUSTOMER', async () => {
    const { c } = await mount(CustomerBulkStatusModal);
    expect([...c['statuses']]).toEqual(['PROSPECT', 'INACTIVE', 'BLACKLISTED']);
  });

  it('keeps the modal open with a mapped error on a request-level code and does not resend', async () => {
    submit.mockRejectedValueOnce(new ApiError(403, 'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED'));
    const { fixture, c, emitted } = await mount(CustomerBulkStatusModal);
    c['open'](ROWS);
    await flush(fixture);
    c['selectStatus']('BLACKLISTED');
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(c['requestError']()).toBeTruthy();
    expect(emitted).toEqual([]);
  });

  it('closes without emitting on BULK_JOB_ACTIVE', async () => {
    submit.mockRejectedValueOnce(new ApiError(409, 'BULK_JOB_ACTIVE'));
    const { fixture, c, emitted } = await mount(CustomerBulkStatusModal);
    c['open'](ROWS);
    await flush(fixture);
    c['selectStatus']('INACTIVE');
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(c['requestError']()).toBeNull();
    expect(emitted).toEqual([]);
  });
});

describe('delete modal', () => {
  it('sends DELETE with {} when the reason is blank and a trimmed reason otherwise', async () => {
    const { fixture, c } = await mount(CustomerBulkDeleteModal);
    c['open'](ROWS);
    await flush(fixture);
    c['reason'].set('   ');
    await c['submit']();
    expect(lastBody()).toMatchObject({
      action: 'DELETE',
      selection: { kind: 'IDS', ids: ['c-1', 'c-2'] },
      params: {},
    });

    c['open'](ROWS);
    await flush(fixture);
    c['reason'].set('  duplicates  ');
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(lastBody().params).toEqual({ reason: 'duplicates' });
  });

  it('blocks a reason over 1000 characters', async () => {
    const { fixture, c } = await mount(CustomerBulkDeleteModal);
    c['open'](ROWS);
    await flush(fixture);
    c['reason'].set('x'.repeat(1001));
    await c['submit']();
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('activity modal', () => {
  async function openFilled() {
    const m = await mount(CustomerBulkActivityModal);
    m.c['open'](ROWS);
    await flush(m.fixture);
    const start = toLocalDateTime(new Date(Date.now() + 2 * 86_400_000));
    m.c['startDate'].set(start.date);
    m.c['startTime'].set(start.time);
    m.c['subject'].set('  Quarterly review  ');
    m.fixture.detectChanges();
    return m;
  }

  it('sends CREATE_ACTIVITY with schedule.assignee { mode: USER, userId } and order OWNER', async () => {
    const { c } = await openFilled();
    c['type'].set('MEETING');
    c['location'].set(' HQ ');
    c['order'].set('owner');
    c['assigneeMode'].set('other');
    c['chosenAssigneeId'].set('u2');
    c['spacePerAssignee'].set(false);

    await c['submit']();

    expect(submit).toHaveBeenCalledTimes(1);
    const body = lastBody();
    expect(body).toMatchObject({
      module: 'crm.customer_profiles',
      action: 'CREATE_ACTIVITY',
      scope: { branchId: BRANCH },
      selection: { kind: 'IDS', ids: ['c-1', 'c-2'] },
    });
    const params = body.params as { activity: Record<string, unknown>; schedule: Record<string, unknown> };
    expect(params.activity).toMatchObject({ type: 'MEETING', subject: 'Quarterly review', location: 'HQ' });
    expect('durationMinutes' in params.activity).toBe(true);
    expect('direction' in params.activity).toBe(false);
    expect(Object.keys(params.schedule).sort()).toEqual(['assignee', 'gapMinutes', 'order', 'spacePerAssignee', 'startAt']);
    expect(params.schedule).toMatchObject({
      order: 'OWNER',
      assignee: { mode: 'USER', userId: 'u2' },
      spacePerAssignee: false,
      gapMinutes: 15,
    });
    expect(Date.parse(params.schedule['startAt'] as string)).toBeGreaterThan(Date.now());
  });

  it.each([
    ['owner', { mode: 'LEAD_OWNER' }],
    ['me', { mode: 'ME' }],
  ] as const)('maps assignee mode %s to %o with order TABLE and drops direction for TODO', async (mode, wire) => {
    const { c } = await openFilled();
    c['type'].set('TODO');
    c['direction'].set('OUTBOUND');
    c['assigneeMode'].set(mode);
    await c['submit']();
    const params = lastBody().params as { activity: Record<string, unknown>; schedule: Record<string, unknown> };
    expect(params.schedule['assignee']).toEqual(wire);
    expect(params.schedule['order']).toBe('TABLE');
    expect('direction' in params.activity).toBe(false);
    expect(params.schedule).not.toHaveProperty('assigneeMode');
    expect(params.schedule).not.toHaveProperty('assigneeUserId');
  });

  it('shows the mapped start error on CUSTOMER_BULK_START_IN_PAST and does not resend by itself', async () => {
    submit.mockRejectedValueOnce(new ApiError(422, 'CUSTOMER_BULK_START_IN_PAST'));
    const { c, emitted } = await openFilled();
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(c['requestError']()).toBeTruthy();
    expect(emitted).toEqual([]);
  });

  it('sends nothing when the start is in the past', async () => {
    const { c } = await openFilled();
    const past = toLocalDateTime(new Date(Date.now() - 86_400_000));
    c['startDate'].set(past.date);
    c['startTime'].set(past.time);
    await c['submit']();
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('idempotency key on retry after a network failure', () => {
  it('a second click after a network failure sends one more request (one submit per click)', async () => {
    submit.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { fixture, c, emitted } = await mount(CustomerBulkDeleteModal);
    c['open'](ROWS);
    await flush(fixture);
    await c['submit']();
    expect(c['requestError']()).toBeTruthy();
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(emitted).toEqual(['job-1']);
  });

  // The modals keep one key per submit attempt (CustomerBulkSubmitKey) until success, a body change or a new open.
  it.each([
    ['ASSIGN', CustomerBulkAssignModal],
    ['SET_STATUS', CustomerBulkStatusModal],
    ['DELETE', CustomerBulkDeleteModal],
  ] as const)('%s reuses the same idempotency key on resend', async (_action, cmp) => {
    submit.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { fixture, c } = await mount(cmp as Type<unknown>);
    c['open'](ROWS);
    await flush(fixture);
    c['selectedOwnerId']?.set('u2');
    c['selectStatus']?.('INACTIVE');
    await c['submit']();
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(2);
    const k1 = submit.mock.calls[0][2]?.idempotencyKey;
    const k2 = submit.mock.calls[1][2]?.idempotencyKey;
    expect(k1).toBeTruthy();
    expect(k2).toBe(k1);
  });

  it('CREATE_ACTIVITY reuses the key on resend of the same body', async () => {
    submit.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { fixture, c } = await mount(CustomerBulkActivityModal);
    c['open'](ROWS);
    await flush(fixture);
    const start = toLocalDateTime(new Date(Date.now() + 2 * 86_400_000));
    c['startDate'].set(start.date);
    c['startTime'].set(start.time);
    c['subject'].set('Call back');
    await c['submit']();
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0][2]?.idempotencyKey).toBeTruthy();
    expect(submit.mock.calls[1][2]?.idempotencyKey).toBe(submit.mock.calls[0][2]?.idempotencyKey);
  });

  it('uses a new key when the body changes after a failure', async () => {
    submit.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { fixture, c } = await mount(CustomerBulkDeleteModal);
    c['open'](ROWS);
    await flush(fixture);
    await c['submit']();
    c['reason'].set('changed');
    await c['submit']();
    expect(submit.mock.calls[1][2]?.idempotencyKey).not.toBe(submit.mock.calls[0][2]?.idempotencyKey);
  });

  it('uses a new key for the next job after a success', async () => {
    const { fixture, c } = await mount(CustomerBulkDeleteModal);
    c['open'](ROWS);
    await flush(fixture);
    await c['submit']();
    c['open'](ROWS);
    await flush(fixture);
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][2]?.idempotencyKey).not.toBe(submit.mock.calls[0][2]?.idempotencyKey);
  });
});
