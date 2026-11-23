import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import {
  cancelRun,
  createMapping,
  discardMappingDraft,
  execute,
  getImportTargets,
  getMapping,
  getRun,
  getRunCounts,
  listMappings,
  listResults,
  listRuns,
  preview,
  publishMapping,
  readResultsCsv,
  releaseSource,
  resultsCsvUrl,
  toMappingFieldInput,
  updateMapping,
  uploadSource,
} from './imports.api';
import type {
  CreateImportMappingResult,
  DiscardMappingDraftResult,
  ImportMapping,
  ImportMappingDetail,
  ImportRun,
  ImportRunCommandResult,
  ImportRunCounts,
  ImportSource,
  MappingFieldInput,
  PreviewImportResult,
  PublishImportMappingResult,
  ReleaseSourceResult,
  RowResult,
  UpdateImportMappingResult,
} from './imports.model';
import type { ImportTargetsResponse } from './imports.registry';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const MAPPING_ID = '0193b000-0000-7000-8000-000000000001';
const SOURCE_ID = '0193b000-0000-7000-8000-000000000002';
const RUN_ID = '0193b000-0000-7000-8000-000000000003';

const COMPANY_CTX = { companyId: COMPANY_ID };
const BRANCH_CTX = { companyId: COMPANY_ID, branchId: BRANCH_ID };

const BASE_FIELDS: MappingFieldInput[] = [
  {
    sourceColumnCode: ' ItemCode ',
    sourceOrdinal: 0,
    targetFieldCode: 'ITEM_CODE',
    transformCode: 'NORMALIZE_CODE',
    isRequired: true,
  },
  {
    sourceColumnCode: 'CanSell',
    sourceOrdinal: 1,
    targetFieldCode: 'CAN_SELL',
    transformCode: 'ENUM_MAP',
    lookupCode: 'CUSTOM_LOOKUP_V2',
    isRequired: true,
  },
];

