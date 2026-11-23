import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import type { Branch, Company, Department, TenantUser } from '../../shared/staff.model';
import { InviteModal } from '../invite-modal/invite-modal';
import { Notify } from '../../../../../core/notify/notify';
import { StaffSession } from '../../shared/staff-session';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { UserModal } from '../user-modal/user-modal';
import { UsersPage } from './users-page';

const usersPath = '/api/tenant/core/v1/users';
const usagePath = '/api/tenant/core/v1/seats/usage';
const stamp = '2026-11-22T12:00:00.000Z';
const company: Company = {
  id: '018f0000-0000-7000-8000-000000000001', code: 'CO', name: 'Company',
  legalName: null, taxNumber: null, countryCode: null, currencyCode: null,
  status: 'ACTIVE', createdAt: stamp, updatedAt: stamp,
};
const branch: Branch = {
  id: '018f0000-0000-7000-8000-000000000002', companyId: company.id, code: 'B1', name: 'Allowed branch',
  address: null, phone: null, isHeadquarters: false, status: 'ACTIVE', createdAt: stamp, updatedAt: stamp,
};
const otherBranch: Branch = { ...branch, id: '018f0000-0000-7000-8000-000000000003', code: 'B2', name: 'Read-only branch' };
const department: Department = {
  id: '018f0000-0000-7000-8000-000000000004', branchId: branch.id, code: 'D1', name: 'Department',
  status: 'ACTIVE', createdAt: stamp, updatedAt: stamp,
};
const name = { email: 'invitee@example.invalid', firstName: 'Test', lastName: 'Invitee' };
const saved: TenantUser = {
  ...name, id: '018f0000-0000-7000-8000-000000000005',
  companyId: company.id, branchId: branch.id, departmentId: department.id,
  employeeCode: null, teamId: null, managerId: null, jobTitle: null,
  status: 'INVITED', seats: [], isTenantOwner: false, createdAt: stamp, updatedAt: stamp,
};

function page<T>(data: T[]) {
  return { success: true, data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1, hasNext: false, hasPrev: false } };
}

class EmptyLoader {
  getTranslation() { return of({ errors: { USER_UNAVAILABLE: 'No longer available' } }); }
}

