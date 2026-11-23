import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { StaffSession } from '../../shared/staff-session';
import type { TenantUser } from '../../shared/staff.model';
import { StaffUsersApi } from '../users.api';
import { UserProfileTab } from './user-profile-tab';

const user: TenantUser = {
  id: '018f0000-0000-7000-8000-000000000004', email: 'user@example.invalid', firstName: 'Test', lastName: 'User',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [],
  createdAt: '2026-11-22T12:00:00Z', updatedAt: '2026-11-22T12:00:00Z',
};
const path = `/api/tenant/core/v1/users/${user.id}`;
class EmptyLoader { getTranslation() { return of({}); } }

describe('user-profile-tab', () => {
  let fixture: ComponentFixture<UserProfileTab>;
  let tab: UserProfileTab;
  let requests: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor' });
  const can = vi.fn(() => true);
  const page = async () => ({ data: [], meta: { hasNext: false, totalPages: 1 } });
  async function settle() {
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(20);
    fixture.detectChanges();
  }
  beforeEach(async () => {
    vi.useFakeTimers(); can.mockReset().mockReturnValue(true); me.set({ id: 'actor' });
    cookie = location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    document.cookie = `${cookie}=proof; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: StaffSession, useValue: { me, can, scopeRevision: () => 'scope' } },
      { provide: OrganizationReadApi, useValue: { listCompanies: page, listBranches: page, listDepartments: page, listTeams: page } },
    ] });
    fixture = TestBed.createComponent(UserProfileTab); tab = fixture.componentInstance;
    fixture.componentRef.setInput('user', user);
    requests = TestBed.inject(HttpTestingController);
    const loaded = TestBed.inject(StaffUsersApi).getUser(user.id);
    requests.expectOne(path).flush({ success: true, data: user }); await loaded;
    await settle();
    tab['draft'].update((draft) => ({ ...draft, firstName: 'Changed' }));
    await settle();
  });
  afterEach(() => { requests.verify(); document.cookie = `${cookie}=; Max-Age=0; path=/`; vi.useRealTimers(); });

  async function fail(status: number, code: string, details?: Record<string, string[]>) {
    const pending = tab.save(); await settle();
    requests.expectOne({ url: path, method: 'PATCH' }).flush({ errorCode: code, details }, { status, statusText: 'Error' });
    await pending; await settle();
  }

  it('saves only changed fields and emits the saved user', async () => {
    const saved = vi.fn(); tab.saved.subscribe(saved);
    const pending = tab.save(); await settle();
    const request = requests.expectOne({ url: path, method: 'PATCH' });
    expect(request.request.body).toEqual({ firstName: 'Changed' });
    const updated = { ...user, firstName: 'Changed', updatedAt: '2026-11-22T12:01:00Z' };
    request.flush({ success: true, data: updated });
    expect(await pending).toBe(true); expect(saved).toHaveBeenCalledWith(updated);
    expect(TestBed.inject(Notify).toasts()[0].type).toBe('success');
  });
  it('a placement change sends company, branch, department and team', async () => {
    tab['cascadeValue'].set({ companyId: 'company', branchId: 'branch', departmentId: 'new-department', teamId: null });
    const pending = tab.save(); await settle();
    const request = requests.expectOne({ url: path, method: 'PATCH' });
    expect(request.request.body).toEqual({ firstName: 'Changed', companyId: 'company', branchId: 'branch', departmentId: 'new-department', teamId: null });
    expect(request.request.body.teamMemberships).toBeUndefined();
    request.flush({ success: true, data: { ...user, departmentId: 'new-department' } }); await pending;
  });
  it('maps CORE_VALIDATION_FAILED details to fields', async () => {
    await fail(400, 'CORE_VALIDATION_FAILED', { firstName: ['First invalid'], lastName: ['Last invalid'],
      employeeCode: ['Code invalid'], jobTitle: ['Title invalid'], managerId: ['Manager invalid'], branchId: ['Branch invalid'], _: ['Other invalid'] });
    expect(tab['firstNameError']()).toBe('First invalid'); expect(tab['lastNameError']()).toBe('Last invalid');
    expect(tab['codeError']()).toBe('Code invalid'); expect(tab['jobTitleError']()).toBe('Title invalid');
    expect(tab['managerError']()).toBe('Manager invalid'); expect(tab['cascadeErrors']().department).toBe('Branch invalid');
    expect(TestBed.inject(Notify).toasts()[0].title).toBe('Other invalid');
  });
  it.each([[422, 'MANAGER_CYCLE'], [404, 'MANAGER_NOT_FOUND']] as const)('manager errors land on the manager field: %s %s', async (status, code) => {
    const deleted = vi.fn(); tab.deletedRemotely.subscribe(deleted); await fail(status, code);
    expect(tab['managerError']()).toBeTruthy(); expect(deleted).not.toHaveBeenCalled();
  });
  it('placement errors land on the cascade', async () => { await fail(422, 'PLACEMENT_INCONSISTENT'); expect(tab['cascadeErrors']().department).toBeTruthy(); });
  it('a taken employee code lands on the code field', async () => { await fail(409, 'EMPLOYEE_CODE_TAKEN'); expect(tab['codeError']()).toBeTruthy(); });
  it.each([[403, 'USER_SELF_FORBIDDEN'], [409, 'TENANT_OWNER_PROTECTED']] as const)('a self or owner race shows a toast: %s %s', async (status, code) => {
    const reload = vi.fn(); tab.reloadRequested.subscribe(reload); await fail(status, code);
    expect(TestBed.inject(Notify).toasts()[0].type).toBe('error'); expect(reload).toHaveBeenCalledOnce();
  });
  it('self and owner are read-only without a request', async () => {
    me.set({ id: user.id }); await settle(); expect(await tab.save()).toBe(false);
    me.set({ id: 'actor' }); fixture.componentRef.setInput('user', { ...user, isTenantOwner: true }); await settle();
    expect(await tab.save()).toBe(false); requests.expectNone((request) => request.method === 'PATCH');
  });
  it('a deleted user closes the modal', async () => {
    const deleted = vi.fn(); tab.deletedRemotely.subscribe(deleted); await fail(404, 'TENANT_USER_NOT_FOUND'); expect(deleted).toHaveBeenCalledOnce();
  });
  it('a 401 keeps the form and retries with the same key', async () => {
    const first = tab.save(); await settle(); const request = requests.expectOne({ url: path, method: 'PATCH' });
    const key = request.request.headers.get('x-idempotency-key'); const body = request.request.body;
    request.flush({}, { status: 401, statusText: 'Unauthorized' }); await first;
    expect(tab.dirty()).toBe(true); expect(TestBed.inject(Notify).toasts()[0].title).toContain('notSaved');
    const retry = tab.save(); await settle(); const next = requests.expectOne({ url: path, method: 'PATCH' });
    expect(next.request.headers.get('x-idempotency-key')).toBe(key); expect(next.request.body).toEqual(body);
    next.flush({ success: true, data: { ...user, firstName: 'Changed' } }); await retry;
  });
  it.each(['GW.IDEM.IN_FLIGHT', 'GW.IDEM.MISMATCH'])('idempotency gateway codes: %s', async (code) => {
    const reload = vi.fn(); tab.reloadRequested.subscribe(reload); await fail(code.endsWith('MISMATCH') ? 422 : 409, code);
    expect(TestBed.inject(Notify).toasts()[0].type).toBe(code.endsWith('MISMATCH') ? 'warning' : 'info');
    expect(reload).toHaveBeenCalledTimes(code.endsWith('MISMATCH') ? 1 : 0);
  });
  it.each([0, 500])('keeps the draft and key after a transport failure: %s', async (status) => {
    const first = tab.save(); await settle(); const request = requests.expectOne({ url: path, method: 'PATCH' });
    const key = request.request.headers.get('x-idempotency-key');
    if (status === 0) request.error(new ProgressEvent('error')); else request.flush({}, { status, statusText: 'Error' });
    await first; expect(tab.dirty()).toBe(true);
    const next = tab.save(); await settle(); const retry = requests.expectOne({ url: path, method: 'PATCH' });
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key); retry.flush({ success: true, data: user }); await next;
  });
});
