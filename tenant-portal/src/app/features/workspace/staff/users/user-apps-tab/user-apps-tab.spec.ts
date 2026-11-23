import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { StaffSession } from '../../shared/staff-session';
import type { TenantUser } from '../../shared/staff.model';
import { UserAppsTab } from './user-apps-tab';

const base = '/api/tenant/core/v1/users/target/modules';
const usagePath = '/api/tenant/core/v1/seats/usage';
const stamp = '2026-11-22T00:00:00.000Z';
const user: TenantUser = { id: 'target', firstName: 'Test', lastName: 'User', email: 'test@example.invalid',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [], createdAt: stamp, updatedAt: stamp };
const assignment = { id: 'assignment', userId: 'target', moduleKey: 'crm', createdAt: stamp, updatedAt: stamp, accessState: 'ACTIVE' as const, source: 'MANUAL' as const };
const modules = ['crm', 'trade', 'accounting'].map((moduleKey) => ({ moduleKey }));

describe('UserAppsTab live access', () => {
  let fixture: ComponentFixture<UserAppsTab>;
  let tab: UserAppsTab;
  let http: HttpTestingController;
  const me = signal({ id: 'actor' });
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const confirm = { open: vi.fn(async () => true) };
  const addons = { open: vi.fn() };
  const changed = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks(); me.set({ id: 'actor' });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: { me, isOwner: () => true, can: () => true, scopeRevision: () => 'scope' } },
      { provide: Notify, useValue: notify },
      { provide: LanguageState, useValue: { current: signal('en') } },
      { provide: TranslocoService, useValue: { events$: new Subject(), translate: (key: string, params?: Record<string, unknown>) => key.startsWith('access.errors.') ? `t:${key}` : params?.['module'] ? `${key}:${params['module']}` : key } },
    ] });
    TestBed.overrideComponent(UserAppsTab, { set: { template: '', imports: [] } });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    fixture = TestBed.createComponent(UserAppsTab); tab = fixture.componentInstance;
    fixture.componentRef.setInput('user', user);
    Object.defineProperty(tab, 'removeAppConfirm', { value: () => confirm });
    Object.defineProperty(tab, 'addonsModal', { value: () => addons });
    Object.defineProperty(tab, 'findHolderForUser', { value: async () => null });
    tab.changed.subscribe(changed); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  async function settle() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
  async function reads(mode = 'MANUAL') {
    for (let i = 0; i < 4; i++) {
      await settle();
      for (const req of http.match((r) => r.method === 'GET')) req.flush({ success: true, data: req.request.url === usagePath ? { mode, revision: 1, modules } : [assignment] });
    }
    await settle();
  }
  async function start(mode = 'MANUAL') { fixture.detectChanges(); await reads(mode); tab['selectedModule'].set('trade'); }
  function reject(code: string, status = 409) {
    const req = http.expectOne((r) => r.method !== 'GET'); req.flush({ errorCode: code }, { status, statusText: 'Rejected' }); return req;
  }

  it('user-apps-tab: lists modules and offers subscribed modules', async () => {
    await start(); expect(tab['assignments']()).toEqual([assignment]);
    expect(tab['availableModules']()).toEqual(['trade', 'accounting']);
    expect(tab['availableModuleOptions']().map((o) => o.value)).toEqual(['trade', 'accounting']);
  });
  it('user-apps-tab: derived mode is read-only', async () => {
    await start('DERIVED'); expect(tab['effectiveReadonly']()).toBe(true);
    expect(tab['effectiveReadonlyReason']()).toBe('access.apps.fromRoles');
    await tab['assign'](); await tab['requestRemove'](assignment); http.expectNone((r) => r.method !== 'GET');
  });
  it('user-apps-tab: assigns a module', async () => {
    await start(); const pending = tab['assign'](); const req = http.expectOne(base);
    expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual({ moduleKey: 'trade' });
    req.flush({ success: true, data: { ...assignment, moduleKey: 'trade' } }, { status: 201, statusText: 'Created' }); await reads(); await pending;
    expect(changed).toHaveBeenCalledOnce(); expect(notify.success).toHaveBeenCalledWith('access.common.saved');
    tab['selectedModule'].set('trade'); const failed = tab['assign'](); reject('SEAT_LIMIT_REACHED', 422); await failed;
    expect(notify.error).toHaveBeenCalledWith('access.apps.noSeats:trade');
  });
  it('user-apps-tab: derived race reloads', async () => {
    await start();
    for (const remove of [false, true]) {
      const pending = remove ? tab['requestRemove'](assignment) : tab['assign'](); await settle(); reject('SEATS_MANAGED_BY_ROLES');
      await reads(); await pending; expect(notify.error).toHaveBeenCalledWith('t:access.errors.SEATS_MANAGED_BY_ROLES');
    }
  });
  it('user-apps-tab: a branch change reloads', async () => {
    await start();
    for (const remove of [false, true]) {
      const pending = remove ? tab['requestRemove'](assignment) : tab['assign'](); await settle(); reject('TENANT_USER_CHANGED'); await reads(); await pending;
    }
    expect(changed).toHaveBeenCalledTimes(2); expect(notify.error).toHaveBeenCalledWith('t:access.errors.TENANT_USER_CHANGED');
  });
  it('user-apps-tab: add-ons must go first', async () => {
    await start(); const pending = tab['requestRemove'](assignment); await settle(); reject('ADDON_ASSIGNMENTS_EXIST'); await pending;
    expect(addons.open).toHaveBeenCalledOnce(); expect(notify.success).not.toHaveBeenCalled();
  });
  it('user-apps-tab: module errors show a toast', async () => {
    await start();
    for (const code of ['MODULE_NOT_SUBSCRIBED', 'MODULE_NOT_FOUND', 'APPLICATION_ALLOWANCE_NOT_READY', 'APPLICATION_ALLOWANCE_STALE', 'APPLICATION_ALLOWANCE_UNAVAILABLE', 'SUBSCRIPTION_NOT_FOUND']) {
      const pending = tab['assign'](); reject(code, code.endsWith('UNAVAILABLE') ? 503 : code.startsWith('MODULE') ? 422 : 409); await pending;
      expect(notify.error).toHaveBeenCalledWith(`t:access.errors.${code}`);
    }
  });
  it('user-apps-tab: self is read-only', async () => {
    me.set({ id: 'target' }); await start(); await tab['assign'](); await tab['requestRemove'](assignment);
    expect(tab['effectiveReadonlyReason']()).toBe('access.apps.selfReadonly'); http.expectNone((r) => r.method !== 'GET');
  });
  it('retains the key and selection after 401 or server failure', async () => {
    await start(); let key: string | null = null;
    for (const status of [401, 500]) {
      const pending = tab['assign'](); const req = reject(status === 401 ? 'AUTH_AUTHORIZATION_STALE' : 'COMMON.GENERIC.INTERNAL_ERROR', status);
      if (key) expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      key = req.request.headers.get('x-idempotency-key'); await pending; expect(tab['selectedModule']()).toBe('trade');
    }
    expect(notify.error).toHaveBeenCalledWith('staff.errors.notSaved');
  });
  it('shows field validation, gateway progress, and a missing user without losing the draft', async () => {
    await start(); const pending = tab['assign']();
    http.expectOne(base).flush({ errorCode: 'CORE_VALIDATION_FAILED', details: { moduleKey: ['Invalid module'], _: ['Review selection'] } }, { status: 400, statusText: 'Invalid' }); await pending;
    expect(tab['fieldError']('moduleKey')).toBe('Invalid module'); expect(notify.error).toHaveBeenCalledWith('Review selection');
    const inFlight = tab['assign'](); reject('GW.IDEM.IN_FLIGHT'); await inFlight; expect(notify.info).toHaveBeenCalled();
    const missing = tab['assign'](); reject('TENANT_USER_NOT_FOUND', 404); await missing; expect(changed).toHaveBeenCalledOnce();
  });
  it('fails closed when seat usage fails and retries without extra network loops', async () => {
    fixture.detectChanges(); http.expectOne(base).flush({ success: true, data: [assignment] });
    http.expectOne(usagePath).flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' }); await settle();
    expect(tab['loadFailed']()).toBe(true); expect(tab['effectiveReadonly']()).toBe(true);
    tab['reload'](); await reads(); expect(tab['loadFailed']()).toBe(false);
  });
});

