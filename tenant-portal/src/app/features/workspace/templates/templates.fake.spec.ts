import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FAKE_TEMPLATE_IDS,
  FAKE_THUMBNAIL_RENDER_MS,
  TemplateApiError,
  fakeCreateAssignment,
  fakeGetDataSourceSchema,
  fakeGetDraft,
  fakeGetTemplate,
  fakeListDataSources,
  fakeListTemplates,
  fakeListRecoverySnapshots,
  fakeListVersions,
  fakePatchDraft,
  fakeRestoreRecoverySnapshot,
  fakeRetryTemplateThumbnail,
  fakeUploadAsset,
  fakeValidateDraft,
  newTemplateIdempotencyKey,
} from './templates.fake';
import type { TemplateDataSourceKey, TemplateDocumentV1 } from './templates.model';

const QUOTATION_ID = FAKE_TEMPLATE_IDS.corporateQuotationId;
/** Fake seeds (templates.fake.ts TPL_IDS). */
const SALES_ORDER_PENDING_THUMB_ID = '01948100-0000-7000-8000-000000001004';
const LETTER_UNAVAILABLE_THUMB_ID = '01948100-0000-7000-8000-000000001008';
const PURCHASE_QUOTATION_ID = '01948100-0000-7000-8000-000000001003';
const LEAD_EMAIL_ID = '01948100-0000-7000-8000-000000001009';

async function rejection(promise: Promise<unknown>): Promise<TemplateApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TemplateApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to reject.');
}

