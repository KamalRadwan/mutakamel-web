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
import type {
  TemplateCapabilityState,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateRecoverySnapshotItem,
  TemplateRecoverySnapshotWireItem,
} from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { RecoveryTab } from './recovery-tab';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of({ ...globalEn, templates: templatesEn, templatesPage: templatesPageEn } as Translation);
  }
}

const BASE_URL = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const OTHER_TEMPLATE_ID = '01948100-0000-7000-8000-000000001002';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const SNAPSHOT_ID = '01948100-0000-7000-8000-000000004001';
const CHECKSUM = 'a'.repeat(64);
const SNAPSHOT_CHECKSUM = 'b'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeSnapshotItem(overrides: Partial<TemplateRecoverySnapshotItem> = {}): TemplateRecoverySnapshotItem {
  return {
    snapshotId: SNAPSHOT_ID,
    sourceDraftRevision: 2,
    sourceSchemaVersion: 1,
    targetSchemaVersion: 1,
    sourceContentChecksum: CHECKSUM,
    snapshotChecksum: SNAPSHOT_CHECKSUM,
    captureReason: 'PRE_SCHEMA_MIGRATION',
    captureAuditId: '01948100-0000-7000-8000-000000005001',
    createdAt: '2026-11-21T10:00:00Z',
    createdBy: { kind: 'USER', actorId: 'actor-creator', displayName: 'actor-creator' },
    expiresAt: '2099-12-21T10:00:00Z',
    integrityStatus: 'AVAILABLE',
    quarantinedAt: null,
    quarantineReason: null,
    cleanupRequestedAt: null,
    restoredAt: null,
    restoredBy: null,
    restoredToDraftRevision: null,
    objectDeletedAt: null,
    ...overrides,
  };
}

