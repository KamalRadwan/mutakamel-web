import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import templatesPageEn from '../../../../../../../public/i18n/templates-page/en.json';
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
  TemplateVersionDetail,
  TemplateVersionItem,
} from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { VersionsTab } from './versions-tab';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({ ...globalEn, templates: templatesEn, templatesPage: templatesPageEn } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const OTHER_TEMPLATE_ID = '01948100-0000-7000-8000-000000001002';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const VERSION_1_ID = '01948100-0000-7000-8000-000000002001';
const VERSION_2_ID = '01948100-0000-7000-8000-000000002002';
const SNAPSHOT_ID = '01948100-0000-7000-8000-000000004001';
const CHECKSUM = 'a'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED', reason: string | null = null) {
  return { state, reason };
}

function makeVersionItem(overrides: Partial<TemplateVersionItem> = {}): TemplateVersionItem {
  return {
    templateDefinitionId: TEMPLATE_ID,
    templateVersionId: VERSION_1_ID,
    versionNumber: 1,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    locale: 'en-US',
    direction: 'LTR',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: CHECKSUM,
    templateContentChecksum: CHECKSUM,
    compiledChecksum: CHECKSUM,
    compilerFingerprint: 'fp-1',
    lifecycleStatus: 'PUBLISHED',
    publishedAt: '2026-11-20T10:00:00Z',
    restoredFromVersionId: null,
    changeNote: 'Initial release',
    publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    retiredAt: null,
    retiredBy: null,
    ...overrides,
  };
}

