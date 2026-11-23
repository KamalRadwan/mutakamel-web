import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../public/i18n/en.json';
import designerEn from '../../../../../../public/i18n/templates-designer/en.json';
import fieldsEn from '../../../../../../public/i18n/templates-designer-fields/en.json';
import templatesPageEn from '../../../../../../public/i18n/templates-page/en.json';
import templatesEn from '../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { AssetsApi } from '../assets/assets.api';
import { TemplatePageService } from '../template-page/template-page.service';
import { TemplatesApi } from '../templates.api';
import type {
  TemplateCapabilityState,
  TemplateDataSourceSchemaDto,
  TemplateDefinitionDetail,
  TemplateDocumentV1,
  TemplateDraftDto,
  TemplateVersionDetail,
} from '../templates.model';
import { DesignerState } from './designer-state';

class TestTranslocoLoader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-designer-fields/')) return of(fieldsEn as unknown as Translation);
    if (lang.startsWith('templates-designer/')) return of(designerEn as unknown as Translation);
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as unknown as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as unknown as Translation);
    return of({
      ...globalEn,
      templates: templatesEn,
      templatesPage: templatesPageEn,
      tplDesigner: designerEn,
      tplFields: fieldsEn,
    } as unknown as Translation);
  }
}

const TEMPLATES_BASE = '/api/tenant/core/v1/templates';
const ASSETS_BASE = '/api/tenant/core/v1/templates/assets';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const COMPANY_ID = '01948100-0000-7000-8000-000000009001';
const DRAFT_ID = '01948100-0000-7000-8000-000000002001';
const VERSION_ID = '01948100-0000-7000-8000-000000003001';
const ASSET_ID = '01948100-0000-7000-8000-000000004001';
const BODY_ID = '01948100-0000-7000-8000-000000005001';
const TEXT_ID = '01948100-0000-7000-8000-000000005002';
const SCHEMA_CHECKSUM = 'a'.repeat(64);
const NEXT_SCHEMA_CHECKSUM = 'b'.repeat(64);
const CONTENT_CHECKSUM = 'c'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeDocument(overrides: Partial<TemplateDocumentV1> = {}): TemplateDocumentV1 {
  return {
    schemaVersion: 1,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    locale: 'en-US',
    direction: 'LTR',
    page: {
      unit: 'MM',
      preset: 'A4',
      widthMm: 210,
      heightMm: 297,
      orientation: 'PORTRAIT',
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
    },
    theme: {
      fontFamilyToken: 'SYSTEM_SANS',
      baseFontSizePx: 12,
      textColor: '#12141c',
      lineHeight: 1.4,
    },
    rootNodeIds: [BODY_ID],
    nodes: {
      [BODY_ID]: {
        id: BODY_ID,
        type: 'container',
        parentId: null,
        childIds: [TEXT_ID],
        locked: false,
        hidden: false,
        layout: { kind: 'FLOW', order: 0 },
        style: {},
        props: { semanticRole: 'BODY' },
      },
      [TEXT_ID]: {
        id: TEXT_ID,
        type: 'text',
        parentId: BODY_ID,
        childIds: [],
        locked: false,
        hidden: false,
        layout: { kind: 'FLOW', order: 0 },
        style: {},
        props: { text: 'Original heading' },
      },
    },
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CONTENT_CHECKSUM },
    code: 'SALES_QUOTE',
    name: 'Sales Quotation',
    description: null,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: SCHEMA_CHECKSUM,
    locale: 'en-US',
    direction: 'LTR',
    resolvedDirection: 'LTR',
    scope: { type: 'TENANT' },
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 3,
    etag: '"3"',
    currentDraft: {
      draftId: DRAFT_ID,
      revision: 6,
      contentChecksum: CONTENT_CHECKSUM,
      validationState: 'PASSED',
      etag: '"6"',
    },
    currentPublishedVersion: {
      templateDefinitionId: TEMPLATE_ID,
      templateVersionId: VERSION_ID,
      versionNumber: 1,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      locale: 'en-US',
      direction: 'LTR',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      dataSourceSchemaVersion: 1,
      dataSourceSchemaChecksum: SCHEMA_CHECKSUM,
      templateContentChecksum: CONTENT_CHECKSUM,
      compiledChecksum: 'd'.repeat(64),
      compilerFingerprint: 'compiler-1',
      lifecycleStatus: 'PUBLISHED',
      publishedAt: '2026-11-20T10:00:00Z',
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
    editorDocument: makeDocument(),
    schemaVersion: 1,
    contentChecksum: CONTENT_CHECKSUM,
    baseVersionId: VERSION_ID,
    restoreSourceVersionId: null,
    validation: {
      state: 'PASSED',
      lastValidationRunId: '01948100-0000-7000-8000-000000006001',
      validatedDraftRevision: 6,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 6,
    etag: '"6"',
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    ...overrides,
  };
}

function makeSchema(overrides: Partial<TemplateDataSourceSchemaDto> = {}): TemplateDataSourceSchemaDto {
  return {
    adapterKey: 'TRADE_QUOTATION_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion: 2,
    schemaChecksum: SCHEMA_CHECKSUM,
    documentType: 'QUOTATION',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 1,
    capabilities: {
      draftSavePrecondition: {
        kind: 'draft-schema',
        scope: { type: 'TENANT' },
      },
    },
    fields: [
      {
        path: 'document.number',
        labelKey: 'quotationNumber',
        dataType: 'STRING',
        nullable: false,
        parentNullable: false,
        sensitive: false,
        previewAllowed: true,
        allowedFormats: ['TEXT'],
        valueEncoding: 'UTF8_NFC',
        maxLength: 64,
        minItems: null,
        maxItems: null,
        itemPathPrefix: null,
      },
    ],
    syntheticFixtures: [],
    ...overrides,
  };
}

function makeVersion(overrides: Partial<TemplateVersionDetail> = {}): TemplateVersionDetail {
  return {
    templateDefinitionId: TEMPLATE_ID,
    templateVersionId: VERSION_ID,
    versionNumber: 1,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    locale: 'en-US',
    direction: 'LTR',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: SCHEMA_CHECKSUM,
    templateContentChecksum: CONTENT_CHECKSUM,
    compiledChecksum: 'd'.repeat(64),
    compilerFingerprint: 'compiler-1',
    lifecycleStatus: 'PUBLISHED',
    publishedAt: '2026-11-20T10:00:00Z',
    restoredFromVersionId: null,
    changeNote: 'Initial release',
    publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    retiredAt: null,
    retiredBy: null,
    editorDocument: makeDocument(),
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    compilerVersion: '1.0.0',
    validationRunId: '01948100-0000-7000-8000-000000006001',
    rendererTargets: ['HTML', 'PDF'],
    bindingManifest: [],
    assetManifest: [],
    ...overrides,
  };
}

describe('DesignerState', () => {
  let state: DesignerState;
  let pageService: TemplatePageService;
  let http: HttpTestingController;
  let cookie: string;
  let origCreateObjectUrl: PropertyDescriptor | undefined;
  let origRevokeObjectUrl: PropertyDescriptor | undefined;
  let createObjectUrlMock: ReturnType<typeof vi.fn>;
  let revokeObjectUrlMock: ReturnType<typeof vi.fn>;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.read', 'templates.update'], permissionScopes: {} });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(async () => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

    origCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    origRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    let seq = 0;
    createObjectUrlMock = vi.fn(() => `blob:designer-${++seq}`);
    revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrlMock });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: TestTranslocoLoader,
        }),
        TemplatePageService,
        DesignerState,
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: ScopeState, useValue: { companies: signal([]) } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });

    const doc = TestBed.inject(DOCUMENT);
    const csrfName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${csrfName}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    pageService = TestBed.inject(TemplatePageService);
    state = TestBed.inject(DesignerState);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    http.verify();
    vi.restoreAllMocks();
    if (origCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', origCreateObjectUrl);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (origRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', origRevokeObjectUrl);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function loadEditableQuotation(opts?: {
    def?: TemplateDefinitionDetail;
    draft?: TemplateDraftDto;
    schema?: TemplateDataSourceSchemaDto;
    draftHeaderEtag?: string;
  }): Promise<void> {
    const def = opts?.def ?? makeDefinition();
    const draft = opts?.draft ?? makeDraft();
    const schema = opts?.schema ?? makeSchema();

    const initPromise = state.init(def.templateId);

    const defReq = http.expectOne(`${TEMPLATES_BASE}/${def.templateId}`);
    expect(defReq.request.method).toBe('GET');
    expect(defReq.request.withCredentials).toBe(true);
    defReq.flush({ success: true, data: def }, { headers: { ETag: def.etag } });
    await flushMicrotasks();

    const draftReq = http.expectOne(`${TEMPLATES_BASE}/${def.templateId}/draft`);
    expect(draftReq.request.method).toBe('GET');
    draftReq.flush(
      { success: true, data: draft },
      { headers: { ETag: opts?.draftHeaderEtag ?? draft.etag } },
    );
    await flushMicrotasks();

    const schemaReq = http.expectOne(
      (r) => r.url === `${TEMPLATES_BASE}/data-sources/${def.dataSourceKey}/schema`,
    );
    expect(schemaReq.request.params.get('scopeType')).toBe(def.scope.type);
    expect(schemaReq.request.params.get('companyId')).toBe(
      def.scope.type === 'COMPANY' ? def.scope.companyId : null,
    );
    expect(schemaReq.request.params.get('schemaVersion')).toBe(
      String(def.dataSourceSchemaVersion === 2 ? 2 : 1),
    );
    schemaReq.flush({ success: true, data: schema });

    await initPromise;
  }

  it('loads definition, draft with header ETag, and company-scoped data-source schema via TemplatesApi', async () => {
    const templatesApi = TestBed.inject(TemplatesApi);
    const getTemplateSpy = vi.spyOn(templatesApi, 'getTemplate');
    const getDraftSpy = vi.spyOn(templatesApi, 'getDraft');
    const getSchemaSpy = vi.spyOn(templatesApi, 'getDataSourceSchema');

    const companyDef = makeDefinition({
      scope: { type: 'COMPANY', companyId: COMPANY_ID },
      dataSourceSchemaVersion: 2,
    });
    await loadEditableQuotation({
      def: companyDef,
      draftHeaderEtag: '"7"',
      schema: makeSchema({
        capabilities: {
          draftSavePrecondition: {
            kind: 'draft-schema',
            scope: { type: 'COMPANY', companyId: COMPANY_ID },
          },
        },
      }),
    });

    expect(getTemplateSpy).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(getDraftSpy).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(getSchemaSpy).toHaveBeenCalledWith('TRADE_QUOTATION_PRINT_V1', {
      scopeType: 'COMPANY',
      companyId: COMPANY_ID,
      schemaVersion: 2,
    });
    expect(state.loading()).toBe(false);
    expect(state.loadError()).toBeNull();
    expect(state.readOnly()).toBe(false);
    expect(state.dirty()).toBe(false);
    expect(state.zoom()).toBe(1);
    expect(state.zoomMode()).toBe('MANUAL');
    expect(state.fullscreen()).toBe(false);
    expect(pageService.draft()?.etag).toBe('"7"');
    expect(state.draftSaveIfMatch()).toBe(`"draft-schema:${SCHEMA_CHECKSUM}:7"`);
  });

  it('defaults to 100% MANUAL zoom and resets zoom, zoomMode, and fullscreen on template load and resetForTemplate', async () => {
    expect(state.zoom()).toBe(1);
    expect(state.zoomMode()).toBe('MANUAL');
    expect(state.fullscreen()).toBe(false);

    state.zoom.set(1.84);
    state.zoomMode.set('FIT_WIDTH');

    await loadEditableQuotation();

    expect(state.zoom()).toBe(1);
    expect(state.zoomMode()).toBe('MANUAL');

    state.zoom.set(2);
    state.zoomMode.set('FIT_PAGE');
    state.fullscreen.set(true);

    state.resetForTemplate();

    expect(state.zoom()).toBe(1);
    expect(state.zoomMode()).toBe('MANUAL');
    expect(state.fullscreen()).toBe(false);
  });

  it('falls back to published version via getVersion when getDraft returns 403, and handles noPublished', async () => {
    const templatesApi = TestBed.inject(TemplatesApi);
    const getVersionSpy = vi.spyOn(templatesApi, 'getVersion');

    const initPromise = state.init(TEMPLATE_ID);
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}`).flush(
      { success: true, data: makeDefinition() },
      { headers: { ETag: '"3"' } },
    );
    await flushMicrotasks();

    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush(
      { errorCode: 'CORE.TEMPLATE.PERMISSION.DENIED' },
      { status: 403, statusText: 'Forbidden' },
    );
    await flushMicrotasks();

    const versionReq = http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/versions/${VERSION_ID}`);
    expect(versionReq.request.method).toBe('GET');
    versionReq.flush({ success: true, data: makeVersion({ dataSourceSchemaVersion: 1 }) });
    await flushMicrotasks();

    const schemaReq = http.expectOne(
      (r) => r.url === `${TEMPLATES_BASE}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`,
    );
    expect(schemaReq.request.params.get('schemaVersion')).toBe('1');
    schemaReq.flush({ success: true, data: makeSchema({ schemaVersion: 1 }) });
    await initPromise;

    expect(getVersionSpy).toHaveBeenCalledWith(TEMPLATE_ID, VERSION_ID);
    expect(pageService.draftAccessForbidden()).toBe(true);
    expect(state.readOnly()).toBe(true);
    expect(state.noPublished()).toBe(false);
    expect(state.document()).not.toBeNull();

    // Reset and load a read-only definition without a published version.
    state.resetForTemplate();
    pageService.resetForTemplate();
    const otherId = '01948100-0000-7000-8000-000000001099';
    const noPubPromise = state.init(otherId);
    http.expectOne(`${TEMPLATES_BASE}/${otherId}`).flush({
      success: true,
      data: makeDefinition({
        templateId: otherId,
        currentPublishedVersion: null,
        capabilities: {
          ...makeDefinition().capabilities,
          update: { state: 'DISABLED', reason: 'ACCESS_POLICY_READ_ONLY' },
        },
      }),
    });
    await noPubPromise;

    expect(state.readOnly()).toBe(true);
    expect(state.noPublished()).toBe(true);
    expect(state.document()).toBeNull();
  });

  it('maps 404, 403, and 503 load errors with correlationId, and degrades gracefully when schema fails', async () => {
    await state.init('');
    expect(state.loadError()).toBe('notFound');
    http.expectNone(() => true);

    for (const [status, errorCode, expected] of [
      [404, 'CORE.TEMPLATE.NOT_FOUND', 'notFound'],
      [403, 'CORE.TEMPLATE.PERMISSION.DENIED', 'forbidden'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', 'loadFailed'],
    ] as const) {
      state.resetForTemplate();
      const pending = state.init(TEMPLATE_ID);
      http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}`).flush(
        { errorCode, correlationId: 'corr-load-1' },
        { status, statusText: 'Error' },
      );
      await pending;
      expect(state.loadError()).toBe(expected);
      expect(state.loadCorrelationId()).toBe('corr-load-1');
    }

    // Schema failure keeps canvas loaded and disables schema-bound tools.
    state.resetForTemplate();
    const okLoad = state.init(TEMPLATE_ID);
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    await flushMicrotasks();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });
    await flushMicrotasks();
    http
      .expectOne((r) => r.url === `${TEMPLATES_BASE}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`)
      .flush({ errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await okLoad;

    expect(state.loadError()).toBeNull();
    expect(state.schema()).toBeNull();
    expect(state.schemaFailed()).toBe(true);
    expect(state.toolState('DATA_FIELD')).toEqual({ state: 'DISABLED', reasonKey: 'schemaUnavailable' });
  });

  it('saves draft via patchDraft with draft-schema If-Match, UUIDv7 idempotency, optimistic revisions, and migration toast', async () => {
    await loadEditableQuotation();

    state.updateNode(TEXT_ID, { props: { text: 'Updated heading' } });
    expect(state.dirty()).toBe(true);

    const savePromise = state.save();
    const patchReq = http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.withCredentials).toBe(true);
    expect(patchReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(patchReq.request.headers.get('If-Match')).toBe(`"draft-schema:${SCHEMA_CHECKSUM}:6"`);
    const firstKey = patchReq.request.headers.get('x-idempotency-key');
    expect(firstKey).toMatch(UUID_V7);
    expect(patchReq.request.body.clientMutationId).toMatch(UUID_V7);
    expect(patchReq.request.body.editorDocument.nodes[TEXT_ID].props.text).toBe('Updated heading');

    const savedDoc = makeDocument();
    savedDoc.nodes[TEXT_ID] = {
      ...savedDoc.nodes[TEXT_ID],
      type: 'text',
      props: { text: 'Updated heading' },
    };
    const nextDraft = makeDraft({
      editorDocument: savedDoc,
      revision: 7,
      etag: '"7"',
      contentChecksum: 'e'.repeat(64),
      validation: {
        state: 'STALE',
        lastValidationRunId: null,
        validatedDraftRevision: null,
        errorCount: 0,
        warningCount: 0,
      },
    });
    patchReq.flush(
      {
        success: true,
        data: {
          draft: nextDraft,
          thumbnail: { state: 'PENDING', sourceChecksum: nextDraft.contentChecksum },
          migrationRecovery: {
            snapshotId: '01948100-0000-7000-8000-000000007001',
            fromSchemaVersion: 1,
            toSchemaVersion: 1,
            sourceDraftRevision: 6,
            sourceContentChecksum: CONTENT_CHECKSUM,
            expiresAt: '2026-12-23T10:00:00Z',
          },
        },
      },
      { status: 200, statusText: 'OK', headers: { ETag: '"8"' } },
    );

    expect(await savePromise).toBe(true);
    expect(state.dirty()).toBe(false);
    expect(pageService.draft()?.revision).toBe(7);
    expect(pageService.draft()?.etag).toBe('"8"');
    expect(pageService.definition()?.currentDraft.revision).toBe(7);
    expect(pageService.definition()?.currentDraft.etag).toBe('"8"');
    expect(pageService.definition()?.capabilities.publish).toEqual({
      state: 'DISABLED',
      reason: 'VALIDATION_REQUIRED',
    });
    expect(notify.info).toHaveBeenCalledWith(designerEn.toasts.migrated);

    // Subsequent edit uses updated optimistic revision ("8") and a fresh idempotency key.
    state.updateNode(TEXT_ID, { props: { text: 'Second edit' } });
    const secondSave = state.save();
    const secondReq = http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`);
    expect(secondReq.request.headers.get('If-Match')).toBe(`"draft-schema:${SCHEMA_CHECKSUM}:8"`);
    expect(secondReq.request.headers.get('x-idempotency-key')).not.toBe(firstKey);
    secondReq.flush(
      {
        success: true,
        data: {
          draft: makeDraft({
            ...nextDraft,
            revision: 9,
            etag: '"9"',
            editorDocument: secondReq.request.body.editorDocument,
          }),
          thumbnail: { state: 'PENDING', sourceChecksum: 'f'.repeat(64) },
          migrationRecovery: null,
        },
      },
      { status: 200, statusText: 'OK', headers: { ETag: '"9"' } },
    );
    expect(await secondSave).toBe(true);
  });

  it('retains idempotency key and clientMutationId across retryable save errors, and rotates after terminal failure', async () => {
    const invoiceDoc = makeDocument({ documentType: 'INVOICE', dataSourceKey: 'TRADE_INVOICE_PRINT_V1' });
    await loadEditableQuotation({
      def: makeDefinition({ documentType: 'INVOICE', dataSourceKey: 'TRADE_INVOICE_PRINT_V1', dataSourceSchemaVersion: 1 }),
      draft: makeDraft({ editorDocument: invoiceDoc }),
      schema: makeSchema({
        adapterKey: 'TRADE_INVOICE_PRINT_V1',
        documentType: 'INVOICE',
        schemaVersion: 1,
        capabilities: undefined,
      }),
    });

    state.updateNode(TEXT_ID, { props: { text: 'Retryable edit' } });

    let heldKey: string | null = null;
    let heldMutationId: string | null = null;

    for (const [status, code, expectedMsg] of [
      [0, 'NETWORK_ERROR', globalEn.apiErrors.network],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', templatesEn.errors['CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE']],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT', templatesEn.errors['CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT']],
      [401, 'COMMON.GENERIC.UNAUTHORIZED', globalEn.apiErrors.notSaved],
    ] as const) {
      notify.error.mockClear();
      const pending = state.save();
      const req = http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`);
      expect(req.request.headers.get('If-Match')).toBe('"6"');
      const key = req.request.headers.get('x-idempotency-key');
      const mutationId = req.request.body.clientMutationId as string;
      expect(key).toMatch(UUID_V7);
      expect(mutationId).toMatch(UUID_V7);
      if (heldKey) {
        expect(key).toBe(heldKey);
        expect(mutationId).toBe(heldMutationId);
      }
      heldKey = key;
      heldMutationId = mutationId;

      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Failed' });

      expect(await pending).toBe(false);
      expect(notify.error).toHaveBeenCalledWith(expectedMsg);
    }

    // Terminal 404 uses the held key once, then clears it so the next attempt rotates.
    const terminalAttempt = state.save();
    const termReq = http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`);
    expect(termReq.request.headers.get('x-idempotency-key')).toBe(heldKey);
    termReq.flush({ errorCode: 'CORE.TEMPLATE.NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    expect(await terminalAttempt).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.NOT_FOUND']);

    const rotatedAttempt = state.save();
    const rotatedReq = http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`);
    expect(rotatedReq.request.headers.get('x-idempotency-key')).not.toBe(heldKey);
    expect(rotatedReq.request.body.clientMutationId).not.toBe(heldMutationId);
    rotatedReq.flush(
      {
        success: true,
        data: {
          draft: makeDraft({ revision: 7, etag: '"7"', editorDocument: rotatedReq.request.body.editorDocument }),
          thumbnail: { state: 'PENDING', sourceChecksum: CONTENT_CHECKSUM },
          migrationRecovery: null,
        },
      },
      { status: 200, statusText: 'OK', headers: { ETag: '"7"' } },
    );
    expect(await rotatedAttempt).toBe(true);
  });

  it('handles STALE_REVISION conflict, SCHEMA_CHANGED reload with fresh schema checksum, 422 SCHEMA.INVALID, and 413', async () => {
    await loadEditableQuotation();
    state.updateNode(TEXT_ID, { props: { text: 'Conflict edit' } });

    // 1. 409 STALE_REVISION opens conflict modal.
    const staleSave = state.save();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush(
      { errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(await staleSave).toBe(false);
    expect(pageService.conflictOpen()).toBe(true);
    pageService.closeConflict();

    // 2. 422 SCHEMA.INVALID includes correlation support reference.
    const invalidSave = state.save();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush(
      { errorCode: 'CORE.TEMPLATE.SCHEMA.INVALID', correlationId: 'corr-422' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(await invalidSave).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(
      designerEn.errors.saveInvalid,
      'Support reference: corr-422',
    );

    // 3. 413 payload too large.
    const largeSave = state.save();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush(
      { code: 'GW.BODY.TOO_LARGE' },
      { status: 413, statusText: 'Payload Too Large' },
    );
    expect(await largeSave).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(designerEn.errors.tooLarge);

    // 4. 409 SCHEMA_CHANGED clears schema cache, reloads definition/draft/schema, and updates draft-schema If-Match.
    const schemaChangedSave = state.save();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush(
      { errorCode: 'CORE.TEMPLATE.CONCURRENCY.SCHEMA_CHANGED' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(await schemaChangedSave).toBe(false);
    expect(notify.warning).toHaveBeenCalledWith(designerEn.errors.schemaChanged);

    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}`).flush({
      success: true,
      data: makeDefinition({ dataSourceSchemaChecksum: NEXT_SCHEMA_CHECKSUM }),
    });
    await flushMicrotasks();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush({
      success: true,
      data: makeDraft({ revision: 8, etag: '"8"' }),
    });
    await flushMicrotasks();
    http
      .expectOne((r) => r.url === `${TEMPLATES_BASE}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`)
      .flush({ success: true, data: makeSchema({ schemaChecksum: NEXT_SCHEMA_CHECKSUM }) });
    await flushMicrotasks();

    expect(state.draftSaveIfMatch()).toBe(`"draft-schema:${NEXT_SCHEMA_CHECKSUM}:8"`);
  });

  it('loads binary asset content via AssetsApi, deduplicates requests, retries failed assets on reload, and revokes URLs', async () => {
    const assetsApi = TestBed.inject(AssetsApi);
    const contentSpy = vi.spyOn(assetsApi, 'getAssetContent');

    await loadEditableQuotation();

    state.requestAsset(ASSET_ID);
    state.requestAsset(ASSET_ID);
    await flushMicrotasks();

    expect(state.assetEntry(ASSET_ID)).toEqual({ status: 'LOADING', url: null });
    const blobReq = http.expectOne(`${ASSETS_BASE}/${ASSET_ID}/content`);
    expect(blobReq.request.method).toBe('GET');
    expect(blobReq.request.responseType).toBe('blob');
    expect(blobReq.request.withCredentials).toBe(true);
    const pngBlob = new Blob(['png-bytes'], { type: 'image/png' });
    blobReq.flush(pngBlob);
    await flushMicrotasks();

    expect(contentSpy).toHaveBeenCalledTimes(1);
    expect(contentSpy).toHaveBeenCalledWith(ASSET_ID);
    expect(state.assetEntry(ASSET_ID)).toEqual({ status: 'READY', url: 'blob:designer-1' });

    // Failed asset transitions to ERROR and is eligible for retry after reload().
    const badAssetId = '01948100-0000-7000-8000-000000004099';
    state.requestAsset(badAssetId);
    await flushMicrotasks();
    http
      .expectOne(`${ASSETS_BASE}/${badAssetId}/content`)
      .flush(new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.NOT_FOUND' })], { type: 'application/json' }), {
        status: 404,
        statusText: 'Not Found',
      });
    await flushMicrotasks();
    expect(state.assetEntry(badAssetId)).toEqual({ status: 'ERROR', url: null });

    const reloadPromise = state.reload();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    await flushMicrotasks();
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });
    await flushMicrotasks();
    http
      .expectOne((r) => r.url === `${TEMPLATES_BASE}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`)
      .flush({ success: true, data: makeSchema() });
    await reloadPromise;

    state.requestAsset(badAssetId);
    await flushMicrotasks();
    http.expectOne(`${ASSETS_BASE}/${badAssetId}/content`).flush(new Blob(['png-2'], { type: 'image/png' }));
    await flushMicrotasks();
    expect(state.assetEntry(badAssetId)).toEqual({ status: 'READY', url: 'blob:designer-2' });

    // Reset revokes all created object URLs and ignores stale in-flight completions.
    const lateAssetId = '01948100-0000-7000-8000-000000004077';
    state.requestAsset(lateAssetId);
    await flushMicrotasks();
    const lateReq = http.expectOne(`${ASSETS_BASE}/${lateAssetId}/content`);

    state.resetForTemplate();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:designer-1');
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:designer-2');

    lateReq.flush(new Blob(['late'], { type: 'image/png' }));
    await flushMicrotasks();
    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
  });
});
