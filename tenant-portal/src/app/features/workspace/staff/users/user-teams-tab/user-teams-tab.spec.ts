import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { StaffSession } from '../../shared/staff-session';
import type { ReportingScopes, TeamMembership, TenantUser } from '../../shared/staff.model';
import { UserTeamsTab } from './user-teams-tab';

const base = '/api/tenant/core/v1/users/target/team-memberships';
const stamp = '2026-11-22T00:00:00.000Z';
const user: TenantUser = { id: 'target', firstName: 'Test', lastName: 'User', email: 'test@example.invalid',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: 'home', managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [], createdAt: stamp, updatedAt: stamp };
const primary: TeamMembership = { id: 'primary', tenantUserId: 'target', companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: 'home', role: 'MEMBER', isPrimary: true, reportingScopeRevision: 1, createdAt: stamp, updatedAt: stamp };
const member: TeamMembership = { ...primary, id: 'member', teamId: 'other', isPrimary: false };
const scopes: ReportingScopes = { membershipId: member.id, revision: 3, items: [
  { id: 'home', companyId: 'company', branchId: 'branch', origin: 'HOME', revision: 3, capabilities: { canRemove: false } },
  { id: 'explicit', companyId: 'company', branchId: 'old', origin: 'EXPLICIT', revision: 3, capabilities: { canRemove: true } },
], capabilities: { canManage: true } };

