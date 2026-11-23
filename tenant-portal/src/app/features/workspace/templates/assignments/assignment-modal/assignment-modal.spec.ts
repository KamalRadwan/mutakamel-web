import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/templates-assignments/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import globalEn from '../../../../../../../public/i18n/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { LanguageState } from '../../../../../core/i18n/language';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { fakeGetTemplate, fakeListAssignments, fakeListTemplates, fakeListVersions } from '../../templates.fake';
import type { TemplateAssignmentDto, TemplateDefinitionDetail, TemplateListResponse, TemplateVersionItem } from '../../templates.model';
import { AssignmentModal } from './assignment-modal';

class Loader {
  getTranslation(lang: string) { return of((lang.startsWith('templates-assignments/') ? en : lang.startsWith('templates/') ? templatesEn : globalEn) as Translation); }
}
const root = '/api/tenant/core/v1/templates';
const path = `${root}/assignments`;
const scopeOptions = [{ key: 'TENANT', scope: { type: 'TENANT' as const }, icon: 'tablerWorld', tile: 'bg-icon-blue', label: 'Workspace' },
  { key: 'BRANCH:company:branch', scope: { type: 'BRANCH' as const, companyId: 'company', branchId: 'branch' }, icon: 'tablerMapPin', tile: 'bg-icon-blue', label: 'Branch' }];
const info = { limit: 100, hasNextPage: false, nextCursor: null };

