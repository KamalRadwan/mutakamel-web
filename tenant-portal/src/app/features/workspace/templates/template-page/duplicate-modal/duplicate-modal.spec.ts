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
import type { TemplateCapabilityState, TemplateDefinitionDetail, TemplateDraftDto } from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { TemplateDuplicateModal } from './duplicate-modal';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({ ...globalEn, templates: templatesEn, templatesPage: templatesPageEn } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const SOURCE_ID = '01948100-0000-7000-8000-000000001001';
const CREATED_ID = '01948100-0000-7000-8000-000000001099';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const VERSION_ID = '01948100-0000-7000-8000-000000002001';
const COMPANY_ID = '01948100-0000-7000-8000-000000000101';
const CHECKSUM = 'a'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: SOURCE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: 'SALES_QUOTATION',
    name: 'Sales Quotation',
    description: '',
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
      templateDefinitionId: SOURCE_ID,
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
    templateId: SOURCE_ID,
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

describe('TemplateDuplicateModal', () => {
  let fixture: ComponentFixture<TemplateDuplicateModal>;
  let component: TemplateDuplicateModal;
  let service: TemplatePageService;
  let http: HttpTestingController;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.create'], permissionScopes: {} });
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
      imports: [TemplateDuplicateModal],
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
    fixture = TestBed.createComponent(TemplateDuplicateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  it('duplicates from CURRENT_DRAFT via TemplatesApi and emits created templateId', async () => {
    const def = makeDefinition();
    const draft = makeDraft();
    service.syncFromDefinition(def);
    service.setDraft(draft);
    service.creationScopes.set([
      { type: 'TENANT' },
      { type: 'COMPANY', companyId: COMPANY_ID, label: 'Alpha Co' },
    ]);

    const emitted = vi.fn();
    component.created.subscribe(emitted);
    component.open(def, draft, false);
    fixture.detectChanges();

    const submitPromise = component['submit']();
    const req = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(req.request.body).toEqual({
      source: { kind: 'CURRENT_DRAFT', expectedDraftRevision: 3 },
      code: 'SALES_QUOTATION_COPY',
      name: 'Sales Quotation',
      scope: { type: 'TENANT' },
      copyAssignments: false,
    });

    req.flush(
      {
        success: true,
        data: {
          definition: makeDefinition({ templateId: CREATED_ID, code: 'SALES_QUOTATION_COPY', revision: 1, etag: '"1"' }),
          draft: makeDraft({ templateId: CREATED_ID, revision: 1, etag: '"1"' }),
        },
      },
      {
        status: 201,
        statusText: 'Created',
        headers: { Location: `${BASE_URL}/${CREATED_ID}`, ETag: '"1"' },
      },
    );
    await submitPromise;

    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.duplicateModal.createdToast);
    expect(emitted).toHaveBeenCalledWith(CREATED_ID);
  });

  it('converts layout from VERSION with COMPANY scope and optional description', async () => {
    const def = makeDefinition();
    const draft = makeDraft();
    service.syncFromDefinition(def);
    service.setDraft(draft);
    service.creationScopes.set([
      { type: 'TENANT' },
      { type: 'COMPANY', companyId: COMPANY_ID, label: 'Alpha Co' },
    ]);

    component.open(def, draft, true);
    component['sourceKind'].set('VERSION');
    component['targetLayout'].set('FIXED_CANVAS');
    component['selectedScopeKey'].set(`COMPANY:${COMPANY_ID}`);
    component['description'].set('Converted copy');
    fixture.detectChanges();

    const submitPromise = component['submit']();
    const req = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(req.request.body).toEqual({
      source: { kind: 'VERSION', versionId: VERSION_ID },
      code: 'SALES_QUOTATION_COPY',
      name: 'Sales Quotation',
      description: 'Converted copy',
      scope: { type: 'COMPANY', companyId: COMPANY_ID },
      copyAssignments: false,
      conversion: { layoutMode: 'FIXED_CANVAS' },
    });

    req.flush(
      {
        success: true,
        data: {
          definition: makeDefinition({ templateId: CREATED_ID, layoutMode: 'FIXED_CANVAS', revision: 1, etag: '"1"' }),
          draft: makeDraft({ templateId: CREATED_ID, revision: 1, etag: '"1"' }),
        },
      },
      { status: 201, statusText: 'Created', headers: { ETag: '"1"' } },
    );
    await submitPromise;
  });

  it('handles CODE.CONFLICT inline, LAYOUT.INCOMPATIBLE toast, and idempotency key retention vs rotation', async () => {
    const def = makeDefinition();
    const draft = makeDraft();
    service.syncFromDefinition(def);
    service.setDraft(draft);
    component.open(def, draft, true);

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['submit']();
      const req = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
      expect(notify.error).toHaveBeenCalled();
    }

    const conflictPromise = component['submit']();
    const conflictReq = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(conflictReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    conflictReq.flush({ errorCode: 'CORE.TEMPLATE.CODE.CONFLICT' }, { status: 409, statusText: 'Conflict' });
    await conflictPromise;
    expect(component['codeError']()).toBe(templatesEn.errors['CORE.TEMPLATE.CODE.CONFLICT']);

    const incompatiblePromise = component['submit']();
    const incompatibleReq = http.expectOne(`${BASE_URL}/${SOURCE_ID}/duplicate`);
    expect(incompatibleReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    incompatibleReq.flush({ errorCode: 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE' }, { status: 422, statusText: 'Unprocessable' });
    await incompatiblePromise;
    expect(notify.error).toHaveBeenCalledWith(templatesPageEn.errors['CORE.TEMPLATE.LAYOUT.INCOMPATIBLE']);
  });
});
