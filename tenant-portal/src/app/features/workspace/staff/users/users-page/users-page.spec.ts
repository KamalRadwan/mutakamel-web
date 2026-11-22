import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import type { Branch, Company, Department, TenantUser } from '../../shared/staff.model';
import { InviteModal } from '../invite-modal/invite-modal';
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
  getTranslation() { return of({}); }
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
