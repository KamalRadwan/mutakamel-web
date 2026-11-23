import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { type Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import createEn from '../../../../../../../public/i18n/templates-create/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type {
  CreateTemplateResponse,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateVersionItem,
} from '../../templates.model';
import { TemplateDuplicateModal } from './duplicate-modal';

const BASE_URL = '/api/tenant/core/v1/templates';
const SCOPES_URL = `${BASE_URL}/creation-scopes`;
const SOURCE_ID = '01948100-0000-7000-8000-000000001001';
const NEW_ID = '01948100-0000-7000-8000-000000001099';
const NEW_DRAFT_ID = '01948100-0000-7000-8000-000000003099';
const VERSION_1_ID = '01948100-0000-7000-8000-000000002001';
const VERSION_2_ID = '01948100-0000-7000-8000-000000002002';
const COMPANY_ID = '01948100-0000-7000-8000-000000000101';
const CHECKSUM = 'a'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

@Injectable()
class StaticLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path.startsWith('templates-create/')) return of(createEn as Translation);
    if (path.startsWith('templates/')) return of(templatesEn as Translation);
    return of(globalEn as Translation);
  }
}

function makeDetail(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: SOURCE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: 'QT-STANDARD',
    name: 'Standard Quotation',
    description: 'Default print quotation',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: CHECKSUM,
    locale: 'en-US',
    direction: 'AUTO',
    resolvedDirection: 'LTR',
    scope: { type: 'COMPANY', companyId: COMPANY_ID },
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 4,
    etag: '"4"',
    currentDraft: {
      draftId: '01948100-0000-7000-8000-000000003001',
      revision: 7,
      contentChecksum: CHECKSUM,
      validationState: 'PASSED',
      etag: '"7"',
    },
    currentPublishedVersion: {
      templateDefinitionId: SOURCE_ID,
      templateVersionId: VERSION_2_ID,
      versionNumber: 2,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      locale: 'en-US',
      direction: 'LTR',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      dataSourceSchemaVersion: 2,
      dataSourceSchemaChecksum: CHECKSUM,
      templateContentChecksum: CHECKSUM,
      compiledChecksum: CHECKSUM,
      compilerFingerprint: CHECKSUM,
      lifecycleStatus: 'PUBLISHED',
      publishedAt: '2026-11-22T10:00:00Z',
    },
    createdAt: '2026-11-20T10:00:00Z',
    createdBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    archivedAt: null,
    capabilities: {
      update: { state: 'ENABLED', reason: null },
      validate: { state: 'ENABLED', reason: null },
      publish: { state: 'ENABLED', reason: null },
      preview: { state: 'ENABLED', reason: null },
      previewPdf: { state: 'ENABLED', reason: null },
      restoreVersion: { state: 'ENABLED', reason: null },
      manageRecovery: { state: 'ENABLED', reason: null },
      restoreRecovery: { state: 'ENABLED', reason: null },
      manageAssets: { state: 'ENABLED', reason: null },
      retireVersion: { state: 'ENABLED', reason: null },
      archive: { state: 'ENABLED', reason: null },
      restore: { state: 'HIDDEN', reason: null },
      delete: { state: 'HIDDEN', reason: 'REFERENCED' },
      manageAssignments: { state: 'ENABLED', reason: null },
    },
    ...overrides,
  };
}

function makeVersions(): TemplateVersionItem[] {
  return [
    {
      templateDefinitionId: SOURCE_ID,
      templateVersionId: VERSION_2_ID,
      versionNumber: 2,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      locale: 'en-US',
      direction: 'LTR',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      dataSourceSchemaVersion: 2,
      dataSourceSchemaChecksum: CHECKSUM,
      templateContentChecksum: CHECKSUM,
      compiledChecksum: CHECKSUM,
      compilerFingerprint: CHECKSUM,
      lifecycleStatus: 'PUBLISHED',
      publishedAt: '2026-11-22T10:00:00Z',
      restoredFromVersionId: null,
      changeNote: 'v2',
      publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
      retiredAt: null,
      retiredBy: null,
    },
    {
      templateDefinitionId: SOURCE_ID,
      templateVersionId: VERSION_1_ID,
      versionNumber: 1,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      locale: 'en-US',
      direction: 'LTR',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      dataSourceSchemaVersion: 2,
      dataSourceSchemaChecksum: CHECKSUM,
      templateContentChecksum: CHECKSUM,
      compiledChecksum: CHECKSUM,
      compilerFingerprint: CHECKSUM,
      lifecycleStatus: 'RETIRED',
      publishedAt: '2026-11-21T10:00:00Z',
      restoredFromVersionId: null,
      changeNote: 'v1',
      publishedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
      retiredAt: '2026-11-22T10:00:00Z',
      retiredBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    },
  ];
}