function makeMapping(overrides: Partial<ImportMapping> = {}): ImportMapping {
  return {
    id: MAPPING_ID,
    code: 'ITEM_SETTINGS',
    targetCode: 'CATALOG_COMPANY_PROFILE',
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    branchId: null,
    currentPublishedVersionId: null,
    status: 'DRAFT',
    version: 1,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeRun(overrides: Partial<ImportRun> = {}): ImportRun {
  return {
    id: RUN_ID,
    mappingId: MAPPING_ID,
    mappingVersionId: '0193b000-0000-7000-8000-000000000011',
    predecessorRunId: null,
    companyId: COMPANY_ID,
    branchId: null,
    sourceId: SOURCE_ID,
    fileName: 'items.csv',
    bulkJobId: null,
    cancelledCount: '0',
    failure: null,
    progress: { phase: null, processed: 0, total: null },
    mediaType: 'text/csv',
    fileSizeBytes: '256',
    targetDtoCode: 'trade.catalog.company-profile.import-row',
    targetDtoVersion: 1,
    mode: 'PER_ROW',
    status: 'PREVIEWED',
    totalCount: '10',
    validCount: '10',
    invalidCount: '0',
    succeededCount: '0',
    failedCount: '0',
    version: 3,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('imports.api', () => {
  const key = newIdempotencyKey();
  const input = { code: 'ITEM_SETTINGS', targetCode: 'CATALOG_COMPANY_PROFILE', scopeTarget: 'COMPANY', fields: BASE_FIELDS } as const;
  const filters = { mappingId: MAPPING_ID, createdFrom: '2026-11-01', createdTo: '2026-11-23' };
  const file = new File(['ItemCode\nA1\n'], 'items.csv', { type: 'text/csv' });
  const cases = [
    { name: 'getImportTargets', method: 'GET', path: '/import-mappings/targets', call: () => getImportTargets(BRANCH_CTX) },
    { name: 'listMappings', method: 'GET', path: '/import-mappings', query: { page: 2, limit: 12 }, call: () => listMappings({ page: 2, limit: 12 }, BRANCH_CTX) },
    { name: 'getMapping', method: 'GET', path: `/import-mappings/${MAPPING_ID}`, call: () => getMapping(MAPPING_ID, BRANCH_CTX) },
    { name: 'createMapping', method: 'POST', path: '/import-mappings', body: { ...input, executionMode: 'PER_ROW', fields: BASE_FIELDS.map(toMappingFieldInput) }, call: () => createMapping({ ...input, fields: BASE_FIELDS }, key, BRANCH_CTX) },
    { name: 'updateMapping', method: 'PATCH', path: `/import-mappings/${MAPPING_ID}`, body: { executionMode: 'PER_ROW', fields: BASE_FIELDS.map(toMappingFieldInput) }, ifMatch: '"3"', call: () => updateMapping(MAPPING_ID, { fields: BASE_FIELDS }, 3, key, BRANCH_CTX) },
    { name: 'publishMapping', method: 'POST', path: `/import-mappings/${MAPPING_ID}/publish`, ifMatch: '"3"', call: () => publishMapping(MAPPING_ID, 3, key, BRANCH_CTX) },
    { name: 'discardMappingDraft', method: 'DELETE', path: `/import-mappings/${MAPPING_ID}/draft`, ifMatch: '"3"', call: () => discardMappingDraft(MAPPING_ID, 3, key, BRANCH_CTX) },
    { name: 'uploadSource', method: 'POST', path: '/imports/sources', call: () => uploadSource(file, key, undefined, BRANCH_CTX) },
    { name: 'releaseSource', method: 'POST', path: `/imports/sources/${SOURCE_ID}/release`, call: () => releaseSource(SOURCE_ID, key, BRANCH_CTX) },
    { name: 'preview', method: 'POST', path: '/imports/preview', body: { mappingId: MAPPING_ID, sourceId: SOURCE_ID }, call: () => preview({ mappingId: MAPPING_ID, sourceId: SOURCE_ID }, key, BRANCH_CTX) },
    { name: 'execute', method: 'POST', path: `/imports/${RUN_ID}/execute`, ifMatch: '"3"', call: () => execute(RUN_ID, 3, key, BRANCH_CTX) },
    { name: 'cancelRun', method: 'POST', path: `/imports/${RUN_ID}/cancel`, ifMatch: '"3"', call: () => cancelRun(RUN_ID, 3, key, BRANCH_CTX) },
    { name: 'getRunCounts', method: 'GET', path: '/imports/counts', query: filters, call: () => getRunCounts(filters, BRANCH_CTX) },
    { name: 'listRuns', method: 'GET', path: '/imports', query: { ...filters, page: 2, limit: 12 }, call: () => listRuns({ ...filters, page: 2, limit: 12 }, BRANCH_CTX) },
    { name: 'getRun', method: 'GET', path: `/imports/${RUN_ID}`, call: () => getRun(RUN_ID, BRANCH_CTX) },
    { name: 'listResults', method: 'GET', path: `/imports/${RUN_ID}/results`, query: { status: 'INVALID', page: 2, limit: 12 }, call: () => listResults(RUN_ID, { status: 'INVALID', page: 2, limit: 12 }, BRANCH_CTX) },
    { name: 'resultsCsvUrl', method: 'GET', path: `/imports/${RUN_ID}/results.csv`, query: { status: 'INVALID' }, call: () => resultsCsvUrl(RUN_ID, 'INVALID', BRANCH_CTX) },
  ];

  it.each(cases)('$name preserves field errors and sends the scoped contract without retrying', async (test) => {
    const error = new ApiError(422, 'TRADE.IMPORT.MAPPING_INVALID', { lookupCode: ['invalid_lookup'] });
    const stub = new TradeHttpStub({ [`${test.method} ${test.path}`]: error });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(test.call()).rejects.toMatchObject({
        status: 422, code: error.code, details: { lookupCode: ['invalid_lookup'] },
      });
      if (test.method === 'GET') {
        expect(stub.recordedReads()).toEqual([{ path: test.path, query: test.query, scope: BRANCH_CTX }]);
      } else {
        expect(stub.recordedWrites()).toHaveLength(1);
        const write = stub.recordedWrites()[0];
        expect(write).toMatchObject({ method: test.method, path: test.path, key, scope: BRANCH_CTX, ifMatch: test.ifMatch });
        if (test.name === 'uploadSource') {
          expect((write.body as FormData).get('file')).toBeInstanceOf(File);
        } else {
          expect(write.body).toEqual(test.body);
        }
      }
    } finally {
      dispose();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('targets: getImportTargets calls GET /import-mappings/targets with OPTIONAL scope and unwraps response', async () => {
    const targets: ImportTargetsResponse = {
      registryVersion: 1,
      targets: [
        {
          code: 'CATALOG_COMPANY_PROFILE',
          dtoCode: 'trade.catalog.company-profile.import-row',
          dtoVersion: 1,
          fields: [
            { code: 'ITEM_CODE', required: true, allowedTransforms: ['NORMALIZE_CODE'], lookupCode: null },
          ],
        },
      ],
      lookups: {
        BOOLEAN_V1: { TRUE: true, FALSE: false },
        TRACKING_MODE_V1: { NONE: 'NONE', LOT: 'LOT', SERIAL: 'SERIAL' },
      },
    };
    const stub = new TradeHttpStub({ 'GET /import-mappings/targets': targets });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await getImportTargets(COMPANY_CTX);
      expect(res).toEqual(targets);
      expect(stub.recordedReads()).toEqual([
        { path: '/import-mappings/targets', query: undefined, scope: COMPANY_CTX },
      ]);
    } finally {
      dispose();
    }
  });

  it('mappings CRUD: listMappings, getMapping, createMapping, updateMapping, publishMapping, discardMappingDraft send exact paths, keys, If-Match, and scope', async () => {
    const mapping = makeMapping();
    const detail: ImportMappingDetail = {
      ...mapping,
      versions: [
        {
          id: 'ver-1',
          versionNumber: 1,
          targetDtoCode: 'trade.catalog.company-profile.import-row',
          targetDtoVersion: 1,
          transformRegistryVersion: 1,
          mappingHash: 'hash',
          executionMode: 'PER_ROW',
          status: 'DRAFT',
          publishedAt: null,
          version: 1,
          createdAt: '2026-11-23T10:00:00.000Z',
          updatedAt: '2026-11-23T10:00:00.000Z',
          fields: [
            {
              sourceColumnCode: 'ItemCode',
              sourceOrdinal: 0,
              targetFieldCode: 'ITEM_CODE',
              transformCode: 'NORMALIZE_CODE',
              lookupCode: null,
              isRequired: true,
            },
          ],
        },
      ],
    };
    const created: CreateImportMappingResult = {
      ...mapping,
      draftVersion: {
        ...detail.versions[0],
        mappingId: mapping.id,
        publishedBy: null,
      },
      fields: detail.versions[0].fields,
    };
    const updated: UpdateImportMappingResult = { ...created, version: 2, createdDraftVersion: false };
    const published: PublishImportMappingResult = {
      ...mapping,
      status: 'ACTIVE',
      version: 3,
      currentPublishedVersionId: 'ver-1',
      publishedVersion: { ...created.draftVersion, status: 'PUBLISHED', publishedAt: '2026-11-23T10:05:00.000Z' },
    };
    const discarded: DiscardMappingDraftResult = {
      id: mapping.id,
      version: 4,
      discardedVersionId: 'ver-2',
    };

    const stub = new TradeHttpStub({
      'GET /import-mappings': { items: [mapping], total: 1, page: 1, limit: 50 },
      'GET /import-mappings/:id': detail,
      'POST /import-mappings': created,
      'PATCH /import-mappings/:id': updated,
      'POST /import-mappings/:id/publish': published,
      'DELETE /import-mappings/:id/draft': discarded,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const page = await listMappings({ page: 1, limit: 50, status: 'DRAFT', targetCode: 'CATALOG_COMPANY_PROFILE' }, COMPANY_CTX);
      expect(page.items).toEqual([mapping]);

      const fetched = await getMapping(MAPPING_ID, BRANCH_CTX);
      expect(fetched.versions[0].fields[0].lookupCode).toBeNull();

      const createKey = newIdempotencyKey();
      const createRes = await createMapping(
        {
          code: 'ITEM_SETTINGS',
          targetCode: 'CATALOG_COMPANY_PROFILE',
          scopeTarget: 'COMPANY',
          fields: BASE_FIELDS,
        },
        createKey,
        COMPANY_CTX,
      );
      expect(createRes.id).toBe(MAPPING_ID);

      const updateKey = newIdempotencyKey();
      const updateRes = await updateMapping(MAPPING_ID, { fields: BASE_FIELDS }, 1, updateKey, COMPANY_CTX);
      expect(updateRes.version).toBe(2);

      const publishKey = newIdempotencyKey();
      const publishRes = await publishMapping(MAPPING_ID, 2, publishKey, COMPANY_CTX);
      expect(publishRes.status).toBe('ACTIVE');

      const discardKey = newIdempotencyKey();
      const discardRes = await discardMappingDraft(MAPPING_ID, 3, discardKey, COMPANY_CTX);
      expect(discardRes).toEqual(discarded);

      expect(stub.recordedReads()).toEqual([
        {
          path: '/import-mappings',
          query: { page: 1, limit: 50, status: 'DRAFT', targetCode: 'CATALOG_COMPANY_PROFILE' },
          scope: COMPANY_CTX,
        },
        {
          path: `/import-mappings/${MAPPING_ID}`,
          query: undefined,
          scope: BRANCH_CTX,
        },
      ]);

      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/import-mappings',
          body: {
            code: 'ITEM_SETTINGS',
            targetCode: 'CATALOG_COMPANY_PROFILE',
            scopeTarget: 'COMPANY',
            executionMode: 'PER_ROW',
            fields: [
              {
                sourceColumnCode: 'ItemCode',
                sourceOrdinal: 0,
                targetFieldCode: 'ITEM_CODE',
                transformCode: 'NORMALIZE_CODE',
                isRequired: true,
              },
              {
                sourceColumnCode: 'CanSell',
                sourceOrdinal: 1,
                targetFieldCode: 'CAN_SELL',
                transformCode: 'ENUM_MAP',
                lookupCode: 'CUSTOM_LOOKUP_V2',
                isRequired: true,
              },
            ],
          },
          key: createKey,
          ifMatch: undefined,
          scope: COMPANY_CTX,
          query: undefined,
        },
        {
          method: 'PATCH',
          path: `/import-mappings/${MAPPING_ID}`,
          body: {
            executionMode: 'PER_ROW',
            fields: BASE_FIELDS.map(toMappingFieldInput),
          },
          key: updateKey,
          ifMatch: '"1"',
          scope: COMPANY_CTX,
          query: undefined,
        },
        {
          method: 'POST',
          path: `/import-mappings/${MAPPING_ID}/publish`,
          body: undefined,
          key: publishKey,
          ifMatch: '"2"',
          scope: COMPANY_CTX,
          query: undefined,
        },
        {
          method: 'DELETE',
          path: `/import-mappings/${MAPPING_ID}/draft`,
          body: undefined,
          key: discardKey,
          ifMatch: '"3"',
          scope: COMPANY_CTX,
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('mappings CRUD rejects missing/non-UUIDv7 key and invalid If-Match before sending', async () => {
    const stub = new TradeHttpStub();
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        createMapping(
          { code: 'X', targetCode: 'CATALOG_COMPANY_PROFILE', scopeTarget: 'COMPANY', fields: BASE_FIELDS },
          'bad-key',
          COMPANY_CTX,
        ),
      ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });

      await expect(
        updateMapping(MAPPING_ID, { fields: BASE_FIELDS }, 0, newIdempotencyKey(), COMPANY_CTX),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });

      await expect(
        discardMappingDraft(MAPPING_ID, -1, newIdempotencyKey(), COMPANY_CTX),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });

      expect(stub.recordedWrites()).toEqual([]);
    } finally {
      dispose();
    }
  });

  it('mappings CRUD surfaces 422 TRADE.IMPORT.MAPPING_INVALID with field details', async () => {
    const err = new ApiError(422, 'TRADE.IMPORT.MAPPING_INVALID', {
      lookupCode: ['invalid_lookup_code'],
    });
    const stub = new TradeHttpStub({ 'PATCH /import-mappings/:id': err });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        updateMapping(MAPPING_ID, { fields: BASE_FIELDS }, 1, newIdempotencyKey(), COMPANY_CTX),
      ).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.IMPORT.MAPPING_INVALID',
        details: { lookupCode: ['invalid_lookup_code'] },
      });
    } finally {
      dispose();
    }
  });

  it('sources & start / cancel run: uploadSource, releaseSource, preview, execute, cancelRun, getRunCounts, listRuns, getRun, listResults', async () => {
    const source: ImportSource = {
      fileId: SOURCE_ID,
      fileName: 'items.csv',
      sourceObjectRef: 'obj://items.csv',
      sha256: 'a'.repeat(64),
      mediaType: 'text/csv',
      storedSize: 128,
    };
    const released: ReleaseSourceResult = {
      sourceId: SOURCE_ID,
      lifecycleCommandId: 'cmd-1',
      storageState: 'PURGED',
      idempotentReplay: false,
    };
    const previewRes: PreviewImportResult = {
      runId: RUN_ID,
      status: 'PENDING',
      dispatchStatus: 'QUEUED',
      sourceId: SOURCE_ID,
      mappingVersionId: 'ver-1',
      message: 'Preview queued',
    };
    const execRes: ImportRunCommandResult = {
      runId: RUN_ID,
      status: 'EXECUTING',
      jobId: 'job-1',
    };
    const cancelRes: ImportRunCommandResult = {
      runId: RUN_ID,
      status: 'CANCELLED',
      jobId: null,
    };
    const counts: ImportRunCounts = {
      total: 1,
      byStatus: {
        PENDING: 0,
        PREVIEWING: 0,
        PREVIEWED: 1,
        EXECUTING: 0,
        COMPLETED: 0,
        COMPLETED_WITH_ERRORS: 0,
        FAILED: 0,
        CANCELLED: 0,
      },
    };
    const run = makeRun();
    const wireRow = {
      rowNumber: '42',
      stableRowKey: 'ITEM-42',
      status: 'INVALID',
      errorCode: 'TRADE.IMPORT.VALUE_INVALID',
      errorFieldCode: 'CAN_SELL',
      ownerAggregateType: null,
      ownerAggregateId: null,
      ownerAggregateVersion: null,
      completedAt: null,
    } as unknown as RowResult;

    const stub = new TradeHttpStub({
      'POST /imports/sources': source,
      'POST /imports/sources/:id/release': released,
      'POST /imports/preview': previewRes,
      'POST /imports/:runId/execute': execRes,
      'POST /imports/:runId/cancel': cancelRes,
      'GET /imports/counts': counts,
      'GET /imports': { items: [run], total: 1, page: 1, limit: 24 },
      'GET /imports/:runId': run,
      'GET /imports/:runId/results': { items: [wireRow], total: 1, page: 1, limit: 25 },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const progressSpy = vi.fn();
      const file = new File(['ItemCode\nA1\n'], 'items.csv', { type: 'text/csv' });
      const uploadKey = newIdempotencyKey();
      const uploaded = await uploadSource(file, uploadKey, progressSpy, COMPANY_CTX);
      expect(uploaded).toEqual(source);
      expect(progressSpy).toHaveBeenCalledWith(100);

      const releaseKey = newIdempotencyKey();
      expect(await releaseSource(SOURCE_ID, releaseKey, COMPANY_CTX)).toEqual(released);

      const previewKey = newIdempotencyKey();
      expect(
        await preview({ mappingId: MAPPING_ID, sourceId: SOURCE_ID, predecessorRunId: 'pred-1' }, previewKey, COMPANY_CTX),
      ).toEqual(previewRes);

      const execKey = newIdempotencyKey();
      expect(await execute(RUN_ID, 3, execKey, BRANCH_CTX)).toEqual(execRes);

      const cancelKey = newIdempotencyKey();
      expect(await cancelRun(RUN_ID, 4, cancelKey, BRANCH_CTX)).toEqual(cancelRes);

      expect(await getRunCounts({ status: ['PENDING', 'PREVIEWED'], q: '  items  ' }, COMPANY_CTX)).toEqual(counts);
      expect(await listRuns({ status: 'PREVIEWED', q: '  items  ', page: 1, limit: 24 }, COMPANY_CTX)).toEqual({
        items: [run],
        total: 1,
        page: 1,
        limit: 24,
      });
      expect(await getRun(RUN_ID, COMPANY_CTX)).toEqual(run);

      const results = await listResults(RUN_ID, { status: 'INVALID', page: 1, limit: 25 }, COMPANY_CTX);
      expect(results.items[0].rowNumber).toBe(42);
      expect(typeof results.items[0].rowNumber).toBe('number');

      const writes = stub.recordedWrites();
      expect(writes[0].method).toBe('POST');
      expect(writes[0].path).toBe('/imports/sources');
      expect(writes[0].key).toBe(uploadKey);
      expect(writes[0].scope).toEqual(COMPANY_CTX);
      expect((writes[0].body as FormData).get('file')).toBeTruthy();

      expect(writes.slice(1)).toEqual([
        {
          method: 'POST',
          path: `/imports/sources/${SOURCE_ID}/release`,
          body: undefined,
          key: releaseKey,
          ifMatch: undefined,
          scope: COMPANY_CTX,
          query: undefined,
        },
        {
          method: 'POST',
          path: '/imports/preview',
          body: { mappingId: MAPPING_ID, sourceId: SOURCE_ID, predecessorRunId: 'pred-1' },
          key: previewKey,
          ifMatch: undefined,
          scope: COMPANY_CTX,
          query: undefined,
        },
        {
          method: 'POST',
          path: `/imports/${RUN_ID}/execute`,
          body: undefined,
          key: execKey,
          ifMatch: '"3"',
          scope: BRANCH_CTX,
          query: undefined,
        },
        {
          method: 'POST',
          path: `/imports/${RUN_ID}/cancel`,
          body: undefined,
          key: cancelKey,
          ifMatch: '"4"',
          scope: BRANCH_CTX,
          query: undefined,
        },
      ]);

      expect(stub.recordedReads()).toEqual([
        { path: '/imports/counts', query: { status: 'PENDING,PREVIEWED', q: 'items' }, scope: COMPANY_CTX },
        { path: '/imports', query: { status: 'PREVIEWED', q: 'items', page: 1, limit: 24 }, scope: COMPANY_CTX },
        { path: `/imports/${RUN_ID}`, query: undefined, scope: COMPANY_CTX },
        { path: `/imports/${RUN_ID}/results`, query: { status: 'INVALID', page: 1, limit: 25 }, scope: COMPANY_CTX },
      ]);
    } finally {
      dispose();
    }
  });

  it('results.csv: readResultsCsv and resultsCsvUrl use readBlob with scope headers and create an object URL', async () => {
    const csvBlob = new Blob(['\ufeffrow_number,status,field,error_code,owner_id\r\n'], { type: 'text/csv' });
    const stub = new TradeHttpStub({ 'GET /imports/:runId/results.csv': csvBlob });
    const dispose = bindTradeHttpForTest(stub);
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:results-csv');
    try {
      const blob = await readResultsCsv(RUN_ID, 'INVALID', BRANCH_CTX);
      expect(blob.size).toBe(csvBlob.size);

      const url = await resultsCsvUrl(RUN_ID, 'FAILED', BRANCH_CTX);
      expect(url).toBe('blob:results-csv');
      expect(createUrlSpy).toHaveBeenCalledTimes(1);
      expect(stub.recordedReads()).toEqual([
        { path: `/imports/${RUN_ID}/results.csv`, query: { status: 'INVALID' }, scope: BRANCH_CTX },
        { path: `/imports/${RUN_ID}/results.csv`, query: { status: 'FAILED' }, scope: BRANCH_CTX },
      ]);
    } finally {
      dispose();
    }
  });

  it('runs filter error: propagates TRADE.CONTROL_TOWER.QUERY_INVALID with field details', async () => {
    const err = new ApiError(400, 'TRADE.CONTROL_TOWER.QUERY_INVALID', { q: ['invalid_filter'] });
    const stub = new TradeHttpStub({ 'GET /imports': err });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listRuns({ q: 'bad' }, COMPANY_CTX)).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.CONTROL_TOWER.QUERY_INVALID',
        details: { q: ['invalid_filter'] },
      });
    } finally {
      dispose();
    }
  });
});
