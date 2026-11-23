import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import activationEn from '../../../../../../../public/i18n/ws-app-activation/en.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Notify } from '../../../../../core/notify/notify';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceBranch } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import type { BranchOverrideResource } from '../activation.model';
import { ReasonModal } from '../reason-modal/reason-modal';
import { BranchOverridesModal } from './branch-overrides-modal';

const path = (id: string) => `/api/tenant/core/v1/branches/${id}/application-activations/crm/addons/crm.homes`;
const branch = (id: string): WorkspaceBranch => ({ id, companyId: 'co', code: id, name: id, address: null, phone: null,
  isHeadquarters: false, status: 'ACTIVE', createdAt: '', updatedAt: '' });
const resource: BranchOverrideResource = { kind: 'BRANCH_OVERRIDE', state: 'NOT_CREATED', id: null, revision: '0',
  mode: null, definitionVersionId: null, configVersionId: null, companyApplicationEnabled: false, companyAddonEnabled: false };
const context = { companyId: 'co', companyName: 'Company', appKey: 'crm', addonKey: 'crm.homes', addonName: 'Homes',
  companyAddonExists: true, companyApplicationExists: true };
const singleton = { scope: {}, target: {}, source: {}, resource };

describe('BranchOverridesModal', () => {
  const lookups = { allBranches: vi.fn() };
  let fixture: ComponentFixture<BranchOverridesModal>;
  let modal: BranchOverridesModal;
  let http: HttpTestingController;
  beforeEach(() => {
    lookups.allBranches.mockReset().mockResolvedValue([branch('br')]);
    TestBed.configureTestingModule({ imports: [BranchOverridesModal, TranslocoTestingModule.forRoot({
      langs: { en: { ...en, wsActivation: activationEn, settings: settingsEn }, 'ws-app-activation/en': activationEn, 'settings/en': settingsEn },
      translocoConfig: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, preloadLangs: true,
    })], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: WorkspaceLookups, useValue: lookups }, { provide: Notify, useValue: { error: vi.fn() } },
      { provide: TenantScopeState, useValue: { me: signal({ id: 'actor' }), selection: signal(null) } },
    ] });
    fixture = TestBed.createComponent(BranchOverridesModal); modal = fixture.componentInstance;
    modal['context'].set(context); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('a 403 row shows no access', async () => {
    const pending = modal['load']();
    (await vi.waitFor(() => http.expectOne(path('br')))).flush({ errorCode: 'ACCESS_POLICY_BLOCKED' }, { status: 403, statusText: 'Forbidden' });
    await pending; expect(modal['rows']()[0]).toMatchObject({ forbidden: true, failed: false }); expect(modal['forbidden']()).toBe(false);
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('No access');
  });
  it('a failed row can be retried', async () => {
    const pending = modal['load']();
    (await vi.waitFor(() => http.expectOne(path('br')))).flush({}, { status: 500, statusText: 'Failure' });
    await pending; expect(modal['rows']()[0].failed).toBe(true);
    const retry = modal['refreshBranchRow']('br', 'crm', 'crm.homes');
    http.expectOne(path('br')).flush({ success: true, data: singleton });
    await retry; expect(modal['rows']()[0]).toMatchObject({ resource, failed: false, forbidden: false });
  });
  it('no branches shows the empty state', async () => { lookups.allBranches.mockResolvedValue([]); await modal['load'](); expect(modal['rows']()).toEqual([]); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain(activationEn.branchModal.empty); });
  it('disabled needs only an existing company binding', () => {
    fixture.componentRef.setInput('canManageBranch', () => true);
    const row = { branch: branch('br'), resource, failed: false, forbidden: false };
    expect(modal['canSelect'](row, 'DISABLED')).toBe(true); expect(modal['canSelect'](row, 'INHERIT')).toBe(false);
    modal['context'].set({ ...context, companyAddonExists: false }); expect(modal['canSelect'](row, 'DISABLED')).toBe(false);
    modal['context'].set(context); row.resource = { ...resource, companyApplicationEnabled: true, companyAddonEnabled: true };
    expect(modal['canSelect'](row, 'INHERIT')).toBe(true);
  });
  it('branch-scope managers manage their branch', () => {
    fixture.componentRef.setInput('canManageBranch', (id: string) => id === 'br');
    expect(modal['canSelect']({ branch: branch('br'), resource, failed: false, forbidden: false }, 'DISABLED')).toBe(true);
    expect(modal['canSelect']({ branch: branch('other'), resource, failed: false, forbidden: false }, 'DISABLED')).toBe(false);
  });
  it('stale branch override keeps the reason and reads only the new revision', async () => {
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    fixture.componentRef.setInput('canManageBranch', () => true); fixture.detectChanges();
    const reason = modal['reasonModal']();
    vi.spyOn(reason, 'open').mockImplementation((_request, submit) => {
      reason['submitHandler'] = submit; reason['reason'].set('Owner request');
    });
    modal['openReasonForBranch']({ branch: branch('br'), resource, failed: false, forbidden: false }, 'DISABLED');
    const first = reason['onSubmit'](new Event('submit'));
    const req = http.expectOne(path('br')); const firstKey = req.request.headers.get('x-idempotency-key');
    req.flush({ errorCode: 'ADDON_REVISION_STALE' }, { status: 409, statusText: 'Conflict' });
    await first; expect(reason['conflictOpen']()).toBe(true);
    const refresh = reason['resolveConflict'](true);
    http.expectOne(path('br')).flush({ success: true, data: { ...singleton, resource: { ...resource, revision: '7' } } });
    await refresh; expect(reason['reason']()).toBe('Owner request');
    const retry = reason['onSubmit'](new Event('submit')); const second = http.expectOne(path('br'));
    expect(second.request.body).toEqual({ expectedOverrideRevision: '7', mode: 'DISABLED', reason: 'Owner request' });
    expect(second.request.headers.get('x-idempotency-key')).not.toBe(firstKey);
    second.flush({ errorCode: 'CORE_VALIDATION_FAILED' }, { status: 400, statusText: 'Bad request' }); await retry;
    document.cookie = 'mutakamel-http-tenant-csrf=; max-age=0; path=/';
  });

  it('reads at most six branch singletons concurrently', async () => {
    lookups.allBranches.mockResolvedValue(Array.from({ length: 8 }, (_, i) => branch(`br${i}`)));
    const pending = modal['load']();
    await Promise.resolve(); await Promise.resolve();
    const batch = http.match((r) => r.method === 'GET'); expect(batch).toHaveLength(6);
    batch.forEach((req) => req.flush({ success: true, data: singleton }));
    await vi.waitFor(() => expect(modal['loading']()).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const rest = http.match((r) => r.method === 'GET'); expect(rest).toHaveLength(2);
    rest.forEach((req) => req.flush({ success: true, data: singleton }));
    await pending; expect(modal['rows']()).toHaveLength(8);
  });
});
