import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import * as assets from './assets/assets.api';
import * as assignments from './assignments/assignments.api';
import * as exports from './templates.api';
import { TemplatesApi, TemplateApiError, newTemplateIdempotencyKey } from './templates.api';
import type {
  CreateTemplateDto, DuplicateTemplateDto, PatchTemplateDraftDto, PublishTemplateRequestDto,
  TemplateHtmlOrEmailPreviewRequestDto, TemplatePdfPreviewRequestDto, TemplateStartersQuery,
} from './templates.model';

const base = '/api/tenant/core/v1/templates';
const id = '01948100-0000-7000-8000-000000001001';
const path = `${base}/${id}`;
const page = { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null }, totalCount: 0 };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const create: CreateTemplateDto = {
  code: 'TEST', name: 'Test', documentType: 'QUOTATION', outputChannel: 'PRINT',
  layoutMode: 'HYBRID_DOCUMENT', dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
  locale: 'en-US', direction: 'LTR', scope: { type: 'TENANT' },
};
const preview: TemplatePdfPreviewRequestDto = {
  source: { kind: 'DRAFT', draftRevision: 7 }, dataSource: { kind: 'SYNTHETIC', fixtureKey: 'standard' },
  locale: 'en-US', timeZone: 'UTC',
};
const htmlPreview: TemplateHtmlOrEmailPreviewRequestDto = {
  source: preview.source, fixtureKey: 'standard', locale: 'en-US', timeZone: 'UTC',
};
const publish: PublishTemplateRequestDto = {
  definitionRevision: 7, draftRevision: 7, validationRunId: 'run', setAsDefinitionPublished: true,
};
const starters: TemplateStartersQuery = {
  documentType: 'QUOTATION', outputChannel: 'PRINT', layoutMode: 'HYBRID_DOCUMENT',
  dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', dataSourceSchemaVersion: 1,
  locale: 'en-US', direction: 'LTR', definitionScopeType: 'TENANT',
};

const definitionReceipt = { templateId: id, revision: 8, etag: '"8"' };
const draftReceipt = { draftId: 'draft', templateId: id, revision: 8, etag: '"8"' };
const thumbnailReceipt = { state: 'PENDING', sourceChecksum: 'checksum' };
const recoveryReceipt = { snapshotId: 'snapshot', createdBy: 'creator-id', restoredBy: 'restorer-id' };
const pdfReceipt = { templateId: id, source: { kind: 'DRAFT', draftId: 'draft', draftRevision: 7 }, kind: 'PDF_ACCEPTED', renderTarget: 'PDF',
  outputProfile: 'DOCUMENT_PRINT', renderJobId: 'job', status: 'PENDING', location: `${base}/preview-jobs/job`,
  createdAt: '2026-11-23T12:00:00Z', expiresAt: '2026-11-23T13:00:00Z',
  templateContentChecksum: 'content', compiledArtifactChecksum: 'compiled' };
const layoutReceipt = { layoutRuntimeChecksum: 'a'.repeat(64), geometryUnit: 'MM', pageLayoutMode: 'UNIFORM',
  pages: [{ pageId: 'page-1', widthMm: 210, heightMm: 297, contentBox: { x: 10, y: 10, width: 190, height: 277 } }],
  fragments: [], fonts: [{ family: 'Tajawal', weight: '400', style: 'normal' }] };