async function quotationSchemaChecksum(): Promise<string> {
  const def = await fakeGetTemplate(QUOTATION_ID);
  const schema = await fakeGetDataSourceSchema('TRADE_QUOTATION_PRINT_V1', {
    scopeType: def.scope.type,
    companyId: def.scope.type === 'COMPANY' ? def.scope.companyId : undefined,
    schemaVersion: def.dataSourceSchemaVersion === 2 ? 2 : 1,
  });
  return schema.schemaChecksum;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('templates.fake thumbnail retry (202 THUMBNAIL_ACCEPTED)', () => {
  it('returns the backend accepted metadata and turns READY after the fake worker runs', async () => {
    vi.useFakeTimers();
    const before = await (async () => {
      const p = fakeGetTemplate(LETTER_UNAVAILABLE_THUMB_ID);
      await vi.advanceTimersByTimeAsync(200);
      return p;
    })();
    expect(before.thumbnail.state).toBe('UNAVAILABLE');

    const retry = fakeRetryTemplateThumbnail(LETTER_UNAVAILABLE_THUMB_ID, {
      sourceKind: 'DRAFT',
      draftRevision: before.currentDraft.revision,
      sourceChecksum: before.thumbnail.sourceChecksum,
    });
    await vi.advanceTimersByTimeAsync(200);
    const accepted = await retry;
    expect(accepted).toEqual({
      kind: 'THUMBNAIL_ACCEPTED',
      thumbnailJobId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      state: 'PENDING',
      generation: 1,
      sourceChecksum: before.thumbnail.sourceChecksum,
      location: expect.stringContaining(`/api/tenant/core/v1/templates/${LETTER_UNAVAILABLE_THUMB_ID}/thumbnail?`),
    });
    expect(Object.keys(accepted)).not.toContain('thumbnail');

    const pendingRead = fakeGetTemplate(LETTER_UNAVAILABLE_THUMB_ID);
    await vi.advanceTimersByTimeAsync(200);
    expect((await pendingRead).thumbnail.state).toBe('PENDING');

    await vi.advanceTimersByTimeAsync(FAKE_THUMBNAIL_RENDER_MS);
    const readyRead = fakeGetTemplate(LETTER_UNAVAILABLE_THUMB_ID);
    await vi.advanceTimersByTimeAsync(200);
    expect((await readyRead).thumbnail.state).toBe('READY');
  });

  it('answers 409 THUMBNAIL.NOT_READY when the current image is already READY', async () => {
    const def = await fakeGetTemplate(QUOTATION_ID);
    expect(def.thumbnail.state).toBe('READY');
    const error = await rejection(
      fakeRetryTemplateThumbnail(QUOTATION_ID, {
        sourceKind: 'DRAFT',
        draftRevision: def.currentDraft.revision,
        sourceChecksum: def.thumbnail.sourceChecksum,
      }),
    );
    expect([error.status, error.code]).toEqual([409, 'CORE.TEMPLATE.THUMBNAIL.NOT_READY']);
  });

  it('re-returns the current PENDING job instead of staging a second one', async () => {
    const def = await fakeGetTemplate(SALES_ORDER_PENDING_THUMB_ID);
    const body = {
      sourceKind: 'DRAFT' as const,
      draftRevision: def.currentDraft.revision,
      sourceChecksum: def.thumbnail.sourceChecksum,
    };
    const first = await fakeRetryTemplateThumbnail(SALES_ORDER_PENDING_THUMB_ID, body);
    const second = await fakeRetryTemplateThumbnail(SALES_ORDER_PENDING_THUMB_ID, body);
    expect(second.thumbnailJobId).toBe(first.thumbnailJobId);
    expect(second.generation).toBe(first.generation);
  });
});

describe('templates.fake PATCH draft If-Match (draft-schema strong tag)', () => {
  it('accepts the strong Sales Quotation tag and rejects a changed schema checksum', async () => {
    const checksum = await quotationSchemaChecksum();
    const draft = await fakeGetDraft(QUOTATION_ID);
    const res = await fakePatchDraft(
      QUOTATION_ID,
      { editorDocument: draft.editorDocument, clientMutationId: newTemplateIdempotencyKey() },
      `"draft-schema:${checksum}:${draft.revision}"`,
      newTemplateIdempotencyKey(),
    );
    expect(res.draft.revision).toBe(draft.revision + 1);
    expect(res.draft.etag).toBe(`"${draft.revision + 1}"`);

    const changed = await rejection(
      fakePatchDraft(
        QUOTATION_ID,
        { editorDocument: draft.editorDocument, clientMutationId: newTemplateIdempotencyKey() },
        `"draft-schema:${'0'.repeat(64)}:${res.draft.revision}"`,
        newTemplateIdempotencyKey(),
      ),
    );
    expect([changed.status, changed.code]).toEqual([409, 'CORE.TEMPLATE.CONCURRENCY.SCHEMA_CHANGED']);
  });

  it('treats the strong tag as stale for any other data source', async () => {
    const draft = await fakeGetDraft(PURCHASE_QUOTATION_ID);
    const error = await rejection(
      fakePatchDraft(
        PURCHASE_QUOTATION_ID,
        { editorDocument: draft.editorDocument, clientMutationId: newTemplateIdempotencyKey() },
        `"draft-schema:${'a'.repeat(64)}:${draft.revision}"`,
        newTemplateIdempotencyKey(),
      ),
    );
    expect([error.status, error.code]).toEqual([409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION']);
  });

  it('answers 428 PRECONDITION_REQUIRED without If-Match', async () => {
    const draft = await fakeGetDraft(PURCHASE_QUOTATION_ID);
    const error = await rejection(
      fakePatchDraft(
        PURCHASE_QUOTATION_ID,
        { editorDocument: draft.editorDocument, clientMutationId: newTemplateIdempotencyKey() },
        '',
        newTemplateIdempotencyKey(),
      ),
    );
    expect([error.status, error.code]).toEqual([428, 'CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED']);
  });

  it('keeps the last run counts on STALE and clears validatedDraftRevision', async () => {
    const draft = await fakeGetDraft(PURCHASE_QUOTATION_ID);
    const res = await fakePatchDraft(
      PURCHASE_QUOTATION_ID,
      { editorDocument: draft.editorDocument, clientMutationId: newTemplateIdempotencyKey() },
      draft.etag,
      newTemplateIdempotencyKey(),
    );
    expect(res.draft.validation.state).toBe('STALE');
    expect(res.draft.validation.validatedDraftRevision).toBeNull();
    expect(res.draft.validation.errorCount).toBe(draft.validation.errorCount);
    expect(res.draft.validation.warningCount).toBe(draft.validation.warningCount);
  });
});

describe('templates.fake validation issues', () => {
  it('reports an all-blank email subject as the issue TEMPLATE_EMAIL_SUBJECT_EMPTY with an RFC 6901 pointer', async () => {
    const draft = await fakeGetDraft(LEAD_EMAIL_ID);
    const doc = structuredClone(draft.editorDocument) as TemplateDocumentV1;
    if (!doc.email) throw new Error('Lead email fixture has no email block.');
    doc.email.subject = { ...doc.email.subject, segments: [{ kind: 'TEXT', value: '   ' }] } as typeof doc.email.subject;
    const saved = await fakePatchDraft(
      LEAD_EMAIL_ID,
      { editorDocument: doc, clientMutationId: newTemplateIdempotencyKey() },
      draft.etag,
      newTemplateIdempotencyKey(),
    );
    const run = await fakeValidateDraft(
      LEAD_EMAIL_ID,
      { draftRevision: saved.draft.revision, rendererTargets: ['EMAIL_HTML', 'EMAIL_TEXT'] },
      saved.draft.etag,
    );
    expect(run.status).toBe('FAILED');
    expect(run.issues).toContainEqual(
      expect.objectContaining({ code: 'TEMPLATE_EMAIL_SUBJECT_EMPTY', severity: 'ERROR', jsonPointer: '/email/subject' }),
    );
    for (const issue of run.issues) {
      expect(issue.jsonPointer === '' || issue.jsonPointer.startsWith('/')).toBe(true);
      expect(issue.jsonPointer.length).toBeLessThanOrEqual(500);
    }
    const after = await fakeGetDraft(LEAD_EMAIL_ID);
    expect(after.validation.errorCount).toBe(run.issues.filter((i) => i.severity === 'ERROR').length);
    expect(after.validation.warningCount).toBe(run.issues.filter((i) => i.severity !== 'ERROR').length);
  });
});

describe('templates.fake response shapes', () => {
  it('version reads carry only LTR or RTL', async () => {
    const page = await fakeListVersions(QUOTATION_ID, { limit: 100 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const item of page.items) expect(['LTR', 'RTL']).toContain(item.direction);
  });

  it('asset upload returns the fresh delivery', async () => {
    const res = await fakeUploadAsset(
      {
        metadata: {
          assetType: 'LOGO',
          deliveryClass: 'PRIVATE_ONLY',
          fileName: 'logo.png',
          declaredMimeType: 'image/png',
          expectedRawSha256: 'b'.repeat(64),
        },
        file: new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' }),
      },
      newTemplateIdempotencyKey(),
    );
    expect(res.delivery).toEqual({
      kind: 'SAME_ORIGIN_AUTHENTICATED_READ',
      url: `/api/tenant/core/v1/templates/assets/${res.asset.assetId}/content`,
    });
  });

  it('recovery restore returns the full snapshot item as recoveredFrom', async () => {
    const draft = await fakeGetDraft(QUOTATION_ID);
    const snapshots = await fakeListRecoverySnapshots(QUOTATION_ID);
    const snapshot = snapshots.items.find((s) => s.snapshotId === FAKE_TEMPLATE_IDS.corporateRecoverySnapshotId);
    if (!snapshot) throw new Error('Missing corporate recovery snapshot seed.');
    const res = await fakeRestoreRecoverySnapshot(
      QUOTATION_ID,
      FAKE_TEMPLATE_IDS.corporateRecoverySnapshotId,
      {
        expectedSnapshotChecksum: snapshot.snapshotChecksum,
        reason: 'Restore for test',
        discardCurrentDraft: true,
      },
      draft.etag,
    );
    expect(res.recoveredFrom).toEqual({ ...snapshot, ...res.recoveredFrom });
    expect(Object.keys(res.recoveredFrom).sort()).toEqual(Object.keys(snapshot).sort());
    expect(res.recoveredFrom).toEqual(
      expect.objectContaining({
        snapshotId: FAKE_TEMPLATE_IDS.corporateRecoverySnapshotId,
        captureReason: 'MATERIALIZE_FIXED_PAGES',
        integrityStatus: 'AVAILABLE',
        restoredToDraftRevision: res.draft.revision,
      }),
    );
  });
});

describe('templates.fake assignments owner runtime', () => {
  const unavailable: TemplateDataSourceKey[] = [
    'TRADE_INVOICE_PRINT_V1',
    'TRADE_CONTRACT_PRINT_V1',
    'CORE_BUSINESS_LETTER_PRINT_V1',
  ];

  it('lists the three unavailable adapters as disabled with OWNER_RUNTIME_UNAVAILABLE', async () => {
    const res = await fakeListDataSources({ scopeType: 'TENANT' });
    for (const item of res.items) {
      const disabled = unavailable.includes(item.adapterKey);
      expect(item.productionAssignmentEnabled).toBe(!disabled);
      expect(item.productionDisabledReason).toBe(disabled ? 'OWNER_RUNTIME_UNAVAILABLE' : null);
    }
  });

  it('answers 422 OWNER_RUNTIME_UNAVAILABLE for an invoice assignment', async () => {
    const error = await rejection(
      fakeCreateAssignment(
        {
          versionId: '01948100-0000-7000-8000-00000000ffff',
          adapterKey: 'TRADE_INVOICE_PRINT_V1',
          documentType: 'INVOICE',
          outputChannel: 'PRINT',
          locale: null,
          scope: { type: 'TENANT' },
          priority: 100,
          isDefault: true,
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
        },
        newTemplateIdempotencyKey(),
      ),
    );
    expect([error.status, error.code]).toEqual([422, 'CORE.TEMPLATE.ASSIGNMENT.OWNER_RUNTIME_UNAVAILABLE']);
  });

  it('accepts a published sales order version', async () => {
    // The seed must hold a published sales-order version (TPL-SO-DISPATCH, published v2).
    const list = await fakeListTemplates({ assignmentScopeType: 'TENANT', documentType: 'SALES_ORDER', limit: 100 });
    const seeded = list.items.find((row) => row.code === 'TPL-SO-DISPATCH');
    expect(seeded?.currentPublishedVersion).toBeTruthy();
    if (!seeded) throw new Error('Missing TPL-SO-DISPATCH seed.');
    const versions = await fakeListVersions(seeded.templateId, { limit: 100 });
    const published = versions.items.find((v) => v.lifecycleStatus === 'PUBLISHED');
    expect(published).toBeDefined();
    if (!published) throw new Error('TPL-SO-DISPATCH has no PUBLISHED version.');
    const res = await fakeCreateAssignment(
      {
        versionId: published.templateVersionId,
        adapterKey: 'TRADE_SALES_ORDER_PRINT_V1',
        documentType: 'SALES_ORDER',
        outputChannel: 'PRINT',
        locale: null,
        scope: { type: 'TENANT' },
        priority: 900,
        isDefault: false,
        effectiveFrom: '2027-01-01T00:00:00.000Z',
        effectiveTo: null,
      },
      newTemplateIdempotencyKey(),
    );
    expect(res.assignment.documentType).toBe('SALES_ORDER');
    expect(res.assignment.adapterKey).toBe('TRADE_SALES_ORDER_PRINT_V1');
    expect(res.assignment.versionId).toBe(published.templateVersionId);
  });
});
