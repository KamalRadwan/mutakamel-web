import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { RolesApi } from '../../roles/roles.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { StaffSession } from '../../shared/staff-session';
import type { AssignmentOptions, BranchRoleAssignment, TenantUser } from '../../shared/staff.model';
import { UserRolesTab, scopeAssignmentInvalidIndexes } from './user-roles-tab';

describe('scopeAssignmentInvalidIndexes', () => {
  it('reads the decimal string array details.indexes', () => {
    expect(scopeAssignmentInvalidIndexes(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID', { indexes: ['1', '2'] }))).toEqual([1, 2]);
  });

  it('ignores numbers, junk and missing details', () => {
    expect(scopeAssignmentInvalidIndexes(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID', { indexes: [1, 'x', '3'] }))).toEqual([3]);
    expect(scopeAssignmentInvalidIndexes(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID'))).toEqual([]);
  });
});

const base = '/api/tenant/core/v1/users/target';
const stamp = '2026-11-22T00:00:00.000Z';
const user: TenantUser = { id: 'target', firstName: 'Test', lastName: 'User', email: 'test@example.invalid',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [], createdAt: stamp, updatedAt: stamp };
const held: BranchRoleAssignment = { id: 'held', tenantUserId: user.id, branchId: 'branch', roleId: 'held-role', createdAt: stamp, updatedAt: stamp };
const choice = (roleId: string, roleName = roleId): AssignmentOptions['choices'][number] => ({ branchId: 'branch', branchName: 'Branch', roleId, roleName, roleNameI18n: { en: roleName, ar: roleName } });
const options: AssignmentOptions = { choices: [choice('held-role'), choice('one'), choice('two'), choice('super', 'Tenant Super Admin')], hasMore: false,
  labels: [{ kind: 'role', id: 'one', name: 'Role one', nameI18n: { en: 'Role one', ar: 'الدور الأول' } }] };

describe('UserRolesTab live access', () => {
  let fixture: ComponentFixture<UserRolesTab>;
  let tab: UserRolesTab;
  let http: HttpTestingController;
  const me = signal({ id: 'actor' });
  const owner = signal(false);
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const modal = { open: vi.fn(), close: vi.fn() };
  const confirm = vi.fn(async () => true);
  const page = async () => ({ data: [], meta: { total: 0, totalPages: 0, hasNext: false } });
  const roles = { list: vi.fn(page) };
  const changed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks(); me.set({ id: 'actor' }); owner.set(false);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { me, isOwner: owner, can: () => true, isTenantWide: () => true, scopeRevision: () => 'scope' } },
      { provide: OrganizationReadApi, useValue: { listBranches: page, listCompanies: page } },
      { provide: RolesApi, useValue: roles },
      { provide: SeatCascadeConfirm, useValue: { confirm } },
      { provide: Notify, useValue: notify },
      { provide: LanguageState, useValue: { current: signal('en') } },
      { provide: TranslocoService, useValue: { events$: new Subject(), translate: (key: string, params?: Record<string, unknown>) => key.startsWith('access.errors.') ? `t:${key}` : params?.['n'] ? `${key}:${params['n']}` : key } },
    ] });
    TestBed.overrideComponent(UserRolesTab, { set: { template: '', imports: [] } });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixture = TestBed.createComponent(UserRolesTab); tab = fixture.componentInstance;
    fixture.componentRef.setInput('user', user);
    for (const name of ['addBranchModal', 'addScopeModal', 'removeBranchConfirm']) Object.defineProperty(tab, name, { value: () => modal });
    Object.defineProperty(tab, 'openRemoveBranchConfirm', { value: async () => true });
    tab.changed.subscribe(changed);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
  async function reads() {
    for (let i = 0; i < 5; i++) {
      await settle();
      for (const req of http.match((r) => r.method === 'GET')) req.flush({ success: true, data: req.request.url.endsWith('assignment-options') ? options : req.request.url.endsWith('/assignments') ? [held] : [] });
    }
    await settle();
  }
  async function start() { fixture.detectChanges(); await reads(); }
  function select() { tab['selectedChoices'].set([choice('one'), choice('two')]); }
  function reject(path: string, code: string, status = 422, details?: object) {
    const req = http.expectOne((r) => r.method !== 'GET' && r.url === base + path);
    req.flush({ errorCode: code, details }, { status, statusText: 'Rejected' });
    return req;
  }

  it('user-roles-tab: never calls the roles routes for self', async () => {
    me.set({ id: 'target' }); owner.set(true); fixture.detectChanges(); await settle();
    expect(tab['effectiveReadonly']()).toBe(true);
    expect(tab['effectiveReadonlyReason']()).toBe('access.roles.selfReadonly');
    http.expectNone(() => true);
  });
  it("user-roles-tab: the owner's roles are read-only", async () => {
    fixture.componentRef.setInput('user', { ...user, isTenantOwner: true }); await start(); select();
    await tab['saveBranchChoices']();
    expect(tab['effectiveReadonlyReason']()).toBe('access.roles.ownerReadonly');
    http.expectNone((r) => r.method !== 'GET');
  });
  it('user-roles-tab: lists branch roles and filters the choices', async () => {
    await start(); expect(tab['branchRoles']()).toEqual([held]);
    expect(tab['choices']().map((r) => r.roleId)).toEqual(['one', 'two']);
  });
  it('user-roles-tab: too many labels shows a toast', async () => {
    await start(); const pending = tab['fetchChoices'](true);
    http.expectOne((r) => r.url.endsWith('/assignment-options')).flush({ errorCode: 'ROLE_ASSIGNMENT_LABELS_LIMIT_EXCEEDED' }, { status: 422, statusText: 'Rejected' });
    await pending; expect(notify.error).toHaveBeenCalledWith('t:access.errors.ROLE_ASSIGNMENT_LABELS_LIMIT_EXCEEDED');
  });
  it('user-roles-tab: adds selected roles in one PUT', async () => {
    await start(); select(); const pending = tab['saveBranchChoices']();
    const req = http.expectOne((r) => r.method === 'PUT');
    expect(req.request.url).toBe(base + '/assignments');
    expect(req.request.body).toEqual({ assignments: [held, choice('one'), choice('two')].map(({ branchId, roleId }) => ({ branchId, roleId })) });
    req.flush({ success: true, data: [] }); await reads(); await pending;
    expect(notify.success).toHaveBeenCalledWith('access.roles.addedPlural.other:2'); expect(changed).toHaveBeenCalledOnce();
  });
  it('user-roles-tab: a delegated admin can edit branch roles', async () => {
    await start(); expect(tab['effectiveReadonly']()).toBe(false);
    expect(tab['branchGridColumns']()).toBe('grid-cols-staff-user-branch-row-actions');
  });
  it.each(['ACTIVE', 'INVITED'] as const)('user-roles-tab: %s users can save branch roles', async (status) => {
    fixture.componentRef.setInput('user', { ...user, status }); await start();
    expect(tab['effectiveReadonly']()).toBe(false);
    expect(tab['effectiveReadonlyReason']()).toBeNull();
    tab['openAddBranchModal'](); await reads();
    expect(modal.open).toHaveBeenCalledOnce();
    tab['toggleChoice'](choice('one'), true);
    const pending = tab['saveBranchChoices']();
    const req = http.expectOne((r) => r.method === 'PUT' && r.url === base + '/assignments');
    expect(req.request.body.assignments).toEqual([
      { branchId: 'branch', roleId: 'held-role' }, { branchId: 'branch', roleId: 'one' },
    ]);
    req.flush({ success: true, data: [] }); await reads(); await pending;
    expect(changed).toHaveBeenCalledOnce();
  });
  it.each(['ACTIVE', 'INVITED'] as const)('user-roles-tab: %s users can load and save scope roles', async (status) => {
    owner.set(true); fixture.componentRef.setInput('user', { ...user, status });
    fixture.detectChanges(); await settle();
    const requests = http.match((r) => r.method === 'GET' && r.url === base + '/scope-role-assignments');
    expect(requests.length).toBeGreaterThan(0);
    for (const req of requests) req.flush({ success: true, data: [] });
    await reads();
    tab['openAddScopeModal']();
    expect(modal.open).toHaveBeenCalledOnce();
    tab['scopeRoleId'].set('one');
    const pending = tab['saveScopeModal']();
    const req = http.expectOne((r) => r.method === 'PUT' && r.url === base + '/scope-role-assignments');
    expect(req.request.body).toEqual({ assignments: [{ scopeTarget: 'TENANT', roleId: 'one' }] });
    req.flush({ success: true, data: [] }); await reads(); await pending;
    expect(changed).toHaveBeenCalledOnce();
  });
  it.each(['SUSPENDED', 'DELETED'] as const)('user-roles-tab: %s users cannot change branch or scope roles', async (status) => {
    owner.set(true);
    fixture.componentRef.setInput('user', { ...user, status }); await start();
    expect(tab['effectiveReadonly']()).toBe(true);
    expect(tab['effectiveReadonlyReason']()).toBe('access.roles.suspendedReadonly');
    expect(tab['branchGridColumns']()).toBe('grid-cols-staff-user-branch-row');
    http.expectNone(base + '/scope-role-assignments');
    tab['openAddBranchModal'](); tab['openAddScopeModal']();
    select(); await tab['saveBranchChoices'](); await tab['requestRemoveBranch'](held);
    expect(await tab['commitScopeRoles']([{ scopeTarget: 'TENANT', roleId: 'one' }])).toBe(false);
    expect(modal.open).not.toHaveBeenCalled();
    http.expectNone((r) => r.method !== 'GET');
  });
  it('user-roles-tab: seat cascade resends with the flag and a new key', async () => {
    owner.set(true); await start();
    for (const kind of ['add', 'remove', 'scope']) {
      select();
      const pending = kind === 'add' ? tab['saveBranchChoices']() : kind === 'remove' ? tab['requestRemoveBranch'](held) : tab['commitScopeRoles']([{ scopeTarget: 'TENANT', roleId: 'one' }]);
      await settle();
      const req = http.expectOne((r) => r.method !== 'GET');
      const firstKey = req.request.headers.get('x-idempotency-key');
      req.flush({ errorCode: 'SEAT_ADDON_CASCADE_REQUIRED', details: { userIds: ['target'], userNames: ['Test'], addonKeys: ['phone'], addonNames: ['Phone'] } }, { status: 409, statusText: 'Conflict' });
      await settle();
      const resend = http.expectOne((r) => r.method !== 'GET');
      expect(resend.request.params.get('confirmAddonCascade')).toBe('true');
      expect(resend.request.headers.get('x-idempotency-key')).not.toBe(firstKey);
      resend.flush(null, { status: 204, statusText: 'No Content' }); await reads(); await pending;
    }
    expect(confirm).toHaveBeenCalledTimes(3);
  });
  it('user-roles-tab: an invalid pair reloads the options', async () => {
    await start(); select(); const pending = tab['saveBranchChoices'](); reject('/assignments', 'BRANCH_OR_ROLE_INVALID');
    await settle(); http.expectOne((r) => r.url.endsWith('/assignment-options')).flush({ success: true, data: options }); await pending;
    expect(notify.error).toHaveBeenCalledWith('t:access.errors.BRANCH_OR_ROLE_INVALID');
  });
  it('user-roles-tab: an existing assignment reloads the list', async () => {
    await start(); select(); const pending = tab['saveBranchChoices'](); reject('/assignments', 'ASSIGNMENT_EXISTS', 409);
    await settle(); http.expectOne(base + '/assignments').flush({ success: true, data: [held] }); await pending;
    expect(notify.error).toHaveBeenCalledWith('t:access.errors.ASSIGNMENT_EXISTS');
  });
  it('user-roles-tab: limit and authority errors show a toast', async () => {
    await start(); select();
    for (const code of ['TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED', 'ROLE_PERMISSION_AUTHORITY_EXCEEDED']) {
      const pending = tab['saveBranchChoices'](); reject('/assignments', code); await pending;
      expect(notify.error).toHaveBeenCalledWith(`t:access.errors.${code}`);
    }
  });
  it('user-roles-tab: seat capacity toast', async () => {
    await start(); select(); const translate = vi.spyOn(TestBed.inject(TranslocoService), 'translate'); const pending = tab['saveBranchChoices']();
    reject('/assignments', 'SEAT_CAPACITY_INSUFFICIENT', 409, { moduleKey: ['crm'], needed: ['2'], free: ['1'] }); await pending;
    expect(notify.error).toHaveBeenCalledWith('seats.errors.SEAT_CAPACITY_INSUFFICIENT');
    expect(translate).toHaveBeenCalledWith('seats.errors.SEAT_CAPACITY_INSUFFICIENT', { module: 'crm', needed: 2, free: 1 });
  });
  it('user-roles-tab: removes a branch role', async () => {
    await start();
    for (const status of [204, 404]) {
      const pending = tab['requestRemoveBranch'](held); await settle();
      if (status === 204) http.expectOne(base + '/assignments/held').flush(null, { status, statusText: 'No Content' });
      else reject('/assignments/held', 'ASSIGNMENT_NOT_FOUND', 404);
      await reads(); await pending;
    }
    expect(notify.success).toHaveBeenCalledWith('access.common.removed');
  });
  it('user-roles-tab: scope roles are hidden for non-owners', async () => {
    await start(); expect(roles.list).not.toHaveBeenCalled(); http.expectNone(base + '/scope-role-assignments');
  });
  it('user-roles-tab: replaces the scope roles', async () => {
    owner.set(true); await start(); const assignments = [{ scopeTarget: 'TENANT' as const, roleId: 'one' }];
    const pending = tab['commitScopeRoles'](assignments);
    const req = http.expectOne(base + '/scope-role-assignments'); expect(req.request.body).toEqual({ assignments });
    req.flush({ success: true, data: [] }); await reads(); expect(await pending).toBe(true); expect(changed).toHaveBeenCalledOnce();
  });
  it('user-roles-tab: marks invalid scope rows', async () => {
    owner.set(true); await start(); const pending = tab['commitScopeRoles']([{ scopeTarget: 'TENANT', roleId: 'one' }]);
    reject('/scope-role-assignments', 'SCOPE_ROLE_ASSIGNMENT_INVALID', 422, { indexes: ['1', '2'] }); await pending;
    expect(tab['invalidScopeIndexes']()).toEqual([1, 2]);
  });
  it('user-roles-tab: a 401 keeps the key', async () => {
    await start(); select();
    const pending = tab['saveBranchChoices'](); const first = reject('/assignments', 'AUTH_AUTHORIZATION_STALE', 401); await pending;
    expect(notify.error).toHaveBeenCalledWith('staff.errors.notSaved');
    const retry = tab['saveBranchChoices'](); const second = http.expectOne(base + '/assignments');
    expect(second.request.body).toEqual(first.request.body); expect(second.request.headers.get('x-idempotency-key')).toBe(first.request.headers.get('x-idempotency-key'));
    second.flush({ success: true, data: [] }); await reads(); await retry;
  });
  it('falls back to assignment labels when the owner cannot read roles', async () => {
    owner.set(true); roles.list.mockRejectedValueOnce(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS')); await start();
    expect(tab['scopeRoleOptions']()).toEqual([{ value: 'one', label: 'Role one' }]); expect(notify.error).not.toHaveBeenCalled();
  });
  it('pages options at 20 and keeps the existing selection', async () => {
    await start(); select(); tab['choicesHasMore'].set(true); tab['loadMoreChoices']();
    const req = http.expectOne((r) => r.url.endsWith('/assignment-options'));
    expect(req.request.params.get('page')).toBe('2'); expect(req.request.params.get('limit')).toBe('20');
    req.flush({ success: true, data: { ...options, choices: [choice('three')], hasMore: false } }); await settle();
    expect(tab['choices']().map((c) => c.roleId)).toEqual(['one', 'two', 'three']);
    expect(tab['selectedChoices']().map((c) => c.roleId)).toEqual(['one', 'two']);
  });
  it('shows field errors, preserves rows offline, and reuses the failed key', async () => {
    await start(); select(); const pending = tab['saveBranchChoices']();
    const req = http.expectOne(base + '/assignments');
    req.flush({ errorCode: 'CORE_VALIDATION_FAILED', details: { 'assignments.0.roleId': ['Invalid role'] } }, { status: 400, statusText: 'Invalid' }); await pending;
    expect(tab['fieldError']('assignments')).toBe('Invalid role');
    const offline = tab['saveBranchChoices'](); const retry = http.expectOne(base + '/assignments');
    expect(retry.request.headers.get('x-idempotency-key')).toBe(req.request.headers.get('x-idempotency-key'));
    retry.error(new ProgressEvent('error')); await offline;
    expect(tab['branchRoles']()).toEqual([held]); expect(tab['selectedChoices']()).toHaveLength(2); expect(notify.error).not.toHaveBeenCalled();
  });
  it('shows a load-failure state on denied or failed reads and keeps the last rows offline', async () => {
    await start();
    for (const status of [403, 404, 500, 0]) {
      const pending = tab['loadBranch']('target'); const req = http.expectOne(base + '/assignments');
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: status === 404 ? 'TENANT_USER_NOT_FOUND' : 'COMMON.GENERIC.FORBIDDEN' }, { status, statusText: 'Rejected' });
      await pending; expect(tab['branchLoadFailed']()).toBe(status !== 0); expect(tab['branchRoles']()).toEqual([held]);
    }
  });
});
