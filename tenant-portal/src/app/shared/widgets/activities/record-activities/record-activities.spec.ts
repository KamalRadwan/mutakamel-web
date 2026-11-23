import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ActivitiesApi } from '../activities.api';
import type { Activity } from '../activities.model';
import { ActivityForm } from '../activity-form/activity-form';
import { ActivityOutcome } from '../activity-outcome/activity-outcome';
import { RecordActivities } from './record-activities';

const activity: Activity = {
  id: 'activity-1', type: 'CALL', subject: 'Call back', description: null, direction: null,
  priority: 'NORMAL', status: 'PLANNED', dueAt: '2026-12-01T10:00:00.000Z', endsAt: null,
  reminderOffsetMinutes: 15, reminderSentAt: null, location: null, meetingUrl: null,
  completedAt: null, cancelledAt: null, outcome: null, assigneeUserId: 'user-1', assigneeName: 'Reader',
  createdByUserId: 'user-1', createdByName: 'Reader', branchId: 'branch-1', companyId: 'company-1',
  version: 3, createdAt: '2026-11-23T10:00:00.000Z', updatedAt: '2026-11-23T10:00:00.000Z',
  targets: [{ id: 'target-1', role: 'PRIMARY', targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-1',
    label: 'Lead', route: '/crm/leads/lead-1', targetVersion: '1', unavailableAt: null }],
};
const target = { app: 'CRM' as const, type: 'LEAD', id: 'lead-1', label: 'Lead' };
const meta = { page: 1, limit: 1, total: 17, totalPages: 17, hasNext: true, hasPrev: false };
const summary = { overdue: 0, today: 0, upcoming: 0, completedToday: 0, byStatus: [] };

