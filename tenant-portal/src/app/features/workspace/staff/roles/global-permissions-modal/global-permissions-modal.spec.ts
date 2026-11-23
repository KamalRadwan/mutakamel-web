import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rolesEn from '../../../../../../../public/i18n/staff-roles/en.json';
import staffEn from '../../../../../../../public/i18n/staff/en.json';
import permEn from '../../../../../../../public/i18n/staff-permissions/en.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import seatsEn from '../../../../../../../public/i18n/seats/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { StaffSession } from '../../shared/staff-session';
import type { Permission, RoleDetail } from '../../shared/staff.model';
import { GlobalPermissionsModal } from './global-permissions-modal';

// The Seats preview remains fake and out of scope; isolate that presentation slot.
@Component({ selector: 'app-seat-impact', template: '' })
class SeatImpactStub {
  readonly changes = input<unknown>(null);
  readonly compact = input(false);
  readonly canBuySeats = input(false);
  readonly blocking = output<boolean>();
}

const dialog = HTMLDialogElement.prototype;
const originalShowModal = dialog.showModal;
const originalClose = dialog.close;
const base = '/api/tenant/core/v1/roles';
const catalogue = '/api/tenant/core/v1/permissions';
const role: RoleDetail = {
  id: '019f0000-0000-7000-8000-000000000010',
  name: 'Reader',
  nameI18n: { en: 'Reader', ar: 'قارئ' },
  description: undefined,
  permissionMode: 'GLOBAL',
  permissionCount: 0,
  permissionIds: [],
  branchProfileCount: 0,
  isSystem: false,
  createdAt: '',
  updatedAt: '',
};
const permission: Permission = {
  id: '019f0000-0000-7000-8000-000000000011',
  key: 'crm.lead.read.all',
  nameEn: 'Read leads',
  nameAr: 'عرض العملاء',
  descriptionI18n: { en: 'Read leads', ar: 'عرض العملاء' },
  group: 'crm',
  groupI18n: { en: 'CRM', ar: 'إدارة العملاء' },
};
const restrictedPermission: Permission = {
  ...permission,
  id: '019f0000-0000-7000-8000-000000000012',
  key: 'users.user.delete',
  nameEn: 'Delete users',
  nameAr: 'حذف المستخدمين',
  descriptionI18n: { en: 'Delete users', ar: 'حذف المستخدمين' },
  group: 'users',
  groupI18n: { en: 'Users', ar: 'المستخدمون' },
};
const root = { roles: rolesEn, staff: staffEn, perm: permEn, settings: settingsEn, seats: seatsEn };
class TestLoader {
  getTranslation(path: string) {
    const scopes: Record<string, unknown> = {
      'staff-roles': rolesEn,
      staff: staffEn,
      'staff-permissions': permEn,
      settings: settingsEn,
      seats: seatsEn,
    };
    return of(scopes[path.split('/')[0]] ?? root);
  }
}