function makeWireSnapshot(overrides: Partial<TemplateRecoverySnapshotWireItem> = {}): TemplateRecoverySnapshotWireItem {
  return {
    snapshotId: SNAPSHOT_ID,
    sourceDraftRevision: 2,
    sourceSchemaVersion: 1,
    targetSchemaVersion: 1,
    sourceContentChecksum: CHECKSUM,
    snapshotChecksum: SNAPSHOT_CHECKSUM,
    captureReason: 'PRE_SCHEMA_MIGRATION',
    captureAuditId: '01948100-0000-7000-8000-000000005001',
    createdAt: '2026-11-21T10:00:00Z',
    createdBy: 'actor-creator',
    expiresAt: '2099-12-21T10:00:00Z',
    integrityStatus: 'AVAILABLE',
    quarantinedAt: null,
    quarantineReason: null,
    cleanupRequestedAt: null,
    restoredAt: null,
    restoredBy: null,
    restoredToDraftRevision: null,
    objectDeletedAt: null,
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<TemplateDefinitionDetail> = {}): TemplateDefinitionDetail {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
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

describe('RecoveryTab', () => {
  let fixture: ComponentFixture<RecoveryTab>;
  let component: RecoveryTab;
  let service: TemplatePageService;
  let http: HttpTestingController;

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.read'], permissionScopes: {} });
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
      imports: [RecoveryTab],
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
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  function mount(
    def = makeDefinition(),
    snapshots: TemplateRecoverySnapshotItem[] = [makeSnapshotItem()],
    draft: TemplateDraftDto | null = makeDraft(),
  ): void {
    service.syncFromDefinition(def);
    service.setDraft(draft);
    service.snapshots.set(snapshots);
    fixture = TestBed.createComponent(RecoveryTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('restores a snapshot with checksum/If-Match, adapts recovery actors, preserves header ETag, and refreshes state', async () => {
    const snap = makeSnapshotItem();
    mount(makeDefinition(), [snap]);

    component['openRestoreModal'](snap);
    component['reason'].set('  Recover pre-migration draft  ');
    component['discardCurrentDraft'].set(true);

    const restoredDraft = makeDraft({
      revision: 4,
      etag: '"3"',
      validation: { state: 'STALE', lastValidationRunId: null, validatedDraftRevision: null, errorCount: 0, warningCount: 0 },
    });
    const recoveredWire = makeWireSnapshot({
      restoredAt: '2026-11-23T12:00:00Z',
      restoredBy: 'actor-restorer',
      restoredToDraftRevision: 4,
    });
    const refreshedDef = makeDefinition({
      currentDraft: {
        draftId: DRAFT_ID,
        revision: 4,
        contentChecksum: CHECKSUM,
        validationState: 'STALE',
        etag: '"4"',
      },
    });

    const restorePromise = component['submitRestore']();
    const restoreReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`);
    expect(restoreReq.request.method).toBe('POST');
    expect(restoreReq.request.headers.get('If-Match')).toBe('"3"');
    expect(restoreReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(restoreReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(restoreReq.request.body).toEqual({
      expectedSnapshotChecksum: SNAPSHOT_CHECKSUM,
      reason: 'Recover pre-migration draft',
      discardCurrentDraft: true,
    });
    restoreReq.flush(
      {
        success: true,
        data: {
          draft: restoredDraft,
          migrationRecovery: null,
          recoveredFrom: recoveredWire,
          replacedDraftRecovery: null,
        },
      },
      { headers: { ETag: '"4"' } },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}`).flush({ success: true, data: refreshedDef }, { headers: { ETag: '"2"' } });
    http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`).flush({
      success: true,
      data: { items: [recoveredWire], pageInfo: { limit: 20, hasNextPage: false, nextCursor: null } },
    });
    await restorePromise;

    expect(service.draft()?.revision).toBe(4);
    expect(service.draft()?.etag).toBe('"4"');
    expect(service.snapshots()[0]?.restoredBy).toEqual({
      kind: 'USER',
      actorId: 'actor-restorer',
      displayName: 'actor-restorer',
    });
    expect(component['restoreModal']()['dialog']().nativeElement.open).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.recovery.restoreModal.restoredToast);
  });

  it('validates form inputs before sending HTTP requests and retains/rotates idempotency keys across errors', async () => {
    const snap = makeSnapshotItem();
    mount(makeDefinition(), [snap]);

    component['openRestoreModal'](snap);
    await component['submitRestore']();
    http.expectNone(() => true);
    expect(component['reasonError']()).toBe(templatesPageEn.recovery.restoreModal.reasonRequired);
    expect(component['discardError']()).toBe(templatesPageEn.recovery.restoreModal.discardRequired);

    component['reason'].set('Restore snapshot');
    component['discardCurrentDraft'].set(true);

    let keptKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['submitRestore']();
      const req = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (keptKey) expect(key).toBe(keptKey);
      keptKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
      if (status === 401) expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.notSaved);
      else expect(notify.error).toHaveBeenCalled();
    }

    const terminal = component['submitRestore']();
    const sameReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`);
    expect(sameReq.request.headers.get('x-idempotency-key')).toBe(keptKey);
    sameReq.flush(
      { errorCode: 'CORE.TEMPLATE.SCHEMA.MIGRATION_FAILED' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await terminal;

    const stale = component['submitRestore']();
    const rotatedReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`);
    expect(rotatedReq.request.headers.get('x-idempotency-key')).not.toBe(keptKey);
    rotatedReq.flush(
      { errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' },
      { status: 409, statusText: 'Conflict' },
    );
    await stale;

    expect(component['restoreModal']()['dialog']().nativeElement.open).toBe(false);
    expect(service.conflictOpen()).toBe(true);
  });

  it('refreshes snapshots and closes the modal on expired, already-restored, stale, or quarantined snapshot errors', async () => {
    const snap = makeSnapshotItem();
    mount(makeDefinition(), [snap]);

    for (const [status, code, expectedToast, refreshedWire] of [
      [
        410,
        'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_EXPIRED',
        templatesPageEn.errors['CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_EXPIRED'],
        makeWireSnapshot({ expiresAt: '2020-01-01T00:00:00Z' }),
      ],
      [
        409,
        'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_ALREADY_RESTORED',
        templatesPageEn.errors['CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_ALREADY_RESTORED'],
        makeWireSnapshot({ restoredAt: '2026-11-23T12:00:00Z', restoredBy: 'actor-other' }),
      ],
      [
        409,
        'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_STALE',
        templatesPageEn.errors['CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_STALE'],
        makeWireSnapshot({ snapshotChecksum: 'c'.repeat(64) }),
      ],
      [
        422,
        'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_INTEGRITY_FAILED',
        templatesPageEn.errors['CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_INTEGRITY_FAILED'],
        makeWireSnapshot({ integrityStatus: 'QUARANTINED' }),
      ],
    ] as const) {
      service.snapshots.set([makeSnapshotItem()]);
      component['openRestoreModal'](snap);
      component['reason'].set('Restore snapshot');
      component['discardCurrentDraft'].set(true);

      const pending = component['submitRestore']();
      http
        .expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`)
        .flush({ errorCode: code }, { status, statusText: 'Error' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`).flush({
        success: true,
        data: { items: [refreshedWire], pageInfo: { limit: 20, hasNextPage: false, nextCursor: null } },
      });
      await pending;

      expect(notify.error).toHaveBeenCalledWith(expectedToast);
      expect(component['restoreModal']()['dialog']().nativeElement.open).toBe(false);
      expect(service.snapshots()[0]?.snapshotChecksum).toBe(refreshedWire.snapshotChecksum);
    }
  });

  it('keeps restored draft and recoveredFrom state when post-restore refresh fails, and ignores late responses across template switches', async () => {
    const snap = makeSnapshotItem();
    mount(makeDefinition(), [snap]);

    component['openRestoreModal'](snap);
    component['reason'].set('Restore');
    component['discardCurrentDraft'].set(true);

    const restoredDraft = makeDraft({ revision: 4, etag: '"4"' });
    const recoveredWire = makeWireSnapshot({ restoredAt: '2026-11-23T12:00:00Z', restoredBy: 'actor-restorer' });

    const refreshFailPromise = component['submitRestore']();
    http
      .expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`)
      .flush(
        {
          success: true,
          data: {
            draft: restoredDraft,
            migrationRecovery: null,
            recoveredFrom: recoveredWire,
            replacedDraftRecovery: null,
          },
        },
        { headers: { ETag: '"4"' } },
      );
    await new Promise((resolve) => setTimeout(resolve, 0));
    http
      .expectOne(`${BASE_URL}/${TEMPLATE_ID}`)
      .flush({ errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });
    http
      .expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots?limit=20`)
      .flush({ errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });
    await refreshFailPromise;

    expect(service.draft()?.revision).toBe(4);
    expect(service.snapshots()[0]?.restoredBy?.actorId).toBe('actor-restorer');
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE']);
    expect(notify.success).toHaveBeenCalledWith(templatesPageEn.recovery.restoreModal.restoredToast);

    component['openRestoreModal'](snap);
    component['reason'].set('Restore before switch');
    component['discardCurrentDraft'].set(true);

    const switchedPromise = component['submitRestore']();
    const switchedReq = http.expectOne(`${BASE_URL}/${TEMPLATE_ID}/draft/recovery-snapshots/${SNAPSHOT_ID}/restore`);
    service.syncFromDefinition(makeDefinition({ templateId: OTHER_TEMPLATE_ID }));
    const otherDraft = makeDraft({ templateId: OTHER_TEMPLATE_ID, revision: 9, etag: '"9"' });
    service.setDraft(otherDraft);
    fixture.detectChanges();

    switchedReq.flush({
      success: true,
      data: {
        draft: restoredDraft,
        migrationRecovery: null,
        recoveredFrom: recoveredWire,
        replacedDraftRecovery: null,
      },
    });
    await switchedPromise;

    expect(service.draft()).toEqual(otherDraft);
  });
});