describe('live scoped Staff Users', () => {
  let csrfCookie: string | undefined;
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;

  afterEach(() => {
    vi.useRealTimers();
    HTMLDialogElement.prototype.showModal = originalShowModal;
    HTMLDialogElement.prototype.close = originalClose;
    if (csrfCookie) document.cookie = `${csrfCookie}=; Max-Age=0; path=/`;
    csrfCookie = undefined;
  });

  function fixtureWithInviteGrant(branchIds: string[]) {
    const readScope = { tenantWide: false, companyIds: [company.id], branchIds: [branch.id, otherBranch.id] };
    const permissions = ['users.user.read', 'org.company.read', 'org.branch.read', 'org.department.read'];
    const me = signal<TenantMe>({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      accessibleCompanies: [company.id],
      accessibleBranches: readScope.branchIds,
      accessibleBranchCompanies: readScope.branchIds.map((branchId) => ({ branchId, companyId: company.id })),
      permissions: branchIds.length ? [...permissions, 'users.user.invite'] : permissions,
      permissionScopes: {
        ...Object.fromEntries(permissions.map((permission) => [permission, readScope])),
        ...(branchIds.length ? { 'users.user.invite': { ...readScope, branchIds } } : {}),
      },
    });
    const organization = {
      listCompanies: async () => page([company]),
      listBranches: async () => page([branch, otherBranch]),
      listDepartments: async () => page([department]),
      listTeams: async () => page([]),
    };
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
      { provide: OrganizationReadApi, useValue: organization },
      { provide: AuthSession, useValue: { me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in' } },
    ] });
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(UsersPage);
    async function settle() {
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();
    }
    return { fixture, settle, requests: TestBed.inject(HttpTestingController) };
  }

  it('renders legacy users and opens the invite Company picker when seat usage returns 404', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const { fixture, settle, requests } = fixtureWithInviteGrant([branch.id]);
    vi.spyOn(TestBed.inject(OrganizationReadApi), 'listCompanies').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return page([company]);
    });
    await settle();
    const { seats, ...legacyUser } = saved;
    requests.expectOne((request) => request.url === usersPath).flush(page([legacyUser]));
    requests.expectOne(usagePath).flush(
      { errorCode: 'COMMON.GENERIC.NOT_FOUND' }, { status: 404, statusText: 'Not Found' },
    );
    await settle();
    expect(fixture.componentInstance['canInvite']()).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    await settle();
    expect(() => fixture.detectChanges()).not.toThrow();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="table"]')?.getAttribute('aria-busy')).toBe('false');
    expect(root.querySelector('[role="row"][aria-hidden="true"]')).toBeNull();
    const cells = root.querySelectorAll('[role="cell"]');
    expect(cells[0].textContent).toContain('Test Invitee');
    expect(cells[1].textContent?.trim()).toBe('Allowed branch · Department');
    expect(cells[2].textContent?.trim()).toBe('—');
    const users = fixture.componentInstance;
    expect(users['loadFailed']()).toBe(false);
    expect(users['seatModules']()).toEqual([]);
    expect(users['filters']().find((filter) => filter.id === 'seat')?.options.map((option) => option.value))
      .toEqual(['OVER_CAPACITY']);
    const inviteButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'users.add')!;
    expect(inviteButton.disabled).toBe(false);
    inviteButton.click();
    await settle();
    const companyPicker = root.querySelector<HTMLButtonElement>('dialog[open] button[aria-haspopup="listbox"][aria-label="staff.cascade.company"]')!;
    expect(companyPicker).not.toBeNull();
    expect(companyPicker.disabled).toBe(false);
    companyPicker.click();
    await settle();
    expect(companyPicker.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[role="listbox"][aria-label="staff.cascade.company"]')?.textContent).toContain('Company');
    expect(users['placementLabel']({ ...saved, branchId: 'missing', departmentId: 'missing' })).toBe('—');
    requests.verify();
  });

  it('opens only authoritative placements, retries the same draft, and reads the saved user after 201', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    csrfCookie = location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    document.cookie = `${csrfCookie}=test-staff-proof; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;

    const { fixture, settle, requests } = fixtureWithInviteGrant([branch.id]);
    const users = fixture.componentInstance;
    await settle();
    requests.expectOne((item) => item.url === usersPath && item.method === 'GET').flush(page([]));
    requests.expectOne(usagePath).flush({ success: true, data: { mode: 'DERIVED', revision: 1, modules: [] } });
    await settle();
    expect(users['canInvite']()).toBe(true);
    expect(users['inviteBranches']().map((item) => item.id)).toEqual([branch.id]);

    const invite: InviteModal = fixture.debugElement.query(By.directive(InviteModal)).componentInstance;
    invite.open({ companyId: company.id, branchId: otherBranch.id });
    expect(invite['cascadeValue']().branchId).toBeNull();
    users['openInvite']();
    await settle();
    expect(invite['cascadeValue']()).toEqual({ companyId: company.id, branchId: branch.id, departmentId: department.id, teamId: null });

    invite['draft'].set({ ...name, employeeCode: '', jobTitle: '' });
    invite['save']();
    await settle();
    const first = requests.expectOne({ url: usersPath, method: 'POST' });
    expect(first.request.body).toEqual({ ...name, companyId: company.id, branchId: branch.id, departmentId: department.id });
    const key = first.request.headers.get('x-idempotency-key');
    expect(key).toMatch(/^[a-f0-9-]{14}7[a-f0-9-]{21}$/);
    first.flush({ errorCode: 'TENANT_EMAIL_TAKEN' }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(invite['emailError']()).toBeTruthy();
    requests.expectNone((item) => item.url === usersPath && item.method === 'GET');

    invite['save']();
    await settle();
    const retried = requests.expectOne({ url: usersPath, method: 'POST' });
    expect(retried.request.headers.get('x-idempotency-key')).toBe(key);
    retried.flush({ success: true, data: saved }, { status: 201, statusText: 'Created' });
    await settle();
    requests.expectOne((item) => item.url === usersPath && item.method === 'GET').flush(page([saved]));
    requests.expectOne(usagePath).flush({ success: true, data: { mode: 'DERIVED', revision: 1, modules: [] } });
    await settle();
    expect(users['rows']().map((item) => item.id)).toEqual([saved.id]);
    requests.verify();
  });

  it.each([[401, 'COMMON.GENERIC.UNAUTHORIZED', 'error'], [409, 'GW.IDEM.IN_FLIGHT', 'info'], [422, 'GW.IDEM.MISMATCH', 'warning']] as const)(
    'invite keeps its draft and key after %s %s', async (status, code, tone) => {
      HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      HTMLDialogElement.prototype.close = function () { this.open = false; };
      csrfCookie = location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
      document.cookie = `${csrfCookie}=proof; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
      const { fixture, settle, requests } = fixtureWithInviteGrant([branch.id]);
      await settle(); requests.expectOne((request) => request.url === usersPath).flush(page([]));
      requests.expectOne(usagePath).flush({ success: true, data: { modules: [] } }); await settle();
      fixture.componentInstance['openInvite'](); await settle();
      const invite = fixture.debugElement.query(By.directive(InviteModal)).componentInstance as InviteModal;
      invite['draft'].set({ ...name, employeeCode: '', jobTitle: '' }); invite['save'](); await settle();
      const first = requests.expectOne({ url: usersPath, method: 'POST' }); const key = first.request.headers.get('x-idempotency-key'); const body = first.request.body;
      first.flush({ code }, { status, statusText: 'Error' }); await settle();
      expect(invite['dirty']()).toBe(true); expect(TestBed.inject(Notify).toasts()[0].type).toBe(tone);
      if (status === 401) expect(TestBed.inject(Notify).toasts()[0].title).toContain('notSaved');
      invite['save'](); await settle(); const retry = requests.expectOne({ url: usersPath, method: 'POST' });
      expect(retry.request.headers.get('x-idempotency-key')).toBe(key); expect(retry.request.body).toEqual(body);
      retry.flush({ errorCode: 'ACCESS_POLICY_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' }); await settle();
      requests.verify();
    });

  it('does not enable invite without a matching active department in the granted branch', async () => {
    const { fixture, settle, requests } = fixtureWithInviteGrant([otherBranch.id]);
    await settle();
    requests.expectOne((item) => item.url === usersPath && item.method === 'GET').flush(page([]));
    requests.expectOne(usagePath).flush({ success: true, data: { mode: 'DERIVED', revision: 1, modules: [] } });
    await settle();

    expect(fixture.componentInstance['hasInviteGrant']()).toBe(true);
    expect(fixture.componentInstance['canInvite']()).toBe(false);
    fixture.componentInstance['openInvite']();
    requests.expectNone((item) => item.url === usersPath && item.method === 'POST');
    requests.verify();
  });

  it('shows the real supplied placement names in the read-only organization cascade', () => {
    TestBed.configureTestingModule({ providers: [
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ] });
    const cascade = TestBed.createComponent(OrgCascade);
    const team = {
      id: '018f0000-0000-7000-8000-000000000006', departmentId: department.id,
      code: 'T1', name: 'Supplied team', status: 'ACTIVE' as const, leadUserId: null,
      createdAt: stamp, updatedAt: stamp,
    };
    cascade.componentRef.setInput('readonly', true);
    cascade.componentRef.setInput('companySource', [company]);
    cascade.componentRef.setInput('placementSource', { branches: [branch], departments: [department], teams: [team] });
    cascade.componentRef.setInput('value', {
      companyId: company.id, branchId: branch.id, departmentId: department.id, teamId: team.id,
    });
    cascade.detectChanges();

    const element: HTMLElement = cascade.nativeElement;
    const values = Array.from(element.querySelectorAll<HTMLInputElement>('input[readonly]'), (field) => field.value);
    expect(values).toEqual([company.name, branch.name, department.name, team.name]);
  });
});


