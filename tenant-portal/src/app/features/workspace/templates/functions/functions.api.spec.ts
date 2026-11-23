import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { FunctionsApi } from './functions.api';
import type { FunctionEditorContextRequestDto, FunctionWorkingBody } from './functions.model';

const base = '/api/tenant/core/v1/templates/functions';
const id = '01948100-0000-7000-8000-000000001001';
const versionId = '01948100-0000-7000-8000-000000001002';
const actorId = '01948100-0000-7000-8000-000000001003';
const now = '2026-11-23T12:00:00.000Z';
const signature = { type: 'DECIMAL', dimension: 'SCALAR', nullable: false } as const;
const working: FunctionWorkingBody = {
  numericPolicy: 'typed-scalars-dimensions-exact256s128-v1', name: 'Amount', parameters: [{ name: 'amount', ...signature }],
  result: signature, expression: { kind: 'PARAMETER', name: 'amount' }, tests: [],
};
const summary = { id, code: 'AMOUNT', name: 'Amount', scope: { scopeType: 'TENANT' }, status: 'ACTIVE', revision: 3,
  createdAt: now, updatedAt: now };
const detail = { ...summary, working };
const pins = { templateSchemaVersion: '0.1.6', templateEngineVersion: '0.1.6' };
const version = { id: versionId, functionId: id, versionNumber: 1, contentChecksum: 'a'.repeat(64), publishedAt: now,
  publishedBy: actorId, changeNote: 'Initial', parameters: working.parameters, result: signature, expression: working.expression,
  dependencies: [], testProof: { validationId: 'proof', passedCount: 1, totalCount: 1, checksum: 'proof-checksum' }, packagePins: pins };
const page = (items: unknown[]) => ({ items, pageInfo: { limit: 25, nextCursor: 'opaque-next', hasNextPage: true } });
const validation = { functionId: id, revision: 4, validationId: 'proof', state: 'FAILED', contentChecksum: 'a'.repeat(64),
  dependencyChecksum: 'b'.repeat(64), validatedAt: now,
  issues: [{ severity: 'ERROR', code: 'FUNCTION_TEST_MISMATCH', jsonPointer: '/tests/0/expected', nodeId: null,
    messageKey: 'FUNCTION_TEST_MISMATCH', params: {} }], testResults: [{ testId: 'case-1', state: 'FAILED', issueCodes: ['FUNCTION_TEST_MISMATCH'] }] };
const impactTarget = { templateId: id, draftRevision: 3, contentChecksum: 'content', fixtureKey: 'standard', fixtureChecksum: 'fixture',
  previousVersionIds: [], proposedVersionId: versionId, state: 'PASSED', comparisons: [], totalComparisons: 0, truncated: false, issueCodes: [] };
const request: FunctionEditorContextRequestDto = { templateId: id, expectedDraftRevision: 3, expectedContentChecksum: 'a'.repeat(64),
  expectedOwnerContextFingerprint: 'b'.repeat(64), functionVersionIds: [versionId], currencyCodes: ['EGP'], unitCodes: ['pcs'] };

function context() {
  const issuedAt = new Date().toISOString();
  return { contract: 'template-native-editor-options.v1', source: { templateId: id, draftId: 'draft', draftRevision: 3, contentChecksum: request.expectedContentChecksum },
    ownerContextFingerprint: request.expectedOwnerContextFingerprint, request, rootFunctionVersionIds: [versionId],
    release: { qualifiedManifestSha256: 'c'.repeat(64), executionPackagePins: pins, compatibleProducerPins: [pins], ownerPackagePins: {} },
    versions: [{ ...version, definition: working }], membership: { currencyCodes: ['EGP'], unitCodes: ['pcs'] },
    issuedAt, expiresAt: new Date(Date.parse(issuedAt) + 30_000).toISOString(), fingerprint: 'd'.repeat(64) };
}