function makeDuplicateResponse(overrides: {
  code?: string;
  name?: string;
  description?: string | null;
  layoutMode?: 'HYBRID_DOCUMENT' | 'FLOW_DOCUMENT' | 'FIXED_CANVAS';
} = {}): CreateTemplateResponse {
  const layoutMode = overrides.layoutMode ?? 'HYBRID_DOCUMENT';
  const definition = makeDetail({
    templateId: NEW_ID,
    code: overrides.code ?? 'QT-STANDARD-COPY',
    name: overrides.name ?? 'Standard Quotation (Copy)',
    description: overrides.description ?? null,
    layoutMode,
    revision: 1,
    etag: '"1"',
    currentPublishedVersion: null,
    currentDraft: {
      draftId: NEW_DRAFT_ID,
      revision: 1,
      contentChecksum: CHECKSUM,
      validationState: 'NOT_VALIDATED',
      etag: '"1"',
    },
  });
  const draft: TemplateDraftDto = {
    draftId: NEW_DRAFT_ID,
    templateId: NEW_ID,
    editorDocument: {
      schemaVersion: 1,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode,
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'en-US',
      direction: 'AUTO',
      theme: {
        fontFamilyToken: 'SYSTEM_SANS',
        baseFontSizePx: 14,
        textColor: '#0F172A',
        lineHeight: 1.5,
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
    revision: 1,
    etag: '"1"',
    updatedAt: '2026-11-23T12:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
  };
  return { definition, draft };
}

describe('TemplateDuplicateModal', () => {
  let fixture: ComponentFixture<TemplateDuplicateModal>;
  let component: TemplateDuplicateModal;
  let http: HttpTestingController;
  let router: Router;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({
    id: 'actor-1',
    isTenantOwner: true,
    permissions: ['templates.read', 'templates.create', 'templates.update'],
    permissionScopes: {},
  });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(async () => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        if (!this.hasAttribute('open')) return;
        this.removeAttribute('open');
        setTimeout(() => this.dispatchEvent(new Event('close')), 0);
      },
    });

    TestBed.configureTestingModule({
      imports: [TemplateDuplicateModal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: StaticLoader,
        }),
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });

    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=csrf-proof`);

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(TemplateDuplicateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    vi.restoreAllMocks();
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function openModal(
    options: Parameters<TemplateDuplicateModal['open']>[0] = SOURCE_ID,
    detail: TemplateDefinitionDetail = makeDetail(),
    versions: TemplateVersionItem[] = makeVersions(),
    scopes: unknown[] = [{ type: 'TENANT' }, { type: 'COMPANY', companyId: COMPANY_ID, label: 'Alpha Co' }],
  ): Promise<void> {
    component.open(options);
    await tick();

    http.expectOne(`${BASE_URL}/${SOURCE_ID}`).flush({ success: true, data: detail }, { headers: { ETag: detail.etag } });

    const verReq = http.expectOne((r) => r.url === `${BASE_URL}/${SOURCE_ID}/versions`);
    expect(verReq.request.params.get('limit')).toBe('100');
    verReq.flush({
      success: true,
      data: { items: versions, pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
    });

    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes } });
    await tick();
  }

  it('loads template detail, versions, and creation scopes via TemplatesApi and populates defaults cleanly', async () => {
    await openModal();

    expect(component['isOpen']()).toBe(true);
    expect(component['loading']()).toBe(false);
    expect(component['loadFailed']()).toBe(false);
    expect(component['sourceKey']()).toBe('DRAFT');
    expect(component['scopeKey']()).toBe(`COMPANY:${COMPANY_ID}`);
    expect(component['name']()).toBe('Standard Quotation (Copy)');
    expect(component['code']()).toBe('QT-STANDARD-COPY');
    expect(component['description']()).toBe('Default print quotation');
    expect(component['dirty']()).toBe(false);
  });

  it('respects explicit versionId, sourceKind VERSION, draftDirty, and hidden update capability', async () => {
    await openModal({ templateId: SOURCE_ID, sourceKind: 'VERSION', versionId: VERSION_1_ID });
    expect(component['sourceKey']()).toBe(`VERSION:${VERSION_1_ID}`);

    await openModal({ templateId: SOURCE_ID, draftDirty: true });
    expect(component['sourceKey']()).toBe(`VERSION:${VERSION_2_ID}`);
    expect(component['sourceOptions']()[0].disabled).toBe(true);

    const readOnlyDetail = makeDetail({
      capabilities: {
        ...makeDetail().capabilities,
        update: { state: 'HIDDEN', reason: 'ACCESS_POLICY_READ_ONLY' },
      },
    });
    await openModal(SOURCE_ID, readOnlyDetail);
    expect(component['sourceKey']()).toBe(`VERSION:${VERSION_2_ID}`);
    expect(component['sourceOptions']().some((o) => o.value === 'DRAFT')).toBe(false);
  });

  it('captures correlationId on load failure and retries all three endpoints', async () => {
    component.open(SOURCE_ID);
    await tick();

    http
      .expectOne(`${BASE_URL}/${SOURCE_ID}`)
      .flush({ errorCode: 'CORE.TEMPLATE.NOT_FOUND', correlationId: 'corr-404' }, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${BASE_URL}/${SOURCE_ID}/versions`).flush({
      success: true,
      data: { items: [], pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [] } });
    await tick();

    expect(component['loadFailed']()).toBe(true);
    expect(component['loadCorrelationId']()).toBe('corr-404');

    component['retryLoad']();
    await tick();
    const detail = makeDetail();
    http.expectOne(`${BASE_URL}/${SOURCE_ID}`).flush({ success: true, data: detail });
    http.expectOne((r) => r.url === `${BASE_URL}/${SOURCE_ID}/versions`).flush({
      success: true,
      data: { items: makeVersions(), pageInfo: { limit: 100, hasNextPage: false, nextCursor: null } },
    });
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    await tick();

    expect(component['loadFailed']()).toBe(false);
    expect(component['loadCorrelationId']()).toBeNull();
  });

  it('validates name, code, description, scope, and convert-mode target layout', async () => {
    await openModal({ templateId: SOURCE_ID, convertLayout: true });

    component['onNameInput']('   ');
    component['onCodeInput']('-bad');
    component['onDescriptionInput']('x'.repeat(1001));
    component['onTargetLayoutChange']('HYBRID_DOCUMENT');

    void component['submit']();

    expect(component['attempted']()).toBe(true);
    expect(component['nameError']()).toBe(createEn.details.errors.nameRequired);
    expect(component['codeError']()).toBe(createEn.details.errors.codePattern);
    expect(component['descriptionError']()).toBe(createEn.details.errors.descriptionTooLong);
    expect(component['targetLayoutError']()).toBe(createEn.duplicate.errors.targetLayoutRequired);
  });

  it('duplicates from CURRENT_DRAFT with UUIDv7 key, omits blank description, captures 201 receipt, emits, and navigates', async () => {
    await openModal();
    component['onDescriptionInput']('   ');
    component['onScopeChange']('TENANT');

    const duplicated: CreateTemplateResponse[] = [];
    component.duplicated.subscribe((res) => duplicated.push(res));

    void component['submit']();
    await tick();

    const req = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(req.request.body).toEqual({
      source: { kind: 'CURRENT_DRAFT', expectedDraftRevision: 7 },
      code: 'QT-STANDARD-COPY',
      name: 'Standard Quotation (Copy)',
      scope: { type: 'TENANT' },
      copyAssignments: false,
    });
    expect(req.request.body).not.toHaveProperty('description');

    const payload = makeDuplicateResponse();
    req.flush(
      { success: true, data: payload },
      { status: 201, statusText: 'Created', headers: { ETag: '"1"', Location: `${BASE_URL}/${NEW_ID}` } },
    );
    await tick();

    expect(duplicated).toEqual([payload]);
    expect(component['lastDuplicateReceipt']()).toEqual({
      status: 201,
      etag: '"1"',
      location: `${BASE_URL}/${NEW_ID}`,
    });
    expect(notify.success).toHaveBeenCalledWith(
      createEn.duplicate.duplicatedTitle,
      createEn.duplicate.duplicatedText.replace('{{name}}', 'Standard Quotation (Copy)'),
    );
    expect(component['isOpen']()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/workspace/operations/template-platform', NEW_ID, 'design']);
  });

  it('converts from VERSION with target layout, includes description, and skips navigation when navigateOnSuccess=false', async () => {
    fixture.componentRef.setInput('navigateOnSuccess', false);
    await openModal({
      templateId: SOURCE_ID,
      sourceKind: 'VERSION',
      versionId: VERSION_1_ID,
      convertLayout: true,
      targetLayoutMode: 'FIXED_CANVAS',
    });

    void component['submit']();
    await tick();

    const req = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(req.request.body).toEqual({
      source: { kind: 'VERSION', versionId: VERSION_1_ID },
      code: 'QT-STANDARD-COPY',
      name: 'Standard Quotation (Copy)',
      description: 'Default print quotation',
      scope: { type: 'COMPANY', companyId: COMPANY_ID },
      copyAssignments: false,
      conversion: { layoutMode: 'FIXED_CANVAS' },
    });

    const payload = makeDuplicateResponse({ layoutMode: 'FIXED_CANVAS', description: 'Default print quotation' });
    req.flush(
      { success: true, data: payload },
      { status: 201, statusText: 'Created', headers: { ETag: '"1"', Location: `${BASE_URL}/${NEW_ID}` } },
    );
    await tick();

    expect(notify.success).toHaveBeenCalledWith(
      createEn.duplicate.convertedTitle,
      createEn.duplicate.convertedText.replace('{{name}}', 'Standard Quotation (Copy)'),
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('handles 409 CODE.CONFLICT, 422 LAYOUT.INCOMPATIBLE issueCodes/issuePaths, retryable key retention, and malformed 201', async () => {
    await openModal({ templateId: SOURCE_ID, convertLayout: true });

    let retainedKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      void component['submit']();
      await tick();
      const req = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (retainedKey) expect(key).toBe(retainedKey);
      retainedKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Failed' });
      await tick();
      expect(notify.error).toHaveBeenCalled();
    }

    // 422 LAYOUT.INCOMPATIBLE surfaces parallel issueCodes/issuePaths and clears key
    void component['submit']();
    await tick();
    const incompReq = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(incompReq.request.headers.get('x-idempotency-key')).toBe(retainedKey);
    incompReq.flush(
      {
        errorCode: 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE',
        details: {
          reason: ['conversion_loss'],
          issueCodes: ['TEMPLATE_CONVERSION_CONTENT_LOSS'],
          issueReasons: ['conversion_loss'],
          issueMessages: ['Node cannot convert'],
          issuePaths: ['$.nodes.n1'],
          issueNodeIds: ['n1'],
        },
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await tick();
    expect(notify.error).toHaveBeenCalledWith(
      createEn.errors.TEMPLATE_CONVERSION_CONTENT_LOSS,
      '$.nodes.n1',
    );

    // 409 CODE.CONFLICT sets inline error and rotates key
    void component['submit']();
    await tick();
    const conflictReq = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    const keyAfter422 = conflictReq.request.headers.get('x-idempotency-key');
    expect(keyAfter422).not.toBe(retainedKey);
    conflictReq.flush({ errorCode: 'CORE.TEMPLATE.CODE.CONFLICT' }, { status: 409, statusText: 'Conflict' });
    await tick();
    expect(component['codeError']()).toBe(templatesEn.errors['CORE.TEMPLATE.CODE.CONFLICT']);

    // Editing rotates key, and malformed 201 fails closed
    component['onCodeInput']('QT-STANDARD-COPY-2');
    void component['submit']();
    await tick();
    const badReceiptReq = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(badReceiptReq.request.headers.get('x-idempotency-key')).not.toBe(keyAfter422);
    badReceiptReq.flush({ success: true, data: {} }, { status: 201, statusText: 'Created' });
    await tick();

    expect(component['isOpen']()).toBe(true);
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors.generic);
  });

  it('guards dirty close with unsaved dialog and emits closed once on discard', async () => {
    await openModal();
    component['onNameInput']('Edited Copy Name');
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component['requestCancel']();
    await tick();
    expect(component['guardBusy']()).toBe(true);
    expect(closed).not.toHaveBeenCalled();

    (component['unsavedDialog']() as unknown as { close: (c: 'discard') => void }).close('discard');
    await tick();
    expect(component['isOpen']()).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);

  });

  it('emits closed once on clean close', async () => {
    await openModal();
    const cleanClosed = vi.fn();
    component.closed.subscribe(cleanClosed);
    component['requestCancel']();
    expect(component['isOpen']()).toBe(false);
    expect(cleanClosed).toHaveBeenCalledTimes(1);
  });
});
