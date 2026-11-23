import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import createEn from '../../../../../../../public/i18n/templates-create/en.json';
import libraryEn from '../../../../../../../public/i18n/templates-library/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { TemplateCapabilityState, TemplateListResponse, TemplateListRow } from '../../templates.model';
import { LibraryPage } from './library-page';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-library/')) return of(libraryEn as Translation);
    if (lang.startsWith('templates-create/')) return of(createEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of(globalEn as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const SCOPES_URL = `${BASE_URL}/creation-scopes`;
const COMPANY_ID = '01948100-0000-7000-8000-000000000101';
const BRANCH_ID = '01948100-0000-7000-8000-000000000201';
const OTHER_COMPANY_ID = '01948100-0000-7000-8000-000000000102';
const OTHER_BRANCH_ID = '01948100-0000-7000-8000-000000000202';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const CHECKSUM = 'a'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeRow(overrides: Partial<TemplateListRow> = {}): TemplateListRow {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    name: 'Sales Quotation',
    code: 'SALES_QUOTATION',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    lifecycleStatus: 'ACTIVE',
    draft: {
      draftId: '01948100-0000-7000-8000-000000003001',
      revision: 3,
      validationState: 'PASSED',
    },
    currentPublishedVersion: null,
    locale: 'en-US',
    direction: 'LTR',
    resolvedDirection: 'LTR',
    definitionScope: { type: 'TENANT' },
    assignment: {
      requestedTarget: { type: 'TENANT' },
      evaluatedAt: '2026-11-22T10:00:00Z',
      state: 'NONE',
      effectiveCandidateCount: 0,
      primary: null,
      candidates: [],
      additionalCount: 0,
    },
    updatedAt: '2026-11-22T10:00:00Z',
    createdAt: '2026-11-20T10:00:00Z',
    author: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    definitionRevision: 2,
    definitionEtag: '"2"',
    actions: {
      open: cap('ENABLED'),
      design: cap('ENABLED'),
      validate: cap('ENABLED'),
      duplicateFromDraft: cap('ENABLED'),
      duplicateFromVersion: cap('HIDDEN'),
      preview: cap('ENABLED'),
      publish: cap('ENABLED'),
      manageAssignments: cap('ENABLED'),
      restoreVersion: cap('HIDDEN'),
      archive: cap('ENABLED'),
      restore: cap('HIDDEN'),
      delete: cap('ENABLED'),
    },
    ...overrides,
  };
}

function makePage(items: TemplateListRow[], nextCursor: string | null = null, totalCount = items.length): TemplateListResponse {
  return {
    items,
    totalCount,
    pageInfo: {
      limit: 10,
      hasNextPage: nextCursor !== null,
      nextCursor,
    },
    sort: { by: 'updatedAt', direction: 'desc' },
    assignmentTarget: { type: 'TENANT' },
    assignmentEvaluatedAt: '2026-11-22T10:00:00Z',
  };
}

describe('LibraryPage', () => {
  let fixture: ComponentFixture<LibraryPage>;
  let component: LibraryPage;
  let http: HttpTestingController;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal<{
    id: string;
    isTenantOwner: boolean;
    permissions: string[];
    permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
    accessibleCompanies: string[];
    accessibleBranches: string[];
    accessibleBranchCompanies: { branchId: string; companyId: string }[];
  }>({
    id: 'actor-1',
    isTenantOwner: true,
    permissions: ['templates.read', 'templates.create', 'templates.archive'],
    permissionScopes: {},
    accessibleCompanies: [COMPANY_ID],
    accessibleBranches: [BRANCH_ID],
    accessibleBranchCompanies: [{ branchId: BRANCH_ID, companyId: COMPANY_ID }],
  });
  const selection = signal<{ companyId: string; branchId: string | null } | null>({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
  });
  const branchCompanies = signal(
    new Map<string, string>([
      [BRANCH_ID, COMPANY_ID],
      [OTHER_BRANCH_ID, OTHER_COMPANY_ID],
    ]),
  );
  const selectorCompanyIds = signal([COMPANY_ID, OTHER_COMPANY_ID]);
  const branchesFor = (companyId: string) =>
    companyId === COMPANY_ID ? [BRANCH_ID] : companyId === OTHER_COMPANY_ID ? [OTHER_BRANCH_ID] : [];

  beforeEach(() => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

    me.set({
      id: 'actor-1',
      isTenantOwner: true,
      permissions: ['templates.read', 'templates.create', 'templates.archive'],
      permissionScopes: {},
      accessibleCompanies: [COMPANY_ID],
      accessibleBranches: [BRANCH_ID],
      accessibleBranchCompanies: [{ branchId: BRANCH_ID, companyId: COMPANY_ID }],
    });
    selection.set({ companyId: COMPANY_ID, branchId: BRANCH_ID });

    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });

    TestBed.configureTestingModule({
      imports: [LibraryPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: Loader,
        }),
        {
          provide: TenantScopeState,
          useValue: { me, selection, branchCompanies, selectorCompanyIds, branchesFor },
        },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function boot(
    items: TemplateListRow[] = [makeRow()],
    nextCursor: string | null = null,
    scopes: unknown[] = [{ type: 'TENANT' }],
  ): Promise<void> {
    fixture = TestBed.createComponent(LibraryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    const scopesReq = http.expectOne(SCOPES_URL);
    scopesReq.flush({ success: true, data: { scopes } });

    const listReq = http.expectOne((r) => r.url === BASE_URL);
    listReq.flush({ success: true, data: makePage(items, nextCursor) });
    await tick();
  }

  it('uses real TenantScopeState assignment scope for BRANCH, COMPANY, and TENANT', async () => {
    fixture = TestBed.createComponent(LibraryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    const branchReq = http.expectOne((r) => r.url === BASE_URL);
    expect(branchReq.request.params.get('assignmentScopeType')).toBe('BRANCH');
    expect(branchReq.request.params.get('assignmentCompanyId')).toBe(COMPANY_ID);
    expect(branchReq.request.params.get('assignmentBranchId')).toBe(BRANCH_ID);
    branchReq.flush({ success: true, data: makePage([makeRow()]) });
    await tick();

    selection.set({ companyId: COMPANY_ID, branchId: null });
    fixture.detectChanges();
    await tick();

    http.expectOne(SCOPES_URL).flush({
      success: true,
      data: { scopes: [{ type: 'COMPANY', companyId: COMPANY_ID, label: 'Alpha Co' }] },
    });
    const companyReq = http.expectOne((r) => r.url === BASE_URL);
    expect(companyReq.request.params.get('assignmentScopeType')).toBe('COMPANY');
    expect(companyReq.request.params.get('assignmentCompanyId')).toBe(COMPANY_ID);
    expect(companyReq.request.params.get('assignmentBranchId')).toBeNull();
    companyReq.flush({ success: true, data: makePage([makeRow()]) });
    await tick();
    expect(component['activeScopeName']()).toBe('Alpha Co');

    selection.set(null);
    fixture.detectChanges();
    await tick();

    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    const tenantReq = http.expectOne((r) => r.url === BASE_URL);
    expect(tenantReq.request.params.get('assignmentScopeType')).toBe('TENANT');
    expect(tenantReq.request.params.get('assignmentCompanyId')).toBeNull();
    expect(tenantReq.request.params.get('assignmentBranchId')).toBeNull();
    tenantReq.flush({ success: true, data: makePage([makeRow()]) });
    await tick();
  });

  it('skips creation-scopes request when user lacks templates.create and fails closed on error', async () => {
    me.set({
      id: 'reader-1',
      isTenantOwner: false,
      permissions: ['templates.read'],
      permissionScopes: { 'templates.read': { tenantWide: true, companyIds: [], branchIds: [] } },
      accessibleCompanies: [],
      accessibleBranches: [],
      accessibleBranchCompanies: [],
    });
    selection.set(null);

    fixture = TestBed.createComponent(LibraryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectNone(SCOPES_URL);
    http.expectOne((r) => r.url === BASE_URL).flush({ success: true, data: makePage([makeRow()]) });
    await tick();
    expect(component['canCreate']()).toBe(false);

    me.update((curr) => ({ ...curr, permissions: ['templates.read', 'templates.create'] }));
    fixture.detectChanges();
    await tick();

    http.expectOne(SCOPES_URL).flush({ errorCode: 'COMMON.GENERIC.FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne((r) => r.url === BASE_URL).flush({ success: true, data: makePage([makeRow()]) });
    await tick();
    expect(component['canCreate']()).toBe(false);
    expect(notify.error).toHaveBeenCalled();
  });

  it('paginates with cursor, resets cursor synchronously on scope change, and recovers from CURSOR.INVALID', async () => {
    await boot([makeRow()], 'cursor-2');
    expect(component['hasNextPage']()).toBe(true);
    expect(component['hasPrevPage']()).toBe(false);

    component['goNext']();
    await tick();
    const page2Req = http.expectOne((r) => r.url === BASE_URL);
    expect(page2Req.request.params.get('cursor')).toBe('cursor-2');
    page2Req.flush({ success: true, data: makePage([makeRow()], 'cursor-3') });
    await tick();
    expect(component['hasPrevPage']()).toBe(true);

    selection.set({ companyId: OTHER_COMPANY_ID, branchId: OTHER_BRANCH_ID });
    fixture.detectChanges();
    await tick();
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    const resetReq = http.expectOne((r) => r.url === BASE_URL);
    expect(resetReq.request.params.get('assignmentCompanyId')).toBe(OTHER_COMPANY_ID);
    expect(resetReq.request.params.get('cursor')).toBeNull();
    resetReq.flush({ success: true, data: makePage([makeRow()], 'cursor-new') });
    await tick();

    component['goNext']();
    await tick();
    http
      .expectOne((r) => r.url === BASE_URL && r.params.get('cursor') === 'cursor-new')
      .flush({ errorCode: 'CORE.TEMPLATE.CURSOR.INVALID' }, { status: 400, statusText: 'Bad Request' });
    await tick();

    const recoveredReq = http.expectOne((r) => r.url === BASE_URL);
    expect(recoveredReq.request.params.get('cursor')).toBeNull();
    recoveredReq.flush({ success: true, data: makePage([makeRow()]) });
    await tick();
    expect(component['errorKind']()).toBe('none');
  });

  it('forwards definitionScopeType COMPANY with real company UUIDv7', async () => {
    await boot([makeRow()]);
    component['onFiltersApplied']({
      documentType: null,
      outputChannel: null,
      layoutMode: null,
      lifecycleStatus: null,
      locale: null,
      definitionScopeType: 'COMPANY',
      hasPublishedVersion: null,
      dateRange: {
        updatedFrom: null,
        updatedTo: null,
        startIso: null,
        endIso: null,
        startTime: '00:00',
        endTime: '23:59',
      },
    });
    await tick();

    const req = http.expectOne((r) => r.url === BASE_URL);
    expect(req.request.params.get('definitionScopeType')).toBe('COMPANY');
    expect(req.request.params.get('definitionCompanyId')).toBe(COMPANY_ID);
    req.flush({ success: true, data: makePage([]) });
    await tick();
  });

  it('maps resource load errors to featureDisabled, forbidden, and failed with correlationId', async () => {
    fixture = TestBed.createComponent(LibraryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    http
      .expectOne((r) => r.url === BASE_URL)
      .flush({ errorCode: 'CORE.TEMPLATE.FEATURE.DISABLED' }, { status: 403, statusText: 'Forbidden' });
    await tick();
    expect(component['errorKind']()).toBe('featureDisabled');

    component['reload']();
    await tick();
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    http
      .expectOne((r) => r.url === BASE_URL)
      .flush({ errorCode: 'CORE.TEMPLATE.PERMISSION.DENIED' }, { status: 403, statusText: 'Forbidden' });
    await tick();
    expect(component['errorKind']()).toBe('forbidden');

    component['reload']();
    await tick();
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    http
      .expectOne((r) => r.url === BASE_URL)
      .flush(
        { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-503' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await tick();
    expect(component['errorKind']()).toBe('failed');
    expect(component['errorCorrelationId']()).toBe('corr-503');
  });

  it('executes archive, restore, and delete via TemplatesApi with If-Match and UUIDv7 key', async () => {
    const row = makeRow();
    await boot([row]);

    component['onRowAction'](row, { id: 'archive' });
    await tick();
    const archiveReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/archive`);
    expect(archiveReq.request.method).toBe('POST');
    expect(archiveReq.request.headers.get('If-Match')).toBe('"2"');
    expect(archiveReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    archiveReq.flush({ success: true, data: { templateId: TEMPLATE_ID, revision: 3, etag: '"3"' } });
    await tick();

    expect(notify.success).toHaveBeenCalledWith(libraryEn.toasts.archived);
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    http.expectOne((r) => r.url === BASE_URL).flush({
      success: true,
      data: makePage([makeRow({ lifecycleStatus: 'ARCHIVED', definitionRevision: 3, definitionEtag: '"3"' })]),
    });
    await tick();

    const archivedRow = component['items']()[0];
    component['onRowAction'](archivedRow, { id: 'restore' });
    await tick();
    const restoreReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/restore`);
    expect(restoreReq.request.method).toBe('POST');
    expect(restoreReq.request.headers.get('If-Match')).toBe('"3"');
    expect(restoreReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    restoreReq.flush({ success: true, data: { templateId: TEMPLATE_ID, revision: 4, etag: '"4"' } });
    await tick();

    expect(notify.success).toHaveBeenCalledWith(libraryEn.toasts.restored);
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    http.expectOne((r) => r.url === BASE_URL).flush({
      success: true,
      data: makePage([makeRow({ definitionRevision: 4, definitionEtag: '"4"' })], 'cursor-p2'),
    });
    await tick();

    component['goNext']();
    await tick();
    http.expectOne((r) => r.url === BASE_URL && r.params.get('cursor') === 'cursor-p2').flush({
      success: true,
      data: makePage([makeRow({ definitionRevision: 4, definitionEtag: '"4"' })]),
    });
    await tick();

    vi.spyOn(component['deleteConfirm'](), 'open').mockResolvedValue(true);
    component['onRowAction'](component['items']()[0], { id: 'delete' });
    await tick();
    const deleteReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.headers.get('If-Match')).toBe('"4"');
    expect(deleteReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await tick();

    expect(notify.success).toHaveBeenCalledWith(libraryEn.toasts.deleted);
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    const prevPageReq = http.expectOne((r) => r.url === BASE_URL);
    expect(prevPageReq.request.params.get('cursor')).toBeNull();
    prevPageReq.flush({ success: true, data: makePage([makeRow()]) });
    await tick();
  });

  it('handles 409 conflict vs referenced, 428 precondition, and retains idempotency key on retryable errors', async () => {
    const row = makeRow();
    await boot([row]);

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      component['onRowAction'](row, { id: 'archive' });
      await tick();
      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/archive`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Failed' });
      await tick();
      expect(notify.error).toHaveBeenCalled();
    }

    component['onRowAction'](row, { id: 'archive' });
    await tick();
    const staleReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/archive`);
    expect(staleReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    staleReq.flush({ errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' }, { status: 409, statusText: 'Conflict' });
    await tick();
    expect(notify.warning).toHaveBeenCalledWith(templatesEn.states.conflict.title, templatesEn.states.conflict.description);

    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    http.expectOne((r) => r.url === BASE_URL).flush({
      success: true,
      data: makePage([makeRow({ definitionRevision: 3, definitionEtag: '"3"' })]),
    });
    await tick();

    vi.spyOn(component['deleteConfirm'](), 'open').mockResolvedValue(true);
    component['onRowAction'](component['items']()[0], { id: 'delete' });
    await tick();
    http
      .expectOne(`${BASE_URL}/${TEMPLATE_ID}`)
      .flush({ errorCode: 'CORE.TEMPLATE.DEFINITION.REFERENCED' }, { status: 409, statusText: 'Conflict' });
    await tick();
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.DEFINITION.REFERENCED']);

    component['onRowAction'](component['items']()[0], { id: 'archive' });
    await tick();
    const preReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/archive`);
    expect(preReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    preReq.flush({ errorCode: 'CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED' }, { status: 428, statusText: 'Precondition Required' });
    await tick();
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED']);
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    http.expectOne((r) => r.url === BASE_URL).flush({ success: true, data: makePage([makeRow()]) });
    await tick();
  });
});