/** Source-shaped receipts, selected independently by the outgoing route. */
function flushCommand(request: TestRequest): void {
  const url = request.request.url;
  let status = 200;
  let data: object = {};
  if (request.request.method === 'DELETE') {
    request.flush(null, { status: 204, statusText: 'No Content' });
    return;
  }
  if (url === base || url.endsWith('/duplicate')) {
    status = 201;
    data = { definition: definitionReceipt, draft: draftReceipt };
  } else if (url.endsWith('/preview/pdf')) {
    status = 202;
    data = pdfReceipt;
  } else if (url.endsWith('/thumbnail/retry')) {
    status = 202;
    data = { kind: 'THUMBNAIL_ACCEPTED', thumbnailJobId: 'thumbnail-job', state: 'PENDING',
      generation: 1, sourceChecksum: 'checksum', location: `${path}/thumbnail` };
  } else if (url.endsWith('/publish')) {
    status = 201;
    data = { version: { templateVersionId: 'version' }, thumbnail: thumbnailReceipt,
      definitionRevision: 8, definitionEtag: '"8"', consumedDraftRevision: 7, draftEtag: '"8"' };
  } else if (url.endsWith('/validate')) {
    data = { validationRunId: 'run', templateId: id, draftId: 'draft', draftRevision: 7,
      status: 'PASSED', issues: [], rendererTargets: ['HTML', 'PDF'] };
  } else if (url.includes('/recovery-snapshots/')) {
    data = { draft: draftReceipt, migrationRecovery: null, recoveredFrom: recoveryReceipt, replacedDraftRecovery: null };
  } else if (url.includes('/versions/')) {
    data = url.endsWith('/retire') ? { version: { templateVersionId: 'version' }, definitionRevision: 8, definitionEtag: '"8"' }
      : { draft: draftReceipt, migrationRecovery: null };
  } else if (url.endsWith('/draft')) {
    data = { draft: draftReceipt, thumbnail: thumbnailReceipt, migrationRecovery: null };
  } else if (request.request.method === 'PATCH') {
    data = { definition: definitionReceipt, draft: null };
  } else {
    data = definitionReceipt;
  }
  request.flush({ success: true, data }, { status, statusText: 'OK', headers: { ETag: '"8"', Location: '/version' } });
}

