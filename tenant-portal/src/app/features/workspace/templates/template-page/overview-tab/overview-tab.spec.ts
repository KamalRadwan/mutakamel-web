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
import type { TemplateCapabilityState, TemplateDefinitionDetail } from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { OverviewTab } from './overview-tab';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({ ...globalEn, templates: templatesEn, templatesPage: templatesPageEn } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const VERSION_ID = '01948100-0000-7000-8000-000000002001';
const CHECKSUM = 'a'.repeat(64);
const THUMB_PATH = `${BASE_URL}/${TEMPLATE_ID}/thumbnail?sourceKind=DRAFT&draftRevision=3&sourceChecksum=${CHECKSUM}`;
const RETRY_URL = `${BASE_URL}/${TEMPLATE_ID}/thumbnail/retry`;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: {
      state: 'READY',
      sourceChecksum: CHECKSUM,
      contentChecksum: 'b'.repeat(64),
      widthPx: 240,
      heightPx: 320,
      expiresAt: '2026-12-01T00:00:00Z',
      downloadPath: THUMB_PATH,
    },
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

describe('OverviewTab', () => {
  let fixture: ComponentFixture<OverviewTab>;
  let component: OverviewTab;
  let service: TemplatePageService;
  let http: HttpTestingController;
  let origCreateObjectUrl: PropertyDescriptor | undefined;
  let origRevokeObjectUrl: PropertyDescriptor | undefined;
  let createObjectUrlMock: ReturnType<typeof vi.fn>;
  let revokeObjectUrlMock: ReturnType<typeof vi.fn>;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.read'], permissionScopes: {} });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(() => {
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof');

    origCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    origRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    createObjectUrlMock = vi.fn(() => 'blob:overview-thumb-1');
    revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrlMock });

    TestBed.configureTestingModule({
      imports: [OverviewTab],
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
    if (origCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', origCreateObjectUrl);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (origRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', origRevokeObjectUrl);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function mount(def: TemplateDefinitionDetail): Promise<void> {
    service.syncFromDefinition(def);
    fixture = TestBed.createComponent(OverviewTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();
  }

  it('loads READY thumbnail via downloadPath and revokes object URL on destroy', async () => {
    await mount(makeDefinition());

    const blob = new Blob(['png'], { type: 'image/png' });
    const req = http.expectOne(THUMB_PATH);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBe(true);
    req.flush(blob);
    await tick();

    expect(createObjectUrlMock).toHaveBeenCalledWith(blob);
    expect(component['thumbUrl']()).toBe('blob:overview-thumb-1');
    expect(component['thumbLoadError']()).toBe(false);

    fixture.destroy();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:overview-thumb-1');
  });

  it('falls back to pinned thumbnail query (DRAFT and PUBLISHED) when downloadPath is empty', async () => {
    const baseDef = makeDefinition();
    await mount({
      ...baseDef,
      thumbnail: { ...baseDef.thumbnail, state: 'READY', downloadPath: '' } as TemplateDefinitionDetail['thumbnail'],
    });

    const draftReq = http.expectOne((r) => r.url === `${BASE_URL}/${TEMPLATE_ID}/thumbnail`);
    expect(draftReq.request.params.get('sourceKind')).toBe('DRAFT');
    expect(draftReq.request.params.get('draftRevision')).toBe('3');
    expect(draftReq.request.params.get('sourceChecksum')).toBe(CHECKSUM);
    draftReq.flush(new Blob(['png'], { type: 'image/png' }));
    await tick();

    service.syncFromDefinition(
      makeDefinition({
        capabilities: { ...baseDef.capabilities, update: cap('HIDDEN') },
        thumbnail: { ...baseDef.thumbnail, state: 'READY', downloadPath: '' } as TemplateDefinitionDetail['thumbnail'],
      }),
    );
    fixture.detectChanges();
    await tick();

    const pubReq = http.expectOne((r) => r.url === `${BASE_URL}/${TEMPLATE_ID}/thumbnail`);
    expect(pubReq.request.params.get('sourceKind')).toBe('PUBLISHED');
    expect(pubReq.request.params.get('versionId')).toBe(VERSION_ID);
    expect(pubReq.request.params.get('sourceChecksum')).toBe(CHECKSUM);
    pubReq.flush(new Blob(['png'], { type: 'image/png' }));
    await tick();
  });

  it('maps 409 THUMBNAIL.NOT_READY to PENDING and 410 UNAVAILABLE to thumbLoadError', async () => {
    await mount(makeDefinition());

    http
      .expectOne(THUMB_PATH)
      .flush(new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.THUMBNAIL.NOT_READY' })], { type: 'application/json' }), {
        status: 409,
        statusText: 'Conflict',
      });
    await tick();

    expect(service.definition()?.thumbnail.state).toBe('PENDING');
    expect(component['thumbLoadError']()).toBe(false);

    service.syncFromDefinition(makeDefinition());
    fixture.detectChanges();
    await tick();

    http
      .expectOne(THUMB_PATH)
      .flush(new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.THUMBNAIL.UNAVAILABLE' })], { type: 'application/json' }), {
        status: 410,
        statusText: 'Gone',
      });
    await tick();

    expect(component['thumbLoadError']()).toBe(true);
  });

  it('refreshes pending thumbnail via TemplatesApi.getTemplate and notifies on error', async () => {
    await mount(makeDefinition({ thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM } }));
    http.expectNone(() => true);

    const refreshPromise = component['refreshPendingThumbnail']();
    const getReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ success: true, data: makeDefinition({ thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM } }) });
    await refreshPromise;
    expect(service.definition()?.thumbnail.state).toBe('UNAVAILABLE');

    const failPromise = component['refreshPendingThumbnail']();
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await failPromise;
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE']);
  });

  it('ignores refresh and retry responses after switching templates', async () => {
    const original = makeDefinition({ thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM } });
    const next = makeDefinition({
      templateId: '01948100-0000-7000-8000-000000001002',
      thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM },
    });
    await mount(original);

    const refresh = component['refreshPendingThumbnail']();
    const read = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`);
    service.syncFromDefinition(next);
    read.flush({ success: true, data: original });
    await refresh;
    expect(service.definition()).toEqual(next);

    service.syncFromDefinition(original);
    const retry = component['retryThumbnail']();
    const write = http.expectOne(RETRY_URL);
    service.syncFromDefinition(next);
    write.flush({
      success: true,
      data: {
        kind: 'THUMBNAIL_ACCEPTED', thumbnailJobId: 'job-1', state: 'PENDING',
        generation: 1, sourceChecksum: CHECKSUM, location: THUMB_PATH,
      },
    }, { status: 202, statusText: 'Accepted' });
    await retry;
    expect(service.definition()).toEqual(next);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('retries thumbnail with CSRF and UUIDv7 idempotency key, retaining key on retryable errors and rotating after terminal error', async () => {
    await mount(makeDefinition({ thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM } }));
    http.expectNone(() => true);

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['retryThumbnail']();
      const req = http.expectOne(RETRY_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;
      expect(req.request.body).toEqual({ sourceKind: 'DRAFT', draftRevision: 3, sourceChecksum: CHECKSUM });
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
      expect(notify.error).toHaveBeenCalled();
    }

    const terminal = component['retryThumbnail']();
    const sameReq = http.expectOne(RETRY_URL);
    expect(sameReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    sameReq.flush({ errorCode: 'CORE.TEMPLATE.NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await terminal;
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.NOT_FOUND']);

    const ok = component['retryThumbnail']();
    const rotatedReq = http.expectOne(RETRY_URL);
    expect(rotatedReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    rotatedReq.flush(
      {
        success: true,
        data: {
          kind: 'THUMBNAIL_ACCEPTED',
          thumbnailJobId: 'job-1',
          state: 'PENDING',
          generation: 1,
          sourceChecksum: CHECKSUM,
          location: THUMB_PATH,
        },
      },
      { status: 202, statusText: 'Accepted' },
    );
    await ok;

    expect(service.definition()?.thumbnail.state).toBe('PENDING');
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.overview.thumbnailCard.retriedToast);
  });
});
