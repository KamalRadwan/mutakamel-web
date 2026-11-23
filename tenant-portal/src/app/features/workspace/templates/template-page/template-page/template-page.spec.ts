import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import createEn from '../../../../../../../public/i18n/templates-create/en.json';
import designerEn from '../../../../../../../public/i18n/templates-designer/en.json';
import emailEn from '../../../../../../../public/i18n/templates-designer-email/en.json';
import fieldsEn from '../../../../../../../public/i18n/templates-designer-fields/en.json';
import tablesEn from '../../../../../../../public/i18n/templates-designer-tables/en.json';
import toolsEn from '../../../../../../../public/i18n/templates-designer-tools/en.json';
import templatesPageEn from '../../../../../../../public/i18n/templates-page/en.json';
import validationEn from '../../../../../../../public/i18n/templates-validation/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type {
  TemplateCapabilityState,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateRecoverySnapshotWireItem,
} from '../../templates.model';
import { TemplatePage } from './template-page';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates-validation/')) return of(validationEn as Translation);
    if (lang.startsWith('templates-designer-fields/')) return of(fieldsEn as Translation);
    if (lang.startsWith('templates-designer-tools/')) return of(toolsEn as Translation);
    if (lang.startsWith('templates-designer-tables/')) return of(tablesEn as Translation);
    if (lang.startsWith('templates-designer-email/')) return of(emailEn as Translation);
    if (lang.startsWith('templates-designer/')) return of(designerEn as Translation);
    if (lang.startsWith('templates-create/')) return of(createEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({ ...globalEn, templates: templatesEn, templatesPage: templatesPageEn } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const SCOPES_URL = `${BASE_URL}/creation-scopes`;
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const SNAPSHOT_ID = '01948100-0000-7000-8000-000000004001';
const CHECKSUM = 'a'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: 'SALES_QUOTATION',
    name: 'Sales Quotation',
    description: 'Standard quotation template',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: CHECKSUM,
    locale: 'en-US',
    direction: 'LTR',
    resolvedDirection: 'LTR',
    scope: { type: 'TENANT' },
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 2,
    etag: '"2"',
    currentDraft: {
      draftId: DRAFT_ID,
      revision: 3,
      contentChecksum: CHECKSUM,
      validationState: 'PASSED',
      etag: '"3"',
    },
    currentPublishedVersion: null,
    createdAt: '2026-11-20T10:00:00Z',
    createdBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    archivedAt: null,
    capabilities: {
      update: cap('ENABLED'),
      validate: cap('ENABLED'),
      publish: cap('ENABLED'),
      preview: cap('ENABLED'),
      previewPdf: cap('ENABLED'),
      restoreVersion: cap('HIDDEN'),
      manageRecovery: cap('ENABLED'),
      restoreRecovery: cap('ENABLED'),
      manageAssets: cap('ENABLED'),
      retireVersion: cap('HIDDEN'),
      archive: cap('ENABLED'),
      restore: cap('HIDDEN'),
      delete: cap('ENABLED'),
      manageAssignments: cap('ENABLED'),
    },
    ...overrides,
  };
}

