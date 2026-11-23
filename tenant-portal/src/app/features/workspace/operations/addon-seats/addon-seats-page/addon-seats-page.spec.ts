import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Translation, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/ws-addon-seats/en.json';
import ar from '../../../../../../../public/i18n/ws-addon-seats/ar.json';
import enGlobal from '../../../../../../../public/i18n/en.json';
import arGlobal from '../../../../../../../public/i18n/ar.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../../public/i18n/settings/ar.json';
import enStaff from '../../../../../../../public/i18n/staff/en.json';
import arStaff from '../../../../../../../public/i18n/staff/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { Language, LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceUser } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { AddonAssignment, AddonOption } from '../addon-seats.model';
import { AddonSeatsPage } from './addon-seats-page';

const base = '/api/tenant/core/v1/users/target';
const stamp = '2026-11-23T12:00:00Z';
const user: WorkspaceUser = {
  id: 'target', email: 'user@example.invalid', firstName: 'Seat', lastName: 'User', status: 'ACTIVE',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, isTenantOwner: false, seats: [], createdAt: stamp, updatedAt: stamp,
};
const option: AddonOption = {
  userId: user.id, targetActive: true, applicationId: 'app', applicationKey: 'crm', addonId: 'addon',
  addonKey: 'crm.homes', addonSelectionId: 'selection', allowanceId: 'allowance', allowanceRevision: '12',
  selectedDefinitionVersionId: 'version', parentAssignment: { id: 'parent', revision: '34' }, assignment: null,
  localState: { parentReadiness: 'READY', addonReadiness: 'READY', parentDenied: false, addonDenied: false,
    adoptionPending: false, capacityChangePending: false }, observation: 'LOCAL_PROJECTION', operationalUse: 'NOT_EVALUATED',
};
const assignment: AddonAssignment = {
  userId: user.id, assignmentId: 'assignment', assignmentRevision: '56', applicationId: 'app', applicationKey: 'crm',
  addonId: 'addon', addonKey: 'crm.homes', addonSelectionId: 'selection', allowanceRevision: '12',
  parentAssignmentId: 'parent', parentAssignmentRevision: '34', selectedDefinitionVersionId: 'version',
  assignedAt: stamp, observation: 'LOCAL_PROJECTION', operationalUse: 'NOT_EVALUATED',
};
const receipt = { operationId: 'operation', operationRevision: '1', state: 'COMMITTED', operationKind: 'ASSIGN_ADDON',
  changed: true, resourceId: 'assignment', resourceRevision: '1', completedAt: stamp };
const translations: Record<string, Translation> = {
  en: enGlobal, ar: arGlobal, 'settings/en': enSettings, 'settings/ar': arSettings,
  'ws-addon-seats/en': en, 'ws-addon-seats/ar': ar, 'staff/en': enStaff, 'staff/ar': arStaff,
};
class TestLoader {
  getTranslation(path: string) { return of(translations[path] ?? {}); }
}

