import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import activationEn from '../../../../../../../public/i18n/ws-app-activation/en.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ReasonModal } from '../reason-modal/reason-modal';
import type { ActivationListItem, AddonActivationPendingCommand } from '../activation.model';
import { ActivationPage } from './activation-page';

const base = '/api/tenant/core/v1/companies/co/application-activations';
const key = 'applications.activation.manage';
const company = { id: 'co', name: 'Company', status: 'ACTIVE' };
const app: ActivationListItem = {
  scope: { kind: 'COMPANY', companyId: 'co', branchId: null }, target: { applicationId: 'app', applicationKey: 'crm', addonId: null, addonKey: null },
  resourceScope: 'COMPANY', resource: { kind: 'APPLICATION_ACTIVATION', state: 'STORED', id: 'binding', revision: '1', enabled: false },
  observation: 'LOCAL_PROJECTION', operationalUse: 'NOT_EVALUATED',
};
const addon: ActivationListItem = { ...app, target: { ...app.target, addonId: 'addon', addonKey: 'crm.homes' },
  resource: { kind: 'ADDON_ACTIVATION', state: 'STORED', id: 'addon-binding', revision: '1', enabled: true, definitionVersionId: 'definition', configVersionId: null } };
const command: AddonActivationPendingCommand = { state: 'PENDING', commandId: 'command', revision: '1', operationKind: 'SET_ADDON_ACTIVATION',
  progress: { pageNumber: '1', validatedBranchCount: '100' }, operationalUse: 'NOT_EVALUATED' };
const committed = { state: 'COMMITTED', changed: true, resourceRevision: '2' };
const meta = { page: 1, limit: 100, total: 2, totalPages: 1, hasNext: false, hasPrev: false };
const owner = () => ({ id: 'actor', isTenantOwner: true, permissions: [key], permissionScopes: {} as Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }> });

