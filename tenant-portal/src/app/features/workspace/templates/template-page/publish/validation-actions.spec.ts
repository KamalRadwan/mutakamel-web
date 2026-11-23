import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
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
  TemplateVersionItem,
} from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
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
const OTHER_TEMPLATE_ID = '01948100-0000-7000-8000-000000001099';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const RUN_ID = '01948100-0000-7000-8000-000000006001';
const VERSION_ID = '01948100-0000-7000-8000-000000007001';
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
      validationState: 'NOT_VALIDATED',
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
      state: 'NOT_VALIDATED',
      lastValidationRunId: null,
      validatedDraftRevision: null,
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

function makeValidationRun(overrides: Partial<TemplateValidationRunDto> = {}): TemplateValidationRunDto {
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

function makeVersionItem(overrides: Partial<TemplateVersionItem> = {}): TemplateVersionItem {
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
    dataSourceSchemaChecksum: CHECKSUM,
    templateContentChecksum: CHECKSUM,
    compiledChecksum: CHECKSUM,
    compilerFingerprint: CHECKSUM,
    lifecycleStatus: 'PUBLISHED',
    publishedAt: '2026-11-23T11:00:00Z',
    restoredFromVersionId: null,
    changeNote: 'Initial release',
    publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    retiredAt: null,
    retiredBy: null,
    ...overrides,
  };
}