describe('Global permission matrix', () => {
  let fixture: ComponentFixture<GlobalPermissionsModal>;
  let component: GlobalPermissionsModal;
  let http: HttpTestingController;
  let notify: Notify;
  const cascade = { confirm: vi.fn() };
  const tenantGrants = signal<string[]>([permission.key]);
  const owner = signal(false);
  beforeEach(async () => {
    tenantGrants.set([permission.key]);
    owner.set(false);
    cascade.confirm.mockReset().mockResolvedValue(true);
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
            isOwner: owner,
            isTenantWide: (key: string) => owner() || key.startsWith('roles.') || tenantGrants().includes(key),
            canReadRolePermissions: () => true,
          },
        },
        { provide: SeatCascadeConfirm, useValue: cascade },
      ],
    });
    TestBed.overrideComponent(GlobalPermissionsModal, {
      remove: { imports: [SeatImpact] },
      add: { imports: [SeatImpactStub] },
    });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(
      `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`,
    );
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    fixture = TestBed.createComponent(GlobalPermissionsModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    dialog.showModal = originalShowModal;
    dialog.close = originalClose;
    http?.verify();
    vi.restoreAllMocks();
  });
  function page(items: Permission[] = [permission], pageNumber = 1, hasNext = false) {
    const req = http.expectOne((r) => r.url === catalogue);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.get('page')).toBe(String(pageNumber));
    req.flush({
      success: true,
      data: items,
      meta: {
        page: pageNumber,
        limit: 100,
        total: hasNext ? 101 : 1,
        totalPages: hasNext ? 2 : pageNumber,
        hasNext,
        hasPrev: pageNumber > 1,
      },
    });
  }
  async function open(detail = role, permissions = [permission]) {
    component.open(role.id);
    fixture.detectChanges();
    http.expectOne(`${base}/${role.id}`).flush({ success: true, data: detail });
    page(permissions);
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    fixture.detectChanges();
  }
  function select(ids = [permission.id]) {
    component['selected'].set(ids);
    fixture.detectChanges();
  }
  function save() {
    const pending = component['save']();
    const req = http.expectOne({ method: 'PUT', url: `${base}/${role.id}/permissions` });
    return { pending, req };
  }
  function lastToast() {
    return notify.toasts().at(-1);
  }
  function saveButton(): HTMLButtonElement {
    const element: HTMLElement = fixture.nativeElement;
    return Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === rolesEn.common.save,
    )!;
  }

  it('loads every catalogue page for the matrix', async () => {
    component.open(role.id);
    http.expectOne(`${base}/${role.id}`).flush({ success: true, data: role });
    page([permission], 1, true);
    await vi.waitFor(() => {
      page([{ ...permission, id: 'second', key: 'crm.lead.create' }], 2);
    });
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    fixture.detectChanges();
    expect(component['entries']()).toHaveLength(2);
    expect(component['entries']()[0].label).toEqual(permission.descriptionI18n);
    expect(fixture.nativeElement.textContent).not.toContain('roles.global.title');
    expect(fixture.nativeElement.textContent).not.toContain('perm.search');
  });
  it.each([403, 500, 0])('shows the modal load failure with Retry: %s', async (status) => {
    component.open(role.id);
    const req = http.expectOne(`${base}/${role.id}`);
    page();
    if (status)
      req.flush({ errorCode: 'COMMON.GENERIC.FORBIDDEN' }, { status, statusText: 'Failure' });
    else req.error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(component['loadFailed']()).toBe(true);
    component['reloadData']();
    http.expectOne(`${base}/${role.id}`).flush({ success: true, data: role });
    page();
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    expect(component['loadFailed']()).toBe(false);
  });
  it('saves the global permission set with a key', async () => {
    await open();
    select();
    const saved = vi.fn();
    component.saved.subscribe(saved);
    const { req, pending } = save();
    expect(req.request.body).toEqual({ permissionIds: [permission.id] });
    expect(req.request.headers.get('x-idempotency-key')).toMatch(/-7[a-f\d]{3}-/i);
    req.flush({ success: true, data: { ...role, permissionIds: [permission.id] } });
    await pending;
    expect(lastToast()?.title).toBe(rolesEn.global.saved);
    expect(saved).toHaveBeenCalledOnce();
  });
  it('blocks more than 200 permissions before sending', async () => {
    await open();
    select(Array.from({ length: 201 }, (_, i) => `p${i}`));
    await component['save']();
    http.expectNone((r) => r.method === 'PUT');
    expect(lastToast()?.title).toBe(rolesEn.errors.TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED);
  });
  it('disables permissions the actor cannot grant', async () => {
    await open();
    tenantGrants.set([]);
    fixture.detectChanges();
    expect(component['disabledPermissionIds']()).toContain(permission.id);
    select();
    await component['save']();
    http.expectNone((r) => r.method === 'PUT');
  });
  it('disables Save and describes an existing selection beyond the actor authority', async () => {
    await open(
      { ...role, permissionIds: [restrictedPermission.id], permissionCount: 1 },
      [permission, restrictedPermission],
    );
    const button = saveButton();
    const hint: HTMLElement = fixture.nativeElement.querySelector('#global-permissions-authority-hint');
    expect(component['exceedsAuthority']()).toBe(true);
    expect(button.disabled).toBe(true);
    expect(hint.textContent?.trim()).toBe(rolesEn.errors.ROLE_PERMISSION_AUTHORITY_EXCEEDED);
    expect(button.getAttribute('aria-describedby')).toBe(hint.id);
    expect(fixture.nativeElement.textContent).not.toContain(rolesEn.common.unsaved);

    select([restrictedPermission.id, permission.id]);
    expect(component['dirty']()).toBe(true);
    expect(button.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain(rolesEn.common.unsaved);
    button.click();
    await fixture.whenStable();
    http.expectNone((r) => r.method === 'PUT');
  });
  it('enables Save and removes the authority hint after removing the ungrantable key', async () => {
    await open(
      { ...role, permissionIds: [restrictedPermission.id], permissionCount: 1 },
      [permission, restrictedPermission],
    );
    select([permission.id]);
    const button = saveButton();
    expect(component['exceedsAuthority']()).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(fixture.nativeElement.querySelector('#global-permissions-authority-hint')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(rolesEn.errors.ROLE_PERMISSION_AUTHORITY_EXCEEDED);
    expect(fixture.nativeElement.textContent).toContain(rolesEn.common.unsaved);
    const { req, pending } = save();
    req.flush({ success: true, data: { ...role, permissionIds: [permission.id] } });
    await pending;
  });
  it('does not block an owner from saving any catalogue permission', async () => {
    owner.set(true);
    await open(
      { ...role, permissionIds: [restrictedPermission.id], permissionCount: 1 },
      [permission, restrictedPermission],
    );
    select([restrictedPermission.id, permission.id]);
    expect(component['exceedsAuthority']()).toBe(false);
    expect(saveButton().disabled).toBe(false);
    expect(saveButton().hasAttribute('aria-describedby')).toBe(false);
    expect(fixture.nativeElement.querySelector('#global-permissions-authority-hint')).toBeNull();
    const { req, pending } = save();
    req.flush({ success: true, data: { ...role, permissionIds: [restrictedPermission.id, permission.id] } });
    await pending;
  });
  it.each(['ROLE_PERMISSION_AUTHORITY_EXCEEDED', 'ROLE_PERMISSION_GRANT_DENIED'] as const)(
    'toasts the authority error on save: %s',
    async (code) => {
      await open();
      select();
      const { req, pending } = save();
      req.flush(
        { errorCode: code },
        { status: code.endsWith('GRANT_DENIED') ? 403 : 422, statusText: 'Denied' },
      );
      await pending;
      expect(lastToast()?.title).toBe(rolesEn.errors.ROLE_PERMISSION_AUTHORITY_EXCEEDED);
      expect(component['selected']()).toEqual([permission.id]);
    },
  );
  it('reloads the catalogue after PERMISSION_UNKNOWN', async () => {
    await open();
    select();
    const { req, pending } = save();
    const key = req.request.headers.get('x-idempotency-key');
    req.flush({ errorCode: 'PERMISSION_UNKNOWN' }, { status: 422, statusText: 'Invalid' });
    await pending;
    expect(component['listChangedError']()).toBe(true);
    component['reloadData']();
    http.expectOne(`${base}/${role.id}`).flush({ success: true, data: role });
    page();
    await vi.waitFor(() => expect(component['loading']()).toBe(false));
    expect(component['listChangedError']()).toBe(false);
    select();
    const next = save();
    expect(next.req.request.headers.get('x-idempotency-key')).not.toBe(key);
    next.req.flush({ success: true, data: role });
    await next.pending;
  });
  it('opens the wizard for ROLE_BRANCH_MODE_REQUIRED as owner', async () => {
    await open();
    select();
    const conflict = vi.fn();
    component.branchModeConflict.subscribe(conflict);
    const { req, pending } = save();
    req.flush({ errorCode: 'ROLE_BRANCH_MODE_REQUIRED' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(conflict).toHaveBeenCalledWith(role.id);
    expect(component['role']()).toBeNull();
  });
  it('resends with confirmAddonCascade and a new key after the seat confirm', async () => {
    await open();
    select();
    const { req, pending } = save();
    const key = req.request.headers.get('x-idempotency-key');
    const body = req.request.body;
    req.flush(
      {
        errorCode: 'SEAT_ADDON_CASCADE_REQUIRED',
        details: { userIds: ['u'], userNames: ['User'], addonKeys: ['crm'], addonNames: ['CRM'] },
      },
      { status: 409, statusText: 'Conflict' },
    );
    await vi.waitFor(() => {
      const retry = http.expectOne(
        (r) => r.method === 'PUT' && r.params.get('confirmAddonCascade') === 'true',
      );
      expect(retry.request.headers.get('x-idempotency-key')).not.toBe(key);
      expect(retry.request.body).toEqual(body);
      retry.flush({ success: true, data: role });
    });
    await pending;
    expect(cascade.confirm).toHaveBeenCalledWith([
      { userId: 'u', userName: 'User', addonKey: 'crm', addonName: 'CRM' },
    ]);
  });
  it('keeps the selection when the seat cascade is cancelled', async () => {
    cascade.confirm.mockResolvedValue(false);
    await open();
    select();
    const { req, pending } = save();
    req.flush(
      { errorCode: 'SEAT_ADDON_CASCADE_REQUIRED' },
      { status: 409, statusText: 'Conflict' },
    );
    await pending;
    expect(component['dirty']()).toBe(true);
    http.expectNone((r) => r.method === 'PUT');
  });
  it.each([
    ['ROLE_IS_SYSTEM', 409],
    ['ROLE_NOT_FOUND', 404],
  ] as const)('toasts system and missing role on save: %s', async (code, status) => {
    await open();
    select();
    const missing = vi.fn();
    component.missing.subscribe(missing);
    const { req, pending } = save();
    req.flush({ errorCode: code }, { status, statusText: 'Failure' });
    await pending;
    expect(lastToast()?.type).toBe('error');
    expect(missing).toHaveBeenCalledTimes(status === 404 ? 1 : 0);
  });
  it.each([401, 500])('reuses the key and keeps the selection after %s on save', async (status) => {
    await open();
    select();
    const { req, pending } = save();
    const key = req.request.headers.get('x-idempotency-key');
    const body = req.request.body;
    req.flush(
      { errorCode: status === 401 ? 'AUTH_AUTHORIZATION_STALE' : 'COMMON.GENERIC.INTERNAL_ERROR' },
      { status, statusText: 'Failure' },
    );
    await pending;
    expect(component['dirty']()).toBe(true);
    if (status === 401) expect(lastToast()?.title).toBe(staffEn.errors.notSaved);
    const retry = save();
    expect(retry.req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retry.req.request.body).toEqual(body);
    retry.req.flush({ success: true, data: role });
    await retry.pending;
  });
  it('handles IN_FLIGHT and MISMATCH and changes the key when the permission body changes', async () => {
    await open();
    select();
    const first = save();
    const key = first.req.request.headers.get('x-idempotency-key');
    expect(component['saving']()).toBe(true);
    first.req.flush({ code: 'GW.IDEM.IN_FLIGHT' }, { status: 409, statusText: 'Conflict' });
    await first.pending;
    expect(lastToast()?.type).toBe('info');
    const retry = save();
    expect(retry.req.request.headers.get('x-idempotency-key')).toBe(key);
    retry.req.flush({ code: 'GW.IDEM.MISMATCH' }, { status: 422, statusText: 'Invalid' });
    await retry.pending;
    expect(lastToast()?.type).toBe('warning');
    component['entries'].update((entries) => [...entries, { ...entries[0], id: 'second' }]);
    select([permission.id, 'second']);
    const changed = save();
    expect(changed.req.request.headers.get('x-idempotency-key')).not.toBe(key);
    changed.req.flush({ success: true, data: role });
    await changed.pending;
  });
});
