import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import departmentsEn from '../../../../../../public/i18n/staff-departments/en.json';
import staffEn from '../../../../../../public/i18n/staff/en.json';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { Notify } from '../../../../core/notify/notify';
import type { Branch, Company, Department } from '../shared/staff.model';
import { DepartmentsPage } from './departments-page';

class Loader {
  getTranslation(path: string) {
    return of(path.startsWith('staff-departments/') ? departmentsEn : path.startsWith('staff/') ? staffEn : { staff: staffEn, departments: departmentsEn });
  }
}
const prefix = '/api/tenant/core/v1/organization';
const path = `${prefix}/departments`;
const date = '2026-01-01T00:00:00Z';
const company: Company = { id: 'company', code: 'C', name: 'Company', status: 'ACTIVE', legalName: null, taxNumber: null, countryCode: 'EG', currencyCode: 'EGP', createdAt: date, updatedAt: date };
const branch: Branch = { id: 'branch', companyId: company.id, code: 'B', name: 'Cairo', status: 'ACTIVE', phone: null, address: null, isHeadquarters: false, createdAt: date, updatedAt: date };
const department: Department = { id: 'department', branchId: branch.id, code: 'SALES', name: 'Sales', status: 'ACTIVE', createdAt: date, updatedAt: date };
const grant = { tenantWide: false, companyIds: [company.id], branchIds: [branch.id] };
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
function envelope(data: unknown[], total = data.length) {
  return { success: true, data, meta: { page: 1, limit: 20, total, totalPages: total ? 1 : 0, hasNext: false, hasPrev: false } };
}

