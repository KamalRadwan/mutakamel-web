import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco, type Translation } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalAr from '../../../../../../../public/i18n/ar.json';
import globalEn from '../../../../../../../public/i18n/en.json';
import templatesPageAr from '../../../../../../../public/i18n/templates-page/ar.json';
import templatesPageEn from '../../../../../../../public/i18n/templates-page/en.json';
import templatesPreviewAr from '../../../../../../../public/i18n/templates-preview/ar.json';
import templatesPreviewEn from '../../../../../../../public/i18n/templates-preview/en.json';
import templatesAr from '../../../../../../../public/i18n/templates/ar.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { PDF_POLL_FAST_MS } from '../../preview/pdf-job';
import type {
  TemplateCapabilityState,
  TemplateDataSourceSchemaDto,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateEmailPreviewResponseDto,
  TemplateHtmlPreviewResponseDto,
  TemplatePdfJobDto,
  TemplatePdfPreviewAcceptedDto,
  TemplateVersionDetail,
  TemplateVersionItem,
} from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { PreviewTab } from './preview-tab';

@Injectable()
class SpecTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    const isAr = lang === 'ar' || lang.endsWith('/ar');
    if (lang.startsWith('templates-preview/')) {
      return Promise.resolve((isAr ? templatesPreviewAr : templatesPreviewEn) as Translation);
    }
    if (lang.startsWith('templates-page/')) {
      return Promise.resolve((isAr ? templatesPageAr : templatesPageEn) as Translation);
    }
    if (lang.startsWith('templates/')) {
      return Promise.resolve((isAr ? templatesAr : templatesEn) as Translation);
    }
    if (isAr) {
      return Promise.resolve({
        ...globalAr,
        templates: templatesAr,
        templatesPage: templatesPageAr,
        tplPreview: templatesPreviewAr,
      } as Translation);
    }
    return Promise.resolve({
      ...globalEn,
      templates: templatesEn,
      templatesPage: templatesPageEn,
      tplPreview: templatesPreviewEn,
    } as Translation);
  }
}

const BASE = '/api/tenant/core/v1/templates';
const PRINT_ID = '01948100-0000-7000-8000-000000001001';
const EMAIL_ID = '01948100-0000-7000-8000-000000001009';
const COMPANY_ID = '01948100-0000-7000-8000-000000004001';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const VERSION_ID = '01948100-0000-7000-8000-000000002001';
const CHECKSUM = 'b'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED', reason: string | null = null) {
  return { state, reason: state === 'ENABLED' ? null : reason };
}

function makePrintDoc(): TemplateDraftDto['editorDocument'] {
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
      lineHeight: 1.5,
    },
    rootNodeIds: [],
    nodes: {},
  };
}

function makeEmailDoc(): TemplateDraftDto['editorDocument'] {
  return {
    schemaVersion: 1,
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
    locale: 'en-US',
    direction: 'LTR',
    email: {
      maxWidthPx: 600,
      subject: { segments: [{ kind: 'TEXT', value: 'Welcome' }] },
      preheader: { segments: [{ kind: 'TEXT', value: 'Summary' }] },
    },
    theme: {
      fontFamilyToken: 'SYSTEM_SANS',
      baseFontSizePx: 14,
      textColor: '#12141c',
      lineHeight: 1.5,
    },
    rootNodeIds: [],
    nodes: {},
  };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: PRINT_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: 'CORP_QUOTE',
    name: 'Corporate Quotation',
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
      revision: 4,
      contentChecksum: CHECKSUM,
      validationState: 'PASSED',
      etag: '"4"',
    },
    currentPublishedVersion: {
      templateDefinitionId: PRINT_ID,
      templateVersionId: VERSION_ID,
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
      publishedAt: '2026-11-20T10:00:00.000Z',
    },
    createdAt: '2026-11-20T10:00:00.000Z',
    createdBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    updatedAt: '2026-11-22T10:00:00.000Z',
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
    templateId: PRINT_ID,
    editorDocument: makePrintDoc(),
    schemaVersion: 1,
    contentChecksum: CHECKSUM,
    baseVersionId: VERSION_ID,
    restoreSourceVersionId: null,
    validation: {
      state: 'PASSED',
      lastValidationRunId: '01948100-0000-7000-8000-000000005001',
      validatedDraftRevision: 4,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 4,
    etag: '"4"',
    updatedAt: '2026-11-22T10:00:00.000Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    ...overrides,
  };
}