describe('TemplatesApi', () => {
  let api: TemplatesApi;
  let http: HttpTestingController;
  let cookie: string;
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);
  const me = signal({ id: 'actor', permissions: ['templates.read'], permissionScopes: {} });

  function writeHeaders(request: TestRequest, key: string, ifMatch?: string) {
    expect(request.request.withCredentials).toBe(true);
    expect(key).toMatch(uuidV7);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.get('If-Match')).toBe(ifMatch ?? null);
  }

  function keyedWrites() {
    const duplicate: DuplicateTemplateDto = { source: { kind: 'CURRENT_DRAFT', expectedDraftRevision: 7 },
      code: 'COPY', name: 'Copy', scope: { type: 'TENANT' }, copyAssignments: false };
    return [
      (key: string) => api.createTemplate(create, key),
      (key: string) => api.duplicateTemplate(id, duplicate, key),
      (key: string) => api.patchTemplate(id, { name: 'Updated' }, '"7"', key),
      (key: string) => api.archiveTemplate(id, '"7"', key),
      (key: string) => api.restoreTemplate(id, '"7"', key),
      (key: string) => api.deleteTemplate(id, '"7"', key),
      (key: string) => api.retryTemplateThumbnail(id, { sourceKind: 'DRAFT', draftRevision: 7, sourceChecksum: 'checksum' }, key),
      (key: string) => api.patchDraft(id, { editorDocument: { schemaVersion: 1 }, clientMutationId: 'mutation' } as PatchTemplateDraftDto, '"7"', key),
      (key: string) => api.validateDraft(id, { draftRevision: 7, rendererTargets: ['HTML', 'PDF'] }, '"7"', key),
      (key: string) => api.publishTemplate(id, publish, '"7"', key),
      (key: string) => api.restoreVersion(id, 'version', { reason: 'Restore', discardCurrentDraft: true }, '"7"', key),
      (key: string) => api.retireVersion(id, 'version', '"7"', key),
      (key: string) => api.restoreRecoverySnapshot(id, 'snapshot',
        { expectedSnapshotChecksum: 'checksum', reason: 'Restore', discardCurrentDraft: true }, '"7"', key),
      (key: string) => api.previewPdf(id, preview, key),
    ];
  }

  beforeEach(() => {
    selection.set(null);
    me.set({ id: 'actor', permissions: ['templates.read'], permissionScopes: {} });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me, selection } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(TemplatesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('listTemplates sends the assignment scope', async () => {
    const pending = api.listTemplates({ assignmentScopeType: 'BRANCH', assignmentCompanyId: 'company',
      assignmentBranchId: 'branch', cursor: 'cursor', limit: 25 });
    const request = http.expectOne((req) => req.url === base);
    expect(request.request.params.get('assignmentScopeType')).toBe('BRANCH');
    expect(request.request.params.get('assignmentCompanyId')).toBe('company');
    expect(request.request.params.get('assignmentBranchId')).toBe('branch');
    expect(request.request.params.get('cursor')).toBe('cursor');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ success: true, data: page });
    await expect(pending).resolves.toEqual(page);
  });

  it('feature disabled reaches the caller', async () => {
    const pending = api.listTemplates({ assignmentScopeType: 'TENANT' });
    http.expectOne(`${base}?assignmentScopeType=TENANT`).flush({ errorCode: 'CORE.TEMPLATE.FEATURE.DISABLED' },
      { status: 403, statusText: 'Forbidden' });
    await expect(pending).rejects.toMatchObject({ status: 403, code: 'CORE.TEMPLATE.FEATURE.DISABLED' });
  });

  it('invalid cursor reaches the caller', async () => {
    const pending = api.listTemplates({ assignmentScopeType: 'TENANT', cursor: 'bad' });
    http.expectOne((req) => req.url === base).flush({ errorCode: 'CORE.TEMPLATE.CURSOR.INVALID' },
      { status: 400, statusText: 'Bad Request' });
    await expect(pending).rejects.toMatchObject({ status: 400, code: 'CORE.TEMPLATE.CURSOR.INVALID' });
  });

  it('create returns the Location', async () => {
    const duplicate: DuplicateTemplateDto = { source: { kind: 'CURRENT_DRAFT', expectedDraftRevision: 7 },
      code: 'COPY', name: 'Copy', scope: { type: 'TENANT' }, copyAssignments: false };
    for (const [url, body, call] of [
      [base, create, (key: string) => api.createTemplate(create, key)],
      [`${path}/duplicate`, duplicate, (key: string) => api.duplicateTemplate(id, duplicate, key)],
    ] as const) {
      const key = newIdempotencyKey();
      const pending = call(key);
      const request = http.expectOne(url);
      writeHeaders(request, key);
      expect(request.request.body).toEqual(body);
      request.flush({ success: true, data: { definition: definitionReceipt, draft: draftReceipt } },
        { status: 201, statusText: 'Created', headers: { Location: '/created' } });
      await expect(pending).resolves.toMatchObject({ status: 201, location: '/created', data: { definition: {}, draft: {} } });
    }
  });

  it('definition writes forward If-Match', async () => {
    for (const [url, method, call] of [
      [path, 'PATCH', (key: string) => api.patchTemplate(id, { name: 'Updated' }, '"7"', key)],
      [`${path}/archive`, 'POST', (key: string) => api.archiveTemplate(id, '"7"', key)],
      [`${path}/restore`, 'POST', (key: string) => api.restoreTemplate(id, '"7"', key)],
      [path, 'DELETE', (key: string) => api.deleteTemplate(id, '"7"', key)],
    ] as const) {
      const key = newIdempotencyKey();
      const pending = call(key);
      const request = http.expectOne(url);
      writeHeaders(request, key, '"7"');
      expect(request.request.method).toBe(method);
      flushCommand(request);
      await pending;
    }
  });

  it('delete accepts 204', async () => {
    const pending = api.deleteTemplate(id, '"7"', newIdempotencyKey());
    http.expectOne(path).flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects unknown command receipts on every keyed platform route', async () => {
    for (const call of keyedWrites()) {
      const pending = call(newIdempotencyKey());
      const request = http.expectOne(() => true);
      const url = request.request.url;
      const status = url === base || url.endsWith('/duplicate') || url.endsWith('/publish') ? 201
        : url.endsWith('/preview/pdf') || url.endsWith('/thumbnail/retry') ? 202 : 200;
      request.flush({ success: true, data: {} }, { status, statusText: 'OK' });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('adapts recovery actor IDs without inventing user names and preserves page info', async () => {
    const pending = api.listRecoverySnapshots(id, { limit: 10, cursor: 'cursor' });
    const payload = { ...page, items: [recoveryReceipt, { ...recoveryReceipt, snapshotId: 'unrestored', restoredBy: null }],
      pageInfo: { limit: 10, hasNextPage: true, nextCursor: 'next' } };
    http.expectOne(`${path}/draft/recovery-snapshots?limit=10&cursor=cursor`).flush({ success: true, data: payload });
    await expect(pending).resolves.toMatchObject({ pageInfo: payload.pageInfo, items: [
      { snapshotId: 'snapshot', createdBy: { kind: 'USER', actorId: 'creator-id', displayName: 'creator-id' },
        restoredBy: { kind: 'USER', actorId: 'restorer-id', displayName: 'restorer-id' } },
      { snapshotId: 'unrestored', restoredBy: null },
    ] });

    const restored = api.restoreRecoverySnapshot(id, 'snapshot', {
      expectedSnapshotChecksum: 'checksum', reason: 'Restore', discardCurrentDraft: true,
    }, '"7"', newIdempotencyKey());
    flushCommand(http.expectOne(`${path}/draft/recovery-snapshots/snapshot/restore`));
    await expect(restored).resolves.toMatchObject({ etag: '"8"', data: {
      draft: draftReceipt, recoveredFrom: { createdBy: { actorId: 'creator-id' }, restoredBy: { actorId: 'restorer-id' } },
    } });
  });

  it('stale and missing precondition reach the caller', async () => {
    for (const [status, code] of [[409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION'],
      [428, 'CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED']] as const) {
      const pending = api.patchTemplate(id, { name: 'Updated' }, '"7"', newIdempotencyKey());
      http.expectOne(path).flush({ errorCode: code }, { status, statusText: 'Conflict' });
      await expect(pending).rejects.toMatchObject({ status, code });
    }
  });

  it('reads keep the ETag', async () => {
    for (const [url, call] of [[path, () => api.getTemplate(id)], [`${path}/draft`, () => api.getDraft(id)]] as const) {
      const pending = call();
      http.expectOne(url).flush({ success: true, data: { etag: '"body"' } }, { headers: { ETag: '"header"' } });
      await expect(pending).resolves.toMatchObject({ etag: '"header"' });
    }
    const pending = api.getDraft(id);
    http.expectOne(`${path}/draft`).flush({ success: true, data: { etag: '"body"' } });
    await expect(pending).resolves.toMatchObject({ etag: '"body"' });
  });

  it('draft save sends the draft-schema precondition', async () => {
    const tag = `"draft-schema:${'a'.repeat(64)}:7"`;
    const key = newIdempotencyKey();
    const body = { editorDocument: { schemaVersion: 1 }, clientMutationId: key } as PatchTemplateDraftDto;
    const pending = api.patchDraft(id, body, tag, key);
    const request = http.expectOne(`${path}/draft`);
    writeHeaders(request, key, tag);
    expect(request.request.body).toEqual(body);
    flushCommand(request);
    await pending;
  });

  it('validate and publish forward key and If-Match', async () => {
    for (const [url, call, status] of [
      [`${path}/validate`, (key: string) => api.validateDraft(id, { draftRevision: 7, rendererTargets: ['HTML', 'PDF'] }, '"7"', key), 200],
      [`${path}/publish`, (key: string) => api.publishTemplate(id, publish, '"7"', key), 201],
    ] as const) {
      const key = newIdempotencyKey();
      const pending = call(key);
      const request = http.expectOne(url);
      writeHeaders(request, key, '"7"');
      flushCommand(request);
      await expect(pending).resolves.toMatchObject({ status, location: '/version' });
    }
  });

  it('version and recovery writes forward If-Match', async () => {
    for (const [url, call] of [
      [`${path}/versions/version/restore`, (key: string) => api.restoreVersion(id, 'version', { reason: 'Restore', discardCurrentDraft: true }, '"7"', key)],
      [`${path}/versions/version/retire`, (key: string) => api.retireVersion(id, 'version', '"7"', key)],
      [`${path}/draft/recovery-snapshots/snapshot/restore`, (key: string) => api.restoreRecoverySnapshot(id, 'snapshot',
        { expectedSnapshotChecksum: 'checksum', reason: 'Restore', discardCurrentDraft: true }, '"7"', key)],
    ] as const) {
      const key = newIdempotencyKey();
      const pending = call(key);
      const request = http.expectOne(url);
      writeHeaders(request, key, '"7"');
      flushCommand(request);
      await pending;
    }
  });

  it('html and email previews send no key', async () => {
    for (const [url, call] of [[`${path}/preview/html`, () => api.previewHtml(id, htmlPreview)],
      [`${path}/preview/email`, () => api.previewEmail(id, htmlPreview)],
      [`${base}/search`, () => api.searchTemplates({ assignmentScopeType: 'TENANT' })]] as const) {
      const pending = call();
      const request = http.expectOne(url);
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.has('x-idempotency-key')).toBe(false);
      request.flush({ success: true, data: url.endsWith('search') ? page : { html: '<p>Preview</p>' } });
      await pending;
    }
  });

  it('pdf preview returns 202 with Location', async () => {
    const key = newIdempotencyKey();
    const pending = api.previewPdf(id, preview, key);
    const request = http.expectOne(`${path}/preview/pdf`);
    writeHeaders(request, key);
    request.flush({ success: true, data: pdfReceipt },
      { status: 202, statusText: 'Accepted', headers: { Location: `${base}/preview-jobs/job` } });
    await expect(pending).resolves.toMatchObject({ status: 202, data: { renderJobId: 'job' }, location: `${base}/preview-jobs/job` });
  });

  it('accepts owner source-resolution receipts and rejects unresolved source identities', async () => {
    for (const source of [{ kind: 'DRAFT', draftId: 'draft', draftRevision: 7 },
      { kind: 'VERSION', versionId: 'version', versionNumber: 1 }]) {
      const pending = api.previewPdf(id, preview, newIdempotencyKey());
      const data = { ...pdfReceipt, source, status: 'RESOLVING_SOURCE' };
      http.expectOne(`${path}/preview/pdf`).flush({ success: true, data }, { status: 202, statusText: 'Accepted' });
      await expect(pending).resolves.toMatchObject({ data });
    }
    const pending = api.previewPdf(id, preview, newIdempotencyKey());
    http.expectOne(`${path}/preview/pdf`).flush({ success: true, data: { ...pdfReceipt, source: {} } },
      { status: 202, statusText: 'Accepted' });
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it('binary reads return a Blob', async () => {
    const blob = new Blob(['binary'], { type: 'image/png' });
    for (const call of [() => api.getTemplateThumbnail(id, { sourceKind: 'DRAFT', draftRevision: 7, sourceChecksum: 'sum' }),
      () => api.getPreviewJobArtifact('job'), () => api.getStarterThumbnail('starter/key', starters),
      () => api.getTemplateThumbnail(`${path}/thumbnail?sourceKind=DRAFT`)]) {
      const pending = call();
      const request = http.expectOne(() => true);
      expect(request.request.responseType).toBe('blob');
      expect(request.request.withCredentials).toBe(true);
      request.flush(blob);
      await expect(pending).resolves.toBe(blob);
    }
  });

  it('thumbnail not ready is parsed from the blob body', async () => {
    const pending = api.getTemplateThumbnail(id, { sourceKind: 'DRAFT', draftRevision: 7, sourceChecksum: 'sum' });
    http.expectOne(() => true).flush(new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.THUMBNAIL.NOT_READY', correlationId: 'corr' })],
      { type: 'application/json' }), { status: 409, statusText: 'Conflict' });
    await expect(pending).rejects.toMatchObject({ status: 409, code: 'CORE.TEMPLATE.THUMBNAIL.NOT_READY', correlationId: 'corr' });
  });

  it('transport errors become ApiError', async () => {
    for (const status of [500, 503, 0]) {
      const pending = api.getCreationScopes();
      const request = http.expectOne(`${base}/creation-scopes`);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ errorCode: 'SERVER_ERROR', correlationId: 'corr' }, { status, statusText: 'Server Error' });
      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status, code: status ? 'SERVER_ERROR' : 'NETWORK_ERROR' });
    }
  });

  it('no CSRF cookie sends nothing', async () => {
    cookie = '';
    for (const call of [...keyedWrites(), () => api.previewHtml(id, htmlPreview),
      () => api.previewEmail(id, htmlPreview), () => api.searchTemplates({ assignmentScopeType: 'TENANT' })]) {
      await expect(call(newIdempotencyKey())).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    }
    http.expectNone(() => true);
  });

  it('malformed envelope is an internal error', async () => {
    for (const body of [{}, { data: {} }, { success: true }, { success: false, data: {} }]) {
      const pending = api.getCreationScopes();
      http.expectOne(`${base}/creation-scopes`).flush(body);
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('forwards every remaining platform route and query', async () => {
    for (const [url, query, call, data] of [
      [`${base}/data-sources`, { scopeType: 'TENANT' }, () => api.listDataSources({ scopeType: 'TENANT' }), { items: [] }],
      [`${base}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`, { scopeType: 'TENANT', schemaVersion: 1 },
        () => api.getDataSourceSchema('TRADE_QUOTATION_PRINT_V1', { scopeType: 'TENANT', schemaVersion: 1 }), { fields: [] }],
      [`${base}/starters`, starters, () => api.listStarters(starters), { items: [] }],
      [`${path}/versions`, { cursor: 'next', limit: 10 }, () => api.listVersions(id, { cursor: 'next', limit: 10 }), page],
      [`${path}/draft/recovery-snapshots`, { limit: 20 }, () => api.listRecoverySnapshots(id, { limit: 20 }), page],
      [`${path}/validation-runs/run%2Fid`, {}, () => api.getValidationRun(id, 'run/id'), { validationRunId: 'run/id' }],
      [`${path}/versions/version`, {}, () => api.getVersion(id, 'version'), { templateVersionId: 'version' }],
      [`${base}/preview-jobs/job%2Fid`, {}, () => api.getPreviewJob('job/id'), { renderJobId: 'job/id' }],
      [`${base}/preview-jobs/job/layout-receipt`, {}, () => api.getPreviewJobLayoutReceipt('job'), layoutReceipt],
    ] as const) {
      const pending = call();
      const request = http.expectOne((req) => req.url === url);
      expect(request.request.method).toBe('GET');
      for (const [key, value] of Object.entries(query)) expect(request.request.params.get(key)).toBe(String(value));
      request.flush({ success: true, data });
      await expect(pending).resolves.toEqual(data);
    }
    const key = newIdempotencyKey();
    const body = { sourceKind: 'DRAFT' as const, draftRevision: 7, sourceChecksum: 'checksum' };
    const pending = api.retryTemplateThumbnail(id, body, key);
    const request = http.expectOne(`${path}/thumbnail/retry`);
    writeHeaders(request, key);
    expect(request.request.body).toEqual(body);
    flushCommand(request);
    await expect(pending).resolves.toMatchObject({ status: 202 });
  });

  it('preserves the supplied action key and body on retry', async () => {
    for (const call of keyedWrites()) {
      for (const [status, code] of [[0, 'NETWORK_ERROR'], [503, 'SERVER_ERROR'],
        [409, 'GW.IDEM.IN_FLIGHT'], [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT']] as const) {
        const key = newIdempotencyKey();
        const pending = call(key);
        const request = http.expectOne(() => true);
        writeHeaders(request, key, request.request.headers.get('If-Match') ?? undefined);
        if (status === 0) request.error(new ProgressEvent('error'));
        else request.flush({ errorCode: code }, { status, statusText: 'Failed' });
        await expect(pending).rejects.toMatchObject({ status, code });
        const retried = call(key);
        const retry = http.expectOne(() => true);
        writeHeaders(retry, key, request.request.headers.get('If-Match') ?? undefined);
        expect(retry.request.body).toEqual(request.request.body);
        flushCommand(retry);
        await retried;
        const changedKey = newIdempotencyKey();
        const changed = api.createTemplate({ ...create, name: 'Changed' }, changedKey);
        const next = http.expectOne(base);
        expect(next.request.headers.get('x-idempotency-key')).not.toBe(key);
        expect(next.request.body).not.toEqual(request.request.body);
        flushCommand(next);
        await changed;
      }
    }
  });

  it('propagates preview expiry, quota, session, validation and gateway errors', async () => {
    for (const [status, body, code] of [
      [410, { errorCode: 'CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED' }, 'CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED'],
      [429, { errorCode: 'CORE.TEMPLATE.PREVIEW.TOO_MANY_ACTIVE' }, 'CORE.TEMPLATE.PREVIEW.TOO_MANY_ACTIVE'],
      [401, { errorCode: 'COMMON.GENERIC.UNAUTHORIZED' }, 'COMMON.GENERIC.UNAUTHORIZED'],
      [400, { errorCode: 'CORE_VALIDATION_FAILED', details: { name: ['required'] } }, 'CORE_VALIDATION_FAILED'],
      [422, { code: 'GW.IDEM.MISMATCH', errors: { key: ['mismatch'] } }, 'GW.IDEM.MISMATCH'],
      [413, { code: 'GW.BODY.TOO_LARGE' }, 'GW.BODY.TOO_LARGE'],
      [404, { errorCode: 'CORE.TEMPLATE.NOT_FOUND' }, 'CORE.TEMPLATE.NOT_FOUND'],
    ] as const) {
      const key = newIdempotencyKey();
      const pending = api.previewPdf(id, preview, key);
      const request = http.expectOne(`${path}/preview/pdf`);
      writeHeaders(request, key);
      request.flush({ ...body, correlationId: 'corr' }, { status, statusText: 'Failed', headers: { 'Retry-After': '15' } });
      await expect(pending).rejects.toMatchObject({ status, code, correlationId: 'corr' });
      if (status === 429) await expect(pending).rejects.toMatchObject({ details: { retryAfterSeconds: ['15'] } });
      if ('details' in body) await expect(pending).rejects.toMatchObject({ details: body.details });
      if ('errors' in body) await expect(pending).rejects.toMatchObject({ details: body.errors });
    }
  });

  it('separates reads by actor, grants and selection and rejects stale scope results', async () => {
    const first = api.getTemplate(id);
    const duplicate = api.getTemplate(id);
    const initial = http.expectOne(path);
    selection.set({ companyId: 'company', branchId: null });
    const otherScope = api.getTemplate(id);
    http.expectOne(path).flush({ success: true, data: { etag: '"2"' } });
    await expect(otherScope).resolves.toMatchObject({ etag: '"2"' });
    initial.flush({ success: true, data: { etag: '"1"' } });
    await expect(first).rejects.toMatchObject({ status: 403 });
    await expect(duplicate).rejects.toMatchObject({ status: 403 });
    me.set({ id: 'other', permissions: ['templates.update'], permissionScopes: {} });
    const otherActor = api.getTemplate(id);
    http.expectOne(path).flush({ success: true, data: { etag: '"3"' } });
    await expect(otherActor).resolves.toMatchObject({ etag: '"3"' });
  });

  it('invalidates pending reads after a successful write', async () => {
    const old = api.getTemplate(id);
    const oldResult = old.catch((error: unknown) => error);
    const pendingRead = http.expectOne(path);
    const saved = api.patchTemplate(id, { name: 'Updated' }, '"7"', newIdempotencyKey());
    flushCommand(http.expectOne(path));
    await saved;
    await oldResult;
    pendingRead.flush({ success: true, data: { etag: '"7"' } });
    const fresh = api.getTemplate(id);
    http.expectOne(path).flush({ success: true, data: { etag: '"8"' } });
    await expect(fresh).resolves.toMatchObject({ etag: '"8"' });
  });
});

describe('templates api', () => {
  it('TemplateApiError is the core ApiError', () => {
    expect(TemplateApiError).toBe(ApiError);
    expect(new TemplateApiError(409, 'X')).toMatchObject({ status: 409, code: 'X' });
    expect(new TemplateApiError(409, 'X')).toBeInstanceOf(ApiError);
  });

  it('newTemplateIdempotencyKey is newIdempotencyKey', () => {
    expect(newTemplateIdempotencyKey).toBe(newIdempotencyKey);
    expect(newTemplateIdempotencyKey()).toMatch(uuidV7);
  });

  it('plain exports stay available for callers', async () => {
    const names = ['listTemplates', 'searchTemplates', 'getCreationScopes', 'listDataSources', 'getDataSourceSchema',
      'listStarters', 'getStarterThumbnail', 'createTemplate', 'duplicateTemplate', 'getTemplate', 'patchTemplate',
      'archiveTemplate', 'restoreTemplate', 'deleteTemplate', 'getTemplateThumbnail', 'retryTemplateThumbnail',
      'getDraft', 'patchDraft', 'validateDraft', 'getValidationRun', 'publishTemplate', 'listVersions', 'getVersion',
      'restoreVersion', 'retireVersion', 'listRecoverySnapshots', 'restoreRecoverySnapshot', 'listAssets',
      'getAsset', 'getAssetContent', 'uploadAsset', 'retireAsset', 'listAssignments', 'getAssignment',
      'createAssignment', 'patchAssignment', 'deactivateAssignment', 'resolveAssignment', 'previewHtml',
      'previewEmail', 'previewPdf', 'getPreviewJob', 'getPreviewJobArtifact', 'getPreviewJobLayoutReceipt'] as const;
    for (const name of names) expect(exports[name]).toBeTypeOf('function');
    await expect(exports.listTemplates({ assignmentScopeType: 'TENANT' })).resolves.toHaveProperty('items');
  });

  it('asset and assignment functions are re-exported', () => {
    const functions = {
      listAssets: assets.listAssets, getAsset: assets.getAsset, getAssetContent: assets.getAssetContent,
      uploadAsset: assets.uploadAsset, retireAsset: assets.retireAsset,
      listAssignments: assignments.listAssignments, getAssignment: assignments.getAssignment,
      createAssignment: assignments.createAssignment, patchAssignment: assignments.patchAssignment,
      deactivateAssignment: assignments.deactivateAssignment, resolveAssignment: assignments.resolveAssignment,
    };
    for (const [name, fn] of Object.entries(functions)) {
      expect(exports[name as keyof typeof exports]).toBe(fn);
    }
  });
});
