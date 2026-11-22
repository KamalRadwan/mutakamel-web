import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rolesAr from '../../../../../../../public/i18n/staff-roles/ar.json';
import rolesEn from '../../../../../../../public/i18n/staff-roles/en.json';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { SessionStatus, TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import type { RoleDetail } from '../../shared/staff.model';
import { RolesApi } from '../roles.api';
import { RolesPage } from './roles-page';

const base = '/api/tenant/core/v1/roles';
const read = 'roles.role.read';
const create = 'roles.role.create';
const tenantWide = { tenantWide: true, companyIds: [], branchIds: [] };
const dialog = HTMLDialogElement.prototype;
const { showModal, close } = dialog;
const created: RoleDetail = {
  id: '019f0000-0000-7000-8000-000000000010', name: 'Inventory reader',
  nameI18n: { en: 'Inventory reader', ar: 'قارئ المخزون' },
  description: 'Read stock', isSystem: false, permissionMode: 'GLOBAL',
  branchProfileCount: 0, permissionCount: 0, permissionIds: [],
  createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z',
};

class TestLoader {
  getTranslation(path: string) {
    if (path === 'staff-roles/en') return of(rolesEn);
    if (path === 'staff-roles/ar') return of(rolesAr);
    return of({});
  }
}

describe('Roles add and read', () => {
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('loading');
  let http: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    dialog.showModal = function () { this.open = true; };
    dialog.close = function () {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
    me.set(null);
    status.set('loading');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true, missingHandler: { logMissingKey: false } },
          loader: TestLoader,
        }),
        { provide: AuthSession, useValue: { me, status, ensureLoaded: async () => status() } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${cookieName}=test-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(LanguageState).current.set('en');
  });

  afterEach(() => {
    dialog.showModal = showModal;
    dialog.close = close;
    http.verify();
    vi.restoreAllMocks();
  });

  function signIn(permissionScopes: TenantMe['permissionScopes'], id = FAKE_TENANT_ME.id): void {
    me.set({ ...FAKE_TENANT_ME, id, isTenantOwner: false, permissions: Object.keys(permissionScopes), permissionScopes });
    status.set('signed-in');
  }

  function flushList(items: RoleDetail[] = [], sort = 'name') {
    const request = http.expectOne((req) => req.method === 'GET' && req.url === base);
    expect(request.request.params.get('sortBy')).toBe(sort);
    expect(request.request.params.get('sortDir')).toBe(sort === 'name' ? 'ASC' : 'DESC');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ success: true, data: items, meta: {
      page: 1, limit: 20, total: items.length, totalPages: 1, hasNext: false, hasPrev: false,
    } });
  }

  function button(fixture: ComponentFixture<RolesPage>, label: string): HTMLButtonElement | undefined {
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
    root.querySelector('app-role-modal form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return http.expectOne({ method: 'POST', url: base });
  }

  it.each([
    ['en', rolesEn], ['ar', rolesAr],
  ] as const)('uses the existing Add Role dialog, submits just metadata and reloads Core in %s', async (language, labels) => {
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
    expect(request.request.body).toEqual({ name: created.name, description: created.description });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-csrf-token')).toBe('test-proof');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i);
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
    expect(root.querySelector('app-global-permissions-modal, app-assign-permissions-wizard')).toBeNull();
    const rowButton = button(fixture, created.nameI18n[language]);
    rowButton!.click();
    fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('app-role-modal input[id$="-name"]')?.readOnly).toBe(true);
    expect(root.querySelector('app-role-modal button[type="submit"]')).toBeNull();
  });

  it('waits for authenticated scope and leaves Add hidden for branch-only write authority', async () => {
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    http.expectNone((request) => request.url.startsWith(base));
    const branchOnly = { ...tenantWide, tenantWide: false, branchIds: FAKE_TENANT_ME.accessibleBranches };
    signIn({ [read]: tenantWide, [create]: branchOnly });
    fixture.detectChanges();
    flushList();
    await fixture.whenStable();
    expect(button(fixture, rolesEn.add)).toBeUndefined();
    await expect(TestBed.inject(RolesApi).create({ name: 'Unauthorized' }, 'key')).rejects.toMatchObject({ status: 403 });
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
    await expect(api.create({ name: created.name }, 'key')).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone({ method: 'POST', url: base });

    const pending = api.get(created.id);
    const request = http.expectOne({ method: 'GET', url: `${base}/${created.id}` });
    signIn({ [read]: tenantWide }, 'different-account');
    request.flush({ success: true, data: created });
    await expect(pending).rejects.toMatchObject({ status: 403 });
  });
});