describe('users-page', () => {
  const me = signal({ id: 'actor', permissions: [] as string[] });
  const can = vi.fn(() => true);
  const cascadeConfirm = vi.fn(async () => true);
  const originalShow = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  let cookie: string;
  beforeEach(() => {
    vi.useFakeTimers(); can.mockReset().mockReturnValue(true); cascadeConfirm.mockReset().mockResolvedValue(true);
    me.set({ id: 'actor', permissions: [] });
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    cookie = location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    document.cookie = `${cookie}=proof; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify(); vi.useRealTimers();
    document.cookie = `${cookie}=; Max-Age=0; path=/`;
    HTMLDialogElement.prototype.showModal = originalShow; HTMLDialogElement.prototype.close = originalClose;
  });
  async function create(status: TenantUser['status'] = 'ACTIVE') {
    const params = new BehaviorSubject(convertToParamMap({}));
    const organization = { listCompanies: async () => page([]), listBranches: async () => page([]),
      listDepartments: async () => page([]), listTeams: async () => page([]) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: StaffSession, useValue: { me, can, isTenantWide: () => false, scopeRevision: () => 'scope' } },
      { provide: OrganizationReadApi, useValue: organization },
      { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: SeatCascadeConfirm, useValue: { confirm: cascadeConfirm } },
    ] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(UsersPage); const users = fixture.componentInstance;
    const requests = TestBed.inject(HttpTestingController);
    async function settle() { fixture.detectChanges(); await vi.advanceTimersByTimeAsync(30); fixture.detectChanges(); }
    await settle(); const target = { ...saved, status };
    requests.expectOne((request) => request.url === usersPath).flush(page([target]));
    requests.expectOne(usagePath).flush({ success: true, data: { mode: 'DERIVED', modules: [] } }); await settle();
    const modal = fixture.debugElement.query(By.directive(UserModal)).componentInstance as UserModal;
    vi.spyOn(users['statusConfirm'](), 'open').mockResolvedValue(true);
    return { fixture, users, requests, settle, target, modal, params, navigate };
  }
  it('opens the user modal on row click', async () => {
    const c = await create();
    const row = c.fixture.nativeElement.querySelector('[role="row"].cursor-pointer') as HTMLElement;
    row.click(); await c.settle(); expect(c.modal.editingId()).toBe(c.target.id); expect(c.modal['activeTab']()).toBe('profile');
    const open = vi.spyOn(c.modal, 'open');
    row.querySelector('button')!.click(); expect(open).toHaveBeenCalledOnce();
    expect(c.fixture.nativeElement.querySelectorAll('app-user-modal')).toHaveLength(1);
    expect(c.fixture.nativeElement.querySelector('app-bulk-role-modal, app-import-modal')).toBeNull();
  });
  it('opens ?open=<id> and clears the param', async () => {
    const c = await create(); c.params.next(convertToParamMap({ open: saved.id, new: '1' })); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}`).flush({ success: true, data: saved }); await c.settle();
    expect(c.modal.editingId()).toBe(saved.id);
    expect(c.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { open: null, new: null }, replaceUrl: true }));
  });
  it.each([403, 404])('an unavailable ?open id shows the toast and no modal: %s', async (status) => {
    const c = await create(); c.params.next(convertToParamMap({ open: 'missing' })); await c.settle();
    c.requests.expectOne(`${usersPath}/missing`).flush({}, { status, statusText: 'Unavailable' }); await c.settle();
    expect(c.modal.editingId()).toBeNull(); expect(TestBed.inject(Notify).toasts()[0].title).toBe('No longer available');
    expect(c.navigate).toHaveBeenCalled();
  });
  it('offers status actions by status, permission, owner and self', async () => {
    const c = await create(); const ids = (user: TenantUser) => c.users['actionsFor'](user).map((action) => action.id);
    expect(ids(c.target)).toEqual(['suspend', 'revokeSessions', 'delete']);
    expect(ids({ ...c.target, status: 'INVITED' })).toEqual(['resend', 'suspend', 'delete']);
    expect(ids({ ...c.target, status: 'SUSPENDED' })).toEqual(['activate', 'delete']);
    expect(ids({ ...c.target, status: 'DEACTIVATED' })).toEqual(['delete']);
    expect(ids({ ...c.target, isTenantOwner: true })).toEqual([]);
    expect(ids({ ...c.target, id: 'actor' })).toEqual([]);
    can.mockReturnValue(false); expect(ids(c.target)).toEqual([]);
  });
  it('suspends after confirm and updates the row', async () => {
    const c = await create(); c.users['openUser'](c.target); await c.settle();
    const pending = c.users['onStatusAction']({ user: c.target, actionId: 'suspend' }); await c.settle();
    expect(c.users['confirmation']()).toEqual({ action: 'suspend', name: 'Test Invitee', tone: 'danger' });
    c.requests.expectOne({ url: `${usersPath}/${saved.id}/suspend`, method: 'POST' }).flush({ success: true, data: { ...c.target, status: 'SUSPENDED' } }, { status: 201, statusText: 'Created' });
    await pending; expect(c.users['rows']()[0].status).toBe('SUSPENDED'); expect(c.modal['user']()?.status).toBe('SUSPENDED');
  });
  it.each(['suspend', 'activate', 'delete'])('seat cascade resends with the confirm flag and a new key: %s', async (actionId) => {
    const c = await create(actionId === 'activate' ? 'SUSPENDED' : 'ACTIVE');
    const pending = c.users['onStatusAction']({ user: c.target, actionId }); await c.settle();
    const path = `${usersPath}/${saved.id}${actionId === 'delete' ? '' : '/' + actionId}`;
    const first = c.requests.expectOne((request) => request.url === path); const key = first.request.headers.get('x-idempotency-key');
    first.flush({ errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details: { userIds: [saved.id], userNames: ['Test'], addonKeys: ['phone'], addonNames: ['Phone'] } }, { status: 409, statusText: 'Conflict' });
    await c.settle(); expect(cascadeConfirm).toHaveBeenCalledWith([expect.objectContaining({ userId: saved.id, addonKey: 'phone' })]);
    const retry = c.requests.expectOne(path + '?confirmAddonCascade=true'); expect(retry.request.headers.get('x-idempotency-key')).not.toBe(key);
    retry.flush(actionId === 'delete' ? null : { success: true, data: c.target }, { status: actionId === 'delete' ? 204 : 201, statusText: 'OK' }); await pending;
    if (actionId === 'delete') {
      c.requests.expectOne((request) => request.url === usersPath).flush(page([]));
      c.requests.expectOne(usagePath).flush({ success: true, data: { modules: [] } });
    }
  });
  it('a skipped seat cascade sends nothing else', async () => {
    const c = await create(); cascadeConfirm.mockResolvedValue(false);
    const pending = c.users['onStatusAction']({ user: c.target, actionId: 'suspend' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/suspend`).flush({ errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details: {} }, { status: 409, statusText: 'Conflict' });
    await pending; c.requests.expectNone((request) => request.method === 'POST');
  });
  it.each(['INVITED', 'ACTIVE'] as const)('activate toast for %s', async (status) => {
    const c = await create('SUSPENDED'); const pending = c.users['onStatusAction']({ user: c.target, actionId: 'activate' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/activate`).flush({ success: true, data: { ...c.target, status } }, { status: 201, statusText: 'Created' }); await pending;
    expect(c.users['rows']()[0].status).toBe(status);
    expect(TestBed.inject(Notify).toasts()[0].title).toContain(status === 'INVITED' ? 'activatedInvited' : 'activated');
  });
  it.each(['suspend', 'activate', 'resend'])('an invalid status transition refreshes the user: %s', async (actionId) => {
    const c = await create(actionId === 'activate' ? 'SUSPENDED' : actionId === 'resend' ? 'INVITED' : 'ACTIVE');
    c.users['openUser'](c.target); await c.settle();
    const pending = c.users['onStatusAction']({ user: c.target, actionId }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/${actionId === 'resend' ? 'resend-invite' : actionId}`).flush({ errorCode: 'INVALID_STATUS_TRANSITION' }, { status: 409, statusText: 'Conflict' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}`).flush({ success: true, data: c.target }); await pending;
    c.requests.expectOne((request) => request.url === usersPath).flush(page([c.target])); c.requests.expectOne(usagePath).flush({ success: true, data: { modules: [] } });
  });
  it('signs the user out everywhere', async () => {
    const c = await create(); const pending = c.users['onStatusAction']({ user: c.target, actionId: 'revokeSessions' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/sessions/revoke`).flush({ success: true, data: c.target }); await pending;
    expect(TestBed.inject(Notify).toasts()[0].title).toContain('signedOut');
  });
  it('resends the invitation', async () => {
    const c = await create('INVITED'); const pending = c.users['onStatusAction']({ user: c.target, actionId: 'resend' }); await c.settle();
    expect(c.users['statusConfirm']().open).not.toHaveBeenCalled();
    c.requests.expectOne(`${usersPath}/${saved.id}/resend-invite`).flush({ success: true, data: { deliveryStatus: 'QUEUED' } }); await pending;
    expect(TestBed.inject(Notify).toasts()[0].title).toContain('resent');
  });
  it('a throttled resend shows the wait message', async () => {
    const c = await create('INVITED'); const pending = c.users['onStatusAction']({ user: c.target, actionId: 'resend' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/resend-invite`).flush('limited', { status: 429, statusText: 'Too many' }); await pending;
    expect(TestBed.inject(Notify).toasts()[0].title).toContain('tooMany');
  });
  it('deletes after confirm and reloads', async () => {
    const c = await create(); c.users['openUser'](c.target); await c.settle();
    const close = vi.spyOn(c.modal, 'closeImmediate'); const pending = c.users['onStatusAction']({ user: c.target, actionId: 'delete' }); await c.settle();
    c.requests.expectOne({ url: `${usersPath}/${saved.id}`, method: 'DELETE' }).flush(null, { status: 204, statusText: 'No content' }); await pending;
    expect(close).toHaveBeenCalled();
    c.requests.expectOne((request) => request.url === usersPath).flush(page([])); c.requests.expectOne(usagePath).flush({ success: true, data: { modules: [] } });
  });
  it('a 401 on a status action keeps the key for the retry', async () => {
    const c = await create(); const action = { user: c.target, actionId: 'suspend' };
    const first = c.users['onStatusAction'](action); await c.settle();
    const request = c.requests.expectOne(`${usersPath}/${saved.id}/suspend`); const key = request.request.headers.get('x-idempotency-key');
    request.flush({}, { status: 401, statusText: 'Unauthorized' }); await first;
    expect(TestBed.inject(Notify).toasts()[0].title).toContain('notSaved');
    const next = c.users['onStatusAction'](action); await c.settle(); const retry = c.requests.expectOne(`${usersPath}/${saved.id}/suspend`);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key); retry.flush({ success: true, data: c.target }, { status: 201, statusText: 'Created' }); await next;
  });
  it.each([[403, 'USER_SELF_FORBIDDEN'], [409, 'TENANT_OWNER_PROTECTED'], [403, 'BRANCH_ACCESS_DENIED']] as const)('protection races show a toast: %s %s', async (status, errorCode) => {
    const c = await create(); const pending = c.users['onStatusAction']({ user: c.target, actionId: 'suspend' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/suspend`).flush({ errorCode }, { status, statusText: 'Error' }); await pending;
    expect(TestBed.inject(Notify).toasts()[0].type).toBe('error');
  });
  it('a cancelled confirmation sends no request', async () => {
    const c = await create(); vi.mocked(c.users['statusConfirm']().open).mockResolvedValue(false);
    await c.users['onStatusAction']({ user: c.target, actionId: 'delete' });
    c.requests.expectNone((request) => request.method !== 'GET');
  });
  it.each(['GW.IDEM.IN_FLIGHT', 'GW.IDEM.MISMATCH'])('status gateway codes: %s', async (code) => {
    const c = await create(); c.users['openUser'](c.target); await c.settle();
    const pending = c.users['onStatusAction']({ user: c.target, actionId: 'suspend' }); await c.settle();
    c.requests.expectOne(`${usersPath}/${saved.id}/suspend`).flush({ code }, { status: code.endsWith('MISMATCH') ? 422 : 409, statusText: 'Error' });
    await c.settle();
    expect(TestBed.inject(Notify).toasts()[0].type).toBe(code.endsWith('MISMATCH') ? 'warning' : 'info');
    if (code.endsWith('MISMATCH')) {
      c.requests.expectOne(`${usersPath}/${saved.id}`).flush({ success: true, data: c.target }); await c.settle();
      c.requests.expectOne((request) => request.url === usersPath).flush(page([c.target]));
      c.requests.expectOne(usagePath).flush({ success: true, data: { modules: [] } });
    }
    await pending;
  });

});