describe('UserAppsTab seat usage failure rendering', () => {
  class EmptyLoader { getTranslation() { return of({}); } }

  it('shows the existing Retry state after a seat usage 404 and recovers on Retry', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
      { provide: StaffSession, useValue: { me: signal({ id: 'actor' }), isOwner: () => true, can: () => true, scopeRevision: () => 'scope' } },
      { provide: LanguageState, useValue: { current: signal('en') } },
    ] });
    const fixture = TestBed.createComponent(UserAppsTab);
    fixture.componentRef.setInput('user', user);
    const http = TestBed.inject(HttpTestingController);
    const tab = fixture.componentInstance;
    const settle = async () => {
      for (let i = 0; i < 25; i++) await Promise.resolve();
      fixture.detectChanges();
    };
    fixture.detectChanges();
    http.expectOne(base).flush({ success: true, data: [assignment] });
    http.expectOne(usagePath).flush({ errorCode: 'COMMON.GENERIC.NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(tab['loading']()).toBe(false);
    expect(tab['loadFailed']()).toBe(true);
    expect(tab['assignments']()).toEqual([]);
    expect(tab['subscribedModules']()).toEqual([]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="table"]')).toBeNull();
    const retry = root.querySelector<HTMLButtonElement>('[role="alert"] button')!;
    expect(retry.textContent?.trim()).toBe('access.common.retry');
    retry.click();
    http.expectOne(base).flush({ success: true, data: [assignment] });
    http.expectOne(usagePath).flush({ success: true, data: { mode: 'MANUAL', revision: 1, modules } });
    await settle();
    expect(tab['loadFailed']()).toBe(false);
    expect(tab['loading']()).toBe(false);
    expect(tab['assignments']()).toEqual([assignment]);
    expect(root.querySelector('[role="alert"]')).toBeNull();
    http.verify();
  });
});
