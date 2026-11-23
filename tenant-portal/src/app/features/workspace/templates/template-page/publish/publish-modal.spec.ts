import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import templatesPageEn from '../../../../../../../public/i18n/templates-page/en.json';
import validationEn from '../../../../../../../public/i18n/templates-validation/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type {
  PublishTemplateResponseDto,
  TemplateCapabilityState,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateValidationRunDto,
} from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { PublishModal } from './publish-modal';
import { ValidationActions } from './validation-actions';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates-validation/')) return of(validationEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({
      ...globalEn,
      templates: templatesEn,
      templatesPage: templatesPageEn,
      tplValidation: validationEn,
    } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const RUN_ID = '01948100-0000-7000-8000-000000006001';
const VERSION_ID = '01948100-0000-7000-8000-000000007001';
const CHECKSUM = 'a'.repeat(64);

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
      lastValidationRunId: RUN_ID,
      validatedDraftRevision: 3,
      errorCount: 0,
      warningCount: 1,
    },
    revision: 3,
    etag: '"3"',
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    ...overrides,
  };
}

function makeRun(overrides: Partial<TemplateValidationRunDto> = {}): TemplateValidationRunDto {
  return {
    validationRunId: RUN_ID,
    templateId: TEMPLATE_ID,
    draftId: DRAFT_ID,
    draftRevision: 3,
    candidateChecksum: CHECKSUM,
    editorSchemaVersion: 1,
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: CHECKSUM,
    nodeRegistryVersion: 'mvp-v1',
    compilerVersion: '1.0.0',
    compilerFingerprint: CHECKSUM,
    rendererTargets: ['HTML', 'PDF'],
    assetResolutionFingerprint: CHECKSUM,
    fixtureChecksum: CHECKSUM,
    issues: [],
    startedAt: '2026-11-23T10:00:00Z',
    completedAt: '2026-11-23T10:00:01Z',
    status: 'PASSED',
    compiledChecksum: CHECKSUM,
    ...overrides,
  };
}

function makePublishResponse(): PublishTemplateResponseDto {
  return {
    version: {
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
      dataSourceSchemaChecksum: CHECKSUM,
      templateContentChecksum: CHECKSUM,
      compiledChecksum: CHECKSUM,
      compilerFingerprint: CHECKSUM,
      lifecycleStatus: 'PUBLISHED',
      publishedAt: '2026-11-23T11:00:00Z',
      restoredFromVersionId: null,
      changeNote: 'Release 1',
      publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
      retiredAt: null,
      retiredBy: null,
      editorDocument: makeDraft().editorDocument,
      editorSchemaVersion: 1,
      nodeRegistryVersion: 'mvp-v1',
      compilerVersion: '1.0.0',
      validationRunId: RUN_ID,
      rendererTargets: ['HTML', 'PDF'],
      bindingManifest: [],
      assetManifest: [],
    },
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    definitionRevision: 3,
    definitionEtag: '"3"',
    consumedDraftRevision: 3,
    draftEtag: '"4"',
  };
}

describe('PublishModal', () => {
  let fixture: ComponentFixture<PublishModal>;
  let component: PublishModal;
  let pageService: TemplatePageService;
  let actions: ValidationActions;
  let http: HttpTestingController;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({
    id: 'actor-1',
    isTenantOwner: true,
    permissions: ['templates.read', 'templates.update', 'templates.publish'],
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
      imports: [PublishModal],
      providers: [
        TemplatePageService,
        ValidationActions,
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

    fixture = TestBed.createComponent(PublishModal);
    component = fixture.componentInstance;
    pageService = TestBed.inject(TemplatePageService);
    actions = TestBed.inject(ValidationActions);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('fetches retained validation run through TemplatesApi when opening without a cached run', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());

    component.open();
    expect(component['warningCount']()).toBe(1);

    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: makeRun({
        issues: [
          { severity: 'WARNING', code: 'A', jsonPointer: '', nodeId: null, messageKey: 'a', params: {} },
          { severity: 'WARNING', code: 'B', jsonPointer: '', nodeId: null, messageKey: 'b', params: {} },
          { severity: 'ERROR', code: 'C', jsonPointer: '', nodeId: null, messageKey: 'c', params: {} },
        ],
      }),
    });
    await tick();

    expect(component['warningCount']()).toBe(2);
  });

  it('keeps draft summary warning count if retained validation run fetch fails or modal closes first', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft({ validation: { state: 'PASSED', lastValidationRunId: RUN_ID, validatedDraftRevision: 3, errorCount: 0, warningCount: 3 } }));

    component.open();
    const failReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    failReq.flush({ errorCode: 'CORE.TEMPLATE.PERMISSION.DENIED' }, { status: 403, statusText: 'Forbidden' });
    await tick();
    expect(component['warningCount']()).toBe(3);
    expect(notify.error).not.toHaveBeenCalled();

    component.close();
    component.open();
    const lateReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    component.close();
    lateReq.flush({
      success: true,
      data: makeRun({
        issues: [{ severity: 'WARNING', code: 'A', jsonPointer: '', nodeId: null, messageKey: 'a', params: {} }],
      }),
    });
    await tick();
    expect(component['warningCount']()).toBe(3);
  });

  it('keeps the draft summary when the retained response belongs to a different run', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    component.open();

    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    req.flush({ success: true, data: makeRun({ validationRunId: 'another-run', issues: [] }) });
    await tick();

    expect(component['warningCount']()).toBe(1);
  });

  it('validates note length and submits publish through ValidationActions and TemplatesApi', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft({ validation: { state: 'PASSED', lastValidationRunId: RUN_ID, validatedDraftRevision: 3, errorCount: 0, warningCount: 0 } }));

    component.open();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`).flush({
      success: true,
      data: makeRun(),
    });
    await tick();

    component['changeNote'].set('x'.repeat(501));
    await component['submit']();
    expect(component['changeNoteError']()).toBe(validationEn.publish.noteTooLong);
    http.expectNone(`${BASE_URL}/${TEMPLATE_ID}/publish`);

    component['changeNote'].set('Release 1');
    const submitPromise = component['submit']();
    const pubReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/publish`);
    pubReq.flush({ success: true, data: makePublishResponse() }, { status: 201, statusText: 'Created', headers: { ETag: '"3"' } });
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition({ revision: 3, etag: '"3"' }) });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft({ revision: 4, etag: '"4"' }) });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
    });
    await submitPromise;

    expect(actions.publishing()).toBe(false);
    expect(notify.success).toHaveBeenCalled();
  });
});
