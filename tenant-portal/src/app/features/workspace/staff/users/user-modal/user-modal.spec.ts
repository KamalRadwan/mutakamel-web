import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { StaffSession } from '../../shared/staff-session';
import type { TenantUser } from '../../shared/staff.model';
import { UserModal } from './user-modal';

const user: TenantUser = {
  id: 'user', email: 'user@example.invalid', firstName: 'Test', lastName: 'User',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [],
  createdAt: '2026-11-22T12:00:00Z', updatedAt: '2026-11-22T12:00:00Z',
};
class EmptyLoader { getTranslation() { return of({}); } }

describe('user-modal', () => {
  const me = signal({ id: 'actor' });
  const can = vi.fn(() => true);
  const showModal = HTMLDialogElement.prototype.showModal;
  const close = HTMLDialogElement.prototype.close;
  beforeEach(() => {
    me.set({ id: 'actor' }); can.mockReset().mockReturnValue(true);
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const page = async () => ({ data: [], meta: { hasNext: false } });
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: StaffSession, useValue: { me, can, isTenantWide: () => false, scopeRevision: () => 'scope' } },
      { provide: OrganizationReadApi, useValue: { listCompanies: page, listBranches: page, listDepartments: page, listTeams: page } },
    ] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); HTMLDialogElement.prototype.showModal = showModal; HTMLDialogElement.prototype.close = close; });
  function create() {
    const fixture = TestBed.createComponent(UserModal);
    fixture.componentRef.setInput('statusActionsFor', () => []); fixture.detectChanges();
    fixture.componentInstance.open(user); fixture.detectChanges();
    return fixture;
  }
  it('reload uses the real API and closes on 404', async () => {
    const fixture = create(); const modal = fixture.componentInstance;
    const updated = vi.fn(); modal.userUpdated.subscribe(updated);
    const pending = modal.reloadUser();
    TestBed.inject(HttpTestingController).expectOne('/api/tenant/core/v1/users/user').flush({ success: true, data: { ...user, status: 'SUSPENDED' } });
    await pending; expect(updated).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUSPENDED' }));
    const deleted = vi.fn(); modal.deletedRemotely.subscribe(deleted);
    const missing = modal.reloadUser();
    TestBed.inject(HttpTestingController).expectOne('/api/tenant/core/v1/users/user').flush({ errorCode: 'TENANT_USER_NOT_FOUND' }, { status: 404, statusText: 'Not found' });
    await missing; expect(deleted).toHaveBeenCalledOnce();
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(false);
    expect(TestBed.inject(Notify).toasts()[0].type).toBe('error');
  });
  it('teams and apps are read-only for self and outside the branch grant', () => {
    const fixture = create(); const modal = fixture.componentInstance;
    expect(modal['appsReadonly']()).toBe(false);
    expect(can).toHaveBeenCalledWith('users.user.manage_modules', { companyId: user.companyId, branchId: user.branchId });
    me.set({ id: user.id }); fixture.detectChanges();
    expect(modal['teamsReadonly']()).toBe(true); expect(modal['appsReadonly']()).toBe(true);
    expect(modal['teamsReadonlyReason']()).toContain('self'); expect(modal['appsReadonlyReason']()).toContain('self');
    me.set({ id: 'actor' }); can.mockReturnValue(false); fixture.detectChanges();
    expect(modal['teamsReadonly']()).toBe(true); expect(modal['appsReadonly']()).toBe(true);
    expect(modal['teamsReadonlyReason']()).toContain('scope'); expect(modal['appsReadonlyReason']()).toContain('scope');
  });
});