describe('Departments list and row actions through real Staff APIs', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let fixture: ComponentFixture<DepartmentsPage>;
  let page: DepartmentsPage;
  let http: HttpTestingController;
  let notify: Notify;

  beforeEach(() => {
    vi.useFakeTimers();
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    const permissions = ['org.company.read', 'org.branch.read', 'org.department.read', 'org.department.manage', 'org.team.read', 'org.team.manage', 'users.user.read'];
    me.set({ ...FAKE_TENANT_ME, permissions, permissionScopes: Object.fromEntries(permissions.map((p) => [p, grant])), accessibleCompanies: [company.id], accessibleBranches: [branch.id], accessibleBranchCompanies: [{ branchId: branch.id, companyId: company.id }] });
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return params.value; } }, queryParamMap: params } },
      { provide: AuthSession, useValue: { me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in', requestVersion: () => ({ generation: 1, revision: 0 }), reloadProfile: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    for (const type of ['success', 'error', 'info', 'warning'] as const) vi.spyOn(notify, type);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const doc = TestBed.inject(DOCUMENT);
    const csrfName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${csrfName}=test-csrf`);
  });

  afterEach(() => {
    http.verify();
    fixture?.destroy();
    dialog.showModal = showModal;
    dialog.close = close;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function render() {
    fixture = TestBed.createComponent(DepartmentsPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }
  function list() { return http.expectOne((req) => req.method === 'GET' && req.url === path); }
  function write(method = 'PATCH') { return http.expectOne({ method, url: `${path}/${department.id}` }); }
  function fail(request: ReturnType<typeof write>, status: number, code: string, details?: object) {
    request.flush({ errorCode: code, details }, { status, statusText: 'Failed' });
  }
  async function settle(rows: Department[] = [department]) {
    for (let pass = 0; pass < 3; pass++) {
      for (const request of http.match((req) => req.method === 'GET')) {
        if (request.request.url === `${prefix}/companies`) request.flush(envelope([company]));
        else if (request.request.url === `${prefix}/branches`) request.flush(envelope([branch]));
        else if (request.request.url === path) request.flush(envelope(rows));
        else if (request.request.url === `${prefix}/teams`) request.flush(envelope([], 3));
        else throw new Error(`Unexpected read: ${request.request.urlWithParams}`);
      }
      await vi.advanceTimersByTimeAsync(10);
      fixture.detectChanges();
    }
  }
  async function open(record = department) {
    page['openEdit'](record);
    http.expectOne({ method: 'GET', url: `${path}/${record.id}` }).flush({ success: true, data: record });
    await vi.advanceTimersByTimeAsync(5);
    fixture.detectChanges();
    return page['departmentModal']();
  }
  async function toggle(record = department) {
    const pending = page['requestToggleStatus'](record);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-confirm-dialog dialog[open]')).not.toBeNull();
    page['statusDialog']()['close'](true);
    await Promise.resolve();
    return { pending };
  }
  async function remove(confirm = true) {
    const pending = page['requestDelete'](department);
    fixture.detectChanges();
    page['deleteConfirm']()['close'](confirm);
    await Promise.resolve();
    return { pending };
  }

  it('list renders Core rows', async () => {
    render();
    list().flush(envelope([department], 21));
    await settle();
    expect(page['rows']()).toEqual([department]);
    expect(page['total']()).toBe(21);
    expect(page['branchName'](branch.id)).toBe(branch.name);
    expect(page['teamCountText'](department.id)).toBe('3');
    const content = fixture.nativeElement.querySelector('[role="table"]').textContent;
    expect(content).toContain('Sales');
    expect(content).toContain('Cairo');
  });

  it('list shows empty and no-results', async () => {
    render();
    await settle([]);
    expect(fixture.nativeElement.querySelector('[role="table"]').textContent).toContain(departmentsEn.empty);
    page['filterValues'].set({ status: 'INACTIVE' });
    fixture.detectChanges();
    await settle([]);
    expect(fixture.nativeElement.querySelector('[role="table"]').textContent).toContain(departmentsEn.noResults);
    const clear = [...fixture.nativeElement.querySelectorAll('button')].find((button: HTMLButtonElement) => button.textContent?.trim() === staffEn.list.clearAll) as HTMLButtonElement;
    expect(clear).toBeDefined();
    clear.click();
    await settle([]);
    expect(page['hasActiveFiltersOrSearch']()).toBe(false);
  });

  it('list denied and failed states', async () => {
    render();
    fail(list(), 403, 'MISSING_REQUIRED_PERMISSIONS');
    await settle();
    expect(page['loadForbidden']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    page['reload']();
    fail(list(), 503, 'COMMON.GENERIC.INTERNAL_ERROR');
    await settle();
    expect(page['loadForbidden']()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(departmentsEn.retry);
    page['reload']();
    await settle();
    expect(page['loadFailed']()).toBe(false);
  });

  it('deep link to a missing department shows no-longer-available', async () => {
    params.next(convertToParamMap({ open: department.id }));
    render();
    fail(http.expectOne({ method: 'GET', url: `${path}/${department.id}` }), 404, 'ORG_NODE_NOT_FOUND');
    await settle();
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.ORG_NODE_NOT_FOUND);
    expect(fixture.nativeElement.querySelector('app-department-modal ui-modal dialog').open).toBe(false);
    expect(page['rows']()).toEqual([department]);
  });

  it('rename sends name only and refreshes', async () => {
    render();
    await settle();
    const modal = await open();
    modal['name'].set('  New sales  ');
    const pending = modal['save']();
    const request = write();
    expect(request.request.body).toEqual({ name: 'New sales' });
    expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(request.request.params.has('confirmAddonCascade')).toBe(false);
    request.flush({ success: true, data: { ...department, name: 'New sales' } });
    await pending;
    list().flush(envelope([{ ...department, name: 'New sales' }]));
    await settle();
    expect(notify.success).toHaveBeenCalledWith(departmentsEn.toast.saved);
    expect(page['rows']()[0].name).toBe('New sales');
    expect(fixture.nativeElement.querySelector('app-department-modal ui-modal dialog').open).toBe(false);
  });

  it('row permissions and opened modal use the exact department branch', async () => {
    render();
    await settle();
    expect(page['actionsFor'](department).map(({ id }) => id)).toEqual(['open', 'edit', 'addTeam', 'viewUsers', 'toggleStatus', 'delete']);
    expect(page['canManageDepartment']({ ...department, branchId: 'outside' })).toBe(false);
    me.update((value) => ({ ...value, permissions: value.permissions.filter((permission) => permission !== 'org.department.manage') }));
    fixture.detectChanges();
    await settle();
    expect(page['actionsFor'](department).map(({ id }) => id)).toEqual(['open', 'addTeam', 'viewUsers']);
    const modal = await open();
    expect(modal.canManage()).toBe(false);
  });

  it('branch cache fallback uses a dash when unknown', async () => {
    render();
    await settle();
    expect(page['branchName']('unknown')).toBe('—');
  });

  it('deactivate from the row menu', async () => {
    render();
    await settle();
    const modal = await open();
    page['onAction'](department, { id: 'toggleStatus' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-confirm-dialog dialog[open]').textContent).toContain('Deactivate Sales?');
    page['statusDialog']()['close'](true);
    await Promise.resolve();
    const request = write();
    expect(request.request.body).toEqual({ status: 'INACTIVE' });
    expect(page['actionsFor'](department).find(({ id }) => id === 'toggleStatus')?.disabled).toBe(true);
    request.flush({ success: true, data: { ...department, status: 'INACTIVE' } });
    await vi.advanceTimersByTimeAsync(5);
    list().flush(envelope([{ ...department, status: 'INACTIVE' }]));
    await settle();
    expect(notify.success).toHaveBeenCalledWith(departmentsEn.toast.deactivated);
    expect(modal['isActive']()).toBe(false);
    expect(page['busyIds']().size).toBe(0);
  });

  for (const [blocker, route] of [
    ['department has active teams', '/workspace/staff/teams'],
    ['department has placed users', '/workspace/staff/users'],
    ['department has team memberships', '/workspace/staff/users'],
  ]) {
    it(`deactivate blocked shows one blocker with link: ${blocker}`, async () => {
      render();
      await settle();
      const { pending } = await toggle();
      fail(write(), 409, 'ORG_NODE_NOT_EMPTY', { blockers: [blocker] });
      await pending;
      fixture.detectChanges();
      const blockers = page['blockersDialog']();
      const rows = blockers['rows']();
      expect(rows).toHaveLength(1);
      expect(rows[0].phrase).toBe(blocker);
      expect(rows[0].link?.route).toEqual([route]);
      blockers['openLink'](rows[0].link!);
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([route], { queryParams: { departmentId: department.id } });
    });
  }

  it('activate under inactive branch shows toast', async () => {
    render();
    await settle();
    const { pending } = await toggle({ ...department, status: 'INACTIVE' });
    const request = write();
    expect(request.request.body).toEqual({ status: 'ACTIVE' });
    fail(request, 409, 'ORG_PARENT_INACTIVE');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(departmentsEn.parentInactive);
  });

  it('modal deactivate output opens the page blockers dialog', async () => {
    render();
    await settle();
    const modal = await open();
    modal['isActive'].set(false);
    const pending = modal['save']();
    fail(write(), 409, 'ORG_NODE_NOT_EMPTY', { blockers: ['department has active teams'] });
    await pending;
    expect(modal['isActive']()).toBe(true);
    expect(page['blockersDialog']()['rows']()).toHaveLength(1);
  });

  for (const [status, code] of [[401, 'GW.AUTH.SESSION_EXPIRED'], [503, 'COMMON.GENERIC.INTERNAL_ERROR']] as const) {
    it(`status retry reuses the held key: ${status}`, async () => {
      render();
      await settle();
      const first = await toggle();
      const request = write();
      fail(request, status, code);
      await first.pending;
      const second = await toggle();
      const retry = write();
      expect(retry.request.headers.get('x-idempotency-key')).toBe(request.request.headers.get('x-idempotency-key'));
      expect(retry.request.body).toEqual(request.request.body);
      if (status === 401) expect(notify.error).toHaveBeenCalledWith(staffEn.errors.notSaved);
      retry.flush({ success: true, data: { ...department, status: 'INACTIVE' } });
      await second.pending;
      await settle();
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    });
  }

  it('delete removes department', async () => {
    render();
    await settle();
    const modal = await open();
    modal['requestDelete']();
    fixture.detectChanges();
    expect(page['pendingDeleteDepartment']()?.id).toBe(department.id);
    page['deleteConfirm']()['close'](true);
    await Promise.resolve();
    const request = write('DELETE');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await vi.advanceTimersByTimeAsync(5);
    list().flush(envelope([]));
    await settle([]);
    expect(page['rows']()).toEqual([]);
    expect(notify.success).toHaveBeenCalledWith(departmentsEn.toast.deleted);
    expect(fixture.nativeElement.querySelector('app-department-modal ui-modal dialog').open).toBe(false);
  });

  it('delete blocked by teams links to teams', async () => {
    render();
    await settle();
    const { pending } = await remove();
    fail(write('DELETE'), 409, 'ORG_NODE_NOT_EMPTY', { blockers: ['department has teams'] });
    await pending;
    const rows = page['blockersDialog']()['rows']();
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toEqual({ label: departmentsEn.blockers.viewTeams, route: ['/workspace/staff/teams'], queryParams: { departmentId: department.id } });
  });

  for (const [status, code] of [[404, 'ORG_NODE_NOT_FOUND'], [403, 'MISSING_REQUIRED_PERMISSIONS'], [503, 'COMMON.GENERIC.INTERNAL_ERROR']] as const) {
    it(`delete errors show toast: ${status}`, async () => {
      render();
      await settle();
      const first = await remove();
      const request = write('DELETE');
      fail(request, status, code);
      await first.pending;
      expect(notify.error).toHaveBeenCalled();
      if (status === 404) { list().flush(envelope([])); await settle([]); }
      else {
        const retry = await remove();
        const second = write('DELETE');
        expect(second.request.headers.get('x-idempotency-key')).toBe(request.request.headers.get('x-idempotency-key'));
        fail(second, status, code);
        await retry.pending;
      }
    });
  }

  it('delete cancel sends nothing', async () => {
    render();
    await settle();
    const { pending } = await remove(false);
    await pending;
    http.expectNone((req) => req.method === 'DELETE');
  });
});