describe('ActivationPage', () => {
  const me = signal(owner());
  const language = signal<'en' | 'ar'>('en');
  const lookups = { allCompanies: vi.fn(), appsOverview: vi.fn() };
  const notify = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
  let fixture: ComponentFixture<ActivationPage>;
  let page: ActivationPage;
  let reason: ReasonModal;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.clearAllMocks(); sessionStorage.clear(); me.set(owner()); language.set('en');
    lookups.allCompanies.mockResolvedValue([company]);
    lookups.appsOverview.mockResolvedValue([{ moduleKey: 'crm', nameI18n: { en: 'CRM live', ar: 'إدارة العملاء' } },
      { moduleKey: 'crm.homes', nameI18n: { en: 'Homes live', ar: 'العقارات' } }]);
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({ imports: [ActivationPage, TranslocoTestingModule.forRoot({
      langs: { en: { ...en, wsActivation: activationEn, settings: settingsEn }, 'ws-app-activation/en': activationEn, 'settings/en': settingsEn },
      translocoConfig: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, preloadLangs: true,
    })], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      { provide: TenantScopeState, useValue: { me, selection: signal(null) } },
      { provide: LanguageState, useValue: { current: language } }, { provide: WorkspaceLookups, useValue: lookups },
      { provide: Notify, useValue: notify }, { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { queryParamMap: convertToParamMap({}) } } },
    ] });
    fixture = TestBed.createComponent(ActivationPage); page = fixture.componentInstance;
    reason = TestBed.runInInjectionContext(() => new ReasonModal());
    vi.spyOn(reason, 'open').mockImplementation((_request, submit) => {
      reason['submitHandler'] = submit; reason['reason'].set('Owner request');
    });
    vi.spyOn(reason as unknown as { closeImmediate(): void }, 'closeImmediate').mockImplementation(() => undefined);
    Object.defineProperty(page, 'reasonModal', { value: () => reason });
    http = TestBed.inject(HttpTestingController);
    (await vi.waitFor(() => http.expectOne((r) => r.url === base))).flush({ success: true, data: [app, addon], meta });
    await vi.waitFor(() => expect(page['companiesLoading']()).toBe(false));
  });
  afterEach(() => { fixture?.destroy(); http?.verify(); TestBed.resetTestingModule(); vi.useRealTimers(); document.cookie = 'mutakamel-http-tenant-csrf=; max-age=0; path=/'; });

  async function readFailure(status: number, code: string, correlationId?: string) {
    const pending = page['loadActivations']('co');
    http.expectOne((r) => r.url === base).flush({ errorCode: code, correlationId }, { status, statusText: 'Failure' });
    await pending;
  }
  function openAction(row = app) {
    page['onSwitchToggle'](row, true, { checked: signal(false) } as Switch);
  }
  async function submitFailure(status: number, code: string, headers?: Record<string, string>) {
    const pending = reason['onSubmit'](new Event('submit'));
    const request = http.expectOne((r) => r.method === 'PATCH');
    const sent = { key: request.request.headers.get('x-idempotency-key'), body: request.request.body };
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush({ errorCode: code }, { status, statusText: 'Failure', headers });
    await pending;
    return sent;
  }
  async function expectRetained(status: number, code: string) {
    openAction(); const first = await submitFailure(status, code);
    expect(reason['reason']()).toBe('Owner request');
    expect(reason['closeImmediate']).not.toHaveBeenCalled();
    const second = await submitFailure(500, 'SERVER_ERROR');
    expect(second).toEqual(first);
    reason['reason'].set('Changed reason');
    const changed = await submitFailure(500, 'SERVER_ERROR');
    expect(changed.key).not.toBe(first.key);
  }

  it('a 400 on the list shows a toast', async () => { await readFailure(400, 'CORE_VALIDATION_FAILED'); expect(notify.error).toHaveBeenCalled(); expect(page['loadFailed']()).toBe(false); });
  it('a 403 shows forbidden', async () => { await readFailure(403, 'ACCESS_POLICY_BLOCKED'); expect(page['isForbidden']()).toBe(true); });
  it('maintenance is not forbidden', async () => { await readFailure(403, 'TENANT_MAINTENANCE_ACTIVE'); expect(page['isForbidden']()).toBe(false); expect(notify.error).toHaveBeenCalledWith('The workspace is under maintenance'); });
  it('a 5xx shows load failure with the reference', async () => { await readFailure(503, 'SERVER_ERROR', 'support-123'); expect(page['loadFailed']()).toBe(true); expect(page['correlationId']()).toBe('support-123'); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('support-123'); });
  it('empty company shows the empty card', () => { page['rows'].set([]); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain(activationEn.states.emptyTitle); });
  it('picker lists active companies only', () => { expect(lookups.allCompanies).toHaveBeenCalledWith({ status: 'ACTIVE' }); });
  it('not found singleton says not purchased', async () => {
    const row = { ...addon, resource: { ...addon.resource, definitionVersionId: null } } as ActivationListItem;
    openAction(row); const pending = reason['onSubmit'](new Event('submit'));
    http.expectOne(`${base}/crm/addons/crm.homes`).flush({ errorCode: 'ADDON_NOT_FOUND' }, { status: 404, statusText: 'Not found' });
    await pending; expect(notify.error).toHaveBeenCalledWith('Not purchased');
  });
  it('receipt changed false shows already in that state', async () => {
    openAction(); const pending = reason['onSubmit'](new Event('submit'));
    http.expectOne(`${base}/crm`).flush({ success: true, data: { ...committed, changed: false } });
    (await vi.waitFor(() => http.expectOne((r) => r.url === base))).flush({ success: true, data: [app, addon], meta });
    await pending; expect(notify.info).toHaveBeenCalledWith('Already in that state');
  });
  it('a 400 keeps the reason modal open', async () => { openAction(); const first = await submitFailure(400, 'CORE_VALIDATION_FAILED'); expect(reason['closeImmediate']).not.toHaveBeenCalled(); const second = await submitFailure(400, 'CORE_VALIDATION_FAILED'); expect(second.key).not.toBe(first.key); });
  it('a 401 keeps the modal and the key', async () => { await expectRetained(401, 'COMMON.GENERIC.UNAUTHORIZED'); expect(notify.error).toHaveBeenCalledWith('Not saved. Try again.'); });
  it('a 403 on save shows a toast', async () => { openAction(); await submitFailure(403, 'ACCESS_POLICY_BLOCKED'); expect(notify.error).toHaveBeenCalledWith(activationEn.errors.ACCESS_POLICY_BLOCKED); });
  it('not ready shows the app name', async () => { openAction(); await submitFailure(409, 'APPLICATION_ALLOWANCE_NOT_READY'); expect(notify.error).toHaveBeenCalledWith('CRM live — Not ready: the purchase or subscription is not active yet'); });
  it('a stale revision opens the conflict modal', async () => {
    openAction(); await submitFailure(409, 'APPLICATION_ACTIVATION_REVISION_STALE'); expect(reason['conflictOpen']()).toBe(true);
    const refresh = reason['resolveConflict'](true);
    http.expectOne(`${base}/crm`).flush({ success: true, data: { scope: {}, target: {}, source: {}, resource: { ...app.resource, revision: '9' } } });
    await refresh; expect(reason['reason']()).toBe('Owner request');
    const pending = reason['onSubmit'](new Event('submit')); const request = http.expectOne(`${base}/crm`);
    expect(request.request.body.expectedActivationRevision).toBe('9'); request.flush({ errorCode: 'CORE_VALIDATION_FAILED' }, { status: 400, statusText: 'Bad request' }); await pending;
  });
  it('conflict Reload discards the reason and reloads server rows', async () => {
    openAction(); await submitFailure(409, 'APPLICATION_ACTIVATION_REVISION_STALE');
    const refresh = reason['resolveConflict'](false);
    http.expectOne((r) => r.url === base).flush({ success: true, data: [app], meta });
    await refresh; expect(reason['closeImmediate']).toHaveBeenCalled(); expect(page['rows']()).toEqual([app]);
  });
  it('uncertain operation reloads', async () => {
    openAction(); await submitFailure(409, 'ADDON_OPERATION_UNCERTAIN');
    http.expectOne((r) => r.url === base).flush({ success: true, data: [app, addon], meta });
    await vi.waitFor(() => expect(page['loading']()).toBe(false));
    expect(notify.error).toHaveBeenCalledWith(activationEn.errors.ADDON_OPERATION_UNCERTAIN);
  });
  it('in flight keeps the key', async () => { await expectRetained(409, 'GW.IDEM.IN_FLIGHT'); });
  it('configuration invalid toast', async () => { openAction(); await submitFailure(422, 'ADDON_CONFIGURATION_INVALID'); expect(notify.error).toHaveBeenCalledWith('Configuration needs attention'); });
  it('idempotency mismatch text', async () => { openAction(); await submitFailure(422, 'IDEMPOTENCY_BODY_MISMATCH'); expect(notify.error).toHaveBeenCalledWith('Already sent with different values. Reload.'); await submitFailure(422, 'GW.IDEM.MISMATCH'); expect(notify.error).toHaveBeenLastCalledWith('Already sent with different values. Reload.'); });
  it('a 5xx keeps the modal and the key', async () => { await expectRetained(500, 'SERVER_ERROR'); });
  it('a network failure keeps the exact body and key', async () => { await expectRetained(0, 'NETWORK_ERROR'); });
  it('202 pending starts polling', async () => {
    vi.useFakeTimers(); openAction(addon); const pending = reason['onSubmit'](new Event('submit'));
    http.expectOne(`${base}/crm/addons/crm.homes`).flush({ success: true, data: command }, { status: 202, statusText: 'Accepted' });
    await pending; expect(page['isRowPending'](addon)).toBe(true); expect(sessionStorage.getItem('ws-activation:co:crm:crm.homes')).toBe('command');
    const tick = vi.advanceTimersByTimeAsync(2000); await tick;
    http.expectOne(`${base}/crm/addons/crm.homes/activation-commands/command`).flush({ success: true, data: command });
    await Promise.resolve();
  });
  function startPending() { page['startPendingCommand']('co', 'crm', 'crm.homes', command); return 'ws-activation:co:crm:crm.homes'; }
  it('committed command reloads', async () => {
    const storageKey = startPending(); const pending = page['pollCommand'](storageKey);
    http.expectOne(`${base}/crm/addons/crm.homes/activation-commands/command`).flush({ success: true, data: committed });
    (await vi.waitFor(() => http.expectOne((r) => r.url === base))).flush({ success: true, data: [app, addon], meta });
    await pending; expect(sessionStorage.getItem(storageKey)).toBeNull(); expect(page['isRowPending'](addon)).toBe(false);
  });
  it('rejected command shows the reason', async () => {
    const pending = page['pollCommand'](startPending());
    http.expectOne(`${base}/crm/addons/crm.homes/activation-commands/command`).flush({ success: true, data: { ...command, state: 'REJECTED', reason: 'SOURCE_CHANGED' } });
    (await vi.waitFor(() => http.expectOne((r) => r.url === base))).flush({ success: true, data: [app, addon], meta });
    await pending; expect(notify.error).toHaveBeenCalledWith(activationEn.rejected.SOURCE_CHANGED);
  });
  it('foreign command shows the badge without counter', async () => {
    const pending = page['pollCommand'](startPending());
    http.expectOne(`${base}/crm/addons/crm.homes/activation-commands/command`).flush({ errorCode: 'ACCESS_POLICY_BLOCKED' }, { status: 403, statusText: 'Forbidden' });
    await pending; expect(page['pendingForRow'](addon)).toMatchObject({ foreignActor: true, validatedBranchCount: null });
  });
  it('poll keeps going after a 5xx', async () => {
    vi.useFakeTimers(); const storageKey = startPending();
    const pending = page['pollCommand'](storageKey);
    http.expectOne(`${base}/crm/addons/crm.homes/activation-commands/command`).flush({}, { status: 500, statusText: 'Failure' });
    await pending;
    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne(`${base}/crm/addons/crm.homes/activation-commands/command`).error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(18000);
    // Subsequent failures are covered by the same back-off path; no lost-connection toast is raised.
    for (const req of http.match((r) => r.url.includes('activation-commands'))) req.flush({ success: true, data: command });
    expect(page['isRowPending'](addon)).toBe(true);
    expect(page['pollIntervalFor'](Date.now() - 20000)).toBe(5000);
  });
  it('add-on can be turned off while the app is off', () => { expect(page['isSwitchDisabled'](addon)).toBe(false); });
  it('company-scope managers get the switch for their company', () => {
    // V-A1 fallback required by section 1: GLOBAL branch parents remain in companyIds.
    me.set({ ...owner(), isTenantOwner: false, permissionScopes: { [key]: { tenantWide: false, companyIds: ['co'], branchIds: [] } } });
    expect(page['canManage']()).toBe(false); page['selectedCompanyId'].set('other'); expect(page['canManage']()).toBe(false);
  });
  it('branch-only grant gives no company switch', () => { me.set({ ...owner(), isTenantOwner: false, permissionScopes: { [key]: { tenantWide: false, companyIds: ['co'], branchIds: ['br'] } } }); expect(page['canManage']()).toBe(false); expect(page['canManageBranch']('br')).toBe(true); expect(page['canManageBranch']('other')).toBe(false); });
  it('app names come from the apps overview', () => { expect(page['rowName'](app)).toBe('CRM live'); expect(page['rowName'](addon)).toBe('Homes live'); language.set('ar'); expect(page['rowName'](addon)).toBe('العقارات'); page['appNames'].set(new Map()); expect(page['rowName'](addon)).toBe('crm.homes'); });
  it('413 and 429 show the shared texts', async () => { openAction(); await submitFailure(413, 'GW.BODY.TOO_LARGE'); expect(notify.error).toHaveBeenCalledWith(settingsEn.errors.tooLarge); await submitFailure(429, 'GW.RATE.LIMIT_EXCEEDED', { 'Retry-After': '12' }); expect(notify.error).toHaveBeenCalledWith('Too many requests, try again in 12 s'); });
});
