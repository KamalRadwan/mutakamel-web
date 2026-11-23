import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import departmentsEn from '../../../../../../../public/i18n/staff-departments/en.json';
import staffEn from '../../../../../../../public/i18n/staff/en.json';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { Notify } from '../../../../../core/notify/notify';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import type { Branch, Company, Department } from '../../shared/staff.model';
import { DepartmentModal } from './department-modal';

class Loader {
  getTranslation() { return of({ staff: staffEn, departments: departmentsEn }); }
}
const path = '/api/tenant/core/v1/organization/departments';
const date = '2026-01-01T00:00:00Z';
const company: Company = { id: 'company', code: 'C', name: 'Company', status: 'ACTIVE', legalName: null, taxNumber: null, countryCode: 'EG', currencyCode: 'EGP', createdAt: date, updatedAt: date };
const branch: Branch = { id: 'branch', companyId: company.id, code: 'B', name: 'Cairo', status: 'ACTIVE', phone: null, address: null, isHeadquarters: false, createdAt: date, updatedAt: date };
const department: Department = { id: 'department', branchId: branch.id, code: 'SALES', name: 'Sales', status: 'ACTIVE', createdAt: date, updatedAt: date };
const grant = { tenantWide: false, companyIds: [company.id], branchIds: [branch.id] };
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;

