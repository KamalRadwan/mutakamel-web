import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { SEAT_PREVIEW } from '../../../seats/seats.api';
import { StaffSession } from '../../shared/staff-session';
import { BulkRoleModal } from './bulk-role-modal';

class EmptyLoader { getTranslation() { return of({}); } }

describe('bulk role modal bulk-jobs contract', () => {
  const submit = vi.fn();
  const previewSeats = vi.fn();
  const notify = { error: vi.fn() };
  const showModal = HTMLDialogElement.prototype.showModal;
  const close = HTMLDialogElement.prototype.close;

  beforeEach(() => {
    submit.mockReset().mockResolvedValue({ jobId: 'job' });
    notify.error.mockReset();
    previewSeats.mockReset().mockResolvedValue({ mode: 'DERIVED', ok: true, modules: [] });
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: StaffSession, useValue: { isOwner: () => true } },
      { provide: BulkJobsTracker, useValue: { submit } },
      { provide: SEAT_PREVIEW, useValue: previewSeats },
      { provide: Notify, useValue: notify },
    ] });
  });
  afterEach(() => {
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = close;
    vi.restoreAllMocks();
  });

  function create(ids = ['user-1', 'user-2']) {
    const fixture = TestBed.createComponent(BulkRoleModal);
    fixture.componentRef.setInput('roles', [{ id: 'role', name: 'Role' }]);
    fixture.componentRef.setInput('companies', [{ id: 'company', name: 'Company', status: 'ACTIVE' }]);
    fixture.componentRef.setInput('branches', [{ id: 'branch', companyId: 'company', name: 'Branch', status: 'ACTIVE' }]);
    fixture.detectChanges();
    fixture.componentInstance.open(ids);
    fixture.detectChanges();
    return fixture;
  }

  it.each(['TENANT', 'COMPANY', 'BRANCH'] as const)('submits closed %s params with the IDS selection and closes', async (target) => {
    const fixture = create();
    const modal = fixture.componentInstance;
    modal['onScopeChange'](target);
    await modal['checkSeats']();
    await modal['assign']();
    const params = target === 'BRANCH' ? { branchId: 'branch' }
      : { scope: target === 'TENANT' ? { target } : { target, companyId: 'company' } };
    expect(submit).toHaveBeenCalledExactlyOnceWith('core', {
      module: 'core.users', action: 'ASSIGN_ROLE',
      scope: target === 'BRANCH' ? { branchId: 'branch' } : target === 'COMPANY' ? { companyId: 'company' } : {},
      selection: { kind: 'IDS', ids: ['user-1', 'user-2'] },
      params: { roleId: 'role', confirmAddonCascade: false, ...params },
    }, { idempotencyKey: expect.stringMatching(/^[0-9a-f-]{14}7/) });
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(false);
  });

  it('checks BULK_ROLE through the seat preview endpoint', async () => {
    const modal = create().componentInstance;
    await modal['checkSeats']();
    expect(previewSeats).toHaveBeenCalledExactlyOnceWith([{
      kind: 'BULK_ROLE', roleId: 'role', scope: { target: 'BRANCH', branchId: 'branch' }, userIds: ['user-1', 'user-2'],
    }]);
  });

  it('skips previews above 100 users, shows the existing state and allows submission', async () => {
    const fixture = create(Array.from({ length: 101 }, (_, index) => `user-${index}`));
    await fixture.componentInstance['checkSeats']();
    fixture.detectChanges();
    expect(previewSeats).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('seats.errors.SEAT_PREVIEW_TOO_LARGE');
    expect(fixture.componentInstance['canAssign']()).toBe(true);
    await fixture.componentInstance['assign']();
    expect(submit).toHaveBeenCalledOnce();
  });

  it('leaves BULK_JOB_ACTIVE handling to the tracker and retains the retry key', async () => {
    const fixture = create();
    const modal = fixture.componentInstance;
    await modal['checkSeats']();
    submit.mockRejectedValue(new ApiError(409, 'BULK_JOB_ACTIVE'));
    await modal['assign']();
    expect(notify.error).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(true);
    const key = submit.mock.calls[0][2].idempotencyKey;
    await modal['assign']();
    expect(submit.mock.calls[1][2].idempotencyKey).toBe(key);
  });
});
