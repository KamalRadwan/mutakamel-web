import { Injectable, Type, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import type { BulkJobSubmit, BulkJobSubmitResult } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { toLocalDateTime } from '../../../../shared/widgets/activities/activity-form/activity-form.model';
import { ApiError } from '../../settings/shared/settings-api';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { bindCrmHttpForTest, crmHttp } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CustomerBulkMenu } from './bulk-menu/customer-bulk-menu';
import { CustomerCapabilities } from '../customers.model';
import en from '../../../../../../public/i18n/customer-bulk/en.json';
import ar from '../../../../../../public/i18n/customer-bulk/ar.json';
import { CustomerBulkActivityModal } from './activity-modal/customer-bulk-activity-modal';
import { CustomerBulkAssignModal } from './assign-modal/customer-bulk-assign-modal';
import { SelectedCustomerRow } from './customer-bulk.model';
import { CustomerSelection } from './customer-selection';
import { CustomerBulkDeleteModal } from './delete-modal/customer-bulk-delete-modal';
import { CustomerBulkStatusModal } from './status-modal/customer-bulk-status-modal';

/*
 * Body builders of the four customer bulk modals: each submit is exactly one BulkJobsTracker.submit('crm', …)
 * with the backend payload (crm.customer_profiles). Scoped lookups and selection use the bound transport.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const BRANCH = '019f0000-0000-7000-8000-000000000011';
const COMPANY = '019f0000-0000-7000-8000-000000000010';
const OTHER_BRANCH = '019f0000-0000-7000-8000-000000000012';
const selectedScope = signal<{ companyId: string; branchId: string | null }>({ companyId: COMPANY, branchId: BRANCH });
const me = signal({ ...FAKE_TENANT_ME, isTenantOwner: true });
let disposeHttp: () => void;

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

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('CustomerBulk %s / %s', (lang, theme) => {
let attributes: (string | null)[];
beforeEach(() => {
  attributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset['theme'] = theme;
  selectedScope.set({ companyId: COMPANY, branchId: BRANCH });
  me.set({ ...FAKE_TENANT_ME, isTenantOwner: true });
  const stub = new CrmHttpStub({ '/assignable-owners': { items: [
    { id: 'u1', displayName: 'One', avatarUrl: null },
    { id: 'u2', displayName: 'Two', avatarUrl: null },
  ], nextCursor: null } });
  vi.spyOn(stub, 'write').mockResolvedValue({ status: 200, data: { items: ROWS, total: 2, truncated: false }, etag: null, location: null });
  disposeHttp = bindCrmHttpForTest(stub);
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
      { provide: TenantScopeState, useValue: {
        selection: selectedScope, me, branchCompanies: () => new Map([[BRANCH, COMPANY], [OTHER_BRANCH, COMPANY]]),
      } },
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
  disposeHttp();
  ['lang', 'dir', 'data-theme'].forEach((name, i) => attributes[i] === null
    ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, attributes[i]!));
});

describe('assign modal', () => {
  it('CustomerBulk › submit', async () => {
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
    expect(submit.mock.calls[0][2]).toEqual({ idempotencyKey: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) });
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

describe('CustomerBulk', () => {
  it.each([CustomerBulkAssignModal, CustomerBulkStatusModal, CustomerBulkDeleteModal, CustomerBulkActivityModal])('CustomerBulk › branch pre-check: %o', async (cmp) => {
    const { fixture, c, selection } = await mount(cmp as Type<unknown>);
    selection.selectAllMatching({ branchId: OTHER_BRANCH }, 2);
    c['open'](ROWS);
    await flush(fixture);
    c['selectedOwnerId']?.set('u2');
    c['selectStatus']?.('INACTIVE');
    if (cmp === CustomerBulkActivityModal) {
      const start = toLocalDateTime(new Date(Date.now() + 2 * 86_400_000));
      c['startDate'].set(start.date);
      c['startTime'].set(start.time);
      c['subject'].set('Call back');
    }
    // Assign uses the current selection when no explicit rows were supplied.
    if (cmp === CustomerBulkAssignModal) c['explicitRows'].set(null);
    await c['submit']();
    expect(submit).not.toHaveBeenCalled();
    expect(c['requestError']()).toBeTruthy();
  });

  it('CustomerBulk › status needs the grant', async () => {
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: ['crm.customer_profiles.status.manage'],
      permissionScopes: { 'crm.customer_profiles.status.manage': { tenantWide: false, companyIds: [], branchIds: [OTHER_BRANCH] } } });
    const fixture = TestBed.createComponent(CustomerBulkMenu);
    fixtures.push(fixture);
    fixture.componentRef.setInput('capabilities', { branchId: BRANCH, customerProfiles: {
      create: null, update: { scope: 'all', ownerUserIds: null }, delete: null,
    } } satisfies CustomerCapabilities);
    const c = fixture.componentInstance as unknown as { actions(): { id: string }[] };
    expect(c.actions().map((action) => action.id)).not.toContain('status');
    me.update((value) => ({ ...value, permissionScopes: {
      'crm.customer_profiles.status.manage': { tenantWide: false, companyIds: [], branchIds: [BRANCH] },
    } }));
    expect(c.actions().map((action) => action.id)).toContain('status');
  });

  it('CustomerBulk › record owner maps to LEAD_OWNER', async () => {
    const { fixture, c } = await mount(CustomerBulkActivityModal);
    c['open'](ROWS);
    await flush(fixture);
    const start = toLocalDateTime(new Date(Date.now() + 2 * 86_400_000));
    c['startDate'].set(start.date);
    c['startTime'].set(start.time);
    c['subject'].set('Call back');
    c['assigneeMode'].set('owner');
    await c['submit']();
    expect(lastBody().params).toMatchObject({ schedule: { assignee: { mode: 'LEAD_OWNER' } } });
  });

  it('never resends an idempotency mismatch until the page is reloaded', async () => {
    const { fixture, c } = await mount(CustomerBulkDeleteModal);
    c['open'](ROWS);
    await flush(fixture);
    submit.mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
    await c['submit']();
    c['reason'].set('changed');
    await c['submit']();
    c['open'](ROWS);
    await flush(fixture);
    await c['submit']();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('selection load failure replaces the form and Retry recovers it with the correlation reference', async () => {
    const { fixture, c, selection } = await mount(CustomerBulkStatusModal);
    selection.setRows(ROWS, true);
    vi.spyOn(selection, 'resolve').mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'corr-bulk' }));
    c['open']();
    await flush(fixture);
    expect(c['loadFailure']()).toBe('corr-bulk');
    expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
    c['retryLoad']();
    await flush(fixture);
    expect(c['loadFailure']()).toBeNull();
    expect(c['rows']()).toHaveLength(2);
  });

  it('activity retries the failed owners read without dropping explicit selected rows', async () => {
    vi.spyOn(crmHttp(), 'read').mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'));
    const { fixture, c } = await mount(CustomerBulkActivityModal);
    c['open'](ROWS);
    await flush(fixture);
    expect(c['loadFailure']()).toBe('');
    expect(c['rows']()).toHaveLength(2);
    c['retryLoad']();
    await flush(fixture);
    expect(c['loadFailure']()).toBeNull();
    expect(c['owners']()).toHaveLength(2);
    expect(c['rows']()).toHaveLength(2);
  });

  it('a forbidden owners catalogue disables its control with the access hint', async () => {
    vi.spyOn(crmHttp(), 'read').mockRejectedValue(new ApiError(403, 'PERMISSION_DENIED'));
    const { fixture, c } = await mount(CustomerBulkAssignModal);
    c['open'](ROWS);
    await flush(fixture);
    expect(c['ownersDenied']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-haspopup="listbox"]').disabled).toBe(true);
    expect(c['ownerFieldError']()).toBeTruthy();
  });

  it.each(['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY', 'CRM_LEADS_DISABLED'])(
    'blocks another submit and disables the fields after %s', async (code) => {
      const { fixture, c } = await mount(CustomerBulkDeleteModal);
      c['open'](ROWS);
      await flush(fixture);
      submit.mockRejectedValueOnce(new ApiError(403, code));
      await c['submit']();
      fixture.detectChanges();
      expect(c['readOnly']()).toBe(true);
      expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
      await c['submit']();
      expect(submit).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    },
  );

  it('has translated existing field labels and hints', () => {
    const dict = lang === 'ar' ? ar : en;
    for (const text of [dict.assign.owner, dict.assign.ownerHint, dict.status.field, dict.status.fieldHint,
      dict.delete.reason, dict.delete.reasonHint, ...Object.values(dict.activity.hints)]) {
      expect(text.trim()).not.toBe('');
      if (lang === 'ar') expect(text).toMatch(/[\u0600-\u06ff]/);
    }
  });
});
});
