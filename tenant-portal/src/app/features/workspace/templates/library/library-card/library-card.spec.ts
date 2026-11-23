import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, provideTranslocoScope, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import libraryEn from '../../../../../../../public/i18n/templates-library/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { TemplateCapabilityState, TemplateListRow } from '../../templates.model';
import { LibraryCard } from './library-card';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-library/')) return of(libraryEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of(globalEn as Translation);
  }
}

const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const VERSION_ID = '01948100-0000-7000-8000-000000002001';
const CHECKSUM = 'a'.repeat(64);
const THUMB_PATH = `/api/tenant/core/v1/templates/${TEMPLATE_ID}/thumbnail?sourceKind=DRAFT&draftRevision=3&sourceChecksum=${CHECKSUM}`;
const RETRY_URL = `/api/tenant/core/v1/templates/${TEMPLATE_ID}/thumbnail/retry`;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeRow(overrides: Partial<TemplateListRow> = {}): TemplateListRow {
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
    name: 'Sales Quotation',
    code: 'SALES_QUOTATION',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    lifecycleStatus: 'ACTIVE',
    draft: {
      draftId: '01948100-0000-7000-8000-000000003001',
      revision: 3,
      validationState: 'PASSED',
    },
    currentPublishedVersion: {
      versionId: VERSION_ID,
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: '2026-11-20T10:00:00Z',
    },
    locale: 'en-US',
    direction: 'LTR',
    resolvedDirection: 'LTR',
    definitionScope: { type: 'TENANT' },
    assignment: {
      requestedTarget: { type: 'TENANT' },
      evaluatedAt: '2026-11-22T10:00:00Z',
      state: 'NONE',
      effectiveCandidateCount: 0,
      primary: null,
      candidates: [],
      additionalCount: 0,
    },
    updatedAt: '2026-11-22T10:00:00Z',
    createdAt: '2026-11-20T10:00:00Z',
    author: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    definitionRevision: 2,
    definitionEtag: '"2"',
    actions: {
      open: cap('ENABLED'),
      design: cap('ENABLED'),
      validate: cap('ENABLED'),
      duplicateFromDraft: cap('ENABLED'),
      duplicateFromVersion: cap('ENABLED'),
      preview: cap('ENABLED'),
      publish: cap('ENABLED'),
      manageAssignments: cap('ENABLED'),
      restoreVersion: cap('ENABLED'),
      archive: cap('ENABLED'),
      restore: cap('HIDDEN'),
      delete: cap('DISABLED'),
    },
    ...overrides,
  };
}

