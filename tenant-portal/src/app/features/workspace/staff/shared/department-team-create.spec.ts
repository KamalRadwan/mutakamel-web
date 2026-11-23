import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { DepartmentModal } from '../departments/department-modal/department-modal';
import { DepartmentsPage } from '../departments/departments-page';
import { TeamModal } from '../teams/team-modal/team-modal';
import { TeamsPage } from '../teams/teams-page';

class EmptyLoader {
  getTranslation() { return of({}); }
}

const prefix = '/api/tenant/core/v1/organization';
const usersPath = '/api/tenant/core/v1/users';
const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const otherBranchId = '019f0000-0000-7000-8000-000000000012';
const departmentId = '019f0000-0000-7000-8000-000000000013';
const leadId = '019f0000-0000-7000-8000-000000000014';
const teamId = '019f0000-0000-7000-8000-000000000015';
const fixtureCsrf = 'mutakamel-http-tenant-csrf=staff-test-csrf';
const date = '2026-01-01T00:00:00Z';
const company = { id: companyId, name: 'Mersany', status: 'ACTIVE' };
const branch = { id: branchId, companyId, name: 'Cairo', status: 'ACTIVE' };
const otherBranch = { ...branch, id: otherBranchId, name: 'Other branch' };
const department = { id: departmentId, branchId, code: 'DELIVERY', name: 'Delivery', status: 'ACTIVE', createdAt: date };
const team = { id: teamId, departmentId, code: 'FIELD', name: 'Field', leadUserId: leadId, status: 'ACTIVE', createdAt: date };
const lead = { id: leadId, companyId, branchId, status: 'ACTIVE', firstName: 'Kareem', lastName: 'Test' };
const grant = { tenantWide: false, companyIds: [companyId], branchIds: [branchId, otherBranchId] };
const writeGrant = { ...grant, branchIds: [branchId] };

function envelope(data: unknown[], page = 1, total = data.length, totalPages = total ? 1 : 0) {
  return { success: true, data, meta: {
    page, limit: 20, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1,
  } };
}