describe('Department modal writes through the real Staff APIs', () => {
  const me = signal<TenantMe>(FAKE_TENANT_ME);
  let fixture: ComponentFixture<DepartmentModal>;
  let modal: DepartmentModal;
  let http: HttpTestingController;
  let notify: Notify;
  let csrf: string;

  beforeEach(() => {
    vi.useFakeTimers();
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    const permissions = ['org.department.read', 'org.department.manage', 'org.branch.read'];
    me.set({ ...FAKE_TENANT_ME, permissions, permissionScopes: Object.fromEntries(permissions.map((p) => [p, grant])), accessibleCompanies: [company.id], accessibleBranches: [branch.id], accessibleBranchCompanies: [{ branchId: branch.id, companyId: company.id }] });
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: AuthSession, useValue: { me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in', requestVersion: () => ({ generation: 1, revision: 0 }), reloadProfile: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    for (const type of ['success', 'error', 'info', 'warning'] as const) vi.spyOn(notify, type);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const doc = TestBed.inject(DOCUMENT);
    csrf = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf=test-csrf' : 'mutakamel-http-tenant-csrf=test-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(csrf);
    fixture = TestBed.createComponent(DepartmentModal);
    fixture.componentRef.setInput('companies', [company]);
    fixture.componentRef.setInput('branches', [branch]);
    fixture.componentRef.setInput('createBranches', [branch]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    modal = fixture.componentInstance;
    modal.openEdit(department, company.id);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    dialog.showModal = showModal;
    dialog.close = close;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function rename() { modal['name'].set('New sales'); }
  function write(method = 'PATCH') { return http.expectOne({ method, url: method === 'POST' ? path : `${path}/${department.id}` }); }
  function fail(request: ReturnType<typeof write>, status: number, code: string, details?: object) {
    request.flush({ errorCode: code, details }, { status, statusText: 'Failed' });
  }
  async function retryKey(status: number, code: string) {
    rename();
    const first = modal['save']();
    const request = write();
    const key = request.request.headers.get('x-idempotency-key');
    fail(request, status, code);
    await first;
    expect(modal['dirty']()).toBe(true);
    expect(modal['saving']()).toBe(false);
    expect(fixture.nativeElement.querySelector('ui-modal dialog').open).toBe(true);
    const retry = modal['save']();
    const second = write();
    expect(second.request.body).toEqual(request.request.body);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    second.flush({ success: true, data: { ...department, name: 'New sales' } });
    await retry;
    return key;
  }

  it('viewer gets read-only modal', async () => {
    me.update((value) => ({ ...value, permissions: ['org.department.read'], permissionScopes: { 'org.department.read': grant } }));
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form');
    expect(form.querySelector('input[id$="-name"]').readOnly).toBe(true);
    expect(form.querySelector('input[id$="-code"]').readOnly).toBe(true);
    expect(form.querySelector('ui-switch')).toBeNull();
    expect(fixture.nativeElement.querySelector('[modal-footer]').textContent.trim()).toBe('Close');
    await modal['save']();
    http.expectNone((req) => req.method !== 'GET');
  });

  it('undo restores the base and Save is enabled only when dirty', async () => {
    const save = () => fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    rename();
    modal['isActive'].set(false);
    fixture.detectChanges();
    expect(save().disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[modal-footer]').textContent).toContain('Unsaved changes');
    modal['undo']();
    fixture.detectChanges();
    expect(modal['name']()).toBe(department.name);
    expect(modal['isActive']()).toBe(true);
    expect(save().disabled).toBe(true);
    const deleted = vi.fn();
    modal.deleteRequested.subscribe(deleted);
    modal['requestDelete']();
    expect(deleted).toHaveBeenCalledWith(department);
    http.expectNone((req) => req.method !== 'GET');
  });

  it('rename retry reuses key', async () => {
    const key = await retryKey(503, 'COMMON.GENERIC.INTERNAL_ERROR');
    expect(key).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  });

  it('rename without CSRF cookie sends nothing', async () => {
    vi.mocked(Object.getOwnPropertyDescriptor(TestBed.inject(DOCUMENT), 'cookie')!.get!).mockReturnValue('');
    rename();
    await modal['save']();
    http.expectNone((req) => req.method === 'PATCH');
    expect(modal['dirty']()).toBe(true);
    expect(notify.error).toHaveBeenCalled();
  });

  it('rename validation error shows under name', async () => {
    rename();
    const pending = modal['save']();
    fail(write(), 400, 'CORE_VALIDATION_FAILED', { name: ['Use a different name.'], _: ['Invalid request.'] });
    await pending;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form').textContent).toContain('Use a different name.');
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.CORE_VALIDATION_FAILED);
  });

  it('rename idempotency bad value shows generic error', async () => {
    rename();
    const pending = modal['save']();
    fail(write(), 400, 'GW.IDEM.BAD_VALUE');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.generic);
  });

  it('rename 401 keeps form and key without navigation', async () => {
    await retryKey(401, 'GW.AUTH.SESSION_EXPIRED');
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.notSaved);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('rename denied shows permission toast', async () => {
    rename();
    const pending = modal['save']();
    fail(write(), 403, 'MISSING_REQUIRED_PERMISSIONS');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.MISSING_REQUIRED_PERMISSIONS);
    expect(modal['dirty']()).toBe(true);
  });

  it('rename of a deleted department closes and refreshes', async () => {
    const reload = vi.fn();
    modal.staleScopeDetected.subscribe(reload);
    rename();
    const pending = modal['save']();
    fail(write(), 404, 'ORG_NODE_NOT_FOUND');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.ORG_NODE_NOT_FOUND);
    expect(fixture.nativeElement.querySelector('ui-modal dialog').open).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  for (const keep of [false, true]) {
    it(keep ? 'scope stale keep changes retries with new key' : 'scope stale reload discards edits', async () => {
      const reload = vi.fn();
      modal.staleScopeDetected.subscribe(reload);
      rename();
      const pending = modal['save']();
      const request = write();
      fail(request, 409, 'ORG_NODE_SCOPE_STALE');
      await pending;
      fixture.detectChanges();
      const conflict = fixture.debugElement.query(By.directive(ConflictDialog)).componentInstance as ConflictDialog;
      expect(conflict.open()).toBe(true);
      expect(conflict.recordLabel()).toBe(department.name);
      conflict['choose'](keep ? 'keep' : 'reload');
      http.expectOne({ method: 'GET', url: `${path}/${department.id}` }).flush({ success: true, data: { ...department, name: 'Latest sales' } });
      await vi.advanceTimersByTimeAsync(5);
      fixture.detectChanges();
      expect(modal['baseDepartment']()?.name).toBe('Latest sales');
      expect(modal['name']()).toBe(keep ? 'New sales' : 'Latest sales');
      expect(modal['dirty']()).toBe(keep);
      if (keep) {
        const retry = modal['save']();
        const second = write();
        expect(second.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
        second.flush({ success: true, data: { ...department, name: 'New sales' } });
        await retry;
      } else expect(reload).toHaveBeenCalledOnce();
    });
  }

  it('failed conflict re-read closes with a toast', async () => {
    const pending = modal['resolveConflict'](true);
    fail(http.expectOne({ method: 'GET', url: `${path}/${department.id}` }), 404, 'ORG_NODE_NOT_FOUND');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(staffEn.errors.ORG_NODE_NOT_FOUND);
    expect(fixture.nativeElement.querySelector('ui-modal dialog').open).toBe(false);
  });

  it('rename in flight shows info and blocks resend', async () => {
    rename();
    const pending = modal['save']();
    const request = write();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    await modal['save']();
    http.expectNone((req) => req.method === 'PATCH');
    fail(request, 409, 'GW.IDEM.IN_FLIGHT');
    await pending;
    expect(notify.info).toHaveBeenCalledWith(staffEn.errors.GW.IDEM.IN_FLIGHT);
  });

  it('rename idempotency mismatch shows warning', async () => {
    rename();
    const pending = modal['save']();
    fail(write(), 422, 'GW.IDEM.MISMATCH');
    await pending;
    expect(notify.warning).toHaveBeenCalledWith(staffEn.errors.GW.IDEM.MISMATCH);
  });

  it('rename offline keeps form and key', async () => {
    rename();
    const first = modal['save']();
    const request = write();
    request.error(new ProgressEvent('error'));
    await first;
    fixture.detectChanges();
    expect(modal['dirty']()).toBe(true);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
    const retry = modal['save']();
    const second = write();
    expect(second.request.headers.get('x-idempotency-key')).toBe(request.request.headers.get('x-idempotency-key'));
    second.flush({ success: true, data: { ...department, name: 'New sales' } });
    await retry;
  });

  it('modal deactivate blocked restores switch', async () => {
    const blocked = vi.fn();
    modal.deactivateBlocked.subscribe(blocked);
    modal['isActive'].set(false);
    const pending = modal['save']();
    const request = write();
    expect(request.request.body).toEqual({ status: 'INACTIVE' });
    fail(request, 409, 'ORG_NODE_NOT_EMPTY', { blockers: ['department has active teams'] });
    await pending;
    expect(modal['isActive']()).toBe(true);
    expect(blocked).toHaveBeenCalledWith({ department, blockers: ['department has active teams'] });
  });

  it('modal status-only save uses the status toast', async () => {
    modal['isActive'].set(false);
    const pending = modal['save']();
    const request = write();
    expect(request.request.body).toEqual({ status: 'INACTIVE' });
    request.flush({ success: true, data: { ...department, status: 'INACTIVE' } });
    await pending;
    expect(notify.success).toHaveBeenCalledWith(departmentsEn.toast.deactivated);
  });

  it('create under inactive branch shows branch field error', async () => {
    modal.openCreate({ companyId: company.id, branchId: branch.id });
    modal['code'].set('NEW');
    modal['name'].set('New department');
    const pending = modal['save']();
    fail(write('POST'), 409, 'ORG_PARENT_INACTIVE');
    await pending;
    fixture.detectChanges();
    expect(modal['cascadeErrors']()).toEqual({ branch: departmentsEn.parentInactive });
    expect(fixture.nativeElement.querySelector('form').textContent).toContain(departmentsEn.parentInactive);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('create duplicate code shows code error', async () => {
    modal.openCreate({ companyId: company.id, branchId: branch.id });
    modal['code'].set('NEW');
    modal['name'].set('New department');
    const pending = modal['save']();
    fail(write('POST'), 409, 'ORG_CODE_TAKEN');
    await pending;
    expect(modal['codeError']()).toBe(staffEn.errors.ORG_CODE_TAKEN);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('create validation maps name code and branch fields', async () => {
    modal.openCreate({ companyId: company.id, branchId: branch.id });
    modal['code'].set('NEW');
    modal['name'].set('New department');
    const pending = modal['save']();
    fail(write('POST'), 400, 'CORE_VALIDATION_FAILED', { name: ['Name issue'], code: ['Code issue'], branchId: ['Branch issue'] });
    await pending;
    expect(modal['nameError']()).toBe('Name issue');
    expect(modal['codeError']()).toBe('Code issue');
    expect(modal['cascadeErrors']()).toEqual({ branch: 'Branch issue' });
  });

  it('branch lookup denied falls back silently', async () => {
    modal.openEdit(department);
    fail(http.expectOne({ method: 'GET', url: `/api/tenant/core/v1/organization/branches/${branch.id}` }), 403, 'BRANCH_PERMISSION_DENIED');
    await vi.advanceTimersByTimeAsync(5);
    fixture.detectChanges();
    expect(modal['name']()).toBe(department.name);
    expect(modal['cascadeValue']().branchId).toBe(branch.id);
    expect(fixture.nativeElement.querySelector('ui-modal dialog').open).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });
});