describe('RecordActivities', () => {
  const api = {
    getActivity: vi.fn(), listActivities: vi.fn(), activitySummary: vi.fn(), listAssignees: vi.fn(),
    createActivity: vi.fn(), updateActivity: vi.fn(), setActivityStatus: vi.fn(),
    completeActivity: vi.fn(), cancelActivity: vi.fn(),
  };
  const notify = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  let window: RecordActivities;

  beforeEach(() => {
    vi.clearAllMocks();
    api.getActivity.mockResolvedValue(activity);
    api.listActivities.mockResolvedValue({ data: [], meta });
    api.activitySummary.mockResolvedValue(summary);
    api.listAssignees.mockResolvedValue([]);
    for (const fn of [api.createActivity, api.updateActivity, api.setActivityStatus, api.completeActivity, api.cancelActivity]) {
      fn.mockReset().mockResolvedValue({ ...activity, version: 4 });
    }
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: ActivitiesApi, useValue: api }, { provide: Notify, useValue: notify },
      { provide: TenantScopeState, useValue: { me: signal({ id: 'user-1' }) } },
    ] });
    for (const component of [RecordActivities, ActivityForm, ActivityOutcome]) {
      TestBed.overrideComponent(component, { set: { template: '', imports: [] } });
    }
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key) => {
      const messages: Record<string, string> = {
        'activities.errors.ACTIVITY_NOT_FOUND': 'No longer available to you',
        'apiErrors.notSaved': 'Not saved. Try again.',
        'activities.errors.ACTIVITY_IDEMPOTENCY_IN_FLIGHT': 'Still saving',
        'activities.errors.ACTIVITY_IDEMPOTENCY_MISMATCH': 'Already sent with different values. Reload.',
      };
      return messages[String(key)] ?? String(key);
    });
    window = TestBed.createComponent(RecordActivities).componentInstance;
    Object.defineProperty(window, 'modal', { value: () => ({ open: vi.fn(), close: vi.fn() }) });
    window['record'].set(target);
  });

  async function form(edit = false) {
    const fixture = TestBed.createComponent(ActivityForm);
    fixture.componentRef.setInput('target', target);
    if (edit) {
      fixture.componentRef.setInput('mode', 'edit');
      fixture.componentRef.setInput('activity', activity);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.componentInstance;
    form['formValue'].update((value) => ({ ...value, subject: 'Changed subject',
      startDate: '2026-12-01', startTime: '12:00' }));
    Object.defineProperty(window, 'activityForm', { configurable: true, value: () => form });
    if (edit) {
      window['screen'].set('edit');
      window['editingActivity'].set(activity);
    } else window['screen'].set('new');
    return { form, fixture };
  }

  it('opens the activity', async () => {
    await window['openActivity'](activity);
    expect(api.getActivity).toHaveBeenCalledWith(activity.id);
    expect(window['editingActivity']()).toEqual(activity);
    expect(window['screen']()).toBe('edit');
  });

  it('access policy blocked shows a toast', async () => {
    api.getActivity.mockRejectedValue(new ApiError(403, 'ACCESS_POLICY_BLOCKED'));
    await window['openActivity'](activity);
    expect(notify.error).toHaveBeenCalled();
    expect(window['screen']()).toBe('open');
  });

  it('not found says no longer available to you', async () => {
    api.getActivity.mockRejectedValue(new ApiError(404, 'ACTIVITY_NOT_FOUND'));
    await window['openActivity'](activity);
    expect(notify.error).toHaveBeenCalledWith('No longer available to you');
  });

  it('a 5xx on open shows a toast', async () => {
    api.getActivity.mockRejectedValue(new ApiError(503, 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE'));
    await window['openActivity'](activity);
    expect(notify.error).toHaveBeenCalled();
  });

  it('a write shows a toast and reloads', async () => {
    await form();
    await window['saveNew'](false);
    expect(api.createActivity).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('activities.toasts.created');
    expect(api.listActivities).toHaveBeenCalled();
    await form(true);
    await window['saveEdit']();
    expect(notify.success).toHaveBeenCalledWith('activities.toasts.saved');
    await window['changeStatus'](activity, 'IN_PROGRESS');
    expect(api.setActivityStatus).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('activities.toasts.started');
  });

  it('validation errors land on the fields', async () => {
    const { form: value } = await form();
    api.createActivity.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED',
      { subject: ['is_too_long'], dueAt: ['invalid_date'], assigneeUserId: ['invalid_uuid'], priority: ['invalid_priority'] }));
    await window['saveNew'](false);
    expect(value['serverErrors']()).toEqual({ subject: 'CORE_VALIDATION_FAILED', start: 'CORE_VALIDATION_FAILED', assigneeUserId: 'CORE_VALIDATION_FAILED', priority: 'CORE_VALIDATION_FAILED' });
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('a 401 on save keeps the form', async () => {
    const { form: value } = await form();
    api.createActivity.mockRejectedValue(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await window['saveNew'](false);
    expect(value['formValue']().subject).toBe('Changed subject');
    expect(value['pendingSave']).not.toBeNull();
    expect(window['screen']()).toBe('new');
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again.');
  });

  it('access denied on save shows a toast', async () => {
    await form();
    api.createActivity.mockRejectedValue(new ApiError(403, 'ACTIVITY_ACCESS_DENIED'));
    await window['saveNew'](false);
    expect(notify.error).toHaveBeenCalled();
    expect(window['screen']()).toBe('new');
  });

  it('a 404 on save says no longer available', async () => {
    await form(true);
    api.updateActivity.mockRejectedValue(new ApiError(404, 'ACTIVITY_NOT_FOUND'));
    await window['saveEdit']();
    expect(notify.error).toHaveBeenCalledWith('No longer available to you');
    expect(window['screen']()).toBe('open');
  });

  it('a version conflict opens the conflict modal', async () => {
    const { form: value } = await form(true);
    api.updateActivity.mockRejectedValue(new ApiError(409, 'ACTIVITY_VERSION_CONFLICT'));
    api.getActivity.mockResolvedValue({ ...activity, version: 8, subject: 'Server change' });
    const saving = window['saveEdit']();
    await vi.waitFor(() => expect(window['conflictOpen']()).toBe(true));
    window['resolveConflict'](false);
    await saving;
    expect(value['currentBaseActivity']()?.version).toBe(8);
    expect(value['formValue']().subject).toBe('Changed subject');
    expect(value.dirty()).toBe(true);
    const next = window['saveEdit']();
    await vi.waitFor(() => expect(window['conflictOpen']()).toBe(true));
    window['resolveConflict'](true);
    await next;
    expect(value['formValue']().subject).toBe('Server change');
    expect(value.dirty()).toBe(false);
  });

  it('terminal activity shows a toast and reloads', async () => {
    await form(true);
    api.updateActivity.mockRejectedValue(new ApiError(409, 'ACTIVITY_TERMINAL'));
    await window['saveEdit']();
    expect(notify.error).toHaveBeenCalled();
    expect(api.listActivities).toHaveBeenCalled();
    expect(window['screen']()).toBe('open');
  });

  it('in flight keeps the key', async () => {
    await form();
    api.createActivity.mockRejectedValueOnce(new ApiError(409, 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT'));
    await window['saveNew'](false);
    await window['saveNew'](false);
    expect(api.createActivity.mock.calls[0][1]).toBe(api.createActivity.mock.calls[1][1]);
    expect(notify.error).toHaveBeenCalledWith('Still saving');
  });

  it('ACTIVITY_INVALID on save shows a toast', async () => {
    await form();
    api.createActivity.mockRejectedValue(new ApiError(422, 'ACTIVITY_INVALID'));
    await window['saveNew'](false);
    expect(notify.error).toHaveBeenCalled();
  });

  it('idempotency mismatch text', async () => {
    await form();
    api.createActivity.mockRejectedValue(new ApiError(422, 'ACTIVITY_IDEMPOTENCY_MISMATCH'));
    await window['saveNew'](false);
    expect(notify.error).toHaveBeenCalledWith('Already sent with different values. Reload.');
  });

  it('a 428 shows a toast', async () => {
    await form(true);
    api.updateActivity.mockRejectedValue(new ApiError(428, 'ACTIVITY_VERSION_REQUIRED'));
    await window['saveEdit']();
    expect(notify.error).toHaveBeenCalled();
  });

  it('retry after a lost connection reuses the key', async () => {
    const { form: value } = await form();
    api.createActivity.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'))
      .mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE'));
    await window['saveNew'](false);
    await window['saveNew'](false);
    const first = api.createActivity.mock.calls[0];
    const retry = api.createActivity.mock.calls[1];
    expect(first).toEqual(retry);
    expect(first[1]).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]+$/i);
    value['formValue'].update((current) => ({ ...current, subject: 'Other values' }));
    await window['saveNew'](false);
    expect(api.createActivity.mock.calls[2][1]).not.toBe(first[1]);
  });

  it('count uses the list total', async () => {
    await window['refreshData']();
    expect(api.listActivities).toHaveBeenCalledWith({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-1', limit: 1 });
    expect(window['totalCount']()).toBe(17);
    expect(api.activitySummary).toHaveBeenCalledWith(target, expect.any(String), expect.any(String));
  });

  it('assignee lookup failure shows inline retry', async () => {
    api.listAssignees.mockRejectedValue(new ApiError(503, 'UNAVAILABLE'));
    const { form: value } = await form();
    expect(value['assigneesFailed']()).toBe(true);
    api.listAssignees.mockResolvedValue([{ id: 'user-2', name: 'Other reader' }]);
    value['retryAssignees']();
    await vi.waitFor(() => expect(value['assigneesFailed']()).toBe(false));
    expect(api.listAssignees).toHaveBeenCalledTimes(2);
  });

  it('status retries preserve the key and request body', async () => {
    api.setActivityStatus.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await window['changeStatus'](activity, 'IN_PROGRESS');
    await window['changeStatus'](activity, 'IN_PROGRESS');
    expect(api.setActivityStatus.mock.calls[0]).toEqual(api.setActivityStatus.mock.calls[1]);
  });

  it.each(['complete', 'cancel'] as const)('keeps the %s note and key on a failed save', async (mode) => {
    const fixture = TestBed.createComponent(ActivityOutcome);
    const outcome = fixture.componentInstance;
    const close = vi.fn();
    Object.defineProperty(outcome, 'modal', { value: () => ({ open: vi.fn(), close }) });
    Object.defineProperty(outcome, 'textarea', { value: () => ({ nativeElement: { focus: vi.fn() } }) });
    Object.defineProperty(window, 'outcomeModal', { value: () => outcome });
    const write = mode === 'complete' ? api.completeActivity : api.cancelActivity;
    write.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    const pending = window['finishActivity'](activity, mode);
    outcome['text'].set('Keep this note');
    await outcome['confirm']();
    expect(close).not.toHaveBeenCalled();
    expect(outcome['text']()).toBe('Keep this note');
    await outcome['confirm']();
    await pending;
    expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    expect(close).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalled();
  });
});