describe('AddonSeatsPage', () => {
  let fixture: ComponentFixture<AddonSeatsPage>;
  let page: AddonSeatsPage;
  let http: HttpTestingController;
  const language = signal<Language>('en');
  const me = signal({ isTenantOwner: true, permissions: [] as string[],
    permissionScopes: {} as Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }> });
  const lookups = { user: vi.fn(), users: vi.fn(), appsOverview: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    language.set('en');
    me.set({ isTenantOwner: true, permissions: [], permissionScopes: {} });
    lookups.user.mockResolvedValue(user);
    lookups.users.mockResolvedValue({ data: [user], meta: {} });
    lookups.appsOverview.mockResolvedValue([{ moduleKey: 'crm', nameI18n: { en: 'CRM live', ar: 'إدارة العملاء المباشرة' } }]);
    TestBed.configureTestingModule({ imports: [AddonSeatsPage], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true,
        missingHandler: { logMissingKey: false } }, loader: TestLoader }),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ userId: user.id })) } },
      { provide: TenantScopeState, useValue: { me, selection: signal(null) } },
      { provide: LanguageState, useValue: { current: language } },
      { provide: WorkspaceLookups, useValue: lookups }, { provide: Notify, useValue: notify },
    ] });
    const document = TestBed.inject(DOCUMENT);
    const cookie = document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-proof`);
    vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    fixture = TestBed.createComponent(AddonSeatsPage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await flushTables();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
  });

  function envelope<T>(data: T[]) {
    return { success: true, data, meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0,
      hasNext: false, hasPrev: false } };
  }
  async function stable() { await fixture.whenStable(); fixture.detectChanges(); }
  async function nextWrite(method: string) {
    return vi.waitFor(() => http.expectOne((req) => req.method === method));
  }
  async function flushTables(options = [option], assignments = [assignment], userId = user.id) {
    (await vi.waitFor(() => http.expectOne((req) => req.url === `/api/tenant/core/v1/users/${userId}/addon-assignment-options`)))
      .flush(envelope(options));
    (await vi.waitFor(() => http.expectOne((req) => req.url === `/api/tenant/core/v1/users/${userId}/addon-assignments`)))
      .flush(envelope(assignments));
    await stable();
  }
  function fail(request: TestRequest, status: number, code: string, headers?: Record<string, string>) {
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush({ errorCode: code, correlationId: 'support-ref' }, { status, statusText: 'Failure', headers });
  }
  async function assignFailure(status: number, code: string, reload = false, headers?: Record<string, string>, row = option) {
    const pending = page['assign'](row);
    const request = await nextWrite('POST');
    const sent = { key: request.request.headers.get('x-idempotency-key'), body: request.request.body };
    fail(request, status, code, headers);
    if (reload) await flushTables();
    await pending;
    await stable();
    return sent;
  }
  async function removeFailure(status: number, code: string, reload = false) {
    const pending = page['requestRemove'](assignment);
    const request = await nextWrite('DELETE');
    const sent = { key: request.request.headers.get('x-idempotency-key'), url: request.request.urlWithParams };
    fail(request, status, code);
    if (reload) await flushTables();
    await pending;
    await stable();
    return sent;
  }
  async function readFailure(status: number, code: string) {
    const pending = page['reloadUserTables'](user.id);
    for (const suffix of ['addon-assignment-options', 'addon-assignments']) {
      fail(http.expectOne((req) => req.url === `${base}/${suffix}`), status, code);
    }
    await pending;
    await stable();
  }
  function text() { return (fixture.nativeElement as HTMLElement).textContent ?? ''; }
  function assignButton() {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => ['Assign', ar.actions.assign].includes(button.textContent?.trim() ?? ''))!;
  }

  it('a 400 on read shows a toast', async () => {
    await readFailure(400, 'CORE_VALIDATION_FAILED');
    expect(notify.error).toHaveBeenCalledWith(enSettings.errors.validation);
    expect(page['bothFailed']()).toBe(false);
  });
  it('a 403 on read shows the forbidden card', async () => {
    await readFailure(403, 'ACCESS_POLICY_BLOCKED');
    expect(page['showForbidden']()).toBe(true);
    expect(text()).toContain(en.forbidden.title);
  });
  it('a failed read shows the failed card', async () => {
    for (const status of [500, 503, 0]) {
      await readFailure(status, status === 503 ? 'ACCESS_POLICY_UNAVAILABLE' : 'COMMON.GENERIC.INTERNAL_ERROR');
      expect(page['bothFailed']()).toBe(true);
      expect(text()).toContain(status === 503 ? en.failed.unavailable : en.failed.title);
      if (status !== 0) expect(text()).toContain('support-ref');
    }
  });
  it('no purchased add-ons shows the empty state', async () => {
    const pending = page['reloadUserTables'](user.id);
    await flushTables([], []);
    await pending;
    expect(text()).toContain(en.empty.options);
  });
  it('assign reloads both tables', async () => {
    const pending = page['assign'](option);
    (await nextWrite('POST')).flush({ success: true, data: receipt }, { status: 201, statusText: 'Created' });
    await flushTables();
    await pending;
    expect(notify.success).toHaveBeenCalled();
  });
  it('already assigned shows an info toast', async () => {
    const pending = page['assign'](option);
    (await nextWrite('POST')).flush({ success: true, data: { ...receipt, changed: false } }, { status: 201, statusText: 'Created' });
    await flushTables();
    await pending;
    expect(notify.info).toHaveBeenCalledWith('Seat User already has this seat.');
  });
  it('a 400 on assign shows a toast', async () => {
    await assignFailure(400, 'CORE_VALIDATION_FAILED');
    expect(notify.error).toHaveBeenCalledWith(enSettings.errors.validation);
  });
  it('a 401 on assign keeps the key', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const first = await assignFailure(401, 'COMMON.GENERIC.UNAUTHORIZED');
    expect(notify.error).toHaveBeenCalledWith(enSettings.errors.notSaved);
    expect(page['selectedUserId']()).toBe(user.id);
    expect(page['options']()).toEqual([option]);
    expect(await assignFailure(401, 'COMMON.GENERIC.UNAUTHORIZED')).toEqual(first);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('access policy blocked text', async () => {
    await assignFailure(403, 'ACCESS_POLICY_BLOCKED');
    expect(notify.error).toHaveBeenCalledWith(en.errors.ACCESS_POLICY_BLOCKED);
    expect(page['showForbidden']()).toBe(false);
  });
  it('missing permission is not blocked', async () => {
    await assignFailure(403, 'MISSING_REQUIRED_PERMISSIONS');
    expect(notify.error).toHaveBeenCalledWith(en.errors.MISSING_REQUIRED_PERMISSIONS);
    expect(notify.error).not.toHaveBeenCalledWith(en.errors.ACCESS_POLICY_BLOCKED);
  });
  it('maintenance text on write', async () => {
    for (const code of ['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED']) {
      await assignFailure(403, code);
      expect(notify.error).toHaveBeenLastCalledWith(enGlobal.apiErrors.maintenance);
      expect(page['showForbidden']()).toBe(false);
    }
  });
  it('missing parent seat links to the user apps tab', async () => {
    await assignFailure(404, 'ASSIGNMENT_NOT_FOUND', true);
    expect(notify.error).toHaveBeenCalledWith('Seat User needs the CRM live seat first.');
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href*="/workspace/staff/users"]');
    expect(link?.getAttribute('href')).toContain('open=target');
    expect(link?.getAttribute('href')).toContain('tab=apps');
  });
  it('stale assign reloads', async () => {
    await assignFailure(409, 'ADDON_ASSIGNMENT_REVISION_STALE', true);
    expect(notify.warning).toHaveBeenCalledWith(en.errors.REVISION_STALE);
  });
  it('not ready shows a toast', async () => {
    await assignFailure(409, 'APPLICATION_ALLOWANCE_NOT_READY', true);
    expect(notify.error).toHaveBeenCalledWith(en.errors.APPLICATION_ALLOWANCE_NOT_READY);
  });
  it('in flight keeps the key', async () => {
    const first = await assignFailure(409, 'GW.IDEM.IN_FLIGHT');
    expect(notify.error).toHaveBeenCalledWith(en.errors['GW.IDEM.IN_FLIGHT']);
    expect(await assignFailure(409, 'GW.IDEM.IN_FLIGHT')).toEqual(first);
  });
  it('seat limit toast names the add-on', async () => {
    await assignFailure(422, 'SEAT_LIMIT_REACHED', true);
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining(en.addons.crm.homes));
  });
  it('idempotency mismatch text', async () => {
    await assignFailure(422, 'IDEMPOTENCY_BODY_MISMATCH');
    expect(notify.error).toHaveBeenCalledWith(enSettings.errors.idempotencyMismatch);
  });
  it('retry after a lost connection reuses the key', async () => {
    for (const status of [0, 500, 503]) {
      const first = await assignFailure(status, 'COMMON.GENERIC.INTERNAL_ERROR');
      if (status === 0) expect(notify.error).toHaveBeenLastCalledWith(enSettings.errors.network);
      expect(await assignFailure(status, 'COMMON.GENERIC.INTERNAL_ERROR')).toEqual(first);
    }
  });
  it('remove reloads both tables', async () => {
    const pending = page['requestRemove'](assignment);
    (await nextWrite('DELETE')).flush({ success: true, data: { ...receipt, operationKind: 'UNASSIGN_ADDON' } });
    await flushTables();
    await pending;
    expect(notify.success).toHaveBeenCalled();
  });
  it('already removed shows info', async () => {
    await removeFailure(404, 'ASSIGNMENT_NOT_FOUND', true);
    expect(notify.info).toHaveBeenCalledWith(en.errors.ASSIGNMENT_ALREADY_GONE);
  });
  it('stale remove reloads', async () => {
    await removeFailure(409, 'ADDON_ASSIGNMENT_REVISION_STALE', true);
    expect(notify.warning).toHaveBeenCalledWith(en.errors.REVISION_STALE);
  });
  it('remove keeps the key after a 5xx', async () => {
    const first = await removeFailure(500, 'COMMON.GENERIC.INTERNAL_ERROR');
    expect(await removeFailure(500, 'COMMON.GENERIC.INTERNAL_ERROR')).toEqual(first);
  });
  it.each([[0, 'NETWORK_ERROR'], [409, 'GW.IDEM.IN_FLIGHT'], [401, 'COMMON.GENERIC.UNAUTHORIZED']] as const)(
    'remove preserves the action after %s %s', async (status, code) => {
      const first = await removeFailure(status, code);
      expect(await removeFailure(status, code)).toEqual(first);
      expect(page['selectedUserId']()).toBe(user.id);
    },
  );
  it('service idempotency in-flight variants keep the key', async () => {
    for (const code of ['CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT', 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT', 'ADDON_IDEMPOTENCY_IN_FLIGHT']) {
      const first = await assignFailure(409, code);
      expect(notify.error).toHaveBeenLastCalledWith('Still saving');
      expect(await assignFailure(409, code)).toEqual(first);
    }
  });
  it('picker 403 shows the hint', async () => {
    lookups.users.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await page['searchUsers']('Search');
    page['pickerOpen'].set(true);
    await stable();
    expect(lookups.users).toHaveBeenCalledWith({ search: 'Search', limit: 50 });
    expect(text()).toContain(en.userField.readAccessRequired);
    expect(page['showForbidden']()).toBe(false);
  });
  it('deep link works without user read access', async () => {
    lookups.user.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await page['selectUserById']('other');
    fixture.detectChanges();
    await flushTables([{ ...option, userId: 'other' }], [], 'other');
    expect(page['selectedUserDisplayName']()).toBe('other');
    expect(page['showForbidden']()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[role="table"]')).toHaveLength(2);
  });
  it('app names come from the apps overview', async () => {
    expect(lookups.appsOverview).toHaveBeenCalledOnce();
    expect(page['appLabel']('crm')).toBe('CRM live');
    expect(page['appLabel']('unknown')).toBe('unknown');
    language.set('ar');
    expect(page['appLabel']('crm')).toBe('إدارة العملاء المباشرة');
  });
  it('capacity change pending keeps assign enabled', async () => {
    page['options'].set([{ ...option, localState: { ...option.localState, capacityChangePending: true } }]);
    await stable();
    expect(assignButton().disabled).toBe(false);
    expect(assignButton().parentElement?.title).toBe(en.options.reasons.capacityChangePending);
    expect(page['isOptionReady'](page['options']()[0])).toBe(true);
  });
  it('shows used of total', async () => {
    page['options'].set([{ ...option, seats: { used: 3, total: 5 } }]);
    for (const lang of ['en', 'ar'] as const) {
      language.set(lang);
      TestBed.inject(TranslocoService).setActiveLang(lang);
      await stable();
      expect(text()).toContain('3 / 5');
      expect(text()).toContain((lang === 'en' ? en : ar).options.seatsUsed);
      expect(assignButton().disabled).toBe(false);
      const count = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('bdi')).find((node) => node.textContent === '3 / 5');
      expect(count?.dir).toBe('ltr');
    }
  });
  it('full add-on disables assign', async () => {
    page['options'].set([{ ...option, seats: { used: 5, total: 5 } }]);
    await stable();
    expect(assignButton().disabled).toBe(true);
    expect(assignButton().parentElement?.title).toBe(en.options.reasons.noFreeSeats);
    await page['assign'](page['options']()[0]);
    http.expectNone((req) => req.method === 'POST');
  });
  it('no seat counts before BE-O3', async () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('bdi.tabular-nums')).toBeNull();
    expect(assignButton().disabled).toBe(false);
  });
  it('a 429 shows the rate-limit text', async () => {
    await assignFailure(429, 'GW.RATE.LIMIT_EXCEEDED', false, { 'Retry-After': '12' });
    expect(notify.error).toHaveBeenCalledWith('Too many requests, try again in 12 s');
  });

  it('changed assign body starts a new key', async () => {
    const first = await assignFailure(0, 'NETWORK_ERROR');
    const second = await assignFailure(0, 'NETWORK_ERROR', false, undefined, { ...option, allowanceRevision: '13' });
    expect(second.key).not.toBe(first.key);
    expect(second.body).toEqual({ ...first.body, expectedAllowanceRevision: '13' });
  });
  it('changed remove revisions start a new key', async () => {
    const first = await removeFailure(500, 'COMMON.GENERIC.INTERNAL_ERROR');
    const pending = page['requestRemove']({ ...assignment, assignmentRevision: '57' });
    const request = await nextWrite('DELETE');
    expect(request.request.headers.get('x-idempotency-key')).not.toBe(first.key);
    expect(request.request.params.get('expectedAssignmentRevision')).toBe('57');
    fail(request, 500, 'COMMON.GENERIC.INTERNAL_ERROR');
    await pending;
  });
  it('known parent over-capacity shows the app seat limit text', async () => {
    page['selectedUser'].set({ ...user, seats: [{ moduleKey: 'crm', accessState: 'OVER_CAPACITY' }] });
    await assignFailure(422, 'SEAT_LIMIT_REACHED', true);
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('The app seat limit is reached'));
  });
  it('company and branch grants cannot manage tenant-wide seats', () => {
    me.set({ isTenantOwner: false, permissions: ['applications.addon_seats.manage'], permissionScopes: {
      'applications.addon_seats.manage': { tenantWide: false, companyIds: ['company'], branchIds: ['branch'] },
    } });
    expect(page['canManage']()).toBe(false);
    expect(page['canRead']()).toBe(false);
  });
});