describe('UserTeamsTab live access', () => {
  let fixture: ComponentFixture<UserTeamsTab>;
  let tab: UserTeamsTab;
  let http: HttpTestingController;
  const me = signal({ id: 'actor' });
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const modal = { open: vi.fn(async () => true), close: vi.fn() };
  const changed = vi.fn();
  const page = async () => ({ data: [], meta: { total: 0, totalPages: 0, hasNext: false } });

  beforeEach(() => {
    vi.clearAllMocks(); me.set({ id: 'actor' });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { me, isOwner: () => true, can: () => true, isTenantWide: () => true, scopeRevision: () => 'scope' } },
      { provide: OrganizationReadApi, useValue: { listBranches: page, listDepartments: page, listTeams: page } },
      { provide: Notify, useValue: notify },
      { provide: TranslocoService, useValue: { events$: new Subject(), translate: (key: string) => (key.startsWith('access.errors.') && !key.includes('.GW.')) || key === 'settings.errors.idempotencyMismatch' ? `t:${key}` : key } },
    ] });
    TestBed.overrideComponent(UserTeamsTab, { set: { template: '', imports: [] } });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixture = TestBed.createComponent(UserTeamsTab); tab = fixture.componentInstance;
    fixture.componentRef.setInput('user', user);
    for (const name of ['addTeamModal', 'changeRoleModal', 'reportingModal', 'removeTeamConfirm']) Object.defineProperty(tab, name, { value: () => modal });
    tab.changed.subscribe(changed); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
  async function reads() {
    for (let i = 0; i < 4; i++) {
      await settle();
      for (const req of http.match((r) => r.method === 'GET')) req.flush({ success: true, data: req.request.url.endsWith('/reporting-scopes') ? scopes : [primary, member] });
    }
    await settle();
  }
  async function start() { fixture.detectChanges(); await reads(); }
  function reporting() {
    tab['reportingMembership'].set(member); tab['reportingScopes'].set(scopes);
    tab['pendingAddBranchIds'].set(['new']); tab['pendingRemoveBranchIds'].set(['old']);
  }
  function reject(code: string, status = 409) {
    const req = http.expectOne((r) => r.method !== 'GET');
    req.flush({ errorCode: code }, { status, statusText: 'Rejected' }); return req;
  }

  it('user-teams-tab: lists memberships and protects the primary', async () => {
    await start(); expect(tab['memberships']()).toEqual([primary, member]);
    expect(tab['actionsFor'](primary).map((a) => a.id)).not.toContain('remove');
    expect(tab['actionsFor'](member).map((a) => a.id)).toContain('remove');
  });
  it('user-teams-tab: adds a membership from the returned list', async () => {
    await start(); tab['cascadeValue'].set({ companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: 'new' });
    const pending = tab['saveAddTeam'](); const req = http.expectOne(base);
    expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual({ teamId: 'new', role: 'MEMBER' });
    const returned = [primary, member, { ...member, id: 'new', teamId: 'new' }]; req.flush({ success: true, data: returned }); await pending;
    expect(tab['memberships']()).toEqual(returned); expect(changed).toHaveBeenCalledOnce(); expect(notify.success).toHaveBeenCalledWith('access.common.saved');
  });
  it('user-teams-tab: changes a role with the full list', async () => {
    await start(); tab['editingMembership'].set(member); tab['nextRole'].set('LEAD');
    const pending = tab['saveRoleChange'](); const req = http.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ memberships: [{ teamId: 'home', role: 'MEMBER', isPrimary: true }, { teamId: 'other', role: 'LEAD', isPrimary: false }] });
    req.flush({ success: true, data: [primary, { ...member, role: 'LEAD' }] }); await reads(); await pending;
    expect(changed).toHaveBeenCalledOnce();
  });
  it('user-teams-tab: removes a membership', async () => {
    await start();
    const pending = tab['requestRemove'](member); await settle();
    http.expectOne(base + '/member').flush(null, { status: 204, statusText: 'No Content' }); await reads(); await pending;
    expect(notify.success).toHaveBeenCalledWith('access.common.removed');
    const rejected = tab['requestRemove'](member); await settle(); reject('PRIMARY_TEAM_MEMBERSHIP_PROTECTED'); await rejected;
    expect(notify.error).toHaveBeenCalledWith('access.teams.homeProtected');
  });
  it('user-teams-tab: membership conflicts show a toast', async () => {
    await start(); tab['cascadeValue'].set({ companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: 'new' });
    for (const code of ['TEAM_MEMBERSHIP_ALREADY_EXISTS', 'TEAM_MEMBERSHIP_PRIMARY_CONFLICT', 'TEAM_MEMBERSHIP_NOT_FOUND', 'TEAM_MEMBERSHIP_LIMIT_EXCEEDED']) {
      const pending = tab['saveAddTeam'](); reject(code, code.endsWith('EXCEEDED') ? 422 : 409); await pending;
      expect(notify.error).toHaveBeenCalledWith(`t:access.errors.${code}`);
    }
  });
  it('user-teams-tab: self is read-only', async () => {
    me.set({ id: 'target' }); await start(); reporting();
    await tab['saveAddTeam'](); await tab['saveRoleChange'](); await tab['requestRemove'](member); await tab['saveReporting']();
    expect(tab['effectiveReadonlyReason']()).toBe('staff.protected.self'); http.expectNone((r) => r.method !== 'GET');
  });
  it('user-teams-tab: saves reporting scopes with expectedRevision', async () => {
    await start(); reporting(); const pending = tab['saveReporting'](); const req = http.expectOne(base + '/member/reporting-scopes');
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ expectedRevision: 3, addBranchIds: ['new'], removeBranchIds: ['old'] });
    req.flush({ success: true, data: { membershipId: member.id, revision: 4, outcome: 'APPLIED', replayed: false } }); await reads(); await pending;
    expect(notify.success).toHaveBeenCalledWith('access.common.saved'); expect(changed).toHaveBeenCalledOnce();
  });
  it('user-teams-tab: no change is an info toast', async () => {
    await start(); reporting(); const pending = tab['saveReporting']();
    http.expectOne(base + '/member/reporting-scopes').flush({ success: true, data: { membershipId: member.id, revision: 3, outcome: 'NO_CHANGE', replayed: false } });
    await reads(); await pending; expect(notify.info).toHaveBeenCalledWith('access.rep.noChange'); expect(changed).not.toHaveBeenCalled();
  });
  it('user-teams-tab: reporting conflict reload and keep', async () => {
    await start();
    for (const code of ['TEAM_REPORTING_SCOPE_REVISION_CONFLICT', 'TEAM_REPORTING_SCOPE_CHANGE_CONFLICT']) {
      for (const keep of [false, true]) {
        reporting(); const pending = tab['saveReporting'](); const first = reject(code); await pending;
        expect(tab['conflictOpen']()).toBe(true);
        const refresh = keep ? tab['keepReportingAfterConflict']() : tab['reloadReportingAfterConflict']();
        http.expectOne(base + '/member/reporting-scopes').flush({ success: true, data: { ...scopes, revision: 4 } }); await refresh;
        expect(tab['pendingAddBranchIds']()).toEqual(keep ? ['new'] : []); expect(tab['pendingRemoveBranchIds']()).toEqual(keep ? ['old'] : []);
        expect(tab['reportingScopes']()?.revision).toBe(4); expect(tab['savingReporting']()).toBe(false);
        if (keep) {
          const retry = tab['saveReporting'](); const req = http.expectOne(base + '/member/reporting-scopes');
          expect(req.request.body.expectedRevision).toBe(4); expect(req.request.headers.get('x-idempotency-key')).not.toBe(first.request.headers.get('x-idempotency-key'));
          req.flush({ success: true, data: { outcome: 'APPLIED' } }); await reads(); await retry;
        }
      }
    }
  });
  it('user-teams-tab: review required warning', async () => {
    await start(); reporting(); const pending = tab['saveReporting'](); reject('TEAM_REPORTING_SCOPE_REVIEW_REQUIRED'); await pending;
    expect(notify.warning).toHaveBeenCalledWith('t:access.errors.TEAM_REPORTING_SCOPE_REVIEW_REQUIRED'); expect(tab['pendingAddBranchIds']()).toEqual(['new']);
  });
  it('user-teams-tab: idempotency conflict reloads', async () => {
    await start(); reporting(); const pending = tab['saveReporting'](); reject('TEAM_REPORTING_SCOPE_IDEMPOTENCY_CONFLICT'); await reads(); await pending;
    expect(notify.warning).toHaveBeenCalledWith('t:settings.errors.idempotencyMismatch'); expect(tab['pendingAddBranchIds']()).toEqual([]);
  });
  it('keeps the reporting key after 401 and field validation beside its field', async () => {
    await start(); reporting(); const pending = tab['saveReporting'](); const first = reject('AUTH_AUTHORIZATION_STALE', 401); await pending;
    expect(notify.error).toHaveBeenCalledWith('staff.errors.notSaved');
    const retry = tab['saveReporting'](); const req = http.expectOne(base + '/member/reporting-scopes');
    expect(req.request.headers.get('x-idempotency-key')).toBe(first.request.headers.get('x-idempotency-key'));
    req.flush({ errorCode: 'CORE_VALIDATION_FAILED', details: { addBranchIds: ['Invalid branch'] } }, { status: 400, statusText: 'Invalid' }); await retry;
    expect(tab['fieldError']('addBranchIds')).toBe('Invalid branch');
  });
});