describe('Department and Team create from real Staff scopes', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  const dialog = HTMLDialogElement.prototype;
  const { showModal, close } = dialog;
  let http: HttpTestingController;
  let document: Document;

  beforeEach(() => {
    vi.useFakeTimers();
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    setPermissions('org.company.read', 'org.branch.read', 'org.department.read', 'org.department.manage');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
      { provide: AuthSession, useValue: {
        me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in',
        requestVersion: () => ({ generation: 1 }),
      } },
    ] });
    http = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    document.cookie = `${fixtureCsrf}; path=/`;
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; path=/; max-age=0';
    dialog.showModal = showModal;
    dialog.close = close;
    vi.useRealTimers();
  });

  function setPermissions(...permissions: string[]) {
    me.set({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions,
      permissionScopes: Object.fromEntries(permissions.map((key) => [key, key.endsWith('.manage') ? writeGrant : grant])),
      accessibleCompanies: [companyId], accessibleBranches: [branchId, otherBranchId],
      accessibleBranchCompanies: [{ companyId, branchId }, { companyId, branchId: otherBranchId }],
    });
  }

  function render<T>(type: Type<T>) {
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>) {
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
  }

  function read(resource: string, limit: number, page = 1) {
    return http.expectOne((req) => req.method === 'GET' && req.url === `${prefix}/${resource}` &&
      req.params.get('limit') === String(limit) && req.params.get('page') === String(page));
  }

  function lookups() {
    read('companies', 100).flush(envelope([company]));
    read('branches', 100).flush(envelope([branch, otherBranch]));
  }

  function post(resource: string) {
    const request = http.expectOne({ method: 'POST', url: `${prefix}/${resource}` });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-csrf-token')).toBe('staff-test-csrf');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    return request;
  }

  it('creates a Department in an active allowed branch and safely retries the same body', async () => {
    const fixture = render(DepartmentsPage);
    const page = fixture.componentInstance;
    lookups();
    read('departments', 20).flush(envelope([], 1, 21, 2));
    await settle(fixture);
    expect(page['canAddDepartment']()).toBe(true);
    expect(page['createBranches']().map(({ id }) => id)).toEqual([branchId]);

    page['filterValues'].set({ companyId, branchId });
    fixture.detectChanges();
    const filtered = read('departments', 20);
    expect(filtered.request.params.get('companyId')).toBe(companyId);
    expect(filtered.request.params.get('branchId')).toBe(branchId);
    filtered.flush(envelope([], 1, 21, 2));
    await settle(fixture);

    page['page'].set(2);
    fixture.detectChanges();
    read('departments', 20, 2).flush(envelope([], 2, 21, 2));
    await settle(fixture);
    page['openCreate']();
    fixture.detectChanges();
    const modal: DepartmentModal = fixture.debugElement.query(By.directive(DepartmentModal)).componentInstance;
    expect(modal['cascadeValue']()).toMatchObject({ companyId, branchId });
    modal['code'].set(department.code);
    modal['name'].set(department.name);

    const first = modal['save']();
    const firstPost = post('departments');
    expect(firstPost.request.body).toEqual({ branchId, code: department.code, name: department.name });
    firstPost.error(new ProgressEvent('error'));
    await first;
    expect(page['rows']()).toEqual([]);

    const retry = modal['save']();
    const retryPost = post('departments');
    expect(retryPost.request.headers.get('x-idempotency-key')).toBe(firstPost.request.headers.get('x-idempotency-key'));
    retryPost.flush({ errorCode: 'ORG_CODE_TAKEN' }, { status: 409, statusText: 'Conflict' });
    await retry;
    expect(modal['codeServerError']()).toBeTruthy();

    const updatedDepartment = { ...department, code: 'DELIVERY-2' };
    modal['code'].set(updatedDepartment.code);
    const corrected = modal['save']();
    const correctedPost = post('departments');
    expect(correctedPost.request.body.code).toBe(updatedDepartment.code);
    expect(correctedPost.request.headers.get('x-idempotency-key')).not.toBe(firstPost.request.headers.get('x-idempotency-key'));
    correctedPost.flush({ success: true, data: updatedDepartment }, { status: 201, statusText: 'Created' });
    await corrected;
    await settle(fixture);
    lookups();
    const refreshed = read('departments', 20, 2);
    expect(refreshed.request.params.get('branchId')).toBe(branchId);
    refreshed.flush(envelope([updatedDepartment], 2, 21, 2));
    await settle(fixture);
    expect(page['rows']()).toEqual([updatedDepartment]);
    expect(page['total']()).toBe(21);
    expect(page['page']()).toBe(2);

    page['openEdit'](page['rows']()[0]);
    http.expectOne({ method: 'GET', url: `${prefix}/departments/${departmentId}` }).flush({ success: true, data: updatedDepartment });
    await settle(fixture);
    expect(modal['mode']()).toBe('edit');
    expect(modal['canManage']()).toBe(true);
    expect(modal['name']()).toBe(department.name);
    const parents: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('dialog[open] app-org-cascade input'));
    expect(parents.map(({ value }) => value)).toEqual([company.name, branch.name]);
    expect(page['actionsFor'](page['rows']()[0]).map(({ id }) => id)).toEqual(['open', 'edit', 'toggleStatus', 'delete']);
  });

  it('creates a Team with a selected lead from its department branch and hides fake actions', async () => {
    setPermissions('org.company.read', 'org.branch.read', 'org.department.read', 'org.team.read', 'org.team.manage', 'users.user.read');
    const fixture = render(TeamsPage);
    const page = fixture.componentInstance;
    const inactiveDepartment = { ...department, id: '019f0000-0000-7000-8000-000000000016', status: 'INACTIVE' };
    lookups();
    read('departments', 100).flush(envelope([department, inactiveDepartment]));
    read('teams', 20).flush(envelope([]));
    await settle(fixture);
    expect(page['canAddTeam']()).toBe(true);
    expect(page['createDepartments']().map(({ id }) => id)).toEqual([departmentId]);
    page['openCreate']();
    fixture.detectChanges();
    const modal: TeamModal = fixture.debugElement.query(By.directive(TeamModal)).componentInstance;
    expect(modal['cascadeValue']()).toMatchObject({ companyId, branchId, departmentId });

    const loading = modal['loadLeadOptions']('Kareem');
    const candidates = http.expectOne((req) => req.method === 'GET' && req.url === usersPath && req.params.get('status') === 'ACTIVE');
    expect(candidates.request.params.get('branchId')).toBe(branchId);
    candidates.flush(envelope([lead, { ...lead, id: 'outside', branchId: otherBranchId }]));
    await loading;
    expect(modal['leadOptions']()).toEqual([{ ...lead, seats: [] }]);
    modal['selectLead'](modal['leadOptions']()[0]);
    modal['code'].set(team.code);
    modal['name'].set(team.name);

    document.cookie = 'mutakamel-http-tenant-csrf=; path=/; max-age=0';
    await modal['save']();
    http.expectNone({ method: 'POST', url: `${prefix}/teams` });
    document.cookie = `${fixtureCsrf}; path=/`;

    const pending = modal['save']();
    const request = post('teams');
    expect(request.request.body).toEqual({ departmentId, code: team.code, name: team.name, leadUserId: leadId });
    request.flush({ success: true, data: team }, { status: 201, statusText: 'Created' });
    await pending;
    await settle(fixture);
    lookups();
    read('departments', 100).flush(envelope([department]));
    read('teams', 20).flush(envelope([team]));
    await settle(fixture);
    http.expectOne({ method: 'GET', url: `${usersPath}/${leadId}` }).flush({ success: true, data: lead });
    http.expectOne((req) => req.url === usersPath && req.params.get('teamId') === teamId).flush(envelope([]));
    await settle(fixture);
    expect(page['rows']()).toEqual([team]);
    expect(page['actionsFor'](page['rows']()[0]).map(({ id }) => id)).toEqual(['open', 'edit', 'viewMembers', 'toggleStatus', 'delete']);
  });

  it('keeps an out-of-branch manage grant from enabling Department create and distinguishes 403', async () => {
    const fixture = render(DepartmentsPage);
    const page = fixture.componentInstance;
    read('companies', 100).flush(envelope([company]));
    read('branches', 100).flush(envelope([otherBranch]));
    read('departments', 20).flush({ code: 'GW.AUTH.FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    await settle(fixture);
    expect(page['canAddDepartment']()).toBe(false);
    expect(page['loadForbidden']()).toBe(true);
    page['openCreate']();
    http.expectNone({ method: 'POST', url: `${prefix}/departments` });
  });
});