function makePublishResponse(overrides: Partial<PublishTemplateResponseDto> = {}): PublishTemplateResponseDto {
  const versionItem = makeVersionItem();
  return {
    version: {
      ...versionItem,
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
    ...overrides,
  };
}

describe('ValidationActions', () => {
  let actions: ValidationActions;
  let pageService: TemplatePageService;
  let http: HttpTestingController;
  let router: Router;

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

  beforeEach(async () => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof');

    TestBed.configureTestingModule({
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

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    actions = TestBed.inject(ValidationActions);
    pageService = TestBed.inject(TemplatePageService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('validates print draft via TemplatesApi, refreshes definition and draft, and navigates to validation tab', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const pending = actions.validate();
    const validateReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
    expect(validateReq.request.method).toBe('POST');
    expect(validateReq.request.headers.get('If-Match')).toBe('"3"');
    expect(validateReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(validateReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(validateReq.request.body).toEqual({
      draftRevision: 3,
      rendererTargets: ['HTML', 'PDF'],
    });

    const run = makeValidationRun({
      issues: [
        {
          severity: 'WARNING',
          code: 'TEMPLATE_STYLE_NOT_SUPPORTED',
          jsonPointer: '/nodes/n1',
          nodeId: 'n1',
          messageKey: 'style',
          params: {},
        },
      ],
    });
    validateReq.flush({ success: true, data: run });
    await tick();

    const defReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    const draftReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`);
    defReq.flush(
      {
        success: true,
        data: makeDefinition({
          revision: 2,
          currentDraft: {
            draftId: DRAFT_ID,
            revision: 3,
            contentChecksum: CHECKSUM,
            validationState: 'PASSED',
            etag: '"3"',
          },
        }),
      },
      { headers: { ETag: '"9"' } },
    );
    draftReq.flush(
      {
        success: true,
        data: makeDraft({
          validation: {
            state: 'PASSED',
            lastValidationRunId: RUN_ID,
            validatedDraftRevision: 3,
            errorCount: 0,
            warningCount: 1,
          },
        }),
      },
      { headers: { ETag: '"10"' } },
    );

    await expect(pending).resolves.toEqual(run);
    expect(actions.lastRun()).toEqual(run);
    expect(pageService.definition()?.etag).toBe('"9"');
    expect(pageService.draft()?.etag).toBe('"10"');
    expect(notify.success).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/workspace/operations/template-platform', TEMPLATE_ID, 'validation']);
  });

  it('sends EMAIL_HTML and EMAIL_TEXT targets when validating an email template', async () => {
    pageService.syncFromDefinition(
      makeDefinition({
        outputChannel: 'EMAIL',
        layoutMode: 'EMAIL_FLOW',
        documentType: 'CRM_OUTBOUND_EMAIL',
        dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
      }),
    );
    pageService.setDraft(
      makeDraft({
        editorDocument: {
          ...makeDraft().editorDocument,
          outputChannel: 'EMAIL',
          layoutMode: 'EMAIL_FLOW',
          documentType: 'CRM_OUTBOUND_EMAIL',
          dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
          email: { maxWidthPx: 600, subject: { segments: [{ kind: 'TEXT', value: 'Hello' }] } },
        },
      }),
    );
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const pending = actions.validate();
    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
    expect(req.request.body).toEqual({
      draftRevision: 3,
      rendererTargets: ['EMAIL_HTML', 'EMAIL_TEXT'],
    });
    const failedRun = makeValidationRun({
      status: 'FAILED',
      rendererTargets: ['EMAIL_HTML', 'EMAIL_TEXT'],
      issues: [
        {
          severity: 'ERROR',
          code: 'TEMPLATE_NODE_NOT_ALLOWED_IN_EMAIL',
          jsonPointer: '/nodes/n1',
          nodeId: 'n1',
          messageKey: 'email',
          params: {},
        },
      ],
    });
    req.flush({ success: true, data: failedRun });
    await tick();

    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });

    await expect(pending).resolves.toEqual(failedRun);
    expect(notify.error).toHaveBeenCalled();
  });

  it('retains validate idempotency key across retryable errors and rejects unknown receipts', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = actions.validate();
      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;

      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code, correlationId: 'corr-val' }, { status, statusText: 'Error' });

      await expect(pending).resolves.toBeNull();
      expect(notify.error).toHaveBeenCalled();
    }

    // Unknown receipt fails command validation with 502 and rotates the key because 502 is retryable until clear
    const malformedPending = actions.validate();
    const malformedReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
    expect(malformedReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    malformedReq.flush({ success: true, data: {} }, { status: 200, statusText: 'OK' });
    await expect(malformedPending).resolves.toBeNull();
    expect(actions.lastRun()).toBeNull();

    // Non-retryable 422 clears the retained key
    const nonRetryPending = actions.validate();
    const nonRetryReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
    nonRetryReq.flush(
      { errorCode: 'CORE.TEMPLATE.COMPILER.TARGET_UNSUPPORTED' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect(nonRetryPending).resolves.toBeNull();

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const nextPending = actions.validate();
    const nextReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
    expect(nextReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    nextReq.flush({ success: true, data: makeValidationRun() });
    await tick();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });
    await nextPending;
  });

  it('opens conflict dialog on 409 stale revision during validate and warns when refresh fails', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());

    const stalePending = actions.validate();
    const staleReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);
    staleReq.flush({ errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' }, { status: 409, statusText: 'Conflict' });
    await expect(stalePending).resolves.toBeNull();
    expect(pageService.conflictOpen()).toBe(true);
    pageService.closeConflict();

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const refreshWarnPending = actions.validate();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`).flush({ success: true, data: makeValidationRun() });
    await tick();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-refresh' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });
    await refreshWarnPending;
    expect(notify.warning).toHaveBeenCalledWith(
      validationEn.refreshFailed,
      'Support reference: corr-refresh',
    );
  });

  it('publishes via TemplatesApi, applies 201 ETags and STALE draft state, and refreshes versions list', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(
      makeDraft({
        validation: {
          state: 'PASSED',
          lastValidationRunId: RUN_ID,
          validatedDraftRevision: 3,
          errorCount: 0,
          warningCount: 0,
        },
      }),
    );

    const pending = actions.publish({ changeNote: '  Initial release  ' });
    const pubReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/publish`);
    expect(pubReq.request.method).toBe('POST');
    expect(pubReq.request.headers.get('If-Match')).toBe('"3"');
    expect(pubReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(pubReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(pubReq.request.body).toEqual({
      definitionRevision: 2,
      draftRevision: 3,
      validationRunId: RUN_ID,
      changeNote: 'Initial release',
      setAsDefinitionPublished: true,
    });

    const receipt = makePublishResponse();
    pubReq.flush(
      { success: true, data: receipt },
      { status: 201, statusText: 'Created', headers: { ETag: '"13"', Location: `${BASE_URL}/${TEMPLATE_ID}/versions/${VERSION_ID}` } },
    );
    await tick();

    // Verify immediate optimistic application from 201 response before refresh completes
    expect(pageService.definition()?.etag).toBe('"13"');
    expect(pageService.draft()?.validation.state).toBe('STALE');
    expect(pageService.draft()?.validation.lastValidationRunId).toBeNull();
    expect(pageService.versions().length).toBe(1);

    const defReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    const draftReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft`);
    const versionsReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/versions?limit=25`);

    defReq.flush({ success: true, data: makeDefinition({ revision: 3, etag: '"3"' }) }, { headers: { ETag: '"3"' } });
    draftReq.flush({ success: true, data: makeDraft({ revision: 4, etag: '"4"' }) }, { headers: { ETag: '"4"' } });
    versionsReq.flush({
      success: true,
      data: {
        items: [makeVersionItem()],
        pageInfo: { limit: 25, hasNextPage: true, nextCursor: 'next-cur' },
      },
    });

    await expect(pending).resolves.toEqual(receipt);
    expect(pageService.versionsHasNext()).toBe(true);
    expect(pageService.versionsNextCursor()).toBe('next-cur');
    expect(notify.success).toHaveBeenCalled();
  });

  it('retains publish idempotency key on retryable errors, maps domain codes, and rejects unknown 201 receipts', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(
      makeDraft({
        validation: {
          state: 'PASSED',
          lastValidationRunId: RUN_ID,
          validatedDraftRevision: 3,
          errorCount: 0,
          warningCount: 0,
        },
      }),
    );

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = actions.publish({ changeNote: 'v1' });
      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/publish`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;

      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await expect(pending).resolves.toBeNull();
    }

    // Malformed 201 receipt fails through TemplatesHttp 502 check without mutating state
    const badReceiptPending = actions.publish({ changeNote: 'v1' });
    const badReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/publish`);
    expect(badReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    badReq.flush({ success: true, data: {} }, { status: 201, statusText: 'Created' });
    await expect(badReceiptPending).resolves.toBeNull();
    expect(pageService.versions()).toEqual([]);

    // Non-retryable domain error clears retained key
    const assetErrPending = actions.publish({ changeNote: 'v1' });
    const assetReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/publish`);
    assetReq.flush(
      { errorCode: 'CORE.TEMPLATE.ASSET.EMAIL_RENDITION_UNAVAILABLE' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect(assetErrPending).resolves.toBeNull();
    expect(notify.error).toHaveBeenCalledWith(validationEn.issues.CORE_TEMPLATE_ASSET_EMAIL_RENDITION_UNAVAILABLE);

    // Next attempt rotates to a fresh idempotency key
    const noChangesPending = actions.publish({ changeNote: 'v1' });
    const noChangesReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/publish`);
    expect(noChangesReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    noChangesReq.flush({ errorCode: 'CORE.TEMPLATE.PUBLISH.NO_CHANGES' }, { status: 409, statusText: 'Conflict' });
    await expect(noChangesPending).resolves.toBeNull();
    expect(notify.error).toHaveBeenCalledWith(validationEn.publish.noChanges.replace('{{n}}', '0'));
  });

  it('ignores late validate responses when the active template changes mid-flight', async () => {
    pageService.syncFromDefinition(makeDefinition());
    pageService.setDraft(makeDraft());

    const pending = actions.validate();
    const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/validate`);

    pageService.syncFromDefinition(makeDefinition({ templateId: OTHER_TEMPLATE_ID }));
    req.flush({ success: true, data: makeValidationRun() });

    await expect(pending).resolves.toBeNull();
    expect(actions.lastRun()).toBeNull();
    expect(notify.success).not.toHaveBeenCalled();
  });
});
