import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rolesAr from '../../../../../../../public/i18n/staff-roles/ar.json';
import rolesEn from '../../../../../../../public/i18n/staff-roles/en.json';
import staffEn from '../../../../../../../public/i18n/staff/en.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import seatsEn from '../../../../../../../public/i18n/seats/en.json';
import permEn from '../../../../../../../public/i18n/staff-permissions/en.json';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { SessionStatus, TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import type { RoleDetail } from '../../shared/staff.model';
import { RolesApi } from '../roles.api';
import { By } from '@angular/platform-browser';
import { Notify } from '../../../../../core/notify/notify';
import { BlockersDialog } from '../../shared/blockers-dialog/blockers-dialog';
import { RoleModal } from '../role-modal/role-modal';
import { AssignPermissionsWizard } from '../assign-wizard/assign-wizard';
import { GlobalPermissionsModal } from '../global-permissions-modal/global-permissions-modal';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { RolesPage } from './roles-page';

const base = '/api/tenant/core/v1/roles';
const read = 'roles.role.read';
const create = 'roles.role.create';
const tenantWide = { tenantWide: true, companyIds: [], branchIds: [] };
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
const created: RoleDetail = {
  id: '019f0000-0000-7000-8000-000000000010',
  name: 'Inventory reader',
  nameI18n: { en: 'Inventory reader', ar: 'قارئ المخزون' },
  description: 'Read stock',
  isSystem: false,
  permissionMode: 'GLOBAL',
  branchProfileCount: 0,
  permissionCount: 0,
  holderCount: 0,
  permissionIds: [],
  createdAt: '2026-11-22T00:00:00Z',
  updatedAt: '2026-11-22T00:00:00Z',
};

class TestLoader {
  getTranslation(path: string) {
    if (path === 'staff-roles/en') return of(rolesEn);
    if (path === 'staff-roles/ar') return of(rolesAr);
    const scopes: Record<string, unknown> = {
      staff: staffEn,
      settings: settingsEn,
      seats: seatsEn,
      'staff-permissions': permEn,
    };
    return of(scopes[path.split('/')[0]] ?? {});
  }
}

describe('Roles add and read', () => {
  let languageBefore: { stored: string | null; lang: string; dir: string };
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('loading');
  let http: HttpTestingController;
  let cookie: string;
  const queryParams = new BehaviorSubject(convertToParamMap({}));

  beforeEach(() => {
    languageBefore = { stored: localStorage.getItem('lang'), lang: document.documentElement.lang, dir: document.documentElement.dir };
    dialog.showModal = function () {
      this.open = true;
    };
    dialog.close = function () {
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    };
    queryParams.next(convertToParamMap({}));
    me.set(null);
    status.set('loading');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams } },
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            missingHandler: { logMissingKey: false },
          },
          loader: TestLoader,
        }),
        { provide: AuthSession, useValue: { me, status, ensureLoaded: async () => status() } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName =
      doc.location.protocol === 'https:'
        ? '__Host-mutakamel-tenant-csrf'
        : 'mutakamel-http-tenant-csrf';
    cookie = `${cookieName}=test-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(SeatCascadeConfirm), 'confirm').mockResolvedValue(true);
    TestBed.inject(LanguageState).current.set('en');
  });

  afterEach(() => {
    dialog.showModal = showModal;
    dialog.close = close;
    http.verify();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    if (languageBefore.stored === null) localStorage.removeItem('lang');
    else localStorage.setItem('lang', languageBefore.stored);
    document.documentElement.lang = languageBefore.lang;
    document.documentElement.dir = languageBefore.dir;
  });

  function signIn(permissionScopes: TenantMe['permissionScopes'], id = FAKE_TENANT_ME.id): void {
    me.set({
      ...FAKE_TENANT_ME,
      id,
      isTenantOwner: false,
      permissions: Object.keys(permissionScopes),
      permissionScopes,
    });
    status.set('signed-in');
  }

  function flushList(items: RoleDetail[] = [], sort = 'name') {
    const request = http.expectOne((req) => req.method === 'GET' && req.url === base);
    expect(request.request.params.get('sortBy')).toBe(sort);
    expect(request.request.params.get('sortDir')).toBe(sort === 'name' ? 'ASC' : 'DESC');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({
      success: true,
      data: items,
      meta: {
        page: 1,
        limit: 20,
        total: items.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  }

  function button(
    fixture: ComponentFixture<RolesPage>,
    label: string,
  ): HTMLButtonElement | undefined {
    const root: HTMLElement = fixture.nativeElement;
    return [...root.querySelectorAll('button')].find((item) => item.textContent.trim() === label);
  }

  function field(fixture: ComponentFixture<RolesPage>, selector: string, value: string): void {
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function save(fixture: ComponentFixture<RolesPage>) {
    const root: HTMLElement = fixture.nativeElement;
    root
      .querySelector('app-role-modal form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return http.expectOne({ method: 'POST', url: base });
  }

  it.each([
    { language: 'en', labels: rolesEn, theme: 'light' },
    { language: 'en', labels: rolesEn, theme: 'dark' },
    { language: 'ar', labels: rolesAr, theme: 'light' },
    { language: 'ar', labels: rolesAr, theme: 'dark' },
  ] as const)(
    'uses the existing Add Role dialog, submits just metadata and reloads Core in $language $theme',
    async ({ language, labels, theme }) => {
      TestBed.inject(DOCUMENT).documentElement.dataset['theme'] = theme;
      TestBed.inject(DOCUMENT).documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      signIn({ [read]: tenantWide, [create]: tenantWide, 'roles.role.update': tenantWide });
      TestBed.inject(LanguageState).current.set(language);
      const fixture = TestBed.createComponent(RolesPage);
      fixture.detectChanges();
      flushList();
      await fixture.whenStable();
      button(fixture, labels.add)!.click();
      fixture.detectChanges();
      expect(button(fixture, labels.modal.create)).toBeDefined();
      field(fixture, 'app-role-modal input[id$="-name"]', ' Inventory reader ');
      field(fixture, 'app-role-modal textarea', ' Read stock ');

      const request = save(fixture);
      expect(request.request.body).toEqual({
        name: created.name,
        description: created.description,
      });
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('x-csrf-token')).toBe('test-proof');
      expect(request.request.headers.get('x-idempotency-key')).toMatch(
        /^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i,
      );
      request.flush({ success: true, data: created }, { status: 201, statusText: 'Created' });
      await vi.waitFor(() => {
        fixture.detectChanges();
        flushList([created], 'createdAt');
      });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain(created.nameI18n[language]);
      });
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('app-global-permissions-modal')).not.toBeNull();
      expect(root.querySelector('app-assign-permissions-wizard')).not.toBeNull();
      const rowButton = button(fixture, created.nameI18n[language]);
      rowButton!.click();
      fixture.detectChanges();
      expect(
        root.querySelector<HTMLInputElement>('app-role-modal input[id$="-name"]')?.readOnly,
      ).toBe(false);
      expect(root.querySelector('app-role-modal button[type="submit"]')).not.toBeNull();
    },
  );

  it('waits for authenticated scope and leaves Add hidden for branch-only write authority', async () => {
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    http.expectNone((request) => request.url.startsWith(base));
    const branchOnly = {
      ...tenantWide,
      tenantWide: false,
      branchIds: FAKE_TENANT_ME.accessibleBranches,
    };
    signIn({ [read]: tenantWide, [create]: branchOnly });
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    expect(button(fixture, rolesEn.add)).toBeUndefined();
    await expect(
      TestBed.inject(RolesApi).create({ name: 'Unauthorized' }, 'key'),
    ).rejects.toMatchObject({ status: 403 });
    http.expectNone({ method: 'POST', url: base });

    signIn({ [read]: tenantWide, [create]: tenantWide });
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    expect(button(fixture, rolesEn.add)).toBeDefined();
  });

  it('keeps the draft and idempotency key on retry, and gives an edited request a new key', async () => {
    signIn({ [read]: tenantWide, [create]: tenantWide });
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    button(fixture, rolesEn.add)!.click();
    fixture.detectChanges();
    field(fixture, 'app-role-modal input[id$="-name"]', 'Inventory reader');

    const first = save(fixture);
    const key = first.request.headers.get('x-idempotency-key');
    first.error(new ProgressEvent('error'));
    await fixture.whenStable();
    const retry = save(fixture);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    retry.flush({ errorCode: 'ROLE_NAME_TAKEN' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(rolesEn.errors.ROLE_NAME_TAKEN);

    field(fixture, 'app-role-modal input[id$="-name"]', 'Different role');
    const edited = save(fixture);
    expect(edited.request.headers.get('x-idempotency-key')).not.toBe(key);
    edited.flush({ errorCode: 'ROLE_NAME_RESERVED' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(rolesEn.errors.ROLE_NAME_RESERVED);
  });

  it('rejects missing CSRF and discards a late read on account change', async () => {
    signIn({ [read]: tenantWide, [create]: tenantWide });
    const api = TestBed.inject(RolesApi);
    cookie = '';
    await expect(api.create({ name: created.name }, 'key')).rejects.toMatchObject({
      code: 'GW.AUTH.CSRF_INVALID',
    });
    http.expectNone({ method: 'POST', url: base });

    const pending = api.get(created.id);
    const request = http.expectOne({ method: 'GET', url: `${base}/${created.id}` });
    signIn({ [read]: tenantWide }, 'different-account');
    request.flush({ success: true, data: created });
    await expect(pending).rejects.toMatchObject({ status: 403 });
  });

  async function show(owner = false) {
    signIn(
      Object.fromEntries(
        [
          'roles.role.read',
          'roles.role.create',
          'roles.role.update',
          'roles.role.delete',
          'roles.permission.read',
        ].map((key) => [key, tenantWide]),
      ),
    );
    me.update((value) => (value ? { ...value, isTenantOwner: owner } : value));
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    flushList([created]);
    await vi.waitFor(() => expect(fixture.componentInstance['loading']()).toBe(false));
    fixture.detectChanges();
    return fixture;
  }
  function child<T>(fixture: ComponentFixture<RolesPage>, type: new (...args: never[]) => T): T {
    return fixture.debugElement.query(By.directive(type)).componentInstance as T;
  }

  it('shows the forbidden state when the role list is denied', async () => {
    signIn({ [read]: tenantWide });
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === base)
      .flush(
        { errorCode: 'MISSING_REQUIRED_PERMISSIONS' },
        { status: 403, statusText: 'Forbidden' },
      );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-route-error')).not.toBeNull();
    });
  });
  it('shows load failure with Retry on 500', async () => {
    signIn({ [read]: tenantWide });
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === base).flush({}, { status: 500, statusText: 'Failure' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button(fixture, rolesEn.retry)).toBeDefined();
    });
    button(fixture, rolesEn.retry)!.click();
    flushList([created]);
    await fixture.whenStable();
  });
  it('keeps empty and filtered-empty lists and clears filters through StaffList', async () => {
    const fixture = await show();
    const page = fixture.componentInstance;
    page['onSearchChange']('missing');
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(rolesEn.noResults);
    });
    page['onSearchChange']('');
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(rolesEn.empty);
    });
  });
  it('toasts and stays on the list for a missing deep-linked role', async () => {
    signIn({ [read]: tenantWide });
    queryParams.next(convertToParamMap({ open: created.id }));
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    flushList();
    http
      .expectOne(base + '/' + created.id)
      .flush({ errorCode: 'ROLE_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await vi.waitFor(() => expect(TestBed.inject(Notify).toasts().length).toBe(1));
    expect(
      (fixture.nativeElement.querySelector('app-role-modal dialog') as HTMLDialogElement).open,
    ).toBe(false);
  });
  it('restores every approved row action and hides the wizard entry for non-owners', async () => {
    const fixture = await show();
    const page = fixture.componentInstance;
    expect(page['actionsFor'](created).map((a) => a.id)).toEqual([
      'open',
      'edit',
      'workspace',
      'view',
      'duplicate',
      'delete',
    ]);
    const branch = { ...created, permissionMode: 'BRANCH' as const };
    expect(page['actionsFor'](branch).some((a) => a.id === 'assign' || a.id === 'view')).toBe(
      false,
    );
    expect(page['actionsFor'](branch).find((a) => a.id === 'duplicate')).toMatchObject({
      disabled: true,
      reason: rolesEn.reason.noDuplicateBranch,
    });
    expect(
      page['actionsFor']({ ...created, isSystem: true }).find((a) => a.id === 'edit'),
    ).toMatchObject({ disabled: true, reason: rolesEn.reason.system });
  });
  it('asks before converting a GLOBAL role and opens Assign only after confirm', async () => {
    const fixture = await show(true);
    const page = fixture.componentInstance;
    const opened = vi
      .spyOn(child(fixture, AssignPermissionsWizard), 'open')
      .mockImplementation(() => undefined);
    page['onRowAction']({ ...created, permissionCount: 1 }, { id: 'assign' });
    fixture.detectChanges();
    expect(opened).not.toHaveBeenCalled();
    const dialogs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('ui-confirm-dialog dialog'),
    ];
    const confirm = dialogs.find((d) => (d as HTMLDialogElement).open)!;
    [...confirm.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === rolesEn.convert.confirm)!
      .click();
    await vi.waitFor(() => expect(opened).toHaveBeenCalledWith(created.id));
  });
  it('offers create-mode choice to the owner and opens the selected editor', async () => {
    const fixture = await show(true);
    const page = fixture.componentInstance;
    const opened = vi
      .spyOn(child(fixture, AssignPermissionsWizard), 'open')
      .mockImplementation(() => undefined);
    page['onRoleCreated'](created);
    fixture.detectChanges();
    flushList([created], 'createdAt');
    expect(page['pendingModeRole']()?.id).toBe(created.id);
    page['chooseCreateMode']('BRANCH');
    expect(opened).toHaveBeenCalledWith(created.id);
    await vi.waitFor(() => expect(page['loading']()).toBe(false));
    const global = vi
      .spyOn(child(fixture, GlobalPermissionsModal), 'open')
      .mockImplementation(() => undefined);
    page['onRoleCreated'](created);
    page['chooseCreateMode']('GLOBAL');
    expect(global).toHaveBeenCalledWith(created.id, { roleName: created.name });
    fixture.detectChanges();
    flushList([created], 'createdAt');
    await fixture.whenStable();
  });
  it('opens the workspace editor after create for an authorized non-owner', async () => {
    const fixture = await show();
    const page = fixture.componentInstance;
    const opened = vi
      .spyOn(child(fixture, GlobalPermissionsModal), 'open')
      .mockImplementation(() => undefined);
    page['onRoleCreated'](created);
    fixture.detectChanges();
    flushList([created], 'createdAt');
    await fixture.whenStable();
    expect(opened).toHaveBeenCalledWith(created.id, { roleName: created.name });
    expect(page['pendingModeRole']()).toBeNull();
  });
  it('opens the wizard for ROLE_BRANCH_MODE_REQUIRED as owner', async () => {
    const fixture = await show(true);
    const page = fixture.componentInstance;
    const opened = vi
      .spyOn(child(fixture, AssignPermissionsWizard), 'open')
      .mockImplementation(() => undefined);
    page['onBranchModeConflict'](created.id);
    flushList([created]);
    await fixture.whenStable();
    expect(opened).toHaveBeenCalledWith(created.id);
  });
  it('refreshes without opening the wizard for ROLE_BRANCH_MODE_REQUIRED as non-owner', async () => {
    const fixture = await show();
    const page = fixture.componentInstance;
    const opened = vi
      .spyOn(child(fixture, AssignPermissionsWizard), 'open')
      .mockImplementation(() => undefined);
    page['onBranchModeConflict'](created.id);
    flushList([created]);
    await fixture.whenStable();
    expect(opened).not.toHaveBeenCalled();
  });

  function duplicateStart(fixture: ComponentFixture<RolesPage>) {
    fixture.componentInstance['onRowAction'](created, { id: 'duplicate' });
    http.expectOne(base + '/' + created.id).flush({
      success: true,
      data: { ...created, permissionIds: ['019f0000-0000-7000-8000-000000000011'] },
    });
    http
      .expectOne((r) => r.url === base && r.params.get('limit') === '100')
      .flush({
        success: true,
        data: [created, { ...created, name: created.name + ' (copy)' }],
        meta: { page: 1, limit: 100, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      });
  }
  it('duplicates a GLOBAL role in one create with permissionIds', async () => {
    const fixture = await show();
    duplicateStart(fixture);
    await vi.waitFor(() => {
      const req = http.expectOne({ method: 'POST', url: base });
      expect(req.request.body).toEqual({
        name: created.name + ' (copy) 2',
        description: created.description,
        permissionIds: ['019f0000-0000-7000-8000-000000000011'],
      });
      req.flush(
        { success: true, data: { ...created, id: 'copy-id', name: created.name + ' (copy) 2' } },
        { status: 201, statusText: 'Created' },
      );
    });
    await vi.waitFor(() => flushList([created]));
    await vi.waitFor(() => expect(child(fixture, RoleModal).editingId()).toBe('copy-id'));
    expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(rolesEn.toast.duplicated);
    http.expectNone((r) => r.method === 'PUT' || r.method === 'POST');
  });
  it('toasts the authority error on duplicate', async () => {
    const fixture = await show();
    duplicateStart(fixture);
    await vi.waitFor(() =>
      http
        .expectOne({ method: 'POST', url: base })
        .flush(
          { errorCode: 'ROLE_PERMISSION_AUTHORITY_EXCEEDED' },
          { status: 422, statusText: 'Invalid' },
        ),
    );
    await vi.waitFor(() =>
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(
        rolesEn.errors.ROLE_PERMISSION_AUTHORITY_EXCEEDED,
      ),
    );
  });
  it('keeps the duplicate key and body after a 401', async () => {
    const fixture = await show();
    duplicateStart(fixture);
    let key: string | null = null;
    let body: unknown;
    await vi.waitFor(() => {
      const req = http.expectOne({ method: 'POST', url: base });
      key = req.request.headers.get('x-idempotency-key');
      body = req.request.body;
      req.flush(
        { errorCode: 'AUTH_AUTHORIZATION_STALE' },
        { status: 401, statusText: 'Unauthorized' },
      );
    });
    await vi.waitFor(() => expect(fixture.componentInstance['duplicating']()).toBe(false));
    fixture.componentInstance['onRowAction'](created, { id: 'duplicate' });
    const retry = http.expectOne({ method: 'POST', url: base });
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retry.request.body).toEqual(body);
    retry.flush(
      { errorCode: 'ROLE_PERMISSION_AUTHORITY_EXCEEDED' },
      { status: 422, statusText: 'Invalid' },
    );
    await fixture.whenStable();
  });

  async function startDelete(fixture: ComponentFixture<RolesPage>) {
    const pending = fixture.componentInstance['requestDelete'](created);
    fixture.detectChanges();
    fixture.componentInstance['settleDeleteConfirm'](true);
    await Promise.resolve();
    return { pending, req: http.expectOne({ method: 'DELETE', url: base + '/' + created.id }) };
  }
  it('deletes a custom role after confirm', async () => {
    const fixture = await show();
    child(fixture, RoleModal).openDetails(created);
    const { pending, req } = await startDelete(fixture);
    fixture.detectChanges();
    expect(fixture.componentInstance['deleting']()).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => flushList());
    await pending;
    expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(rolesEn.toast.deleted);
    expect(child(fixture, RoleModal).editingId()).toBeNull();
  });
  it('shows the in-use blocker for ROLE_IN_USE', async () => {
    const fixture = await show();
    const blocked = vi.spyOn(child(fixture, BlockersDialog), 'open').mockResolvedValue();
    const { pending, req } = await startDelete(fixture);
    req.flush({ errorCode: 'ROLE_IN_USE' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(blocked).toHaveBeenCalledWith(
      expect.objectContaining({
        blockers: [rolesEn.delete.inUseNoCount],
        links: {
          [rolesEn.delete.inUseNoCount]: {
            label: rolesEn.delete.viewUsers,
            route: ['/workspace/staff/users'],
          },
        },
      }),
    );
  });
  it('confirms the seat cascade on delete with a new key', async () => {
    const fixture = await show();
    const { pending, req } = await startDelete(fixture);
    const key = req.request.headers.get('x-idempotency-key');
    req.flush(
      {
        errorCode: 'SEAT_ADDON_CASCADE_REQUIRED',
        details: { userIds: ['u'], userNames: ['User'], addonKeys: ['crm'], addonNames: ['CRM'] },
      },
      { status: 409, statusText: 'Conflict' },
    );
    await vi.waitFor(() => {
      const retry = http.expectOne(
        (r) => r.method === 'DELETE' && r.params.get('confirmAddonCascade') === 'true',
      );
      expect(retry.request.headers.get('x-idempotency-key')).not.toBe(key);
      retry.flush(null, { status: 204, statusText: 'No Content' });
    });
    await vi.waitFor(() => flushList());
    await pending;
  });
  it.each([
    ['ROLE_IS_SYSTEM', 409, 'error'],
    ['ROLE_NOT_FOUND', 404, 'error'],
    ['MISSING_REQUIRED_PERMISSIONS', 403, 'error'],
    ['GW.IDEM.IN_FLIGHT', 409, 'info'],
    ['GW.IDEM.MISMATCH', 422, 'warning'],
    ['AUTH_AUTHORIZATION_STALE', 401, 'error'],
    ['COMMON.GENERIC.INTERNAL_ERROR', 500, 'error'],
  ] as const)(
    'handles delete errors and keeps the key after 401: %s',
    async (code, status, tone) => {
      const fixture = await show();
      const { pending, req } = await startDelete(fixture);
      const key = req.request.headers.get('x-idempotency-key');
      req.flush({ errorCode: code }, { status, statusText: 'Failure' });
      if (status === 404) await vi.waitFor(() => flushList());
      await pending;
      expect(TestBed.inject(Notify).toasts().at(-1)?.type).toBe(tone);
      if (status === 401 || status === 500) {
        const retry = await startDelete(fixture);
        expect(retry.req.request.headers.get('x-idempotency-key')).toBe(key);
        retry.req.flush({ errorCode: 'ROLE_IS_SYSTEM' }, { status: 409, statusText: 'Conflict' });
        await retry.pending;
      }
    },
  );

  it('keeps the create form and key after a 401 without navigation', async () => {
    signIn({ [read]: tenantWide, [create]: tenantWide });
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    button(fixture, rolesEn.add)!.click();
    fixture.detectChanges();
    field(fixture, 'app-role-modal input[id$="-name"]', 'Reader');
    const first = save(fixture);
    const key = first.request.headers.get('x-idempotency-key');
    const body = first.request.body;
    first.flush(
      { errorCode: 'AUTH_AUTHORIZATION_STALE' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await vi.waitFor(() =>
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(staffEn.errors.notSaved),
    );
    expect(
      (fixture.nativeElement.querySelector('app-role-modal dialog') as HTMLDialogElement).open,
    ).toBe(true);
    expect(child(fixture, RoleModal)['dirty']()).toBe(true);
    const retry = save(fixture);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retry.request.body).toEqual(body);
    retry.flush({ errorCode: 'ROLE_NAME_TAKEN' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
  });

  it('renames a custom role and refreshes the list', async () => {
    const fixture = await show();
    const modal = child(fixture, RoleModal);
    modal.openDetails(created);
    fixture.detectChanges();
    field(fixture, 'app-role-modal input[id$="-name"]', 'Updated role');
    fixture.nativeElement
      .querySelector('app-role-modal form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = http.expectOne({ method: 'PATCH', url: base + '/' + created.id });
    expect(request.request.body).toEqual({ name: 'Updated role' });
    const updated = {
      ...created,
      name: 'Updated role',
      nameI18n: { en: 'Updated role', ar: 'Updated role' },
    };
    request.flush({ success: true, data: updated });
    await vi.waitFor(() => flushList([updated]));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button(fixture, 'Updated role')).toBeDefined();
    });
    expect(modal['dirty']()).toBe(false);
    expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(rolesEn.toast.saved);
  });
});
