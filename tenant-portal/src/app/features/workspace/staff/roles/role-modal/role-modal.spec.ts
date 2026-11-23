import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rolesEn from '../../../../../../../public/i18n/staff-roles/en.json';
import staffEn from '../../../../../../../public/i18n/staff/en.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { StaffSession } from '../../shared/staff-session';
import type { RoleDetail } from '../../shared/staff.model';
import { RoleModal } from './role-modal';

const dialog = HTMLDialogElement.prototype;
const originalShowModal = dialog.showModal;
const originalClose = dialog.close;
const base = '/api/tenant/core/v1/roles';
const role: RoleDetail = {
  id: '019f0000-0000-7000-8000-000000000010',
  name: 'Reader',
  nameI18n: { en: 'Reader', ar: 'قارئ' },
  description: 'Old description',
  permissionMode: 'GLOBAL',
  permissionCount: 0,
  holderCount: 0,
  permissionIds: [],
  branchProfileCount: 0,
  isSystem: false,
  createdAt: '',
  updatedAt: '',
};
class TestLoader {
  getTranslation() {
    return of({ roles: rolesEn, staff: staffEn, settings: settingsEn });
  }
}

describe('Role modal edit', () => {
  let fixture: ComponentFixture<RoleModal>;
  let http: HttpTestingController;
  let component: RoleModal;
  let notify: Notify;
  let canUpdate = true;
  beforeEach(async () => {
    canUpdate = true;
    dialog.showModal = function () {
      this.open = true;
    };
    dialog.close = function () {
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: TestLoader,
        }),
        {
          provide: StaffSession,
          useValue: {
            scopeRevision: signal('scope'),
            can: () => true,
            isTenantWide: () => canUpdate,
            canReadRolePermissions: () => true,
            canReadBranchPermissions: () => true,
          },
        },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(
      `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`,
    );
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    fixture = TestBed.createComponent(RoleModal);
    fixture.componentRef.setInput('canCreate', true);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    component.openDetails(role);
    fixture.detectChanges();
  });
  afterEach(() => {
    dialog.showModal = originalShowModal;
    dialog.close = originalClose;
    http?.verify();
    vi.restoreAllMocks();
  });
  function edit(selector: string, value: string) {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  function save() {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return http.expectOne({ method: 'PATCH', url: `${base}/${role.id}` });
  }
  function lastToast() {
    return notify.toasts().at(-1);
  }

  it('renames a custom role and refreshes the list', async () => {
    const saved = vi.fn();
    component.saved.subscribe(saved);
    edit('input', ' Renamed ');
    const req = save();
    expect(req.request.body).toEqual({ name: 'Renamed' });
    req.flush({ success: true, data: { ...role, name: 'Renamed' } });
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }));
    expect(component['dirty']()).toBe(false);
    expect(lastToast()?.title).toBe(rolesEn.toast.saved);
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe(
      'Renamed',
    );
  });
  it('sends null to clear the description', async () => {
    edit('textarea', '');
    const req = save();
    expect(req.request.body).toEqual({ description: null });
    req.flush({ success: true, data: { ...role, description: null } });
    await fixture.whenStable();
  });
  it('shows field messages from a 400', async () => {
    edit('input', 'Renamed');
    const req = save();
    req.flush(
      {
        errorCode: 'CORE_VALIDATION_FAILED',
        details: {
          name: ['Name rejected'],
          description: ['Description rejected'],
          _: ['Cannot save'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Name rejected');
    expect(fixture.nativeElement.textContent).toContain('Description rejected');
    expect(lastToast()?.title).toBe('Cannot save');
  });
  it.each(['ROLE_NAME_TAKEN', 'ROLE_NAME_RESERVED'] as const)(
    'shows the name conflict under Name on edit: %s',
    async (code) => {
      edit('input', 'Renamed');
      save().flush({ errorCode: code }, { status: 409, statusText: 'Conflict' });
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain(rolesEn.errors[code]);
    },
  );
  it('toasts ROLE_IS_SYSTEM', async () => {
    edit('input', 'Renamed');
    save().flush({ errorCode: 'ROLE_IS_SYSTEM' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(lastToast()?.title).toBe(rolesEn.errors.ROLE_IS_SYSTEM);
  });
  it('closes and refreshes on a 404 edit', async () => {
    const missing = vi.fn();
    component.deletedRemotely.subscribe(missing);
    edit('input', 'Renamed');
    save().flush({ errorCode: 'ROLE_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(missing).toHaveBeenCalledOnce();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });
  it.each(['TENANT_WIDE_PERMISSION_REQUIRED', 'MISSING_REQUIRED_PERMISSIONS'])(
    'toasts a permission error on edit: %s',
    async (code) => {
      edit('input', 'Renamed');
      save().flush({ errorCode: code }, { status: 403, statusText: 'Forbidden' });
      await fixture.whenStable();
      expect(lastToast()?.type).toBe('error');
      expect(component['dirty']()).toBe(true);
    },
  );
  it('reuses the key on retry and handles IN_FLIGHT and MISMATCH on edit', async () => {
    edit('input', 'Renamed');
    const req = save();
    const key = req.request.headers.get('x-idempotency-key');
    const body = req.request.body;
    fixture.detectChanges();
    expect(component['saving']()).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    req.flush({ code: 'GW.IDEM.IN_FLIGHT' }, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() => expect(component['saving']()).toBe(false));
    expect(lastToast()?.type).toBe('info');
    const retry = save();
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retry.request.body).toEqual(body);
    retry.flush({ code: 'GW.IDEM.MISMATCH' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();
    expect(lastToast()?.type).toBe('warning');
    edit('input', 'Changed');
    const changed = save();
    expect(changed.request.headers.get('x-idempotency-key')).not.toBe(key);
    changed.flush({ success: true, data: { ...role, name: 'Changed' } });
    await fixture.whenStable();
  });
  it.each([401, 500])('keeps the form and key after a %s on edit', async (status) => {
    edit('input', 'Renamed');
    const first = save();
    const key = first.request.headers.get('x-idempotency-key');
    const body = first.request.body;
    first.flush(
      { errorCode: status === 401 ? 'AUTH_AUTHORIZATION_STALE' : 'COMMON.GENERIC.INTERNAL_ERROR' },
      { status, statusText: 'Failure' },
    );
    await fixture.whenStable();
    expect(component['dirty']()).toBe(true);
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(true);
    if (status === 401) expect(lastToast()?.title).toBe(staffEn.errors.notSaved);
    const retry = save();
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retry.request.body).toEqual(body);
    retry.flush({ success: true, data: { ...role, name: 'Renamed' } });
    await fixture.whenStable();
  });
  it('opens system roles read-only with the system note', () => {
    component.openDetails({ ...role, isSystem: true });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(rolesEn.modal.systemNote);
    component['save']();
    http.expectNone(() => true);
  });
  it('keeps the same layout read-only without update authority', () => {
    canUpdate = false;
    component.openDetails({ ...role, id: 'another' });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
  });
  it('undoes metadata and emits the approved Delete and Permissions actions', async () => {
    const deleted = vi.fn();
    const permissions = vi.fn();
    component.deleteRequested.subscribe(deleted);
    component.permissionsRequested.subscribe(permissions);
    edit('input', 'Renamed');
    component['undo']();
    fixture.detectChanges();
    expect(component['dirty']()).toBe(false);
    component['requestDelete']();
    expect(deleted).toHaveBeenCalledWith(role);
    await component['openPermissions']();
    expect(permissions).toHaveBeenCalledWith(role);
  });
});