describe('AssignmentModal', () => {
  let fixture: ComponentFixture<AssignmentModal>; let modal: AssignmentModal; let http: HttpTestingController;
  let row: TemplateAssignmentDto; let definition: TemplateDefinitionDetail; let catalogue: TemplateListResponse; let versions: TemplateVersionItem[];
  const notify = { success: vi.fn(), error: vi.fn() };
  beforeAll(async () => {
    row = (await fakeListAssignments({ scopeType: 'TENANT', limit: 100 })).items[0];
    definition = await fakeGetTemplate(row.definitionId);
    catalogue = await fakeListTemplates({ assignmentScopeType: 'TENANT', limit: 100 });
    versions = (await fakeListVersions(row.definitionId, { lifecycleStatus: 'PUBLISHED', limit: 100 })).items;
  });
  beforeEach(async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf; __Host-mutakamel-tenant-csrf=csrf');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    notify.success.mockClear(); notify.error.mockClear();
    TestBed.configureTestingModule({ imports: [AssignmentModal], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'actor', isTenantOwner: true, permissions: [], permissionScopes: {} }), selection: signal(null) } },
      { provide: Notify, useValue: notify }] });
    TestBed.overrideProvider(LanguageState, { useValue: { current: signal('en') } });
    fixture = TestBed.createComponent(AssignmentModal); modal = fixture.componentInstance;
    fixture.componentRef.setInput('definitions', catalogue.items); fixture.componentRef.setInput('scopeOptions', scopeOptions);
    http = TestBed.inject(HttpTestingController); fixture.detectChanges(); await tick();
  });
  afterEach(() => { try { fixture?.destroy(); http.verify(); } finally { TestBed.resetTestingModule(); vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close'); } });
  async function tick() { await new Promise((resolve) => setTimeout(resolve, 0)); fixture.detectChanges(); }
  function flushVersions() { http.expectOne((r) => r.url === `${root}/${row.definitionId}/versions`).flush({ success: true, data: { items: versions, pageInfo: info } }); }
  async function create() {
    modal.openCreate('TENANT'); await tick();
    http.expectOne((r) => r.url === root).flush({ success: true, data: catalogue }); await tick();
    modal['assignmentForm'].templateId().value.set(row.definitionId); await tick();
    http.expectOne(`${root}/${row.definitionId}`).flush({ success: true, data: definition }); flushVersions(); await tick();
  }
  async function edit() {
    modal.openEdit(row);
    http.expectOne(`${path}/${row.assignmentId}`).flush({ success: true, data: row });
    http.expectOne(`${root}/${row.definitionId}`).flush({ success: true, data: definition }); flushVersions(); await tick();
  }
  async function writeError(status: number, code: string, details?: Record<string, string[]>) {
    const pending = modal['save'](); await tick();
    const request = http.expectOne((r) => r.url === (modal['mode']() === 'create' ? path : `${path}/${row.assignmentId}`));
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush({ errorCode: code, details }, { status, statusText: 'Failure' });
    await pending; await tick();
    return request.request;
  }
  const result = () => ({ assignment: row, impact: { effectiveNow: true, affectedSelectors: [{ scope: row.scope, locale: row.locale, previousEpoch: '9007199254740993', assignmentEpoch: '9007199254740994' }] } });

  it('opens or closes when gone', async () => {
    await edit(); expect(modal['baseAssignment']()?.assignmentId).toBe(row.assignmentId);
    modal.openEdit(row);
    http.expectOne(`${path}/${row.assignmentId}`).flush({ errorCode: 'NOT_FOUND' }, { status: 404, statusText: 'Gone' });
    http.expectOne(`${root}/${row.definitionId}`).flush({ success: true, data: definition }); flushVersions(); await tick();
    expect(modal['modal']()['isOpen']).toBe(false);
  });
  it('create shows the impact summary', async () => {
    await create(); const pending = modal['save'](); await tick();
    http.expectOne(path).flush({ success: true, data: result() }, { status: 201, statusText: 'Created' }); await pending;
    expect(notify.success).toHaveBeenCalledWith('Assignment created.', 'Effective now; 1 selectors affected.');
  });
  it('validation errors land on the fields', async () => {
    await create(); await writeError(400, 'CORE_VALIDATION_FAILED', { priority: ['invalid'], 'scope.companyId': ['invalid'], locale: ['invalid'] });
    expect(modal['priorityError']()).toBe(en.modal.fieldInvalid);
    expect(modal['serverErrors']()['scopeKey']).toBe(en.modal.fieldInvalid);
    expect(modal['serverErrors']()['localeChoice']).toBe(en.modal.fieldInvalid);
    expect(fixture.nativeElement.textContent).toContain(en.modal.fieldInvalid);
  });
  it('adapter not entitled shows a toast', async () => {
    await create(); await writeError(403, 'FEATURE.DISABLED'); expect(notify.error).toHaveBeenCalled(); expect(modal['modal']()['isOpen']).toBe(true);
  });
  it('create not found shows a toast', async () => {
    await create(); await writeError(404, 'NOT_FOUND'); expect(notify.error).toHaveBeenCalled(); expect(modal['modal']()['isOpen']).toBe(true);
  });
  it('overlap 409 is a window field message', async () => {
    await create(); await writeError(409, 'CORE.TEMPLATE.ASSIGNMENT.CONFLICT');
    expect(modal['effectiveFromError']()).toBe(en.modal.overlapError); expect(modal['conflictOpen']()).toBe(false); expect(notify.error).not.toHaveBeenCalled();
  });
  it('bad window 422 is an End field message', async () => {
    await create(); await writeError(422, 'ASSIGNMENT.CONFLICT');
    expect(modal['effectiveToError']()).toBe(en.modal.effectiveToRangeError); expect(modal['effectiveFromError']()).toBeNull();
  });
  it('422 selector codes are field messages', async () => {
    await create();
    for (const [code, field] of [['ASSIGNMENT.VERSION_INCOMPATIBLE', 'versionId'], ['ASSIGNMENT.SCOPE_INVALID', 'scopeKey'], ['ASSIGNMENT.OWNER_RUNTIME_UNAVAILABLE', 'templateId']]) {
      await writeError(422, code); expect(modal['serverErrors']()[field]).toBeTruthy();
    }
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('a 401 keeps the form', async () => {
    await create(); const before = modal['draft'](); await writeError(401, 'COMMON.GENERIC.UNAUTHORIZED');
    expect(modal['draft']()).toEqual(before); expect(modal['modal']()['isOpen']).toBe(true);
    expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.notSaved);
  });
  it('retry reuses the key', async () => {
    await create();
    for (const [status, code] of [[0, 'NETWORK_ERROR'], [503, 'DEPENDENCY.UNAVAILABLE'], [409, 'GW.IDEM.IN_FLIGHT']] as const) {
      const first = await writeError(status, code); const second = await writeError(503, 'DEPENDENCY.UNAVAILABLE');
      expect(second.headers.get('x-idempotency-key')).toBe(first.headers.get('x-idempotency-key')); expect(second.body).toEqual(first.body);
      modal['assignmentForm'].priority().value.set(String(Number(modal['draft']().priority) + 1)); await tick();
      const changed = await writeError(503, 'DEPENDENCY.UNAVAILABLE'); expect(changed.headers.get('x-idempotency-key')).not.toBe(first.headers.get('x-idempotency-key'));
    }
  });
  it('empty patch is not sent', async () => {
    await edit(); await modal['save'](); http.expectNone((r) => r.method === 'PATCH');
  });
  it('patch not found closes', async () => {
    await edit(); modal['assignmentForm'].priority().value.set('999'); await tick(); await writeError(404, 'NOT_FOUND');
    expect(modal['modal']()['isOpen']).toBe(false);
  });
  it('stale revision opens the conflict modal', async () => {
    await edit(); modal['assignmentForm'].priority().value.set('999'); await tick(); await writeError(409, 'STALE_REVISION');
    expect(modal['conflictOpen']()).toBe(true);
    const keep = modal['keepChangesAfterConflict']();
    http.expectOne(`${path}/${row.assignmentId}`).flush({ success: true, data: { ...row, revision: 8, etag: '"8"' } }); await keep;
    expect(modal['draft']().priority).toBe('999'); expect(modal['baseAssignment']()?.etag).toBe('"8"'); expect(modal['dirty']()).toBe(true);
    await writeError(409, 'STALE_REVISION');
    const reload = modal['reloadFromConflict']();
    http.expectOne(`${path}/${row.assignmentId}`).flush({ success: true, data: { ...row, priority: 4, etag: '"9"' } });
    http.expectOne(`${root}/${row.definitionId}`).flush({ success: true, data: definition }); flushVersions(); await reload;
    expect(modal['draft']().priority).toBe('4'); expect(modal['dirty']()).toBe(false);
  });
  it('a 428 shows a toast', async () => {
    await edit(); modal['assignmentForm'].priority().value.set('999'); await tick(); await writeError(428, 'PRECONDITION_REQUIRED');
    expect(notify.error).toHaveBeenCalled(); expect(modal['conflictOpen']()).toBe(false);
  });
  it('definition picker uses the edited scope', async () => {
    modal.openCreate('TENANT'); await tick();
    const first = http.expectOne((r) => r.url === root); expect(first.request.params.get('assignmentScopeType')).toBe('TENANT');
    first.flush({ success: true, data: { ...catalogue, pageInfo: { ...info, hasNextPage: true, nextCursor: 'next' } } }); await tick();
    const next = http.expectOne((r) => r.url === root); expect(next.request.params.get('cursor')).toBe('next');
    next.flush({ success: true, data: { ...catalogue, items: [] } }); await tick();
    modal['assignmentForm'].scopeKey().value.set('BRANCH:company:branch'); await tick();
    const branch = http.expectOne((r) => r.url === root);
    expect(branch.request.params.get('assignmentScopeType')).toBe('BRANCH'); expect(branch.request.params.get('assignmentCompanyId')).toBe('company'); expect(branch.request.params.get('assignmentBranchId')).toBe('branch');
    branch.flush({ success: true, data: catalogue }); await tick();
    expect(modal['draft']().templateId).toBe('');
  });
  it('no client overlap check', async () => {
    await create(); await writeError(409, 'ASSIGNMENT.CONFLICT'); http.expectNone((r) => r.method === 'GET' && r.url === path);
  });
  it('locale is all languages or the template locale', async () => {
    await create(); expect(modal['languageOptions']().map((o) => o.value).sort()).toEqual(['DEFAULT', definition.locale].sort());
  });
  it('versions follow every cursor', async () => {
    modal.openCreate('TENANT'); await tick(); http.expectOne((r) => r.url === root).flush({ success: true, data: catalogue }); await tick();
    modal['assignmentForm'].templateId().value.set(row.definitionId); await tick();
    http.expectOne(`${root}/${row.definitionId}`).flush({ success: true, data: definition });
    http.expectOne((r) => r.url === `${root}/${row.definitionId}/versions`).flush({ success: true, data: { items: versions, pageInfo: { ...info, hasNextPage: true, nextCursor: 'v-next' } } }); await tick();
    const next = http.expectOne((r) => r.url === `${root}/${row.definitionId}/versions`); expect(next.request.params.get('cursor')).toBe('v-next');
    next.flush({ success: true, data: { items: [], pageInfo: info } }); await tick(); expect(modal['versions']()).toEqual(versions);
  });
  it('patch retries keep the key and changes rotate it', async () => {
    await edit(); modal['assignmentForm'].priority().value.set('999'); await tick();
    for (const [status, code] of [[0, 'NETWORK_ERROR'], [503, 'DEPENDENCY.UNAVAILABLE'], [409, 'GW.IDEM.IN_FLIGHT']] as const) {
      const first = await writeError(status, code); const retry = await writeError(503, 'DEPENDENCY.UNAVAILABLE');
      expect(retry.headers.get('x-idempotency-key')).toBe(first.headers.get('x-idempotency-key')); expect(retry.body).toEqual(first.body);
      modal['assignmentForm'].priority().value.set(String(Number(modal['draft']().priority) - 1)); await tick();
      const changed = await writeError(503, 'DEPENDENCY.UNAVAILABLE'); expect(changed.headers.get('x-idempotency-key')).not.toBe(first.headers.get('x-idempotency-key'));
    }
    const rejected = await writeError(422, 'ASSIGNMENT.VERSION_INCOMPATIBLE');
    const next = await writeError(422, 'ASSIGNMENT.VERSION_INCOMPATIBLE');
    expect(next.headers.get('x-idempotency-key')).not.toBe(rejected.headers.get('x-idempotency-key'));
  });
  it('deactivate retries and stale revisions preserve the action', async () => {
    await edit(); vi.spyOn(modal['deactivateConfirm'](), 'open').mockResolvedValue(true);
    async function fail(status: number, code: string) {
      const pending = modal['requestDeactivate'](); await tick();
      const req = http.expectOne(`${path}/${row.assignmentId}`);
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Failure' });
      await pending; await tick(); return req.request;
    }
    for (const [status, code] of [[0, 'NETWORK_ERROR'], [503, 'DEPENDENCY.UNAVAILABLE'], [409, 'GW.IDEM.IN_FLIGHT']] as const) {
      const first = await fail(status, code); const retry = await fail(503, 'DEPENDENCY.UNAVAILABLE');
      expect(retry.headers.get('x-idempotency-key')).toBe(first.headers.get('x-idempotency-key')); expect(retry.body).toEqual(first.body);
    }
    const stale = await fail(409, 'STALE_REVISION'); expect(modal['conflictOpen']()).toBe(true);
    const keep = modal['keepChangesAfterConflict']();
    http.expectOne(`${path}/${row.assignmentId}`).flush({ success: true, data: { ...row, revision: 8, etag: '\"8\"' } }); await keep;
    const changed = await fail(428, 'PRECONDITION_REQUIRED');
    expect(changed.headers.get('x-idempotency-key')).not.toBe(stale.headers.get('x-idempotency-key'));
    expect(changed.headers.get('If-Match')).toBe('\"8\"');
    await fail(404, 'NOT_FOUND'); expect(modal['modal']()['isOpen']).toBe(false);
  });

});
