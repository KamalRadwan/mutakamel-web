import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import designerEn from '../../../../../../../public/i18n/templates-designer/en.json';
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
  TemplateValidationRunDto,
} from '../../templates.model';
import { ValidationActions } from '../publish/validation-actions';
import { TemplatePageService } from '../template-page.service';
import { ValidationTab } from './validation-tab';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates-validation/')) return of(validationEn as Translation);
    if (lang.startsWith('templates-designer/')) return of(designerEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({
      ...globalEn,
      templates: templatesEn,
      templatesPage: templatesPageEn,
      tplValidation: validationEn,
      tplDesigner: designerEn,
    } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const OTHER_TEMPLATE_ID = '01948100-0000-7000-8000-000000001099';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const RUN_ID = '01948100-0000-7000-8000-000000006001';
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
      validationState: 'FAILED',
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
      publish: cap('DISABLED'),
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
      rootNodeIds: ['node-1'],
      nodes: {
        'node-1': {
          id: 'node-1',
          type: 'text',
          name: 'Header title',
          parentId: null,
          layout: { kind: 'FLOW', order: 0 },
          childIds: [],
          locked: false,
          hidden: false,
          style: {},
          props: { text: 'Quotation' },
        },
      },
    },
    schemaVersion: 1,
    contentChecksum: CHECKSUM,
    baseVersionId: null,
    restoreSourceVersionId: null,
    validation: {
      state: 'FAILED',
      lastValidationRunId: RUN_ID,
      validatedDraftRevision: 3,
      errorCount: 1,
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
    issues: [
      {
        severity: 'WARNING',
        code: 'TEMPLATE_STYLE_NOT_SUPPORTED',
        jsonPointer: '/nodes/node-1/style',
        nodeId: null,
        messageKey: 'style',
        params: {},
      },
      {
        severity: 'ERROR',
        code: 'TEMPLATE_EMAIL_SUBJECT_EMPTY',
        jsonPointer: '',
        nodeId: null,
        messageKey: 'subject',
        params: {},
      },
    ],
    startedAt: '2026-11-23T10:00:00Z',
    completedAt: '2026-11-23T10:00:01Z',
    status: 'FAILED',
    compiledChecksum: null,
    ...overrides,
  };
}

describe('ValidationTab', () => {
  let fixture: ComponentFixture<ValidationTab>;
  let component: ValidationTab;
  let pageService: TemplatePageService;
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
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof');

    TestBed.configureTestingModule({
      imports: [ValidationTab],
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

    fixture = TestBed.createComponent(ValidationTab);
    component = fixture.componentInstance;
    pageService = TestBed.inject(TemplatePageService);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('loads retained validation run via TemplatesApi, orders errors before warnings, and filters issues', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    fixture.detectChanges();

    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: makeRun() });
    await tick();

    expect(component['loadingRun']()).toBe(false);
    expect(component['loadError']()).toBe(false);
    expect(component['effectiveState']()).toBe('FAILED');
    expect(component['orderedIssues']().map((row) => [row.severity, row.objectLabel])).toEqual([
      ['ERROR', validationEn.object.document],
      ['WARNING', 'Header title'],
    ]);

    component['onFilterChange']('WARNING');
    expect(component['filteredIssues']().length).toBe(1);
    expect(component['filteredIssues']()[0]?.code).toBe('TEMPLATE_STYLE_NOT_SUPPORTED');
  });

  it('treats 404 retained run as empty state without error banner', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    fixture.detectChanges();

    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    req.flush({ errorCode: 'CORE.TEMPLATE.NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await tick();

    expect(component['activeRun']()).toBeNull();
    expect(component['loadError']()).toBe(false);
    expect(component['loadingRun']()).toBe(false);
  });

  it('shows error state with correlationId on 503 or malformed run payload and retries via TemplatesApi', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    fixture.detectChanges();

    const failReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    failReq.flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-run-503' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await tick();

    expect(component['loadError']()).toBe(true);
    expect(component['loadCorrelationId']()).toBe('corr-run-503');

    component['retryLoad']();
    const malformedReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    malformedReq.flush({ success: true, data: { unexpected: true } });
    await tick();

    expect(component['loadError']()).toBe(true);
    expect(component['activeRun']()).toBeNull();

    component['retryLoad']();
    const okReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    okReq.flush({ success: true, data: makeRun({ status: 'PASSED', issues: [] }) });
    await tick();

    expect(component['loadError']()).toBe(false);
    expect(component['activeRun']()?.status).toBe('PASSED');
  });

  it.each([null, {}, { severity: 'WARNING', code: 'TEMPLATE_STYLE_NOT_SUPPORTED', nodeId: null }])(
    'rejects a malformed retained issue without rendering it: %j',
    async (issue) => {
      pageService.syncFromDefinition(makeDefinition());
      pageService.setDraft(makeDraft());
      fixture.detectChanges();

      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
      req.flush({ success: true, data: { ...makeRun(), issues: [issue] } });
      await tick();

      expect(component['loadError']()).toBe(true);
      expect(component['activeRun']()).toBeNull();
    },
  );

  it('ignores a retained read failure after a fresh action result becomes available', async () => {
    const actionRun = signal<TemplateValidationRunDto | null>(null);
    vi.spyOn(TestBed.inject(ValidationActions), 'lastRun').mockImplementation(actionRun);
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    fixture.detectChanges();

    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    actionRun.set(makeRun({ status: 'PASSED', issues: [] }));
    fixture.detectChanges();
    req.flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await tick();

    expect(component['loadError']()).toBe(false);
    expect(component['loadingRun']()).toBe(false);
    expect(component['activeRun']()?.status).toBe('PASSED');
  });

  it('ignores late retained run responses after switching templates', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    fixture.detectChanges();

    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validation-runs/${RUN_ID}`);
    pageService.syncFromDefinition(makeDefinition({ templateId: OTHER_TEMPLATE_ID }));
    pageService.setDraft(makeDraft({ templateId: OTHER_TEMPLATE_ID, validation: { state: 'NOT_VALIDATED', lastValidationRunId: null, validatedDraftRevision: null, errorCount: 0, warningCount: 0 } }));
    fixture.detectChanges();

    req.flush({ success: true, data: makeRun() });
    await tick();

    expect(component['activeRun']()).toBeNull();
    expect(component['loadError']()).toBe(false);
  });
});