function makeSchema(
  adapterKey: TemplateDefinitionDetail['dataSourceKey'] = 'TRADE_QUOTATION_PRINT_V1',
  schemaVersion = 1,
  fixtures: TemplateDataSourceSchemaDto['syntheticFixtures'] = [
    {
      fixtureKey: 'trade.quotation.ar-EG.standard',
      locale: 'ar-EG',
      labelKey: 'template.fixture.salesStandardAr',
      fixtureChecksum: CHECKSUM,
    },
    {
      fixtureKey: 'trade.quotation.en-US.standard',
      locale: 'en-US',
      labelKey: 'template.fixture.salesStandardEn',
      fixtureChecksum: CHECKSUM,
    },
  ],
): TemplateDataSourceSchemaDto {
  return {
    adapterKey,
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion,
    schemaChecksum: CHECKSUM,
    documentType: adapterKey === 'CRM_LEAD_OUTBOUND_EMAIL_V1' ? 'CRM_OUTBOUND_EMAIL' : 'QUOTATION',
    allowedOutputChannels: adapterKey === 'CRM_LEAD_OUTBOUND_EMAIL_V1' ? ['EMAIL'] : ['PRINT'],
    allowedLayoutModes: adapterKey === 'CRM_LEAD_OUTBOUND_EMAIL_V1' ? ['EMAIL_FLOW'] : ['HYBRID_DOCUMENT'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 0,
    fields: [],
    syntheticFixtures: fixtures,
  };
}

function makeVersionItem(overrides: Partial<TemplateVersionItem> = {}): TemplateVersionItem {
  return {
    templateDefinitionId: PRINT_ID,
    templateVersionId: VERSION_ID,
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
    publishedAt: '2026-11-20T10:00:00.000Z',
    restoredFromVersionId: null,
    changeNote: 'Initial release',
    publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    retiredAt: null,
    retiredBy: null,
    ...overrides,
  };
}

function makeHtmlPreview(
  templateId = PRINT_ID,
  draftRevision = 4,
  warnings: TemplateHtmlPreviewResponseDto['warnings'] = [],
): TemplateHtmlPreviewResponseDto {
  return {
    templateId,
    source: { kind: 'DRAFT', draftId: DRAFT_ID, draftRevision },
    templateContentChecksum: CHECKSUM,
    compiledArtifactChecksum: CHECKSUM,
    kind: 'HTML',
    renderTarget: 'HTML',
    html: '<main data-preview="1"><p>Quotation preview</p></main>',
    outputChecksum: CHECKSUM,
    warnings,
  };
}

function makeEmailPreview(templateId = EMAIL_ID, draftRevision = 4): TemplateEmailPreviewResponseDto {
  return {
    templateId,
    source: { kind: 'DRAFT', draftId: DRAFT_ID, draftRevision },
    templateContentChecksum: CHECKSUM,
    compiledArtifactChecksum: CHECKSUM,
    kind: 'EMAIL',
    renderTarget: 'EMAIL',
    subject: 'Your quotation is ready',
    preheader: 'Summary inside',
    html: '<table><tr><td>Email body</td></tr></table>',
    text: 'Your quotation is ready — Summary inside',
    outputChecksum: CHECKSUM,
    warnings: [],
  };
}

function makePdfAccepted(jobId: string, templateId = PRINT_ID, draftRevision = 4): TemplatePdfPreviewAcceptedDto {
  return {
    templateId,
    source: { kind: 'DRAFT', draftId: DRAFT_ID, draftRevision },
    templateContentChecksum: CHECKSUM,
    compiledArtifactChecksum: CHECKSUM,
    kind: 'PDF_ACCEPTED',
    renderTarget: 'PDF',
    outputProfile: templateId === EMAIL_ID ? 'EMAIL_PRINT_PROJECTION' : 'DOCUMENT_PRINT',
    renderJobId: jobId,
    status: 'PENDING',
    location: `${BASE}/preview-jobs/${jobId}`,
    createdAt: '2026-11-23T12:00:00.000Z',
    expiresAt: '2026-11-23T13:00:00.000Z',
  };
}

function makeCompletedJob(jobId: string, expiresAt = '2026-11-23T13:00:00.000Z'): TemplatePdfJobDto {
  return {
    templateId: PRINT_ID,
    source: { kind: 'DRAFT', draftId: DRAFT_ID, draftRevision: 4 },
    templateContentChecksum: CHECKSUM,
    compiledArtifactChecksum: CHECKSUM,
    renderJobId: jobId,
    renderTarget: 'PDF',
    attemptCount: 1,
    createdAt: '2026-11-23T12:00:00.000Z',
    expiresAt,
    lifecycleRevision: 2,
    status: 'COMPLETED',
    nextRetryAt: null,
    failure: null,
    outputProfile: 'DOCUMENT_PRINT',
    artifact: {
      downloadUrl: `${BASE}/preview-jobs/${jobId}/artifact`,
      downloadUrlExpiresAt: expiresAt,
      checksum: CHECKSUM,
      sizeBytes: 4096,
      pageCount: 2,
      rendererVersion: '1.0.0',
      browserBuildFingerprint: 'chromium-1',
      createdAt: '2026-11-23T12:00:01.000Z',
    },
  };
}

describe('PreviewTab', () => {
  let fixture: ComponentFixture<PreviewTab>;
  let component: PreviewTab;
  let http: HttpTestingController;
  let notify: Notify;
  let page: TemplatePageService;
  let origCreateObjectUrl: PropertyDescriptor | undefined;
  let origRevokeObjectUrl: PropertyDescriptor | undefined;
  let createObjectUrlMock: ReturnType<typeof vi.fn>;
  let revokeObjectUrlMock: ReturnType<typeof vi.fn>;
  let jobCounter = 0;

  const lang = signal<'en' | 'ar'>('en');
  const me = signal({
    id: 'actor-1',
    isTenantOwner: true,
    permissions: ['templates.read', 'templates.update', 'templates.preview'],
    permissionScopes: {},
  });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));
    lang.set('en');
    selection.set(null);
    jobCounter = 0;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    let urlSeq = 0;
    origCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    origRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    createObjectUrlMock = vi.fn(() => `blob:pdf-${++urlSeq}`);
    revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrlMock });

    TestBed.configureTestingModule({
      imports: [PreviewTab],
      providers: [
        TemplatePageService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: SpecTranslocoLoader,
        }),
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: ScopeState, useValue: { companies: signal([]) } },
        { provide: LanguageState, useValue: { current: lang } },
      ],
    });

    const doc = TestBed.inject(DOCUMENT);
    const csrfName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${csrfName}=csrf-proof`);

    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    page = TestBed.inject(TemplatePageService);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (origCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', origCreateObjectUrl);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (origRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', origRevokeObjectUrl);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  async function settleMicrotasks(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  function expectReadLikePost(req: TestRequest): void {
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
  }

  function expectKeyedPost(req: TestRequest): string {
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    const key = req.request.headers.get('x-idempotency-key') ?? '';
    expect(key).toMatch(UUID_V7);
    return key;
  }

  async function mountPrint(
    defOverrides: Partial<TemplateDefinitionDetail> = {},
    draftOverrides: Partial<TemplateDraftDto> = {},
  ): Promise<TemplateDefinitionDetail> {
    const def = makeDefinition(defOverrides);
    const draft = makeDraft({ templateId: def.templateId, ...draftOverrides });
    page.syncFromDefinition(def);
    page.setDraft(draft);

    fixture = TestBed.createComponent(PreviewTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settleMicrotasks();

    const schemaReq = http.expectOne((r) => r.url === `${BASE}/data-sources/${def.dataSourceKey}/schema`);
    expect(schemaReq.request.params.get('scopeType')).toBe(def.scope.type);
    expect(schemaReq.request.params.get('schemaVersion')).toBe(String(def.dataSourceSchemaVersion === 2 ? 2 : 1));
    if (def.scope.type === 'COMPANY') {
      expect(schemaReq.request.params.get('companyId')).toBe(def.scope.companyId);
    } else {
      expect(schemaReq.request.params.has('companyId')).toBe(false);
    }
    schemaReq.flush({ success: true, data: makeSchema(def.dataSourceKey, def.dataSourceSchemaVersion) });

    const versionsReq = http.expectOne((r) => r.url === `${BASE}/${def.templateId}/versions`);
    expect(versionsReq.request.params.get('lifecycleStatus')).toBe('PUBLISHED');
    expect(versionsReq.request.params.get('limit')).toBe('100');
    versionsReq.flush({
      success: true,
      data: {
        items: [makeVersionItem({ templateDefinitionId: def.templateId })],
        pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
      },
    });
    await settleMicrotasks();

    const htmlReq = http.expectOne(`${BASE}/${def.templateId}/preview/html`);
    expectReadLikePost(htmlReq);
    expect(htmlReq.request.body).toMatchObject({
      source: { kind: 'DRAFT', draftRevision: draft.revision },
      fixtureKey: 'trade.quotation.en-US.standard',
      locale: def.locale,
      viewport: 'DESKTOP',
    });
    htmlReq.flush({ success: true, data: makeHtmlPreview(def.templateId, draft.revision) });
    await settleMicrotasks();
    return def;
  }

  async function runPdfToCompletion(expectedExpiresAt = '2026-11-23T13:00:00.000Z'): Promise<{ jobId: string; key: string }> {
    const jobId = `01948100-0000-7000-8000-00000000900${++jobCounter}`;
    component['onFormatChange']('PDF');
    fixture.detectChanges();
    expect(component['pdfSubmitting']()).toBe(true);
    expect(component['isPdfInProgress']()).toBe(true);

    const pdfReq = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
    const key = expectKeyedPost(pdfReq);
    expect(pdfReq.request.body).toMatchObject({
      source: { kind: 'DRAFT', draftRevision: 4 },
      dataSource: { kind: 'SYNTHETIC', fixtureKey: 'trade.quotation.en-US.standard' },
      outputProfile: 'DOCUMENT_PRINT',
      locale: 'en-US',
    });
    pdfReq.flush(
      { success: true, data: makePdfAccepted(jobId) },
      { status: 202, statusText: 'Accepted', headers: { Location: `${BASE}/preview-jobs/${jobId}` } },
    );
    await settleMicrotasks();
    expect(component['poller'].status()).toBe('PENDING');
    expect(component['poller'].jobId()).toBe(jobId);

    await settleMicrotasks(PDF_POLL_FAST_MS);
    http.expectOne(`${BASE}/preview-jobs/${jobId}`).flush({
      success: true,
      data: makeCompletedJob(jobId, expectedExpiresAt),
    });
    await settleMicrotasks();

    const artifactReq = http.expectOne(`${BASE}/preview-jobs/${jobId}/artifact`);
    expect(artifactReq.request.responseType).toBe('blob');
    artifactReq.flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    await settleMicrotasks();

    return { jobId, key };
  }

  describe('initial load, scopes and read-only version fallback', () => {
    it('loads company-scoped schema v2 and versions, picks matching locale fixture, and renders HTML preview via read-like POST', async () => {
      const def = await mountPrint({
        scope: { type: 'COMPANY', companyId: COMPANY_ID },
        dataSourceSchemaVersion: 2,
      });

      expect(component['loadingInit']()).toBe(false);
      expect(component['format']()).toBe('HTML');
      expect(component['selectedSource']()).toBe('DRAFT');
      expect(component['selectedFixtureKey']()).toBe('trade.quotation.en-US.standard');
      expect(component['stageError']()).toBeNull();
      expect(component['activeHtmlResult']()?.response.templateId).toBe(def.templateId);
      expect(component['statusBadge']()?.labelKey).toBe('tplPreview.badge.ready');
      expect(component['generateAgainDisabled']()).toBe(false);
    });

    it('shows forbidden stage state and sends zero HTTP requests when preview capability is HIDDEN', async () => {
      page.syncFromDefinition(
        makeDefinition({
          capabilities: {
            ...makeDefinition().capabilities,
            preview: cap('HIDDEN'),
            previewPdf: cap('HIDDEN'),
          },
        }),
      );
      page.setDraft(makeDraft());

      fixture = TestBed.createComponent(PreviewTab);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settleMicrotasks();

      http.expectNone(() => true);
      expect(component['loadingInit']()).toBe(false);
      expect(component['stageError']()).toEqual({ kind: 'forbidden' });
      expect(component['activeResult']()).toBeNull();
      expect(component['formatOptions']().map((o) => o.value)).toEqual(['HTML']);
    });

    it('shows translated capability reason when preview capability is DISABLED and sends zero HTTP requests', async () => {
      page.syncFromDefinition(
        makeDefinition({
          capabilities: {
            ...makeDefinition().capabilities,
            preview: cap('DISABLED', 'ARCHIVED'),
            previewPdf: cap('DISABLED', 'ARCHIVED'),
          },
        }),
      );
      page.setDraft(makeDraft());

      fixture = TestBed.createComponent(PreviewTab);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settleMicrotasks();

      http.expectNone(() => true);
      expect(component['stageError']()).toEqual({
        kind: 'previewDisabled',
        reasonText: templatesPageEn.header.capabilities.ARCHIVED,
      });
      expect(component['statusBadge']()?.labelKey).toBe('tplPreview.badge.failed');
    });

    it('shows a clear empty state without fabricating data when syntheticFixtures is empty', async () => {
      const def = makeDefinition();
      page.syncFromDefinition(def);
      page.setDraft(makeDraft());

      fixture = TestBed.createComponent(PreviewTab);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settleMicrotasks();

      http.expectOne((r) => r.url === `${BASE}/data-sources/${def.dataSourceKey}/schema`).flush({
        success: true,
        data: makeSchema(def.dataSourceKey, 1, []),
      });
      http.expectOne((r) => r.url === `${BASE}/${def.templateId}/versions`).flush({
        success: true,
        data: { items: [], pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
      });
      await settleMicrotasks();

      expect(component['stageError']()).toEqual({
        kind: 'previewDisabled',
        reasonText: templatesPreviewEn.fixture.empty,
      });
      expect(component['generateAgainDisabled']()).toBe(true);
    });

    it('falls back to published version and loads version editorDocument via getVersion when draft access is forbidden', async () => {
      const def = makeDefinition();
      page.syncFromDefinition(def);
      page.setDraft(null);
      page.draftAccessForbidden.set(true);

      fixture = TestBed.createComponent(PreviewTab);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settleMicrotasks();

      http.expectOne((r) => r.url === `${BASE}/data-sources/${def.dataSourceKey}/schema`).flush({
        success: true,
        data: makeSchema(),
      });
      http.expectOne((r) => r.url === `${BASE}/${def.templateId}/versions`).flush({
        success: true,
        data: {
          items: [makeVersionItem()],
          pageInfo: { limit: 100, hasNextPage: true, nextCursor: 'cur-2' },
        },
      });
      await settleMicrotasks();

      const page2 = http.expectOne((r) => r.url === `${BASE}/${def.templateId}/versions`);
      expect(page2.request.params.get('cursor')).toBe('cur-2');
      page2.flush({
        success: true,
        data: { items: [], pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
      });
      await settleMicrotasks();

      const versionDetail: TemplateVersionDetail = {
        ...makeVersionItem(),
        editorDocument: makePrintDoc(),
        editorSchemaVersion: 1,
        nodeRegistryVersion: 'mvp-v1',
        compilerVersion: '1.0.0',
        validationRunId: '01948100-0000-7000-8000-000000005001',
        rendererTargets: ['HTML', 'PDF'],
        bindingManifest: [],
        assetManifest: [],
      };
      http.expectOne(`${BASE}/${def.templateId}/versions/${VERSION_ID}`).flush({
        success: true,
        data: versionDetail,
      });

      const previewReq = http.expectOne(`${BASE}/${def.templateId}/preview/html`);
      expect(previewReq.request.body).toMatchObject({
        source: { kind: 'VERSION', versionId: VERSION_ID },
      });
      previewReq.flush({
        success: true,
        data: {
          ...makeHtmlPreview(),
          source: { kind: 'VERSION', versionId: VERSION_ID, versionNumber: 1 },
        },
      });
      await settleMicrotasks();

      expect(component['selectedSource']()).toBe(`VERSION:${VERSION_ID}`);
      expect(component['activeHtmlResult']()?.response.source).toEqual({
        kind: 'VERSION',
        versionId: VERSION_ID,
        versionNumber: 1,
      });
    });

    it('previews EMAIL templates via /preview/email and reuses cached response when toggling TEXT', async () => {
      const def = makeDefinition({
        templateId: EMAIL_ID,
        documentType: 'CRM_OUTBOUND_EMAIL',
        outputChannel: 'EMAIL',
        layoutMode: 'EMAIL_FLOW',
        dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
        currentPublishedVersion: null,
      });
      const draft = makeDraft({ templateId: EMAIL_ID, editorDocument: makeEmailDoc() });
      page.syncFromDefinition(def);
      page.setDraft(draft);

      fixture = TestBed.createComponent(PreviewTab);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settleMicrotasks();

      http.expectOne((r) => r.url === `${BASE}/data-sources/CRM_LEAD_OUTBOUND_EMAIL_V1/schema`).flush({
        success: true,
        data: makeSchema('CRM_LEAD_OUTBOUND_EMAIL_V1', 1, [
          {
            fixtureKey: 'crm.lead.en-US.welcome',
            locale: 'en-US',
            labelKey: 'template.fixture.leadWelcome',
            fixtureChecksum: CHECKSUM,
          },
        ]),
      });
      http.expectOne((r) => r.url === `${BASE}/${EMAIL_ID}/versions`).flush({
        success: true,
        data: { items: [], pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
      });
      await settleMicrotasks();

      const emailReq = http.expectOne(`${BASE}/${EMAIL_ID}/preview/email`);
      expectReadLikePost(emailReq);
      emailReq.flush({ success: true, data: makeEmailPreview(EMAIL_ID, draft.revision) });
      await settleMicrotasks();

      expect(component['format']()).toBe('EMAIL');
      const first = component['activeEmailResult']();
      expect(first?.response.subject).toBe('Your quotation is ready');

      component['onFormatChange']('TEXT');
      http.expectNone(() => true);
      expect(component['loadingPreview']()).toBe(false);
      expect(component['activeEmailResult']()).toBe(first);
    });
  });

  describe('PDF 202 command, polling, caching and expiry', () => {
    it('submits 202 PDF command, polls job, downloads artifact Blob, caches result and rotates key on Generate again', async () => {
      await mountPrint();

      const firstRun = await runPdfToCompletion();

      expect(component['poller'].status()).toBe('COMPLETED');
      expect(component['pdfSubmitting']()).toBe(false);
      const firstPdf = component['activePdfResult']();
      expect(firstPdf?.kind).toBe('PDF');
      expect(firstPdf?.objectUrl).toBe('blob:pdf-1');
      expect(firstPdf?.artifact.pageCount).toBe(2);
      expect(component['canDownloadPdf']()).toBe(true);
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);

      component['onFormatChange']('HTML');
      await settleMicrotasks();
      http.expectNone(() => true);

      component['onFormatChange']('PDF');
      fixture.detectChanges();
      http.expectNone(() => true);
      expect(component['poller'].status()).toBe('IDLE');
      expect(component['activePdfResult']()).toBe(firstPdf);

      component['generateAgain']();
      fixture.detectChanges();
      expect(component['pdfSubmitting']()).toBe(true);

      const secondJobId = '01948100-0000-7000-8000-000000009099';
      const secondPdfReq = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      const secondKey = expectKeyedPost(secondPdfReq);
      expect(secondKey).not.toBe(firstRun.key);
      secondPdfReq.flush(
        { success: true, data: makePdfAccepted(secondJobId) },
        { status: 202, statusText: 'Accepted' },
      );
      await settleMicrotasks();

      await settleMicrotasks(PDF_POLL_FAST_MS);
      http.expectOne(`${BASE}/preview-jobs/${secondJobId}`).flush({
        success: true,
        data: makeCompletedJob(secondJobId),
      });
      await settleMicrotasks();
      http.expectOne(`${BASE}/preview-jobs/${secondJobId}/artifact`).flush(
        new Blob(['%PDF-1.7-v2'], { type: 'application/pdf' }),
      );
      await settleMicrotasks();

      expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:pdf-1');
      expect(component['activePdfResult']()?.objectUrl).toBe('blob:pdf-2');

      fixture.destroy();
      expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:pdf-2');
    });

    it('transitions to EXPIRED when downloadUrlExpiresAt elapses or when downloadPdf() is called after expiry', async () => {
      await mountPrint();
      await runPdfToCompletion('2026-11-23T12:05:00.000Z');
      expect(component['activePdfResult']()).not.toBeNull();

      await settleMicrotasks(5 * 60 * 1000 + 500);

      expect(component['poller'].status()).toBe('EXPIRED');
      expect(component['activeResult']()).toBeNull();
      expect(component['isPdfExpired']()).toBe(true);
      expect(component['statusBadge']()?.labelKey).toBe('tplPreview.badge.expired');

      component['generateAgain']();
      const jobId = '01948100-0000-7000-8000-000000009055';
      http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`).flush(
        { success: true, data: makePdfAccepted(jobId) },
        { status: 202, statusText: 'Accepted' },
      );
      await settleMicrotasks(PDF_POLL_FAST_MS);
      http.expectOne(`${BASE}/preview-jobs/${jobId}`).flush({
        success: true,
        data: makeCompletedJob(jobId, '2026-11-23T13:00:00.000Z'),
      });
      await settleMicrotasks();
      http.expectOne(`${BASE}/preview-jobs/${jobId}/artifact`).flush(
        new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      );
      await settleMicrotasks();

      vi.setSystemTime(new Date('2026-11-23T13:00:01.000Z'));
      component['downloadPdf']();
      expect(component['poller'].status()).toBe('EXPIRED');
      expect(component['activeResult']()).toBeNull();
    });
  });

  describe('error mapping, stale draft reload and idempotency retention', () => {
    it('retains the PDF idempotency key across 503/network/in-flight/401 retries and rotates after terminal 429', async () => {
      const warning = vi.spyOn(notify, 'warning');
      const error = vi.spyOn(notify, 'error');
      await mountPrint();

      component['onFormatChange']('PDF');
      const req503 = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      const retainedKey = expectKeyedPost(req503);
      req503.flush(
        { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-503' },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await settleMicrotasks();

      expect(component['stageError']()).toEqual({ kind: 'unavailable', correlationId: 'corr-503' });

      component['retryUnavailable']();
      const reqNet = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      expect(reqNet.request.headers.get('x-idempotency-key')).toBe(retainedKey);
      reqNet.error(new ProgressEvent('error'));
      await settleMicrotasks();
      expect(error).toHaveBeenCalledWith(globalEn.apiErrors.network);

      component['generateAgain']();
      const reqInFlight = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      expect(reqInFlight.request.headers.get('x-idempotency-key')).toBe(retainedKey);
      reqInFlight.flush(
        { errorCode: 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT' },
        { status: 409, statusText: 'Conflict' },
      );
      await settleMicrotasks();
      expect(error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT']);

      component['generateAgain']();
      const req401 = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      expect(req401.request.headers.get('x-idempotency-key')).toBe(retainedKey);
      req401.flush(
        { errorCode: 'COMMON.GENERIC.UNAUTHORIZED' },
        { status: 401, statusText: 'Unauthorized' },
      );
      await settleMicrotasks();
      expect(error).toHaveBeenCalledWith(globalEn.apiErrors.session);

      component['generateAgain']();
      const req429 = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      expect(req429.request.headers.get('x-idempotency-key')).toBe(retainedKey);
      req429.flush(
        { errorCode: 'CORE.TEMPLATE.PREVIEW.TOO_MANY_ACTIVE' },
        { status: 429, statusText: 'Too Many Requests' },
      );
      await settleMicrotasks();
      expect(warning).toHaveBeenCalledWith(templatesPreviewEn.toast.tooMany);

      component['generateAgain']();
      const reqRotated = http.expectOne(`${BASE}/${PRINT_ID}/preview/pdf`);
      const nextKey = expectKeyedPost(reqRotated);
      expect(nextKey).not.toBe(retainedKey);
      reqRotated.flush(
        { errorCode: 'CORE.TEMPLATE.PREVIEW.OUTPUT_LIMIT' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await settleMicrotasks();
      expect(error).toHaveBeenCalledWith(templatesPreviewEn.toast.tooLarge);
    });

    it('reloads definition and draft on 409 PREVIEW.SOURCE_STALE and re-runs HTML preview with the fresh revision', async () => {
      const warning = vi.spyOn(notify, 'warning');
      const def = makeDefinition();
      const staleDraft = makeDraft({ revision: 5 });
      page.syncFromDefinition(def);
      page.setDraft(staleDraft);

      fixture = TestBed.createComponent(PreviewTab);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settleMicrotasks();

      http.expectOne((r) => r.url === `${BASE}/data-sources/${def.dataSourceKey}/schema`).flush({
        success: true,
        data: makeSchema(),
      });
      http.expectOne((r) => r.url === `${BASE}/${def.templateId}/versions`).flush({
        success: true,
        data: { items: [], pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
      });
      await settleMicrotasks();

      const stalePreview = http.expectOne(`${BASE}/${def.templateId}/preview/html`);
      expect(stalePreview.request.body).toMatchObject({ source: { kind: 'DRAFT', draftRevision: 5 } });
      stalePreview.flush(
        { errorCode: 'CORE.TEMPLATE.PREVIEW.SOURCE_STALE' },
        { status: 409, statusText: 'Conflict' },
      );
      await settleMicrotasks();

      expect(warning).toHaveBeenCalledWith(templatesPreviewEn.toast.stale);

      const freshDef = makeDefinition({
        revision: 3,
        etag: '"3"',
        currentDraft: { ...def.currentDraft, revision: 6, etag: '"6"' },
      });
      const freshDraft = makeDraft({ revision: 6, etag: '"6"' });
      http.expectOne(`${BASE}/${def.templateId}`).flush(
        { success: true, data: freshDef },
        { headers: { ETag: '"3"' } },
      );
      http.expectOne(`${BASE}/${def.templateId}/draft`).flush(
        { success: true, data: freshDraft },
        { headers: { ETag: '"6"' } },
      );
      await settleMicrotasks();

      const freshPreview = http.expectOne(`${BASE}/${def.templateId}/preview/html`);
      expect(freshPreview.request.body).toMatchObject({ source: { kind: 'DRAFT', draftRevision: 6 } });
      freshPreview.flush({ success: true, data: makeHtmlPreview(def.templateId, 6, [{ code: 'W1', messageKey: 'w' }]) });
      await settleMicrotasks();

      expect(page.draft()?.revision).toBe(6);
      expect(page.definition()?.etag).toBe('"3"');
      expect(component['activeHtmlResult']()?.response.source).toEqual({
        kind: 'DRAFT',
        draftId: DRAFT_ID,
        draftRevision: 6,
      });
      expect(warning).toHaveBeenCalledWith(templatesPreviewEn.toast.warningOne);
    });

    it('maps 422 VALIDATION.FAILED, COMPILER.FAILED, 403, 404, 410 and layout/malformed errors accurately', async () => {
      const error = vi.spyOn(notify, 'error');
      await mountPrint();

      const triggerWithError = async (status: number, body: Record<string, unknown>) => {
        component['generateAgain']();
        const req = http.expectOne(`${BASE}/${PRINT_ID}/preview/html`);
        req.flush(body, { status, statusText: 'Error' });
        await settleMicrotasks();
      };

      await triggerWithError(422, { errorCode: 'CORE.TEMPLATE.VALIDATION.FAILED' });
      expect(component['stageError']()).toEqual({ kind: 'validation' });

      await triggerWithError(422, { errorCode: 'CORE.TEMPLATE.COMPILER.FAILED' });
      expect(component['stageError']()).toEqual({ kind: 'compiler' });

      await triggerWithError(403, { errorCode: 'CORE.TEMPLATE.PERMISSION.DENIED' });
      expect(component['stageError']()).toEqual({ kind: 'forbidden' });

      await triggerWithError(404, { errorCode: 'CORE.TEMPLATE.NOT_FOUND' });
      expect(component['stageError']()).toEqual({ kind: 'notFound' });

      await triggerWithError(410, { errorCode: 'CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED' });
      expect(component['poller'].status()).toBe('EXPIRED');

      await triggerWithError(422, { errorCode: 'CORE.TEMPLATE.LAYOUT.OUT_OF_BOUNDS' });
      expect(error).toHaveBeenCalledWith(templatesPreviewEn.toast.outOfPage);

      await triggerWithError(422, { errorCode: 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE' });
      expect(error).toHaveBeenCalledWith(templatesPreviewEn.toast.incompatible);

      component['generateAgain']();
      http.expectOne(`${BASE}/${PRINT_ID}/preview/html`).flush({ success: true, data: {} });
      await settleMicrotasks();
      expect(error).toHaveBeenCalledWith(globalEn.apiErrors.generic);
    });

    it('blocks uncached draft preview with saveFirst while dirty and automatically previews once saved', async () => {
      await mountPrint();
      page.setDirty(true);
      fixture.detectChanges();

      component['activeResult'].set(null);
      component['onFixtureChange']('trade.quotation.ar-EG.standard');
      await settleMicrotasks();
      http.expectNone(() => true);

      expect(component['stageError']()).toEqual({ kind: 'saveFirst' });
      expect(component['generateAgainDisabled']()).toBe(true);
      expect(component['generateAgainTooltip']()).toBe(templatesPreviewEn.source.saveFirst);

      page.setDraft(makeDraft({ revision: 5, etag: '"5"' }));
      page.setDirty(false);
      fixture.detectChanges();
      await settleMicrotasks();

      const previewReq = http.expectOne(`${BASE}/${PRINT_ID}/preview/html`);
      expect(previewReq.request.body).toMatchObject({
        source: { kind: 'DRAFT', draftRevision: 5 },
        fixtureKey: 'trade.quotation.ar-EG.standard',
      });
      previewReq.flush({ success: true, data: makeHtmlPreview(PRINT_ID, 5) });
      await settleMicrotasks();

      expect(component['stageError']()).toBeNull();
      expect(component['activeHtmlResult']()?.response.source).toMatchObject({ draftRevision: 5 });
    });
  });
});