function makeVersionDetail(overrides: Partial<TemplateVersionDetail> = {}): TemplateVersionDetail {
  return {
    ...makeVersionItem(),
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
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    compilerVersion: '1.0.0',
    validationRunId: '01948100-0000-7000-8000-000000006001',
    rendererTargets: ['HTML', 'PDF'],
    bindingManifest: [{ path: 'quote.number', format: 'TEXT', nodeIds: [] } as unknown as TemplateVersionDetail['bindingManifest'][number]],
    assetManifest: [{ assetId: '01948100-0000-7000-8000-000000007001', nodeId: 'node-1' }],
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: 'SALES_QUOTATION',
    name: 'Sales Quotation',
    description: null,
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
    currentPublishedVersion: {
      templateDefinitionId: TEMPLATE_ID,
      templateVersionId: VERSION_2_ID,
      versionNumber: 2,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      locale: 'en-US',
      direction: 'LTR',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      dataSourceSchemaVersion: 1,
      dataSourceSchemaChecksum: CHECKSUM,
      templateContentChecksum: CHECKSUM,
      compiledChecksum: CHECKSUM,
      compilerFingerprint: 'fp-1',
      lifecycleStatus: 'PUBLISHED',
      publishedAt: '2026-11-21T10:00:00Z',
    },
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
      restoreVersion: cap('ENABLED'),
      manageRecovery: cap('ENABLED'),
      restoreRecovery: cap('ENABLED'),
      manageAssets: cap('ENABLED'),
      retireVersion: cap('ENABLED'),
      archive: cap('ENABLED'),
      restore: cap('HIDDEN'),
      delete: cap('DISABLED'),
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
    baseVersionId: VERSION_2_ID,
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
    sourceDraftRevision: 3,
    sourceSchemaVersion: 1,
    targetSchemaVersion: 1,
    sourceContentChecksum: CHECKSUM,
    snapshotChecksum: 'b'.repeat(64),
    captureReason: 'PRE_SCHEMA_MIGRATION',
    captureAuditId: '01948100-0000-7000-8000-000000005001',
    createdAt: '2026-11-22T11:00:00Z',
    createdBy: 'actor-recovery-creator',
    expiresAt: '2026-12-22T11:00:00Z',
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

describe('VersionsTab', () => {
  let fixture: ComponentFixture<VersionsTab>;
  let component: VersionsTab;
  let service: TemplatePageService;
  let http: HttpTestingController;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.read'], permissionScopes: {} });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(() => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

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
      imports: [VersionsTab],
      providers: [
        TemplatePageService,
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
    service = TestBed.inject(TemplatePageService);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  function mount(
    def = makeDefinition(),
    versions: TemplateVersionItem[] = [makeVersionItem(), makeVersionItem({ templateVersionId: VERSION_2_ID, versionNumber: 2 })],
    draft: TemplateDraftDto | null = makeDraft(),
  ): void {
    service.syncFromDefinition(def);
    service.setDraft(draft);
    service.versions.set(versions);
    fixture = TestBed.createComponent(VersionsTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads true detailed version fields and rejects summary-only payloads without detailed fields', async () => {
    const v1 = makeVersionItem();
    const v2 = makeVersionItem({ templateVersionId: VERSION_2_ID, versionNumber: 2 });
    mount(makeDefinition(), [v1, v2]);

    const detail = makeVersionDetail();
    const viewPromise = component['openViewModal'](v1);
    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: detail });
    await viewPromise;

    expect(component['viewingVersion']()).toEqual(detail);
    expect(component['loadingView']()).toBe(false);
    expect(component['viewModal']()['dialog']().nativeElement.open).toBe(true);

    const badPromise = component['openViewModal'](v2);
    const badReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_2_ID}`);
    badReq.flush({ success: true, data: v2 });
    await badPromise;

    expect(component['viewingVersion']()).toBeNull();
    expect(component['viewModal']()['dialog']().nativeElement.open).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors.generic);
  });

  it('restores a historical version with draft If-Match, preserves header ETag, and refreshes definition and recovery snapshots', async () => {
    const v1 = makeVersionItem();
    mount(makeDefinition(), [v1]);

    component['openRestoreModal'](v1);
    component['restoreReason'].set('  Rollback to v1  ');
    component['restoreDiscardDraft'].set(true);

    const restoredDraft = makeDraft({
      revision: 4,
      etag: '"3"',
      restoreSourceVersionId: VERSION_1_ID,
      validation: { state: 'STALE', lastValidationRunId: null, validatedDraftRevision: null, errorCount: 0, warningCount: 0 },
    });
    const refreshedDef = makeDefinition({
      revision: 2,
      etag: '"2"',
      currentDraft: {
        draftId: DRAFT_ID,
        revision: 4,
        contentChecksum: CHECKSUM,
        validationState: 'STALE',
        etag: '"4"',
      },
    });

    const restorePromise = component['submitRestore']();
    const restoreReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/restore`);
    expect(restoreReq.request.method).toBe('POST');
    expect(restoreReq.request.headers.get('If-Match')).toBe('"3"');
    expect(restoreReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(restoreReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(restoreReq.request.body).toEqual({ reason: 'Rollback to v1', discardCurrentDraft: true });
    restoreReq.flush(
      { success: true, data: { draft: restoredDraft, migrationRecovery: null } },
      { headers: { ETag: '"4"' } },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: refreshedDef }, { headers: { ETag: '"2"' } });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`).flush({
      success: true,
      data: { items: [makeWireSnapshot()], pageInfo: { limit: 20, hasNextPage: false, nextCursor: null } },
    });
    await restorePromise;

    expect(service.draft()?.revision).toBe(4);
    expect(service.draft()?.etag).toBe('"4"');
    expect(service.definition()?.currentDraft.revision).toBe(4);
    expect(service.snapshots()[0]?.createdBy).toEqual({
      kind: 'USER',
      actorId: 'actor-recovery-creator',
      displayName: 'actor-recovery-creator',
    });
    expect(component['restoreModal']()['dialog']().nativeElement.open).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Version v1 restored to working draft');
  });

  it('retains idempotency key on retryable/401 restore errors, rotates after terminal error, and opens conflict on stale revision', async () => {
    const v1 = makeVersionItem();
    mount(makeDefinition(), [v1]);

    component['openRestoreModal'](v1);
    component['restoreReason'].set('Rollback reason');
    component['restoreDiscardDraft'].set(true);

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['submitRestore']();
      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/restore`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
      if (status === 401) expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.notSaved);
      else expect(notify.error).toHaveBeenCalled();
    }

    const terminal = component['submitRestore']();
    const sameReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/restore`);
    expect(sameReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    sameReq.flush(
      { errorCode: 'CORE.TEMPLATE.VERSION.RESTORE_CURRENT' },
      { status: 409, statusText: 'Conflict' },
    );
    await terminal;
    expect(notify.error).toHaveBeenCalledWith(templatesPageEn.errors['CORE.TEMPLATE.VERSION.RESTORE_CURRENT']);

    const stale = component['submitRestore']();
    const rotatedReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/restore`);
    expect(rotatedReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    rotatedReq.flush(
      { errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' },
      { status: 409, statusText: 'Conflict' },
    );
    await stale;

    expect(component['restoreModal']()['dialog']().nativeElement.open).toBe(false);
    expect(service.conflictOpen()).toBe(true);
  });

  it('retires a version with definition If-Match, empty body, updates ETag/list, and handles stale revision and domain errors', async () => {
    const v1 = makeVersionItem();
    const v2 = makeVersionItem({ templateVersionId: VERSION_2_ID, versionNumber: 2 });
    mount(makeDefinition(), [v1, v2]);

    vi.spyOn(component['retireConfirm'](), 'open').mockResolvedValue(true);
    const retiredV1 = makeVersionItem({
      lifecycleStatus: 'RETIRED',
      retiredAt: '2026-11-23T12:00:00Z',
      retiredBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    });
    const refreshedDef = makeDefinition({ revision: 3, etag: '"3"' });

    const retirePromise = component['confirmRetire'](v1);
    await Promise.resolve();
    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/retire`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('If-Match')).toBe('"2"');
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(req.request.body).toBeNull();
    req.flush(
      { success: true, data: { version: retiredV1, definitionRevision: 3, definitionEtag: '"2"' } },
      { headers: { ETag: '"3"' } },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: refreshedDef }, { headers: { ETag: '"3"' } });
    await retirePromise;

    expect(service.versions()[0]?.lifecycleStatus).toBe('RETIRED');
    expect(service.definition()?.revision).toBe(3);
    expect(service.definition()?.etag).toBe('"3"');
    expect(notify.success).toHaveBeenCalledWith('Version v1 retired');

    const v3 = makeVersionItem({ templateVersionId: '01948100-0000-7000-8000-000000002003', versionNumber: 3 });
    service.versions.update((items) => [...items, v3]);

    const conflictPromise = component['confirmRetire'](v3);
    await Promise.resolve();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${v3.templateVersionId}/retire`).flush(
      { errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' },
      { status: 409, statusText: 'Conflict' },
    );
    await conflictPromise;
    expect(service.conflictOpen()).toBe(true);

    const retiredErrPromise = component['confirmRetire'](v3);
    await Promise.resolve();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${v3.templateVersionId}/retire`).flush(
      { errorCode: 'CORE.TEMPLATE.VERSION.RETIRED' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await retiredErrPromise;
    expect(notify.error).toHaveBeenCalledWith(templatesPageEn.errors['CORE.TEMPLATE.VERSION.RETIRED']);
  });

  it('paginates versions with cursor params and recovers from CURSOR.INVALID on the first page', async () => {
    const v1 = makeVersionItem();
    const v2 = makeVersionItem({ templateVersionId: VERSION_2_ID, versionNumber: 2 });
    mount(makeDefinition(), [v2]);
    service.versionsHasNext.set(true);
    service.versionsNextCursor.set('cursor-2');

    const nextPromise = component['nextPage']();
    const nextReq = http.expectOne((r) => r.url === `${BASE_URL}/${TEMPLATE_ID}/versions`);
    expect(nextReq.request.params.get('cursor')).toBe('cursor-2');
    expect(nextReq.request.params.get('limit')).toBe('25');
    nextReq.flush({
      success: true,
      data: { items: [v1], pageInfo: { limit: 25, hasNextPage: true, nextCursor: 'cursor-3' } },
    });
    await nextPromise;

    expect(service.versions()).toEqual([v1]);
    expect(component['cursorStack']()).toEqual([null]);
    expect(component['currentCursor']()).toBe('cursor-2');

    const prevPromise = component['prevPage']();
    const prevReq = http.expectOne((r) => r.url === `${BASE_URL}/${TEMPLATE_ID}/versions`);
    expect(prevReq.request.params.get('cursor')).toBeNull();
    expect(prevReq.request.params.get('limit')).toBe('25');
    prevReq.flush({
      success: true,
      data: { items: [v2], pageInfo: { limit: 25, hasNextPage: true, nextCursor: 'cursor-expired' } },
    });
    await prevPromise;

    const invalidPromise = component['nextPage']();
    const expiredReq = http.expectOne((r) => r.url === `${BASE_URL}/${TEMPLATE_ID}/versions`);
    expect(expiredReq.request.params.get('cursor')).toBe('cursor-expired');
    expiredReq.flush({ errorCode: 'CORE.TEMPLATE.CURSOR.INVALID' }, { status: 400, statusText: 'Bad Request' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const recoveryReq = http.expectOne((r) => r.url === `${BASE_URL}/${TEMPLATE_ID}/versions`);
    expect(recoveryReq.request.params.get('cursor')).toBeNull();
    expect(recoveryReq.request.params.get('limit')).toBe('25');
    recoveryReq.flush({
      success: true,
      data: { items: [v2], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    await invalidPromise;

    expect(component['currentCursor']()).toBeNull();
    expect(component['cursorStack']()).toEqual([]);
    expect(service.versions()).toEqual([v2]);
  });

  it('keeps a successful restore and its header ETag when both refresh requests fail', async () => {
    const v1 = makeVersionItem();
    mount(makeDefinition(), [v1]);
    component['openRestoreModal'](v1);
    component['restoreReason'].set('Restore');
    component['restoreDiscardDraft'].set(true);

    const pending = component['submitRestore']();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/restore`).flush(
      { success: true, data: { draft: makeDraft({ revision: 4 }), migrationRecovery: null } },
      { headers: { ETag: '"4"' } },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const url of [`${BASE_URL}/${TEMPLATE_ID}`, `${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`]) {
      http.expectOne(url).flush(
        { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    }
    await pending;

    expect(service.draft()?.revision).toBe(4);
    expect(service.draft()?.etag).toBe('"4"');
    expect(component['restoreModal']()['dialog']().nativeElement.open).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE']);
    expect(notify.success).toHaveBeenCalledWith('Version v1 restored to working draft');
  });

  it('retries retirement with the same key and retains the receipt if definition refresh fails', async () => {
    const v1 = makeVersionItem();
    mount(makeDefinition(), [v1]);
    vi.spyOn(component['retireConfirm'](), 'open').mockResolvedValue(true);

    const retry = component['confirmRetire'](v1);
    await Promise.resolve();
    const first = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/retire`);
    const key = first.request.headers.get('x-idempotency-key');
    first.error(new ProgressEvent('error'));
    await retry;

    const pending = component['confirmRetire'](v1);
    await Promise.resolve();
    const second = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}/retire`);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    second.flush({ success: true, data: {
      version: makeVersionItem({ lifecycleStatus: 'RETIRED' }),
      definitionRevision: 3,
      definitionEtag: '"2"',
    } }, { headers: { ETag: '"3"' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await pending;

    expect(service.definition()?.etag).toBe('"3"');
    expect(service.definition()?.revision).toBe(3);
    expect(service.versions()[0]?.lifecycleStatus).toBe('RETIRED');
    expect(notify.success).toHaveBeenCalledWith('Version v1 retired');
  });

  it('guards unknown capability reasons and ignores late responses after template navigation', async () => {
    const v1 = makeVersionItem();
    const defWithUnknownReason = makeDefinition({
      capabilities: {
        ...makeDefinition().capabilities,
        restoreVersion: cap('DISABLED', 'UNKNOWN_BACKEND_REASON'),
        retireVersion: cap('DISABLED', 'ACCESS_POLICY_READ_ONLY'),
      },
    });
    mount(defWithUnknownReason, [v1]);

    const actions = component['actionsFor'](v1);
    expect(actions.find((item) => item.id === 'restore')?.reason).toBeUndefined();
    expect(actions.find((item) => item.id === 'retire')?.reason).toBe(
      templatesPageEn.header.capabilities.ACCESS_POLICY_READ_ONLY,
    );

    const viewPromise = component['openViewModal'](v1);
    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_1_ID}`);
    service.syncFromDefinition(makeDefinition({ templateId: OTHER_TEMPLATE_ID }));
    fixture.detectChanges();
    req.flush({ success: true, data: makeVersionDetail() });
    await viewPromise;

    expect(component['viewingVersion']()).toBeNull();
    expect(component['cursorStack']()).toEqual([]);
    expect(component['currentCursor']()).toBeNull();
  });
});
