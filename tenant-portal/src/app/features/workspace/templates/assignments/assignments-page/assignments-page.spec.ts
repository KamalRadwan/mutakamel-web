import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/templates-assignments/en.json';
import globalEn from '../../../../../../../public/i18n/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { TemplatesApi } from '../../templates.api';
import { fakeGetTemplate, fakeListAssignments, fakeListVersions } from '../../templates.fake';
import type { TemplateAssignmentDto } from '../../templates.model';
import { AssignmentsPage } from './assignments-page';

class Loader { getTranslation(lang: string) { return of((lang.startsWith('templates-assignments/') ? en : globalEn) as Translation); } }
const path = '/api/tenant/core/v1/templates/assignments';
const info = { limit: 25, hasNextPage: false, nextCursor: null };

describe('AssignmentsPage', () => {
  let fixture: ComponentFixture<AssignmentsPage>; let page: AssignmentsPage; let http: HttpTestingController; let row: TemplateAssignmentDto;
  const notify = { success: vi.fn(), error: vi.fn() };
  const me = signal({ id: 'actor', isTenantOwner: true, permissions: ['templates.assignments.manage'],
    permissionScopes: { 'templates.assignments.manage': { tenantWide: true, companyIds: [] as string[], branchIds: [] as string[] } } });
  const templates = { listTemplates: vi.fn(), getTemplate: vi.fn(), listVersions: vi.fn() };
  beforeAll(async () => { row = (await fakeListAssignments({ scopeType: 'TENANT' })).items[0]; });
  beforeEach(async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf; __Host-mutakamel-tenant-csrf=csrf');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    notify.success.mockClear(); notify.error.mockClear();
    me.set({ id: 'actor', isTenantOwner: true, permissions: ['templates.assignments.manage'], permissionScopes: { 'templates.assignments.manage': { tenantWide: true, companyIds: [], branchIds: [] } } });
    templates.listTemplates.mockReset().mockResolvedValue({ items: [], pageInfo: info });
    templates.getTemplate.mockReset().mockImplementation((id) => fakeGetTemplate(id));
    templates.listVersions.mockReset().mockImplementation((id) => fakeListVersions(id, { lifecycleStatus: 'PUBLISHED', limit: 100 }));
    TestBed.configureTestingModule({ imports: [AssignmentsPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: WorkspaceLookups, useValue: { allCompanies: vi.fn().mockResolvedValue([]), allBranches: vi.fn().mockResolvedValue([]) } },
      { provide: TenantScopeState, useValue: { me, selection: signal(null) } }, { provide: TemplatesApi, useValue: templates },
      { provide: LanguageState, useValue: { current: signal('en') } }, { provide: Notify, useValue: notify }] });
    fixture = TestBed.createComponent(AssignmentsPage); page = fixture.componentInstance; http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => { fixture?.destroy(); http.verify(); vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close'); });
  async function tick() { await new Promise((resolve) => setTimeout(resolve, 0)); fixture.detectChanges(); }
  async function list(items: TemplateAssignmentDto[] = [], next: string | null = null) {
    const req = http.expectOne((r) => r.url === path); req.flush({ success: true, data: { items, pageInfo: { ...info, hasNextPage: !!next, nextCursor: next } } }); await tick(); return req;
  }
  async function error(status: number, code: string) {
    http.expectOne((r) => r.url === path).flush({ errorCode: code, correlationId: 'reference' }, { status, statusText: 'Failure' }); await tick();
  }
  it('lists one scope and loads more', async () => {
    const first = await list([row], 'next'); expect(first.request.params.get('scopeType')).toBe('TENANT');
    page['nextPage'](); await tick(); const second = await list([row]); expect(second.request.params.get('cursor')).toBe('next');
    expect(page['assignments']()).toEqual([row]);
  });
  it('schema invalid resets the filters', async () => {
    await list(); page['filters'].set({ documentAdapter: row.adapterKey, locale: '', status: 'ACTIVE', effectiveAt: null }); await tick();
    await error(400, 'SCHEMA.INVALID'); await list(); expect(page['activeFiltersCount']()).toBe(0);
  });
  it('feature disabled shows the plan full state', async () => {
    await error(403, 'FEATURE.DISABLED'); expect(page['errorState']()).toBe('featureDisabled');
    expect(fixture.nativeElement.querySelector('ui-full-state')?.textContent).toContain(en.states.featureDisabledDescription);
  });
  it('not found on the scope shows the scope empty state', async () => {
    await error(404, 'NOT_FOUND'); expect(fixture.nativeElement.textContent).toContain(en.states.scopeEmptyTitle);
  });
  it('empty scope', async () => { await list(); expect(fixture.nativeElement.textContent).toContain(en.states.emptyTitle); });
  it('a 5xx shows load failure', async () => {
    await error(503, 'DEPENDENCY.UNAVAILABLE'); expect(fixture.nativeElement.querySelector('ui-full-state')?.textContent).toContain(en.states.loadFailedTitle);
    expect(fixture.nativeElement.textContent).toContain('reference'); page['reload'](); await list([row]); expect(page['errorState']()).toBe('none');
  });
  it('labels need no per-row request', async () => {
    await list([row]); expect(page['templateInfo'](row).name).toBe(row.definitionId);
    expect(templates.getTemplate).not.toHaveBeenCalled(); http.expectNone((r) => r.url === `/api/tenant/core/v1/templates/${row.definitionId}`);
  });
  it('manage follows the row scope', async () => {
    await list([row]);
    me.set({ id: 'actor', isTenantOwner: false, permissions: ['templates.assignments.manage'], permissionScopes: { 'templates.assignments.manage': { tenantWide: false, companyIds: [], branchIds: ['branch'] } } });
    const disabled = (scope: TemplateAssignmentDto['scope']) => page['actionsFor']({ ...row, status: 'ACTIVE', scope }).find((a) => a.id === 'deactivate')?.disabled;
    expect(disabled({ type: 'TENANT' })).toBe(true); expect(disabled({ type: 'COMPANY', companyId: 'company' })).toBe(true);
    expect(disabled({ type: 'BRANCH', companyId: 'company', branchId: 'branch' })).toBe(false);
    expect(disabled({ type: 'BRANCH', companyId: 'company', branchId: 'other' })).toBe(true);
    expect(page['canManage']()).toBe(false);
  });
  it('shared error texts', async () => {
    const req = http.expectOne((r) => r.url === path);
    req.flush({ code: 'GW.RATE.LIMIT_EXCEEDED' }, { status: 429, statusText: 'Too many requests', headers: { 'Retry-After': '7' } }); await tick();
    expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.rateLimitedIn.replace('{{seconds}}', '7'));
    page['reload'](); await error(503, 'DEPENDENCY.UNAVAILABLE'); expect(notify.error).toHaveBeenCalledWith(en.errors['DEPENDENCY.UNAVAILABLE']);
  });
  it('patch and deactivate show a toast', async () => {
    await list([row]); page['openEdit'](row);
    http.expectOne(`${path}/${row.assignmentId}`).flush({ success: true, data: row });
    await new Promise((resolve) => setTimeout(resolve, 400)); await tick();
    const modal = page['assignmentModal'](); modal['assignmentForm'].priority().value.set('999'); await tick();
    const pending = modal['save'](); await tick();
    http.expectOne(`${path}/${row.assignmentId}`).flush({ success: true, data: { assignment: { ...row, priority: 999 }, impact: { effectiveNow: true, affectedSelectors: [] } } });
    await pending; await list([row]); expect(notify.success).toHaveBeenCalledWith(en.toasts.saved);
    vi.spyOn(page['deactivateConfirm'](), 'open').mockResolvedValue(true);
    const deactivation = page['confirmDeactivate'](row); await tick();
    http.expectOne(`${path}/${row.assignmentId}`).flush(null, { status: 204, statusText: 'No Content' });
    await deactivation; await list(); expect(notify.success).toHaveBeenCalledWith(en.toasts.deactivated);
  });
  it('uses authenticated scope IDs when organization labels are unavailable', async () => {
    await list();
    me.update((current) => ({ ...current, accessibleCompanies: ['real-company'], accessibleBranchCompanies: [{ companyId: 'real-company', branchId: 'real-branch' }] }));
    expect(page['scopeOptions']().some((option) => option.key === 'BRANCH:real-company:real-branch')).toBe(true);
    page['onScopeChanged']('BRANCH:real-company:real-branch'); await tick();
    const req = await list(); expect(req.request.params.get('companyId')).toBe('real-company'); expect(req.request.params.get('branchId')).toBe('real-branch');
    expect(templates.listTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ assignmentScopeType: 'BRANCH', assignmentCompanyId: 'real-company', assignmentBranchId: 'real-branch' }));
  });

});
