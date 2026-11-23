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
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type {
  CreateTemplateResponse,
  TemplateDataSourceItem,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateStarterOption,
} from '../../templates.model';
import { TemplateCreateWizard } from './create-wizard';

const BASE_URL = '/api/tenant/core/v1/templates';
const SCOPES_URL = `${BASE_URL}/creation-scopes`;
const DATA_SOURCES_URL = `${BASE_URL}/data-sources`;
const STARTERS_URL = `${BASE_URL}/starters`;
const COMPANY_ID = '01948100-0000-7000-8000-000000000101';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
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

const DATA_SOURCES: TemplateDataSourceItem[] = [
  {
    adapterKey: 'TRADE_QUOTATION_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion: 2,
    schemaChecksum: CHECKSUM,
    documentType: 'QUOTATION',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 12,
  },
  {
    adapterKey: 'CORE_BUSINESS_LETTER_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion: 1,
    schemaChecksum: CHECKSUM,
    documentType: 'LETTER',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 6,
  },
  {
    adapterKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion: 1,
    schemaChecksum: CHECKSUM,
    documentType: 'CRM_OUTBOUND_EMAIL',
    allowedOutputChannels: ['EMAIL'],
    allowedLayoutModes: ['EMAIL_FLOW'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 5,
  },
  {
    adapterKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion: 1,
    schemaChecksum: CHECKSUM,
    documentType: 'CRM_OUTBOUND_EMAIL',
    allowedOutputChannels: ['EMAIL'],
    allowedLayoutModes: ['EMAIL_FLOW'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 5,
  },
  {
    adapterKey: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
    schemaVersion: 1,
    schemaChecksum: CHECKSUM,
    documentType: 'CRM_OUTBOUND_EMAIL',
    allowedOutputChannels: ['EMAIL'],
    allowedLayoutModes: ['EMAIL_FLOW'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 5,
  },
];

function makeStarter(overrides: Partial<TemplateStarterOption> = {}): TemplateStarterOption {
  return {
    starterKey: 'trade.quotation.en-US.hybrid.v1',
    displayName: 'Modern quotation',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: CHECKSUM,
    locale: 'en-US',
    resolvedDirection: 'LTR',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: CHECKSUM,
    descriptorChecksum: CHECKSUM,
    thumbnail: {
      state: 'READY',
      sourceChecksum: CHECKSUM,
      contentChecksum: CHECKSUM,
      widthPx: 240,
      heightPx: 320,
      expiresAt: '2026-12-01T00:00:00Z',
      downloadPath: `${STARTERS_URL}/trade.quotation.en-US.hybrid.v1/thumbnail`,
    },
    ...overrides,
  };
}

function makeCreateResponse(overrides: {
  code?: string;
  name?: string;
  description?: string | null;
  outputChannel?: 'PRINT' | 'EMAIL';
  layoutMode?: 'HYBRID_DOCUMENT' | 'EMAIL_FLOW';
  starterKey?: string;
} = {}): CreateTemplateResponse {
  const isEmail = overrides.outputChannel === 'EMAIL';
  const definition: TemplateDefinitionDetail = {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: overrides.code ?? 'TPL-SPEC-NEW',
    name: overrides.name ?? 'Spec quotation',
    description: overrides.description ?? null,
    documentType: isEmail ? 'CRM_OUTBOUND_EMAIL' : 'QUOTATION',
    outputChannel: overrides.outputChannel ?? 'PRINT',
    layoutMode: overrides.layoutMode ?? (isEmail ? 'EMAIL_FLOW' : 'HYBRID_DOCUMENT'),
    dataSourceKey: isEmail ? 'CRM_LEAD_OUTBOUND_EMAIL_V1' : 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: isEmail ? 1 : 2,
    dataSourceSchemaChecksum: CHECKSUM,
    locale: 'en-US',
    direction: 'AUTO',
    resolvedDirection: 'LTR',
    scope: { type: 'TENANT' },
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 1,
    etag: '"1"',
    currentDraft: {
      draftId: DRAFT_ID,
      revision: 1,
      contentChecksum: CHECKSUM,
      validationState: 'NOT_VALIDATED',
      etag: '"1"',
    },
    currentPublishedVersion: null,
    createdAt: '2026-11-23T12:00:00Z',
    createdBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    updatedAt: '2026-11-23T12:00:00Z',
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
      delete: { state: 'ENABLED', reason: null },
      manageAssignments: { state: 'ENABLED', reason: null },
    },
  };

  const draft: TemplateDraftDto = {
    draftId: DRAFT_ID,
    templateId: TEMPLATE_ID,
    editorDocument: {
      schemaVersion: 1,
      documentType: definition.documentType,
      outputChannel: definition.outputChannel,
      layoutMode: definition.layoutMode,
      dataSourceKey: definition.dataSourceKey,
      locale: definition.locale,
      direction: definition.direction,
      ...(isEmail
        ? {}
        : {
            page: {
              unit: 'MM',
              preset: 'A4',
              widthMm: 210,
              heightMm: 297,
              orientation: 'PORTRAIT',
              marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
            },
          }),
      theme: {
        fontFamilyToken: 'SYSTEM_SANS',
        baseFontSizePx: 14,
        textColor: '#0F172A',
        lineHeight: 1.5,
      },
      rootNodeIds: [],
      nodes: {},
      ...(overrides.starterKey ? { metadata: { starterKey: overrides.starterKey } } : {}),
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

describe('TemplateCreateWizard', () => {
  let fixture: ComponentFixture<TemplateCreateWizard>;
  let component: TemplateCreateWizard;
  let http: HttpTestingController;
  let router: Router;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({
    id: 'actor-1',
    isTenantOwner: true,
    permissions: ['templates.read', 'templates.create'],
    permissionScopes: {},
  });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);
  const originalCreateUrl = URL.createObjectURL;
  const originalRevokeUrl = URL.revokeObjectURL;

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

    let urlSeq = 0;
    URL.createObjectURL = vi.fn(() => `blob:starter-${++urlSeq}`);
    URL.revokeObjectURL = vi.fn();

    TestBed.configureTestingModule({
      imports: [TemplateCreateWizard],
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

    fixture = TestBed.createComponent(TemplateCreateWizard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    URL.createObjectURL = originalCreateUrl;
    URL.revokeObjectURL = originalRevokeUrl;
    vi.restoreAllMocks();
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function openWizard(
    scopes: unknown[] = [{ type: 'TENANT' }, { type: 'COMPANY', companyId: COMPANY_ID, label: 'Alpha Co' }],
    sources: TemplateDataSourceItem[] = DATA_SOURCES,
  ): Promise<void> {
    component.open();
    await tick();

    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes } });
    await tick();

    if (scopes.length > 0) {
      const dsReq = http.expectOne((r) => r.url === DATA_SOURCES_URL);
      dsReq.flush({
        success: true,
        data: { registryVersion: 'template-data-schema-registry.v1', registryChecksum: CHECKSUM, items: sources },
      });
      await tick();
    }
  }

  function fillValidDetails(code = 'TPL-SPEC-NEW'): void {
    component['onNameInput']('Spec quotation');
    component['onCodeInput'](code);
    component['onDescriptionInput']('  Written by the spec  ');
  }

  async function enterStarterStep(items: TemplateStarterOption[] = [makeStarter()], withThumb = true): Promise<void> {
    component['goNext']();
    await tick();

    const startersReq = http.expectOne((r) => r.url === STARTERS_URL);
    startersReq.flush({
      success: true,
      data: { items, count: items.length, registryVersion: 'template-platform.mvp.v1', registryFingerprint: CHECKSUM },
    });
    await tick();

    if (withThumb) {
      for (const item of items) {
        if (item.thumbnail.state === 'READY') {
          const thumbReq = http.expectOne((r) => r.url === `${STARTERS_URL}/${encodeURIComponent(item.starterKey)}/thumbnail`);
          expect(thumbReq.request.responseType).toBe('blob');
          expect(thumbReq.request.withCredentials).toBe(true);
          thumbReq.flush(new Blob(['png'], { type: 'image/png' }));
        }
      }
      await tick();
    }
  }

  it('opens on Details, loads creation scopes and tenant data sources via TemplatesApi, and stays clean', async () => {
    await openWizard();

    expect(component['isOpen']()).toBe(true);
    expect(component['step']()).toBe('details');
    expect(component['loading']()).toBe(false);
    expect(component['loadFailed']()).toBe(false);
    expect(component['creationScopes']()).toHaveLength(2);
    expect(component['scopeKey']()).toBe('TENANT');
    expect(component['dataSourcesLoaded']()).toBe(true);
    expect(component['documentType']()).toBe('QUOTATION');
    expect(component['dataSourceKey']()).toBe('TRADE_QUOTATION_PRINT_V1');
    expect(component['outputChannel']()).toBe('PRINT');
    expect(component['dirty']()).toBe(false);
  });

  it('loads company data sources when preferred scope or scope change targets COMPANY', async () => {
    component.open({ type: 'COMPANY', companyId: COMPANY_ID });
    await tick();

    http.expectOne(SCOPES_URL).flush({
      success: true,
      data: { scopes: [{ type: 'TENANT' }, { type: 'COMPANY', companyId: COMPANY_ID, label: 'Alpha Co' }] },
    });
    await tick();

    const dsCompanyReq = http.expectOne((r) => r.url === DATA_SOURCES_URL);
    expect(dsCompanyReq.request.params.get('scopeType')).toBe('COMPANY');
    expect(dsCompanyReq.request.params.get('companyId')).toBe(COMPANY_ID);
    expect(dsCompanyReq.request.params.get('branchId')).toBeNull();
    dsCompanyReq.flush({
      success: true,
      data: { registryVersion: 'v1', registryChecksum: CHECKSUM, items: DATA_SOURCES },
    });
    await tick();

    expect(component['scopeKey']()).toBe(`COMPANY:${COMPANY_ID}`);
    expect(component['selectedScope']()).toEqual({ type: 'COMPANY', companyId: COMPANY_ID });

    component['onScopeChange']('TENANT');
    await tick();

    const dsTenantReq = http.expectOne((r) => r.url === DATA_SOURCES_URL);
    expect(dsTenantReq.request.params.get('scopeType')).toBe('TENANT');
    expect(dsTenantReq.request.params.get('companyId')).toBeNull();
    dsTenantReq.flush({
      success: true,
      data: { registryVersion: 'v1', registryChecksum: CHECKSUM, items: DATA_SOURCES },
    });
    await tick();
  });

  it('captures correlationId on initial load failure and retries cleanly', async () => {
    component.open();
    await tick();

    http
      .expectOne(SCOPES_URL)
      .flush({ errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-init-503' }, { status: 503, statusText: 'Unavailable' });
    await tick();

    expect(component['loadFailed']()).toBe(true);
    expect(component['loadCorrelationId']()).toBe('corr-init-503');

    component['retryInitialLoad']();
    await tick();
    http.expectOne(SCOPES_URL).flush({ success: true, data: { scopes: [{ type: 'TENANT' }] } });
    await tick();
    http.expectOne((r) => r.url === DATA_SOURCES_URL).flush({
      success: true,
      data: { registryVersion: 'v1', registryChecksum: CHECKSUM, items: DATA_SOURCES },
    });
    await tick();

    expect(component['loadFailed']()).toBe(false);
    expect(component['loadCorrelationId']()).toBeNull();
  });

  it('validates step 1 (details) fields and blocks advancing when invalid', async () => {
    await openWizard();

    expect(component['nameError']()).toBeNull();
    component['goNext']();
    expect(component['step']()).toBe('details');
    expect(component['step1Attempted']()).toBe(true);
    expect(component['nameError']()).toBe(createEn.details.errors.nameRequired);
    expect(component['codeError']()).toBe(createEn.details.errors.codeRequired);
    expect(component['isStepInvalid']('details')).toBe(true);

    component['onCodeInput']('tpl-lower');
    expect(component['code']()).toBe('TPL-LOWER');

    component['onNameInput']('x'.repeat(201));
    component['onCodeInput']('-BAD');
    component['onDescriptionInput']('d'.repeat(1001));
    expect(component['nameError']()).toBe(createEn.details.errors.nameTooLong);
    expect(component['codeError']()).toBe(createEn.details.errors.codePattern);
    expect(component['descriptionError']()).toBe(createEn.details.errors.descriptionTooLong);

    component['onCodeInput']('A'.repeat(101));
    expect(component['codeError']()).toBe(createEn.details.errors.codeTooLong);

    component['goToStep']('review');
    expect(component['step']()).toBe('details');

    fillValidDetails();
    component['goNext']();
    expect(component['step']()).toBe('document');
    expect(component['isStepDone'](0, 'details')).toBe(true);
  });

  it('handles document type, layout compatibility, email page skip, and empty data sources guard', async () => {
    await openWizard();
    fillValidDetails();
    component['goNext']();

    component['selectDocumentType']('CRM_OUTBOUND_EMAIL');
    expect(component['isEmail']()).toBe(true);
    expect(component['outputChannel']()).toBe('EMAIL');
    expect(component['layoutMode']()).toBe('EMAIL_FLOW');
    expect(component['dataSourceKey']()).toBe('CRM_LEAD_OUTBOUND_EMAIL_V1');
    expect(component['emailSourceOptions']().map((o) => o.value)).toEqual([
      'CRM_LEAD_OUTBOUND_EMAIL_V1',
      'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
      'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    ]);
    expect(component['isLayoutDisabled']('HYBRID_DOCUMENT')).toBe(true);
    expect(component['isLayoutDisabled']('EMAIL_FLOW')).toBe(false);
    expect(component['isStepSkipped']('page')).toBe(true);

    await enterStarterStep([
      makeStarter({
        starterKey: 'crm.lead.en-US.email.v1',
        documentType: 'CRM_OUTBOUND_EMAIL',
        outputChannel: 'EMAIL',
        layoutMode: 'EMAIL_FLOW',
        dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
        dataSourceSchemaVersion: 1,
        thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM },
      }),
    ], false);
    expect(component['step']()).toBe('starter');
    component['goPrevious']();
    expect(component['step']()).toBe('document');

    component['selectDocumentType']('LETTER');
    component['selectLayoutMode']('FIXED_CANVAS');
    expect(component['dataSourceKey']()).toBe('CORE_BUSINESS_LETTER_PRINT_V1');
    expect(component['isLayoutDisabled']('EMAIL_FLOW')).toBe(true);

    component['onLocaleChange']('ar-EG');
    expect(component['resolvedDirection']()).toBe('RTL');
    component['onLocaleChange']('en-US');
    expect(component['resolvedDirection']()).toBe('LTR');

    // Empty data sources guard blocks advancing past Document
    await openWizard([{ type: 'TENANT' }], []);
    fillValidDetails();
    component['goNext']();
    expect(component['step']()).toBe('document');
    component['goNext']();
    expect(component['step']()).toBe('document');
    expect(notify.error).toHaveBeenCalledWith(createEn.document.errors.noCompatibleSources);
  });

  it('validates page dimensions/margins and fetches starters + READY thumbnail via TemplatesApi', async () => {
    await openWizard();
    fillValidDetails();
    component['goNext']();
    component['onLocaleChange']('en-US');
    component['goNext']();
    expect(component['step']()).toBe('page');

    component['onOrientationChange']('LANDSCAPE');
    expect([component['diagramWidthMm'](), component['diagramHeightMm']()]).toEqual([297, 210]);

    component['onPresetChange']('CUSTOM');
    component['onNumericInput']('width', '40');
    component['onNumericInput']('height', '');
    component['goNext']();
    expect(component['step']()).toBe('page');
    expect(component['widthError']()).toBe(createEn.page.errors.widthRange);
    expect(component['heightError']()).toBe(createEn.page.errors.heightRange);

    component['onPresetChange']('A4');
    component['onOrientationChange']('PORTRAIT');
    component['onNumericInput']('top', '101');
    component['goNext']();
    expect(component['marginTopError']()).toBe(createEn.page.errors.marginRange);

    component['onNumericInput']('top', '12');
    await enterStarterStep();

    expect(component['step']()).toBe('starter');
    expect(component['starters']()).toHaveLength(1);
    expect(component['starterThumbUrls']()['trade.quotation.en-US.hybrid.v1']).toBe('blob:starter-1');

    // Changing tuple clears starter and notifies
    component['selectStarter']('trade.quotation.en-US.hybrid.v1');
    component['onLocaleChange']('ar-EG');
    expect(component['selectedStarterKey']()).toBeNull();
    expect(notify.info).toHaveBeenCalledWith(createEn.wizard.starterClearedTitle, createEn.wizard.starterClearedText);

    // Closing revokes blob URLs
    component['onModalClosed']();
    await tick();
    (component['unsavedDialog']() as unknown as { close: (c: 'discard') => void }).close('discard');
    await tick();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:starter-1');
  });

  it('retries failed starters load with correlationId', async () => {
    await openWizard();
    fillValidDetails();
    component['goNext']();
    component['goNext']();

    component['goNext']();
    await tick();
    http
      .expectOne((r) => r.url === STARTERS_URL)
      .flush({ errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', correlationId: 'corr-starters' }, { status: 503, statusText: 'Unavailable' });
    await tick();

    expect(component['startersFailed']()).toBe(true);
    expect(component['startersCorrelationId']()).toBe('corr-starters');

    component['reloadStarters']();
    await tick();
    http.expectOne((r) => r.url === STARTERS_URL).flush({
      success: true,
      data: { items: [], count: 0, registryVersion: 'v1', registryFingerprint: CHECKSUM },
    });
    await tick();

    expect(component['startersFailed']()).toBe(false);
    expect(component['startersCorrelationId']()).toBeNull();
  });

  it('creates a print template with UUIDv7 key, CSRF, 201 receipt headers, emits created, and navigates', async () => {
    await openWizard();
    fillValidDetails('TPL-SPEC-NEW');
    component['goNext']();
    component['onLocaleChange']('en-US');
    component['goNext']();
    await enterStarterStep();
    component['selectStarter']('trade.quotation.en-US.hybrid.v1');
    component['goNext']();
    expect(component['step']()).toBe('review');

    const created: CreateTemplateResponse[] = [];
    component.created.subscribe((r) => created.push(r));

    component['goNext']();
    await tick();

    const createReq = http.expectOne(BASE_URL);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.withCredentials).toBe(true);
    expect(createReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(createReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(createReq.request.body).toEqual({
      code: 'TPL-SPEC-NEW',
      name: 'Spec quotation',
      description: 'Written by the spec',
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'en-US',
      direction: 'AUTO',
      scope: { type: 'TENANT' },
      page: {
        preset: 'A4',
        orientation: 'PORTRAIT',
        marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
      },
      starterKey: 'trade.quotation.en-US.hybrid.v1',
    });

    const payload = makeCreateResponse({
      code: 'TPL-SPEC-NEW',
      name: 'Spec quotation',
      description: 'Written by the spec',
      starterKey: 'trade.quotation.en-US.hybrid.v1',
    });
    createReq.flush(
      { success: true, data: payload },
      { status: 201, statusText: 'Created', headers: { ETag: '"1"', Location: `${BASE_URL}/${TEMPLATE_ID}` } },
    );
    await tick();

    expect(created).toEqual([payload]);
    expect(component['lastCreateReceipt']()).toEqual({
      status: 201,
      etag: '"1"',
      location: `${BASE_URL}/${TEMPLATE_ID}`,
    });
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(component['isOpen']()).toBe(false);
    expect(component['saving']()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/workspace/operations/template-platform', TEMPLATE_ID, 'design']);
  });

  it('omits page and empty description for email templates and respects navigateOnCreate=false', async () => {
    fixture.componentRef.setInput('navigateOnCreate', false);
    await openWizard();
    component['onNameInput']('Email notice');
    component['onCodeInput']('TPL-EMAIL-1');
    component['goNext']();
    component['selectDocumentType']('CRM_OUTBOUND_EMAIL');
    await enterStarterStep([], false);
    component['goNext']();
    expect(component['step']()).toBe('review');

    component['goNext']();
    await tick();

    const req = http.expectOne(BASE_URL);
    expect(req.request.body).not.toHaveProperty('page');
    expect(req.request.body).not.toHaveProperty('description');
    req.flush(
      {
        success: true,
        data: makeCreateResponse({
          code: 'TPL-EMAIL-1',
          name: 'Email notice',
          outputChannel: 'EMAIL',
          layoutMode: 'EMAIL_FLOW',
        }),
      },
      { status: 201, statusText: 'Created', headers: { ETag: '"1"', Location: `${BASE_URL}/${TEMPLATE_ID}` } },
    );
    await tick();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('handles 409 CODE.CONFLICT inline, retains UUIDv7 key on retryable errors, rotates on terminal/edit, and rejects malformed 201', async () => {
    await openWizard();
    fillValidDetails('TPL-QT-CORP');
    component['goNext']();
    component['goNext']();
    await enterStarterStep([], false);
    component['goNext']();

    // Retryable errors retain the exact same key
    let retainedKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      component['goNext']();
      await tick();
      const req = http.expectOne(BASE_URL);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (retainedKey) expect(key).toBe(retainedKey);
      retainedKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Failed' });
      await tick();
      expect(notify.error).toHaveBeenCalled();
    }

    // Terminal 422 clears key so next submit uses a fresh UUIDv7 key
    component['goNext']();
    await tick();
    const err422Req = http.expectOne(BASE_URL);
    expect(err422Req.request.headers.get('x-idempotency-key')).toBe(retainedKey);
    err422Req.flush({ errorCode: 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE' }, { status: 422, statusText: 'Unprocessable' });
    await tick();
    expect(notify.error).toHaveBeenCalledWith(createEn.errors['CORE.TEMPLATE.LAYOUT.INCOMPATIBLE']);

    // 409 CODE.CONFLICT puts message on code field and navigates back to Details
    component['goNext']();
    await tick();
    const conflictReq = http.expectOne(BASE_URL);
    expect(conflictReq.request.headers.get('x-idempotency-key')).not.toBe(retainedKey);
    conflictReq.flush({ errorCode: 'CORE.TEMPLATE.CODE.CONFLICT' }, { status: 409, statusText: 'Conflict' });
    await tick();

    expect(component['step']()).toBe('details');
    expect(component['codeError']()).toBe(templatesEn.errors['CORE.TEMPLATE.CODE.CONFLICT']);
    expect(component['step1Valid']()).toBe(false);

    // Fix code and test malformed 201 fails closed
    component['onCodeInput']('TPL-QT-CORP-2');
    expect(component['codeError']()).toBeNull();
    component['goToStep']('review');
    component['goNext']();
    await tick();
    http.expectOne(BASE_URL).flush({ success: true, data: {} }, { status: 201, statusText: 'Created' });
    await tick();

    expect(component['isOpen']()).toBe(true);
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors.generic);
  });

  it('maps local, template, shared apiErrors, 429 retryAfter, and network/generic errors', async () => {
    await openWizard();
    const map = (e: unknown, isWrite = false) => component['translateErrorMessage'](e, isWrite);

    expect(map(new ApiError(422, 'CORE.TEMPLATE.PAGE.MISSING'))).toBe(createEn.errors['CORE.TEMPLATE.PAGE.MISSING']);
    expect(map(new ApiError(409, 'CORE.TEMPLATE.CODE.CONFLICT'))).toBe(templatesEn.errors['CORE.TEMPLATE.CODE.CONFLICT']);
    expect(map({ code: 'CORE.TEMPLATE.CODE.CONFLICT' })).toBe(templatesEn.errors['CORE.TEMPLATE.CODE.CONFLICT']);
    expect(map(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'), true)).toBe(globalEn.apiErrors.notSaved);
    expect(map(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['15'] }), true)).toBe(
      globalEn.apiErrors.rateLimitedIn.replace('{{seconds}}', '15'),
    );
    expect(map(new ApiError(400, 'CORE_VALIDATION_FAILED'), true)).toBe(globalEn.apiErrors.validation);
    expect(map(new ApiError(0, 'UNKNOWN.CODE'))).toBe(templatesEn.errors.network);
    expect(map(new ApiError(500, 'UNKNOWN.CODE'))).toBe(templatesEn.errors.generic);
    expect(map(new Error('boom'))).toBe(templatesEn.errors.generic);
  });

  it('guards dirty close with unsaved dialog and emits closed once on discard', async () => {
    await openWizard();
    fillValidDetails();
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component['onModalClosed']();
    await tick();
    expect(component['isOpen']()).toBe(true);
    expect(component['guardBusy']()).toBe(true);
    expect(closed).not.toHaveBeenCalled();

    (component['unsavedDialog']() as unknown as { close: (c: 'discard') => void }).close('discard');
    await tick();
    expect(component['isOpen']()).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);

  });

  it('emits closed once on clean close', async () => {
    await openWizard();
    const cleanClosed = vi.fn();
    component.closed.subscribe(cleanClosed);
    component['onModalClosed']();
    expect(component['isOpen']()).toBe(false);
    expect(cleanClosed).toHaveBeenCalledTimes(1);
  });
});