describe('LibraryCard', () => {
  let fixture: ComponentFixture<LibraryCard>;
  let component: LibraryCard;
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
    createObjectUrlMock = vi.fn(() => 'blob:thumb-1');
    revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrlMock });

    TestBed.configureTestingModule({
      imports: [LibraryCard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslocoScope('templates', { scope: 'templates-library', alias: 'templatesLibrary' }),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: Loader,
        }),
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpTestingController);
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

  async function mount(row: TemplateListRow): Promise<void> {
    fixture = TestBed.createComponent(LibraryCard);
    fixture.componentRef.setInput('row', row);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await tick();
  }

  it('loads READY thumbnail via TemplatesApi downloadPath and revokes object URL on destroy', async () => {
    await mount(makeRow());
    const blob = new Blob(['png'], { type: 'image/png' });
    const req = http.expectOne(THUMB_PATH);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBe(true);
    req.flush(blob);
    await tick();

    expect(createObjectUrlMock).toHaveBeenCalledWith(blob);
    expect(component['thumbState']()).toBe('READY');
    expect(component['thumbUrl']()).toBe('blob:thumb-1');
    const img = fixture.nativeElement.querySelector('img');
    expect(img?.getAttribute('src')).toBe('blob:thumb-1');

    fixture.destroy();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:thumb-1');
  });

  it('falls back to pinned thumbnail query when downloadPath is empty (DRAFT and PUBLISHED)', async () => {
    const baseRow = makeRow();
    await mount({
      ...baseRow,
      thumbnail: { ...baseRow.thumbnail, state: 'READY', downloadPath: '' } as TemplateListRow['thumbnail'],
    });
    const draftReq = http.expectOne((r) => r.url === `/api/tenant/core/v1/templates/${TEMPLATE_ID}/thumbnail`);
    expect(draftReq.request.params.get('sourceKind')).toBe('DRAFT');
    expect(draftReq.request.params.get('draftRevision')).toBe('3');
    expect(draftReq.request.params.get('sourceChecksum')).toBe(CHECKSUM);
    draftReq.flush(new Blob(['png'], { type: 'image/png' }));
    await tick();

    fixture.componentRef.setInput(
      'row',
      makeRow({
        actions: { ...baseRow.actions, design: cap('HIDDEN') },
        thumbnail: { ...baseRow.thumbnail, state: 'READY', downloadPath: '' } as TemplateListRow['thumbnail'],
      }),
    );
    fixture.detectChanges();
    await tick();

    const pubReq = http.expectOne((r) => r.url === `/api/tenant/core/v1/templates/${TEMPLATE_ID}/thumbnail`);
    expect(pubReq.request.params.get('sourceKind')).toBe('PUBLISHED');
    expect(pubReq.request.params.get('versionId')).toBe(VERSION_ID);
    expect(pubReq.request.params.get('sourceChecksum')).toBe(CHECKSUM);
    pubReq.flush(new Blob(['png'], { type: 'image/png' }));
    await tick();
  });

  it('maps 409 NOT_READY to PENDING and other thumbnail errors to UNAVAILABLE', async () => {
    await mount(makeRow());
    http
      .expectOne(THUMB_PATH)
      .flush(new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.THUMBNAIL.NOT_READY' })], { type: 'application/json' }), {
        status: 409,
        statusText: 'Conflict',
      });
    await tick();
    expect(component['thumbState']()).toBe('PENDING');

    fixture.componentRef.setInput(
      'row',
      makeRow({
        draft: { draftId: '01948100-0000-7000-8000-000000003001', revision: 4, validationState: 'PASSED' },
      }),
    );
    fixture.detectChanges();
    await tick();

    http
      .expectOne(THUMB_PATH)
      .flush(new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.THUMBNAIL.UNAVAILABLE' })], { type: 'application/json' }), {
        status: 410,
        statusText: 'Gone',
      });
    await tick();
    expect(component['thumbState']()).toBe('UNAVAILABLE');
  });

  it('does not fetch thumbnail when state is PENDING or UNAVAILABLE', async () => {
    await mount(makeRow({ thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM } }));
    http.expectNone(() => true);
    expect(component['thumbState']()).toBe('PENDING');

    fixture.componentRef.setInput('row', makeRow({ thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM } }));
    fixture.detectChanges();
    await tick();
    http.expectNone(() => true);
    expect(component['thumbState']()).toBe('UNAVAILABLE');
  });

  it('retries thumbnail with DRAFT or PUBLISHED source, CSRF, UUIDv7 idempotency key, and emits thumbnailRetried', async () => {
    const row = makeRow({ thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM } });
    await mount(row);
    const retried = vi.fn();
    component.thumbnailRetried.subscribe(retried);

    const pending = component['retryThumb'](new MouseEvent('click'));
    const req = http.expectOne(RETRY_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(req.request.body).toEqual({ sourceKind: 'DRAFT', draftRevision: 3, sourceChecksum: CHECKSUM });
    req.flush(
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
    await pending;

    expect(component['thumbState']()).toBe('PENDING');
    expect(notify.info).toHaveBeenCalledWith(libraryEn.toasts.thumbnailQueued);
    expect(retried).toHaveBeenCalledWith(row);

    const readOnlyRow = makeRow({
      actions: { ...row.actions, design: cap('HIDDEN') },
      thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM },
    });
    fixture.componentRef.setInput('row', readOnlyRow);
    fixture.detectChanges();
    await tick();

    const pubPending = component['retryThumb'](new MouseEvent('click'));
    const pubReq = http.expectOne(RETRY_URL);
    expect(pubReq.request.body).toEqual({ sourceKind: 'PUBLISHED', versionId: VERSION_ID, sourceChecksum: CHECKSUM });
    pubReq.flush(
      {
        success: true,
        data: {
          kind: 'THUMBNAIL_ACCEPTED',
          thumbnailJobId: 'job-2',
          state: 'PENDING',
          generation: 1,
          sourceChecksum: CHECKSUM,
          location: THUMB_PATH,
        },
      },
      { status: 202, statusText: 'Accepted' },
    );
    await pubPending;
  });

  it('retains the idempotency key on retryable retryThumb failures and rotates after non-retryable or changed intent', async () => {
    const row = makeRow({ thumbnail: { state: 'UNAVAILABLE', sourceChecksum: CHECKSUM } });
    await mount(row);

    let firstKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['retryThumb'](new MouseEvent('click'));
      const req = http.expectOne(RETRY_URL);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (firstKey) expect(key).toBe(firstKey);
      firstKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
      expect(notify.error).toHaveBeenCalled();
    }

    const terminal = component['retryThumb'](new MouseEvent('click'));
    const sameKeyReq = http.expectOne(RETRY_URL);
    expect(sameKeyReq.request.headers.get('x-idempotency-key')).toBe(firstKey);
    sameKeyReq.flush({ errorCode: 'CORE.TEMPLATE.NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await terminal;
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.NOT_FOUND']);

    const afterTerminal = component['retryThumb'](new MouseEvent('click'));
    const rotatedReq = http.expectOne(RETRY_URL);
    expect(rotatedReq.request.headers.get('x-idempotency-key')).not.toBe(firstKey);
    rotatedReq.flush(
      {
        success: true,
        data: {
          kind: 'THUMBNAIL_ACCEPTED',
          thumbnailJobId: 'job-3',
          state: 'PENDING',
          generation: 1,
          sourceChecksum: CHECKSUM,
          location: THUMB_PATH,
        },
      },
      { status: 202, statusText: 'Accepted' },
    );
    await afterTerminal;
  });
});