describe('FunctionsApi Core HTTP contract', () => {
  let api: FunctionsApi;
  let http: HttpTestingController;
  let document: Document;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(FunctionsApi);
    http = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    const name = document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(`${name}=functions-csrf`);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('maps cursor summaries without inventing names or null fields', async () => {
    const pending = api.listFunctions({ scopeType: 'COMPANY', companyId: actorId, name: 'Amount', status: 'ACTIVE', cursor: 'opaque', limit: 25 });
    const req = http.expectOne(r => r.url === base);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.get('companyId')).toBe(actorId);
    expect(req.request.params.get('scopeType')).toBe('COMPANY');
    expect(req.request.params.get('cursor')).toBe('opaque');
    expect(req.request.params.get('name')).toBe('Amount');
    req.flush({ success: true, data: page([summary]) });
    const result = await pending;
    expect(result.pageInfo).toEqual(page([]).pageInfo);
    expect(result.items[0]).toEqual({ ...summary, etag: '"3"' });
  });

  it('requires and retains the current GET ETag', async () => {
    const pending = api.getFunction(id);
    http.expectOne(`${base}/${id}`).flush({ success: true, data: detail }, { headers: { ETag: '"3"' } });
    expect(await pending).toEqual({ ...detail, etag: '"3"' });
    const missing = api.getFunction(id);
    http.expectOne(`${base}/${id}`).flush({ success: true, data: detail });
    await expect(missing).rejects.toMatchObject({ status: 502 });
  });

  it('maps UUID publishers and preserves version details and pagination', async () => {
    const pending = api.listFunctionVersions(id, { cursor: 'next', limit: 25 });
    const req = http.expectOne(r => r.url === `${base}/${id}/versions`);
    expect(req.request.params.get('cursor')).toBe('next');
    req.flush({ success: true, data: page([version]) });
    const result = await pending;
    expect(result.items[0].publishedBy).toEqual({ kind: 'USER', actorId, displayName: actorId });
    const full = api.getFunctionVersion(id, versionId);
    http.expectOne(`${base}/${id}/versions/${versionId}`).flush({ success: true, data: version });
    expect((await full).expression).toEqual(working.expression);
  });

  it('preserves the usage source and exact version filter', async () => {
    const pending = api.listFunctionUsage(id, { versionId, limit: 25 });
    const req = http.expectOne(r => r.url === `${base}/${id}/usage`);
    expect(req.request.params.get('versionId')).toBe(versionId);
    const usage = { templateId: id, templateName: 'Quotation', sourceKind: 'PUBLISHED', sourceId: versionId,
      revisionOrVersionNumber: 3, functionVersionId: versionId };
    req.flush({ success: true, data: page([usage]) });
    expect((await pending).items).toEqual([usage]);
  });

  const commands = [
    { name: 'create', method: 'POST', suffix: '', status: 201, body: { code: 'AMOUNT', scope: { scopeType: 'TENANT' as const }, working },
      call: (api: FunctionsApi, key: string) => api.createFunction({ code: 'AMOUNT', scope: { scopeType: 'TENANT' }, working }, key), data: detail, match: false },
    { name: 'patch', method: 'PATCH', suffix: `/${id}`, status: 200, body: { working },
      call: (api: FunctionsApi, key: string) => api.patchFunction(id, { working }, '"3"', key), data: detail, match: true },
    { name: 'validate', method: 'POST', suffix: `/${id}/validate`, status: 200, body: { revision: 3 },
      call: (api: FunctionsApi, key: string) => api.validateFunction(id, { revision: 3 }, '"3"', key), data: validation, match: true },
    { name: 'publish', method: 'POST', suffix: `/${id}/publish`, status: 201,
      body: { revision: 3, validationId: 'proof', contentChecksum: 'content', dependencyChecksum: 'dependency', changeNote: 'Initial' },
      call: (api: FunctionsApi, key: string) => api.publishFunction(id, { revision: 3, validationId: 'proof', contentChecksum: 'content', dependencyChecksum: 'dependency', changeNote: 'Initial' }, '"3"', key), data: version, match: true },
    ...(['archive', 'restore'] as const).map(name => ({ name, method: 'POST', suffix: `/${id}/${name}`, status: 200, body: { reason: 'Reviewed' },
      call: (api: FunctionsApi, key: string) => name === 'archive' ? api.archiveFunction(id, { reason: 'Reviewed' }, '"3"', key) : api.restoreFunction(id, { reason: 'Reviewed' }, '"3"', key), data: detail, match: true })),
    { name: 'impact', method: 'POST', suffix: `/${id}/impact`, status: 200, body: { versionId, targets: [{ templateId: id, draftRevision: 3, fixtureKey: 'standard' }] },
      call: (api: FunctionsApi, key: string) => api.checkFunctionImpact(id, { versionId, targets: [{ templateId: id, draftRevision: 3, fixtureKey: 'standard' }] }, key),
      data: { impactId: 'impact', functionId: id, versionId, createdAt: now, expiresAt: now, checksum: 'checksum', state: 'PASSED', targets: [impactTarget] }, match: false },
    { name: 'apply', method: 'POST', suffix: `/${id}/apply-to-drafts`, status: 200,
      body: { versionId, impactId: 'impact', targets: [{ templateId: id, draftRevision: 3 }], reason: 'Reviewed' },
      call: (api: FunctionsApi, key: string) => api.applyFunctionToDrafts(id, { versionId, impactId: 'impact', targets: [{ templateId: id, draftRevision: 3 }], reason: 'Reviewed' }, key),
      data: { functionId: id, versionId, updated: [{ templateId: id, draftRevision: 4, contentChecksum: 'checksum', validationState: 'STALE' }] }, match: false },
  ];
  for (const command of commands) {
    it(`${command.name} sends the Core command headers, body and status`, async () => {
      const key = newIdempotencyKey();
      const pending = command.call(api, key);
      const req = http.expectOne(`${base}${command.suffix}`);
      expect(req.request.method).toBe(command.method);
      expect(req.request.body).toEqual(command.body);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      expect(req.request.headers.get('x-csrf-token')).toBe('functions-csrf');
      expect(req.request.headers.get('If-Match')).toBe(command.match ? '"3"' : null);
      req.flush({ success: true, data: command.data }, { status: command.status, statusText: 'OK', headers: { ETag: command.name === 'validate' ? '"4"' : '"3"' } });
      const result = await pending;
      if (command.name === 'validate') expect(result).toMatchObject({ revision: 4, etag: '"4"', issues: [{ path: '/tests/0/expected', jsonPointer: '/tests/0/expected', nodeId: null }] });
      else expect(result).toBeDefined();
    });
    it(`${command.name} rejects null command receipts`, async () => {
      const pending = command.call(api, newIdempotencyKey());
      http.expectOne(`${base}${command.suffix}`).flush({ success: true, data: null }, { status: command.status, statusText: 'OK' });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    });
  }

  it('gets a source-bound editor context without command headers', async () => {
    const pending = api.getFunctionEditorContext(request);
    const req = http.expectOne(`${base}/editor-context`);
    expect(req.request.body).toEqual(request);
    expect(req.request.headers.get('x-idempotency-key')).toBeNull();
    expect(req.request.headers.get('If-Match')).toBeNull();
    expect(req.request.headers.get('x-csrf-token')).toBe('functions-csrf');
    const receipt = context();
    req.flush({ success: true, data: receipt });
    expect(await pending).toEqual(receipt);
  });

  it('rejects stale source contexts and incomplete dependency graphs', async () => {
    for (const receipt of [
      { ...context(), source: { ...context().source, draftRevision: 2 } },
      { ...context(), expiresAt: new Date(0).toISOString() },
      { ...context(), versions: [] },
    ]) {
      const pending = api.getFunctionEditorContext(request);
      http.expectOne(`${base}/editor-context`).flush({ success: true, data: receipt });
      await expect(pending).rejects.toMatchObject({ status: 502 });
    }
  });

  it('rejects table-only expressions nested inside function bodies before sending writes', async () => {
    const body: FunctionWorkingBody = { ...working, expression: { kind: 'ABS', value: { kind: 'SUM_ROWS', sourcePath: 'items', item: working.expression } } };
    await expect(api.createFunction({ code: 'AMOUNT', scope: { scopeType: 'TENANT' }, working: body })).rejects.toBeInstanceOf(ApiError);
    http.expectNone(base);
  });

  it('propagates backend errors with correlation IDs and reuses explicit command keys on retry', async () => {
    const key = newIdempotencyKey();
    for (const status of [403, 412, 422, 429, 503]) {
      const pending = api.archiveFunction(id, { reason: 'Reviewed' }, '"3"', key);
      const req = http.expectOne(`${base}/${id}/archive`);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      req.flush({ code: 'FUNCTION_ARCHIVED', correlationId: 'trace-id' }, { status, statusText: 'Failure' });
      await expect(pending).rejects.toMatchObject({ status, code: 'FUNCTION_ARCHIVED', correlationId: 'trace-id' });
    }
  });

  it('rejects malformed pages and mismatching resource headers', async () => {
    const pending = api.listFunctions();
    http.expectOne(base).flush({ success: true, data: { items: [], pageInfo: { limit: 25 } } });
    await expect(pending).rejects.toMatchObject({ status: 502 });
    const read = api.getFunction(id);
    http.expectOne(`${base}/${id}`).flush({ success: true, data: detail }, { headers: { ETag: '"8"' } });
    await expect(read).rejects.toMatchObject({ status: 502 });
  });

  it('preserves exact256/128 evaluated comparison values without converting them to numbers', async () => {
    const decimal = { kind: 'DECIMAL', dimension: 'SCALAR', value: '1'.repeat(100) };
    const pending = api.checkFunctionImpact(id, { versionId, targets: [{ templateId: id, draftRevision: 3, fixtureKey: 'standard' }] });
    http.expectOne(`${base}/${id}/impact`).flush({ success: true, data: { impactId: 'impact', functionId: id, versionId,
      createdAt: now, expiresAt: now, checksum: 'checksum', state: 'PASSED', targets: [{ ...impactTarget,
        totalComparisons: 1, comparisons: [{ nodeId: 'node', formulaId: 'formula', previous: decimal, proposed: decimal }] }] } });
    expect((await pending).targets[0].comparisons[0].proposed).toEqual(decimal);
  });

  it('rejects incomplete impact results for the requested draft set', async () => {
    const pending = api.checkFunctionImpact(id, { versionId, targets: [{ templateId: id, draftRevision: 3, fixtureKey: 'standard' }] });
    http.expectOne(`${base}/${id}/impact`).flush({ success: true, data: { impactId: 'impact', functionId: id, versionId,
      createdAt: now, expiresAt: now, checksum: 'checksum', state: 'PASSED', targets: [] } });
    await expect(pending).rejects.toMatchObject({ status: 502 });
  });
});