function makeDraft(overrides: Partial<TemplateDraftDto> = {}): TemplateDraftDto {
  return {
    draftId: DRAFT_ID,
    templateId: TEMPLATE_ID,
    editorDocument: {
      schemaVersion: 1,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'en-US',
      direction: 'LTR',
      theme: {
        fontFamilyToken: 'SYSTEM_SANS',
        baseFontSizePx: 12,
        textColor: '#111827',
        lineHeight: 1.4,
      },
      rootNodeIds: [],
      nodes: {},
    },
    schemaVersion: 1,
    contentChecksum: CHECKSUM,
    baseVersionId: null,
    restoreSourceVersionId: null,
    validation: {
      state: 'PASSED',
      lastValidationRunId: null,
      validatedDraftRevision: 3,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 3,
    etag: '"3"',
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    ...overrides,
  };
}

function makeWireSnapshot(): TemplateRecoverySnapshotWireItem {
  return {
    snapshotId: SNAPSHOT_ID,
    sourceDraftRevision: 2,
    sourceSchemaVersion: 1,
    targetSchemaVersion: 1,
    sourceContentChecksum: CHECKSUM,
    snapshotChecksum: 'b'.repeat(64),
    captureReason: 'PRE_SCHEMA_MIGRATION',
    captureAuditId: '01948100-0000-7000-8000-000000005001',
    createdAt: '2026-11-21T10:00:00Z',
    createdBy: 'actor-creator',
    expiresAt: '2026-12-21T10:00:00Z',
    integrityStatus: 'AVAILABLE',
    quarantinedAt: null,
    quarantineReason: null,
    cleanupRequestedAt: null,
    restoredAt: null,
    restoredBy: null,
    restoredToDraftRevision: null,
    objectDeletedAt: null,
  };
}

describe('TemplatePage', () => {
  let fixture: ComponentFixture<TemplatePage>;
  let component: TemplatePage;
  let http: HttpTestingController;
  let router: Router;

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
    permissions: ['templates.read', 'templates.update', 'templates.create', 'templates.archive'],
    permissionScopes: {},
    accessibleCompanies: [],
    accessibleBranches: [],
    accessibleBranchCompanies: [],
  });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(() => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

    me.set({
      id: 'actor-1',
      isTenantOwner: true,
      permissions: ['templates.read', 'templates.update', 'templates.create', 'templates.archive'],
      permissionScopes: {},
      accessibleCompanies: [],
      accessibleBranches: [],
      accessibleBranchCompanies: [],
    });
    selection.set(null);

    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
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
      imports: [TemplatePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: Loader,
        }),
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: ScopeState, useValue: { companies: signal([]) } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function mountAndFlush(
    def = makeDefinition(),
    draft: TemplateDraftDto | null = makeDraft(),
    snapshots: TemplateRecoverySnapshotWireItem[] = [makeWireSnapshot()],
  ): Promise<void> {
    fixture = TestBed.createComponent(TemplatePage);
    fixture.componentRef.setInput('id', TEMPLATE_ID);
    fixture.componentRef.setInput('tab', 'overview');
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { success: true, data: def },
      { headers: { ETag: def.etag } },
    );
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({
      success: true,
      data: { scopes: [{ type: 'TENANT' }] },
    });
    await tick();

    const draftReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`);
    if (draft) {
      draftReq.flush({ success: true, data: draft }, { headers: { ETag: draft.etag } });
      await tick();
      http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`).flush({
        success: true,
        data: { items: snapshots, pageInfo: { limit: 20, hasNextPage: false, nextCursor: null } },
      });
    } else {
      draftReq.flush({ errorCode: 'CORE.TEMPLATE.PERMISSION.DENIED' }, { status: 403, statusText: 'Forbidden' });
    }
    await tick();
  }

  it('loads template detail, versions, creation scopes, draft, and adapts recovery snapshot actors', async () => {
    const def = makeDefinition({ etag: '"1"' });
    const draft = makeDraft({ etag: '"1"' });

    fixture = TestBed.createComponent(TemplatePage);
    fixture.componentRef.setInput('id', TEMPLATE_ID);
    fixture.componentRef.setInput('tab', 'overview');
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { success: true, data: def },
      { headers: { ETag: '"9"' } },
    );
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({
      success: true,
      data: { scopes: [{ type: 'TENANT' }] },
    });
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush(
      { success: true, data: draft },
      { headers: { ETag: '"12"' } },
    );
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`).flush({
      success: true,
      data: { items: [makeWireSnapshot()], pageInfo: { limit: 20, hasNextPage: false, nextCursor: null } },
    });
    await tick();

    expect(component['service'].definition()?.etag).toBe('"9"');
    expect(component['service'].draft()?.etag).toBe('"12"');
    expect(component['service'].creationScopes()).toEqual([{ type: 'TENANT' }]);
    expect(component['service'].snapshots()[0]?.createdBy).toEqual({
      kind: 'USER',
      actorId: 'actor-creator',
      displayName: 'actor-creator',
    });
    expect(component['loading']()).toBe(false);
    expect(component['loadError']()).toBeNull();
  });

  it('reports optional scope and recovery read failures without hiding the template', async () => {
    await mountAndFlush();
    const reload = component['loadAll'](TEMPLATE_ID, false);
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await tick();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });
    await tick();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`).flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await reload;

    expect(notify.error).toHaveBeenCalledTimes(2);
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE']);
    expect(component['service'].definition()?.templateId).toBe(TEMPLATE_ID);
    expect(component['service'].creationScopes()).toEqual([]);
    expect(component['service'].snapshots()).toEqual([]);
    expect(component['loadError']()).toBeNull();
    expect(component['loading']()).toBe(false);
  });

  it('skips creation-scopes without templates.create and handles 403 draft as read-only', async () => {
    me.set({
      id: 'reader-1',
      isTenantOwner: false,
      permissions: ['templates.read'],
      permissionScopes: {},
      accessibleCompanies: [],
      accessibleBranches: [],
      accessibleBranchCompanies: [],
    });

    fixture = TestBed.createComponent(TemplatePage);
    fixture.componentRef.setInput('id', TEMPLATE_ID);
    fixture.componentRef.setInput('tab', 'overview');
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectNone(SCOPES_URL);
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush(
      { errorCode: 'CORE.TEMPLATE.PERMISSION.DENIED' },
      { status: 403, statusText: 'Forbidden' },
    );
    await tick();

    http.expectNone(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`);
    expect(component['service'].draftAccessForbidden()).toBe(true);
    expect(component['service'].draft()).toBeNull();
    expect(component['service'].snapshots()).toEqual([]);
    expect(component['service'].isReadOnly()).toBe(true);
  });

  it('maps initial load failures to featureDisabled, forbidden, notFound, and loadFailed with correlationId', async () => {
    fixture = TestBed.createComponent(TemplatePage);
    fixture.componentRef.setInput('id', TEMPLATE_ID);
    fixture.componentRef.setInput('tab', 'overview');
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { errorCode: 'CORE.TEMPLATE.FEATURE.DISABLED' },
      { status: 403, statusText: 'Forbidden' },
    );
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    await tick();
    expect(component['loadError']()).toBe('featureDisabled');

    component['retryLoad']();
    await tick();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { errorCode: 'CORE.TEMPLATE.NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    await tick();
    expect(component['loadError']()).toBe('notFound');

    component['retryLoad']();
    await tick();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-page-503' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    await tick();
    expect(component['loadError']()).toBe('loadFailed');
    expect(component['loadCorrelationId']()).toBe('corr-page-503');
  });

  it('saves overview changes via patchTemplate, handles CoreWriteResult.etag, and retains idempotency key on retryable errors', async () => {
    await mountAndFlush();

    component['service'].overviewName.set('Updated Quotation');
    component['service'].overviewDirection.set('RTL');

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['save']();
      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.headers.get('If-Match')).toBe('"2"');
      expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;
      expect(req.request.body).toEqual({
        name: 'Updated Quotation',
        direction: 'RTL',
        expectedDraftRevision: 3,
      });

      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await expect(pending).resolves.toBe(false);
      expect(notify.error).toHaveBeenCalled();
    }

    const updatedDef = makeDefinition({
      name: 'Updated Quotation',
      direction: 'RTL',
      resolvedDirection: 'RTL',
      revision: 3,
      etag: '"2"',
    });
    const updatedDraft = makeDraft({ revision: 4, etag: '"4"' });

    const saveOk = component['save']();
    const okReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(okReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    okReq.flush(
      { success: true, data: { definition: updatedDef, draft: updatedDraft } },
      { headers: { ETag: '"3"' } },
    );
    await expect(saveOk).resolves.toBe(true);

    expect(component['service'].definition()?.etag).toBe('"3"');
    expect(component['service'].draft()?.revision).toBe(4);
    expect(component['service'].dirty()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.header.savedToast);

    component['service'].overviewName.set('Conflicting Name');
    const conflictSave = component['save']();
    const conflictReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(conflictReq.request.headers.get('If-Match')).toBe('"3"');
    expect(conflictReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    conflictReq.flush(
      { errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(conflictSave).resolves.toBe(false);
    expect(component['service'].conflictOpen()).toBe(true);
  });

  it('archives, restores, and deletes via TemplatesApi using CoreWriteResult.etag and navigating on 204', async () => {
    await mountAndFlush();

    vi.spyOn(component['archiveConfirm'](), 'open').mockResolvedValue(true);
    const archivePromise = component['confirmArchive'](makeDefinition());
    await tick();
    const archiveReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/archive`);
    expect(archiveReq.request.method).toBe('POST');
    expect(archiveReq.request.headers.get('If-Match')).toBe('"2"');
    expect(archiveReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    archiveReq.flush(
      { success: true, data: makeDefinition({ lifecycleStatus: 'ARCHIVED', revision: 3, etag: '"2"' }) },
      { headers: { ETag: '"3"' } },
    );
    await archivePromise;
    expect(component['service'].definition()?.lifecycleStatus).toBe('ARCHIVED');
    expect(component['service'].definition()?.etag).toBe('"3"');
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.header.archivedToast);

    vi.spyOn(component['restoreTemplateConfirm'](), 'open').mockResolvedValue(true);
    const restoreDef = component['service'].definition();
    expect(restoreDef).not.toBeNull();
    if (!restoreDef) return;
    const restorePromise = component['confirmRestoreTemplate'](restoreDef);
    await tick();
    const restoreReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/restore`);
    expect(restoreReq.request.method).toBe('POST');
    expect(restoreReq.request.headers.get('If-Match')).toBe('"3"');
    restoreReq.flush(
      { success: true, data: makeDefinition({ lifecycleStatus: 'ACTIVE', revision: 4, etag: '"3"' }) },
      { headers: { ETag: '"4"' } },
    );
    await restorePromise;
    expect(component['service'].definition()?.lifecycleStatus).toBe('ACTIVE');
    expect(component['service'].definition()?.etag).toBe('"4"');
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.header.restoredToast);

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(component['deleteConfirm'](), 'open').mockResolvedValue(true);
    const deleteDef = component['service'].definition();
    expect(deleteDef).not.toBeNull();
    if (!deleteDef) return;
    const deletePromise = component['confirmDelete'](deleteDef);
    await tick();
    const deleteReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.headers.get('If-Match')).toBe('"4"');
    expect(deleteReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await deletePromise;
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.header.deletedToast);
    expect(navSpy).toHaveBeenCalledWith(['/workspace/operations/template-platform']);
  });

  it('renders compact single-band header and toggles fullscreen class on the design tab with Escape exit', async () => {
    await mountAndFlush();

    const hostEl = fixture.nativeElement as HTMLElement;
    const header = hostEl.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.classList.contains('desktop:h-table-row')).toBe(true);

    const title = header?.querySelector('h1');
    expect(title?.textContent?.trim()).toBe('Sales Quotation');
    expect(title?.getAttribute('title')).toBe('Sales Quotation');
    expect(title?.classList.contains('text-15')).toBe(true);

    const tablist = header?.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    const activeTabBtn = tablist?.querySelector('[role="tab"][aria-selected="true"]');
    expect(activeTabBtn?.classList.contains('subnav-active')).toBe(true);

    // Trailing modal hosts use display: contents so they do not consume flex height
    expect(hostEl.querySelector(':scope > app-tpl-publish-modal')?.classList.contains('contents')).toBe(true);
    expect(hostEl.querySelector(':scope > ui-unsaved-dialog')?.classList.contains('contents')).toBe(true);

    // Switch to the Design tab and flush DesignerState load
    fixture.componentRef.setInput('tab', 'design');
    fixture.detectChanges();
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { success: true, data: makeDefinition() },
      { headers: { ETag: '"2"' } },
    );
    await tick();
    const designDraft = makeDraft();
    const selectedNodeId = '01948100-0000-7000-8000-000000006001';
    designDraft.editorDocument.page = {
      unit: 'MM',
      preset: 'A4',
      widthMm: 210,
      heightMm: 297,
      orientation: 'PORTRAIT',
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
    };
    designDraft.editorDocument.rootNodeIds = [selectedNodeId];
    designDraft.editorDocument.nodes[selectedNodeId] = {
      id: selectedNodeId,
      type: 'text',
      parentId: null,
      childIds: [],
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 12, y: 12, width: 50, height: 10, rotationDeg: 0, zIndex: 0 },
      style: {},
      props: { text: 'Selected heading' },
    };
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush(
      { success: true, data: designDraft },
      { headers: { ETag: '"3"' } },
    );
    await tick();
    http
      .expectOne((req) => req.url === `${BASE_URL}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`)
      .flush({
        success: true,
        data: {
          adapterKey: 'TRADE_QUOTATION_PRINT_V1',
          productionAssignmentEnabled: true,
          productionDisabledReason: null,
          schemaVersion: 1,
          schemaChecksum: CHECKSUM,
          documentType: 'QUOTATION',
          allowedOutputChannels: ['PRINT'],
          allowedLayoutModes: ['HYBRID_DOCUMENT'],
          supportedLocales: ['en-US'],
          fieldCount: 0,
          fields: [],
          syntheticFixtures: [],
        },
      });
    await tick();

    const fullscreenBtn = hostEl.querySelector<HTMLButtonElement>('[data-ribbon-tool="fullscreen"]');
    expect(fullscreenBtn).not.toBeNull();
    expect(hostEl.classList.contains('fixed')).toBe(false);

    fullscreenBtn?.click();
    fixture.detectChanges();
    expect(hostEl.classList.contains('fixed')).toBe(true);
    expect(hostEl.classList.contains('inset-0')).toBe(true);
    expect(hostEl.classList.contains('z-nav')).toBe(true);

    // A canvas selection must not consume the Escape meant to exit fullscreen.
    const designerState = component['designerState'];
    designerState.select([selectedNodeId]);
    fixture.detectChanges();
    expect(designerState.selectedIds().length).toBeGreaterThan(0);
    const canvas = hostEl.querySelector<HTMLElement>('[role="application"]');
    expect(canvas).not.toBeNull();
    canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(hostEl.classList.contains('fixed')).toBe(false);
    expect(designerState.selectedIds().length).toBeGreaterThan(0);

    // Outside fullscreen, Escape still clears the canvas selection.
    canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(designerState.selectedIds()).toEqual([]);

    // Escape exits fullscreen on DesignTab
    fullscreenBtn?.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(hostEl.classList.contains('fixed')).toBe(false);

    // Switching away from design also clears fullscreen
    fullscreenBtn?.click();
    fixture.detectChanges();
    expect(hostEl.classList.contains('fixed')).toBe(true);

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['selectTab']('overview');
    fixture.detectChanges();
    expect(component['designerState'].fullscreen()).toBe(false);
  });
});
