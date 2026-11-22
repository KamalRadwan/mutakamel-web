import {
  type FakeBulkModule,
  fakeCancelBulkJob,
  fakeGetBulkJob,
  fakeSubmitBulkJob,
  registerFakeBulkModule,
} from '../../../shared/bulk-jobs/bulk-jobs.fake';
import type { BulkJob, BulkJobItem, BulkJobItemStatus, BulkJobSubmit } from '../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError, fakeDelay, fakeId } from '../shared/trade-api';
import { clone, nowIso } from '../shared/trade-foundation.fake';
import type { Page } from '../shared/trade-foundation.model';
import {
  type WriteOptions,
  checkIfMatch,
  computeHash,
  fakeIdem,
  getFakeActor,
  requireIdempotencyKey,
  requireIfMatch,
} from './automation-fake-actors';
import type {
  CreateImportMappingInput,
  CreateImportMappingResult,
  DiscardMappingDraftResult,
  ImportMapping,
  ImportMappingDetail,
  ImportRun,
  ImportRunCommandResult,
  ImportRunCounts,
  ImportRunFailure,
  ImportRunFilters,
  ImportRunStatus,
  ImportScopeTarget,
  ImportSource,
  ListImportMappingsQuery,
  ListImportRunsQuery,
  ListRowResultsQuery,
  MappingField,
  MappingFieldInput,
  MappingVersion,
  MappingVersionEntity,
  PreviewImportInput,
  PreviewImportResult,
  PublishImportMappingResult,
  ReleaseSourceResult,
  RowResult,
  RowResultStatus,
  UpdateImportMappingInput,
  UpdateImportMappingResult,
} from './imports.model';
import {
  CSV_MEDIA_TYPE,
  FILE_LIMITS,
  IMPORT_LOOKUPS,
  IMPORT_TARGETS,
  type ImportTargetCode,
  type ImportTargetsResponse,
  MAPPING_CODE_PATTERN,
  SOURCE_COLUMN_PATTERN,
  XLSX_MEDIA_TYPE,
  getImportTarget,
} from './imports.registry';

// Mirrors trade-app import-mappings.service.ts and import-source.service.ts (fake data only).

const idem = fakeIdem();

const CHUNK_STEP = 60;
const SOURCE_MAX_BYTES = 50 * 1024 * 1024;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN_STATUSES: readonly ImportRunStatus[] = [
  'PENDING',
  'PREVIEWING',
  'PREVIEWED',
  'EXECUTING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED',
];
const ROW_STATUSES: readonly RowResultStatus[] = ['VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED'];
const SOURCE_IN_USE: readonly ImportRunStatus[] = ['PENDING', 'PREVIEWING', 'PREVIEWED', 'EXECUTING'];
const TERMINAL: readonly ImportRunStatus[] = ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'];

/** The trade request context the fake answers for (the real API reads it from the scope headers). */
export interface FakeImportContext {
  companyId: string | null;
  branchId: string | null;
}

let context: FakeImportContext = { companyId: 'c1', branchId: null };

export function setFakeImportContext(next: FakeImportContext): void {
  context = { ...next };
}

interface StoredVersion extends MappingVersion {
  publishedBy: string | null;
}

interface StoredMapping extends ImportMapping {
  versions: StoredVersion[];
}

interface StoredSource {
  fileId: string;
  fileName: string | null;
  sourceObjectRef: string;
  sha256: string;
  mediaType: string;
  storedSize: number;
  companyId: string;
  branchId: string | null;
  uploadedBy: string;
  intentKey: string;
  released: boolean;
}

interface StoredRun {
  id: string;
  mappingId: string;
  mappingVersionId: string;
  predecessorRunId: string | null;
  companyId: string;
  branchId: string | null;
  sourceId: string;
  fileName: string | null;
  bulkJobId: string | null;
  failure: ImportRunFailure | null;
  mediaType: string;
  fileSizeBytes: number;
  targetDtoCode: string;
  targetDtoVersion: number;
  status: ImportRunStatus;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  succeededCount: number;
  failedCount: number;
  cancelledCount: number;
  cancelRequested: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  timers: ReturnType<typeof setTimeout>[];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function itemIdForRow(rowNumber: number): string {
  const num = ((rowNumber - 1) % 48) + 1;
  return `item-${String(num).padStart(2, '0')}`;
}

function row(rowNumber: number, status: RowResultStatus, completedAt: string | null): RowResult {
  const succeeded = status === 'SUCCEEDED';
  return {
    rowNumber,
    stableRowKey: `row-${String(rowNumber).padStart(5, '0')}`,
    status,
    errorCode: null,
    errorFieldCode: null,
    ownerAggregateType: succeeded ? 'trade.catalog.item' : null,
    ownerAggregateId: succeeded ? itemIdForRow(rowNumber) : null,
    ownerAggregateVersion: succeeded ? 2 : null,
    completedAt: status === 'VALID' || status === 'INVALID' ? null : completedAt,
  };
}

const PARTIAL_FAIL_ROWS = new Set([18, 145, 392]);

function failRow(target: RowResult, completedAt: string): void {
  target.status = 'FAILED';
  target.errorCode = 'TRADE.IMPORT.OWNER_COMMAND_FAILED';
  target.errorFieldCode = 'ITEM_CODE';
  target.completedAt = completedAt;
}

function succeedRow(target: RowResult, completedAt: string): void {
  target.status = 'SUCCEEDED';
  target.ownerAggregateType = 'trade.catalog.item';
  target.ownerAggregateId = itemIdForRow(target.rowNumber);
  target.ownerAggregateVersion = 2;
  target.completedAt = completedAt;
}

function buildRows(
  total: number,
  outcome: 'VALID' | 'SUCCEEDED' | 'CANCELLED' | 'PARTIAL_ERROR' | 'EXECUTING',
  completedAt: string | null,
  alreadyProcessed = 0,
): RowResult[] {
  const rows: RowResult[] = [];
  for (let i = 1; i <= total; i += 1) {
    if (outcome === 'SUCCEEDED') rows.push(row(i, 'SUCCEEDED', completedAt));
    else if (outcome === 'CANCELLED') rows.push(row(i, i <= alreadyProcessed ? 'SUCCEEDED' : 'CANCELLED', completedAt));
    else if (outcome === 'EXECUTING') rows.push(row(i, i <= alreadyProcessed ? 'SUCCEEDED' : 'VALID', completedAt));
    else if (outcome === 'PARTIAL_ERROR') {
      const r = row(i, 'SUCCEEDED', completedAt);
      if (PARTIAL_FAIL_ROWS.has(i)) failRow(r, completedAt ?? nowIso());
      rows.push(r);
    } else rows.push(row(i, 'VALID', null));
  }
  return rows;
}

function buildRowsWithPreviewErrors(total: number): RowResult[] {
  const invalidSpecs = new Map<number, { field: string; code: string }>([
    [14, { field: 'CAN_SELL', code: 'TRADE.IMPORT.VALUE_INVALID' }],
    [87, { field: 'ITEM_CODE', code: 'TRADE.IMPORT.REQUIRED_VALUE_MISSING' }],
    [311, { field: 'TRACKING_MODE', code: 'TRADE.IMPORT.VALUE_INVALID' }],
    [452, { field: 'CAN_PURCHASE', code: 'TRADE.IMPORT.VALUE_INVALID' }],
    [790, { field: 'ITEM_CODE', code: 'TRADE.IMPORT.REQUIRED_VALUE_MISSING' }],
    [1088, { field: 'DEFAULT_SALES_UOM_CODE', code: 'TRADE.IMPORT.VALUE_INVALID' }],
  ]);
  const rows: RowResult[] = [];
  for (let i = 1; i <= total; i += 1) {
    const err = invalidSpecs.get(i);
    const r = row(i, err ? 'INVALID' : 'VALID', null);
    if (err) {
      r.errorCode = err.code;
      r.errorFieldCode = err.field;
    }
    rows.push(r);
  }
  return rows;
}

function field(
  sourceOrdinal: number,
  sourceColumnCode: string,
  targetFieldCode: string,
  transformCode: MappingField['transformCode'],
  lookupCode: MappingField['lookupCode'],
  isRequired: boolean,
): MappingField {
  return { sourceColumnCode, sourceOrdinal, targetFieldCode, transformCode, lookupCode, isRequired };
}

function seedVersion(
  id: string,
  versionNumber: number,
  targetCode: ImportTargetCode,
  status: StoredVersion['status'],
  publishedAt: string | null,
  fields: MappingField[],
): StoredVersion {
  const target = getImportTarget(targetCode)!;
  return {
    id,
    versionNumber,
    targetDtoCode: target.dtoCode,
    targetDtoVersion: target.dtoVersion,
    transformRegistryVersion: 1,
    mappingHash: computeHash(fields).padEnd(64, '0'),
    executionMode: 'PER_ROW',
    status,
    publishedAt,
    publishedBy: publishedAt ? getFakeActor() : null,
    version: status === 'PUBLISHED' ? 2 : 1,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: publishedAt ?? '2026-11-18T14:00:00.000Z',
    fields,
  };
}

function buildSeedImports() {
  const itemSettingsFields: MappingField[] = [
    field(0, 'ItemCode', 'ITEM_CODE', 'NORMALIZE_CODE', null, true),
    field(1, 'CanSell', 'CAN_SELL', 'ENUM_MAP', 'BOOLEAN_V1', true),
    field(2, 'CanPurchase', 'CAN_PURCHASE', 'ENUM_MAP', 'BOOLEAN_V1', true),
    field(3, 'TrackInventory', 'TRACK_INVENTORY', 'ENUM_MAP', 'BOOLEAN_V1', true),
    field(4, 'TrackingMode', 'TRACKING_MODE', 'ENUM_MAP', 'TRACKING_MODE_V1', true),
  ];
  const branchV1Fields: MappingField[] = [
    field(0, 'ItemCode', 'ITEM_CODE', 'NORMALIZE_CODE', null, true),
    field(1, 'BranchCode', 'BRANCH_CODE', 'NORMALIZE_CODE', null, true),
    field(2, 'IsAssorted', 'IS_ASSORTED', 'ENUM_MAP', 'BOOLEAN_V1', true),
  ];
  const branchV2Fields: MappingField[] = [
    ...branchV1Fields,
    field(3, 'DefaultFulfillmentNode', 'DEFAULT_FULFILLMENT_NODE_CODE', 'NORMALIZE_CODE', null, false),
  ];

  const mappings: StoredMapping[] = [
    {
      id: 'map-item-settings',
      code: 'ITEM_SETTINGS',
      targetCode: 'CATALOG_COMPANY_PROFILE',
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      branchId: null,
      currentPublishedVersionId: 'mapv-item-1',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
      versions: [
        seedVersion('mapv-item-1', 1, 'CATALOG_COMPANY_PROFILE', 'PUBLISHED', '2026-06-02T09:00:00.000Z', itemSettingsFields),
      ],
    },
    {
      id: 'map-branch-assortment',
      code: 'BRANCH_ASSORTMENT',
      targetCode: 'CATALOG_BRANCH_ASSIGNMENT',
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      branchId: null,
      currentPublishedVersionId: 'mapv-branch-1',
      status: 'ACTIVE',
      version: 3,
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-11-18T14:00:00.000Z',
      versions: [
        seedVersion('mapv-branch-1', 1, 'CATALOG_BRANCH_ASSIGNMENT', 'PUBLISHED', '2026-07-02T09:00:00.000Z', branchV1Fields),
        seedVersion('mapv-branch-2', 2, 'CATALOG_BRANCH_ASSIGNMENT', 'DRAFT', null, branchV2Fields),
      ],
    },
  ];

  // Source ids are UUIDv7 because release validates them (requireUuidV7).
  const sourceSeed: [string, string, string, number][] = [
    ['0193b000-0000-7000-8000-000000000001', 'items-november-live.xlsx', XLSX_MEDIA_TYPE, 1_842_120],
    ['0193b000-0000-7000-8000-000000000002', 'items-november.xlsx', XLSX_MEDIA_TYPE, 2_516_582],
    ['0193b000-0000-7000-8000-000000000003', 'catalog-q4-clean.csv', CSV_MEDIA_TYPE, 412_800],
    ['0193b000-0000-7000-8000-000000000004', 'branch-assortment-partial.xlsx', XLSX_MEDIA_TYPE, 1_258_000],
    ['0193b000-0000-7000-8000-000000000005', 'legacy-header-fail.csv', CSV_MEDIA_TYPE, 98_400],
    ['0193b000-0000-7000-8000-000000000006', 'october-reimport-cancelled.csv', CSV_MEDIA_TYPE, 320_000],
  ];
  const sources: StoredSource[] = sourceSeed.map(([fileId, fileName, mediaType, storedSize], index) => ({
    fileId,
    fileName,
    sourceObjectRef: `imports/${fileId}`,
    sha256: 'abcdef'[index].repeat(64),
    mediaType,
    storedSize,
    companyId: 'c1',
    branchId: null,
    uploadedBy: getFakeActor(),
    intentKey: `seed-${fileId}`,
    released: false,
  }));

  const baseRun = (
    id: string,
    mappingId: string,
    sourceIndex: number,
    status: ImportRunStatus,
    counts: [number, number, number, number, number, number],
    version: number,
    createdAt: string,
    updatedAt: string,
  ): StoredRun => {
    const mapping = mappings.find((m) => m.id === mappingId)!;
    const source = sources[sourceIndex];
    const target = getImportTarget(mapping.targetCode)!;
    const [totalCount, validCount, invalidCount, succeededCount, failedCount, cancelledCount] = counts;
    return {
      id,
      mappingId,
      mappingVersionId: mapping.currentPublishedVersionId!,
      predecessorRunId: null,
      companyId: 'c1',
      branchId: null,
      sourceId: source.fileId,
      fileName: source.fileName,
      bulkJobId: null,
      failure: null,
      mediaType: source.mediaType,
      fileSizeBytes: source.storedSize,
      targetDtoCode: target.dtoCode,
      targetDtoVersion: target.dtoVersion,
      status,
      totalCount,
      validCount,
      invalidCount,
      succeededCount,
      failedCount,
      cancelledCount,
      cancelRequested: false,
      version,
      createdAt,
      updatedAt,
      timers: [],
    };
  };

  const runs: StoredRun[] = [
    baseRun('run-executing-1', 'map-item-settings', 0, 'EXECUTING', [660, 660, 0, 240, 0, 0], 4,
      '2026-11-21T10:30:00.000Z', '2026-11-21T10:32:00.000Z'),
    baseRun('run-previewed-2', 'map-item-settings', 1, 'PREVIEWED', [660, 660, 0, 0, 0, 0], 2,
      '2026-11-21T09:15:00.000Z', '2026-11-21T09:15:45.000Z'),
    baseRun('run-completed-3', 'map-item-settings', 2, 'COMPLETED', [660, 660, 0, 660, 0, 0], 5,
      '2026-11-20T15:00:00.000Z', '2026-11-20T15:03:00.000Z'),
    baseRun('run-partial-4', 'map-branch-assortment', 3, 'COMPLETED_WITH_ERRORS', [420, 420, 0, 417, 3, 0], 5,
      '2026-11-19T11:20:00.000Z', '2026-11-19T11:24:00.000Z'),
    baseRun('run-failed-5', 'map-item-settings', 4, 'FAILED', [0, 0, 0, 0, 0, 0], 2,
      '2026-11-18T16:10:00.000Z', '2026-11-18T16:10:12.000Z'),
    baseRun('run-cancelled-6', 'map-branch-assortment', 5, 'CANCELLED', [300, 300, 0, 120, 0, 180], 4,
      '2026-11-17T13:00:00.000Z', '2026-11-17T13:02:00.000Z'),
  ];
  runs[4].failure = { phase: 'PREVIEW', code: 'WORKER.TRADE_IMPORT.MAPPING_HEADER_MISMATCH' };

  const resultsByRun = new Map<string, RowResult[]>([
    ['run-executing-1', buildRows(660, 'EXECUTING', '2026-11-21T10:31:30.000Z', 240)],
    ['run-previewed-2', buildRows(660, 'VALID', null)],
    ['run-completed-3', buildRows(660, 'SUCCEEDED', '2026-11-20T15:03:00.000Z')],
    ['run-partial-4', buildRows(420, 'PARTIAL_ERROR', '2026-11-19T11:24:00.000Z')],
    ['run-failed-5', []],
    ['run-cancelled-6', buildRows(300, 'CANCELLED', '2026-11-17T13:02:00.000Z', 120)],
  ]);

  return { mappings, sources, runs, resultsByRun };
}

const DB = buildSeedImports();

// ---------------------------------------------------------------------------
// Projections (projectMapping, projectRun, version entity)
// ---------------------------------------------------------------------------

function projectMapping(m: StoredMapping): ImportMapping {
  return {
    id: m.id,
    code: m.code,
    targetCode: m.targetCode,
    scopeTarget: m.scopeTarget,
    companyId: m.companyId,
    branchId: m.branchId,
    currentPublishedVersionId: m.currentPublishedVersionId,
    status: m.status,
    version: m.version,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function projectVersion(v: StoredVersion): MappingVersion {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    targetDtoCode: v.targetDtoCode,
    targetDtoVersion: v.targetDtoVersion,
    transformRegistryVersion: v.transformRegistryVersion,
    mappingHash: v.mappingHash,
    executionMode: v.executionMode,
    status: v.status,
    publishedAt: v.publishedAt,
    version: v.version,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    fields: clone(v.fields),
  };
}

function versionEntity(mappingId: string, v: StoredVersion): MappingVersionEntity {
  return {
    id: v.id,
    mappingId,
    versionNumber: v.versionNumber,
    targetDtoCode: v.targetDtoCode,
    targetDtoVersion: v.targetDtoVersion,
    transformRegistryVersion: v.transformRegistryVersion,
    mappingHash: v.mappingHash,
    executionMode: v.executionMode,
    status: v.status,
    publishedAt: v.publishedAt,
    publishedBy: v.publishedBy,
    version: v.version,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function rowsOf(run: StoredRun): RowResult[] {
  return DB.resultsByRun.get(run.id) ?? [];
}

function projectRun(r: StoredRun): ImportRun {
  const previewing = r.status === 'PENDING' || r.status === 'PREVIEWING';
  const progress = r.bulkJobId
    ? {
        phase: r.status === 'EXECUTING' ? ('EXECUTE' as const) : null,
        processed: r.succeededCount + r.failedCount + r.cancelledCount,
        total: r.validCount,
      }
    : previewing
      ? { phase: 'PREVIEW' as const, processed: r.status === 'PREVIEWING' ? 1 : 0, total: r.status === 'PREVIEWING' ? 2 : null }
      : { phase: null, processed: r.succeededCount + r.failedCount + r.cancelledCount, total: r.validCount };
  return {
    id: r.id,
    mappingId: r.mappingId,
    mappingVersionId: r.mappingVersionId,
    predecessorRunId: r.predecessorRunId,
    companyId: r.companyId,
    branchId: r.branchId,
    sourceId: r.sourceId,
    fileName: r.fileName,
    bulkJobId: r.bulkJobId,
    cancelledCount: String(r.cancelledCount),
    failure: r.failure ? { ...r.failure } : null,
    progress,
    mediaType: r.mediaType,
    fileSizeBytes: String(r.fileSizeBytes),
    targetDtoCode: r.targetDtoCode,
    targetDtoVersion: r.targetDtoVersion,
    mode: 'PER_ROW',
    status: r.status,
    totalCount: String(r.totalCount),
    validCount: String(r.validCount),
    invalidCount: String(r.invalidCount),
    succeededCount: String(r.succeededCount),
    failedCount: String(r.failedCount),
    version: r.version,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Scope and validation (requireImportScope, requireImportRunContext, validateImportMapping)
// ---------------------------------------------------------------------------

function scopeMismatch(): ApiError {
  return new ApiError(422, 'TRADE.IMPORT.SCOPE_MISMATCH');
}

function mappingInvalid(): ApiError {
  return new ApiError(422, 'TRADE.IMPORT.MAPPING_INVALID');
}

function requireRunContext(): { companyId: string; branchId: string | null } {
  if (!context.companyId) throw scopeMismatch();
  return { companyId: context.companyId, branchId: context.branchId };
}

function inScope(item: { companyId: string; branchId: string | null }): boolean {
  const scope = requireRunContext();
  return item.companyId === scope.companyId && item.branchId === scope.branchId;
}

function requireMapping(id: string): StoredMapping {
  const scope = requireRunContext();
  const found = DB.mappings.find(
    (m) => m.id === id && inScope(m) && m.scopeTarget === (scope.branchId ? 'BRANCH' : 'COMPANY'),
  );
  if (!found) throw new ApiError(404, 'TRADE.IMPORT.MAPPING_NOT_FOUND');
  return found;
}

function requireRun(id: string): StoredRun {
  const found = DB.runs.find((r) => r.id === id && inScope(r));
  if (!found) throw new ApiError(404, 'TRADE.IMPORT.RUN_NOT_FOUND');
  return found;
}

function compileMapping(targetCode: string, fields: readonly MappingFieldInput[]): MappingField[] {
  const target = getImportTarget(targetCode);
  if (!target || !Array.isArray(fields) || fields.length < 1 || fields.length > FILE_LIMITS.columns) {
    throw mappingInvalid();
  }
  const sources = new Set(fields.map((f) => (f.sourceColumnCode ?? '').toLowerCase()));
  const targets = new Set(fields.map((f) => f.targetFieldCode));
  if (sources.size !== fields.length || targets.size !== fields.length) throw mappingInvalid();
  if (target.fields.some((f) => f.required && !targets.has(f.code))) throw mappingInvalid();
  for (const f of fields) {
    const spec = target.fields.find((s) => s.code === f.targetFieldCode);
    if (
      !spec ||
      !SOURCE_COLUMN_PATTERN.test(f.sourceColumnCode ?? '') ||
      !Number.isInteger(f.sourceOrdinal) ||
      f.sourceOrdinal < 0 ||
      f.sourceOrdinal > 999 ||
      !spec.allowedTransforms.includes(f.transformCode) ||
      (spec.lookupCode ? f.lookupCode !== spec.lookupCode : f.lookupCode !== undefined) ||
      (f.isRequired !== undefined && typeof f.isRequired !== 'boolean')
    ) {
      throw mappingInvalid();
    }
  }
  return [...fields]
    .sort((a, b) => a.sourceOrdinal - b.sourceOrdinal)
    .map((f) => ({
      sourceColumnCode: f.sourceColumnCode.trim(),
      sourceOrdinal: f.sourceOrdinal,
      targetFieldCode: f.targetFieldCode,
      transformCode: f.transformCode,
      lookupCode: f.lookupCode ?? null,
      isRequired: f.isRequired ?? false,
    }));
}

function newVersion(versionNumber: number, targetCode: ImportTargetCode, fields: MappingField[]): StoredVersion {
  const target = getImportTarget(targetCode)!;
  const now = nowIso();
  return {
    id: fakeId(),
    versionNumber,
    targetDtoCode: target.dtoCode,
    targetDtoVersion: target.dtoVersion,
    transformRegistryVersion: 1,
    mappingHash: computeHash(fields).padEnd(64, '0'),
    executionMode: 'PER_ROW',
    status: 'DRAFT',
    publishedAt: null,
    publishedBy: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    fields,
  };
}

function touch(entity: { version: number; updatedAt: string }): void {
  entity.version += 1;
  entity.updatedAt = nowIso();
}

function assertPage(page: number, limit: number): void {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

function pageOf<T>(items: T[], page: number, limit: number): Page<T> {
  return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
}

// ---------------------------------------------------------------------------
// Worker bulk module (trading.catalog-import EXECUTE)
// ---------------------------------------------------------------------------

function clearRunTimers(run: StoredRun): void {
  for (const t of run.timers) clearTimeout(t);
  run.timers = [];
}

function recomputeRunCounts(run: StoredRun): void {
  const rows = rowsOf(run);
  run.succeededCount = rows.filter((r) => r.status === 'SUCCEEDED').length;
  run.failedCount = rows.filter((r) => r.status === 'FAILED').length;
  run.cancelledCount = rows.filter((r) => r.status === 'CANCELLED').length;
}

function finalizeRunCancelled(run: StoredRun): void {
  const now = nowIso();
  for (const r of rowsOf(run)) {
    if (r.status === 'VALID') {
      r.status = 'CANCELLED';
      r.completedAt = now;
    }
  }
  recomputeRunCounts(run);
  run.status = 'CANCELLED';
  touch(run);
}

function finishIfDone(run: StoredRun): void {
  if (!rowsOf(run).some((r) => r.status === 'VALID')) {
    run.status = run.failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  }
}

/** Seeded EXECUTING run without a job: advances one chunk per read so the demo moves. */
function advanceSeededExecutingRun(run: StoredRun): void {
  if (run.status !== 'EXECUTING' || run.bulkJobId !== null) return;
  const now = nowIso();
  const isPartial = (run.fileName ?? '').toLowerCase().includes('partial');
  for (const r of rowsOf(run).filter((x) => x.status === 'VALID').slice(0, CHUNK_STEP)) {
    if (isPartial && PARTIAL_FAIL_ROWS.has(r.rowNumber)) failRow(r, now);
    else succeedRow(r, now);
  }
  recomputeRunCounts(run);
  finishIfDone(run);
  touch(run);
}

async function syncRunWithBulkJob(run: StoredRun): Promise<void> {
  if (!run.bulkJobId || run.status !== 'EXECUTING') return;
  try {
    const job = await fakeGetBulkJob('trading', run.bulkJobId);
    if (job.status === 'CANCELLED') finalizeRunCancelled(run);
  } catch {
    // A missing fake job leaves the run as it is.
  }
}

type ChunkResult = { ordinal: number; status: BulkJobItemStatus; code?: string; field?: string; refId?: string };

function runIdOf(params: unknown): string {
  const runId = (params as { runId?: unknown } | null)?.runId;
  return typeof runId === 'string' ? runId.trim() : '';
}

const CATALOG_IMPORT_BULK_MODULE: FakeBulkModule = {
  module: 'trading.catalog-import',
  chunkSize: () => CHUNK_STEP,
  validate(body: BulkJobSubmit): void {
    if (!runIdOf(body.params)) throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  },
  async resolve(body: BulkJobSubmit) {
    const run = DB.runs.find((r) => r.id === runIdOf(body.params));
    if (!run) return [];
    return rowsOf(run)
      .filter((r) => r.status === 'VALID')
      .map((r) => ({
        entityId: r.stableRowKey,
        label: `${run.fileName ?? run.id} #${r.rowNumber}`,
        data: { runId: run.id, rowNumber: r.rowNumber },
      }));
  },
  async executeChunk(_job: BulkJob, rawParams: unknown, items: BulkJobItem[]): Promise<ChunkResult[]> {
    const run = DB.runs.find((r) => r.id === runIdOf(rawParams));
    if (!run) {
      return items.map((item) => ({ ordinal: item.ordinal, status: 'FAILED' as const, code: 'TRADE.IMPORT.RUN_NOT_FOUND' }));
    }
    const byKey = new Map(rowsOf(run).map((r) => [r.stableRowKey, r]));
    const isPartial = (run.fileName ?? '').toLowerCase().includes('partial');
    const now = nowIso();
    const results: ChunkResult[] = items.map((item) => {
      const target = byKey.get(item.entityId);
      if (!target) return { ordinal: item.ordinal, status: 'FAILED', code: 'TRADE.IMPORT.OWNER_COMMAND_FAILED' };
      if (isPartial && PARTIAL_FAIL_ROWS.has(target.rowNumber)) {
        failRow(target, now);
        return { ordinal: item.ordinal, status: 'FAILED', code: 'TRADE.IMPORT.OWNER_COMMAND_FAILED', field: 'ITEM_CODE' };
      }
      succeedRow(target, now);
      return { ordinal: item.ordinal, status: 'SUCCEEDED', refId: target.ownerAggregateId ?? undefined };
    });
    recomputeRunCounts(run);
    finishIfDone(run);
    touch(run);
    return results;
  },
  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const run = DB.runs.find((r) => r.id === runIdOf(body.params));
    const mapping = run ? DB.mappings.find((m) => m.id === run.mappingId) : undefined;
    return { runId: runIdOf(body.params), fileName: run?.fileName ?? null, mappingCode: mapping?.code ?? null };
  },
};

registerFakeBulkModule('trading', CATALOG_IMPORT_BULK_MODULE);

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

/** Specs: the stored version of a run or mapping (1 when unknown), read without the fake delay. */
export function fakeImportVersion(id: string): number {
  return DB.runs.find((r) => r.id === id)?.version ?? DB.mappings.find((m) => m.id === id)?.version ?? 1;
}

export async function fakeGetImportTargets(): Promise<ImportTargetsResponse> {
  await fakeDelay(80);
  return clone({ registryVersion: 1, targets: [...IMPORT_TARGETS], lookups: IMPORT_LOOKUPS });
}

export async function fakeListMappings(q: ListImportMappingsQuery = {}): Promise<Page<ImportMapping>> {
  await fakeDelay();
  const scope = requireRunContext();
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  assertPage(page, limit);
  const items = DB.mappings
    .filter(
      (m) =>
        inScope(m) &&
        m.scopeTarget === (scope.branchId ? 'BRANCH' : 'COMPANY') &&
        (!q.status || m.status === q.status) &&
        (!q.targetCode || m.targetCode === q.targetCode),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map(projectMapping);
  return clone(pageOf(items, page, limit));
}

export async function fakeGetMapping(id: string): Promise<ImportMappingDetail> {
  await fakeDelay();
  const mapping = requireMapping(id);
  const versions = [...mapping.versions].sort((a, b) => b.versionNumber - a.versionNumber).map(projectVersion);
  return clone({ ...projectMapping(mapping), versions });
}

export async function fakeCreateMapping(
  input: CreateImportMappingInput,
  idempotencyKey?: string,
): Promise<CreateImportMappingResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(idempotencyKey);
  return idem.run('imports:createMapping', key, input, () => {
    const scopeTarget: ImportScopeTarget = input.scopeTarget;
    if (
      !context.companyId ||
      (scopeTarget === 'BRANCH' && (!context.branchId || context.branchId !== input.branchId)) ||
      (scopeTarget === 'COMPANY' && input.branchId)
    ) {
      throw scopeMismatch();
    }
    if (
      !MAPPING_CODE_PATTERN.test(input.code ?? '') ||
      !getImportTarget(input.targetCode) ||
      (input.executionMode !== undefined && input.executionMode !== 'PER_ROW')
    ) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
    const fields = compileMapping(input.targetCode, input.fields);
    const companyId = context.companyId;
    const branchId = scopeTarget === 'BRANCH' ? input.branchId! : null;
    const code = input.code.trim().toUpperCase();
    if (DB.mappings.some((m) => m.code === code && m.companyId === companyId && m.branchId === branchId)) {
      throw mappingInvalid(); // unique violation maps to MAPPING_INVALID in the backend
    }
    const now = nowIso();
    const id = fakeId();
    const draft = newVersion(1, input.targetCode, fields);
    const created: StoredMapping = {
      id,
      code,
      targetCode: input.targetCode,
      scopeTarget,
      companyId,
      branchId,
      currentPublishedVersionId: null,
      status: 'DRAFT',
      version: 1,
      createdAt: now,
      updatedAt: now,
      versions: [draft],
    };
    DB.mappings.unshift(created);
    return { ...projectMapping(created), draftVersion: versionEntity(id, draft), fields: clone(fields) };
  });
}

export async function fakeUpdateMapping(
  id: string,
  input: UpdateImportMappingInput,
  opts: WriteOptions = {},
): Promise<UpdateImportMappingResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  return idem.run(`imports:updateMapping:${id}`, key, { id, input, expected }, () => {
    const mapping = requireMapping(id);
    checkIfMatch(expected, mapping.version);
    if (input.executionMode !== undefined && input.executionMode !== 'PER_ROW') {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
    const fields = compileMapping(mapping.targetCode, input.fields);
    let draft = mapping.versions.find((v) => v.status === 'DRAFT');
    let createdDraftVersion = false;
    if (!draft) {
      const published = mapping.versions.find(
        (v) => v.id === mapping.currentPublishedVersionId && v.status === 'PUBLISHED',
      );
      if (!published) throw mappingInvalid();
      const next = Math.max(...mapping.versions.map((v) => v.versionNumber)) + 1;
      draft = newVersion(next, mapping.targetCode, fields);
      mapping.versions.push(draft);
      createdDraftVersion = true;
    } else {
      draft.fields = fields;
      draft.mappingHash = computeHash(fields).padEnd(64, '0');
      touch(draft);
    }
    touch(mapping);
    return {
      ...projectMapping(mapping),
      draftVersion: versionEntity(mapping.id, draft),
      fields: clone(fields),
      createdDraftVersion,
    };
  });
}

export async function fakePublishMapping(
  id: string,
  opts: WriteOptions = {},
): Promise<PublishImportMappingResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  return idem.run(`imports:publishMapping:${id}`, key, { id, expected }, () => {
    const mapping = requireMapping(id);
    checkIfMatch(expected, mapping.version);
    const draft = mapping.versions.find((v) => v.status === 'DRAFT');
    if (!draft || draft.fields.length === 0) throw mappingInvalid();
    // The backend leaves an older PUBLISHED version as it is; only the pointer moves.
    draft.status = 'PUBLISHED';
    draft.publishedAt = nowIso();
    draft.publishedBy = getFakeActor();
    touch(draft);
    mapping.currentPublishedVersionId = draft.id;
    mapping.status = 'ACTIVE';
    touch(mapping);
    return { ...projectMapping(mapping), publishedVersion: versionEntity(mapping.id, draft) };
  });
}

export async function fakeDiscardMappingDraft(
  id: string,
  opts: WriteOptions = {},
): Promise<DiscardMappingDraftResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  return idem.run(`imports:discardDraft:${id}`, key, { id, expected }, () => {
    const mapping = requireMapping(id);
    checkIfMatch(expected, mapping.version);
    const draft = mapping.versions.find((v) => v.status === 'DRAFT');
    if (!draft) throw mappingInvalid();
    mapping.versions = mapping.versions.filter((v) => v !== draft);
    touch(mapping);
    return { id, version: mapping.version, discardedVersionId: draft.id };
  });
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function requireUuidV7(value: string | undefined, field: string): void {
  if (!value || !UUID_V7.test(value)) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.KEY_REQUIRED', { reason: [`import_source_${field.toLowerCase()}_invalid`] });
  }
}

async function headBytes(file: Blob): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  } catch {
    return null;
  }
}

function sanitizeFileName(value: string | undefined): string | null {
  if (!value) return null;
  // eslint-disable-next-line no-control-regex
  const name = (value.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255).trim();
  return name || null;
}

/** POST /imports/sources: the media type is detected from the bytes, never from the name. */
export async function fakeUploadSource(
  file: File | null,
  idempotencyKey: string | undefined,
  onProgress?: (percent: number) => void,
): Promise<ImportSource> {
  onProgress?.(15);
  await fakeDelay(140);
  if (!file) throw new ApiError(400, 'TRADE.IMPORT.FILE_UNSAFE', { reason: ['import_source_file_required'] });
  const key = requireIdempotencyKey(idempotencyKey);
  requireUuidV7(key, 'idempotencyKey');
  const scope = requireRunContext();
  if (file.size <= 0) throw new ApiError(400, 'TRADE.IMPORT.FILE_UNSAFE');

  const head = await headBytes(file);
  const isZip = head
    ? head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
    : file.name.toLowerCase().endsWith('.xlsx');
  if (isZip && file.size > FILE_LIMITS.xlsxBytes) {
    throw new ApiError(413, 'TRADE.IMPORT.FILE_TOO_LARGE', { reason: ['xlsx_over_8_mib'] });
  }
  if (!isZip && file.size > FILE_LIMITS.csvBytes) throw new ApiError(413, 'TRADE.IMPORT.FILE_TOO_LARGE');
  if (file.size > SOURCE_MAX_BYTES) throw new ApiError(413, 'TRADE.IMPORT.FILE_TOO_LARGE');
  if (!isZip && (head ? head.includes(0) : !file.name.toLowerCase().endsWith('.csv'))) {
    throw new ApiError(415, 'TRADE.IMPORT.FILE_TYPE_UNSUPPORTED');
  }
  const mediaType = isZip ? XLSX_MEDIA_TYPE : CSV_MEDIA_TYPE;
  const sha256 = computeHash({ name: file.name, size: file.size, head: head ? Array.from(head.slice(0, 64)) : null })
    .repeat(4);

  onProgress?.(65);
  await fakeDelay(140);
  onProgress?.(100);

  const actor = getFakeActor();
  const existing = DB.sources.find((s) => s.uploadedBy === actor && s.intentKey === key);
  if (existing) {
    if (existing.sha256 !== sha256 || existing.storedSize !== file.size || existing.mediaType !== mediaType) {
      throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
    }
  }
  const source: StoredSource = existing ?? {
    fileId: fakeId(),
    fileName: sanitizeFileName(file.name),
    sourceObjectRef: `imports/${fakeId()}`,
    sha256,
    mediaType,
    storedSize: file.size,
    companyId: scope.companyId,
    branchId: scope.branchId,
    uploadedBy: actor,
    intentKey: key,
    released: false,
  };
  if (!existing) DB.sources.push(source);
  if (source.released) throw new ApiError(422, 'TRADE.IMPORT.FILE_REJECTED');
  return {
    fileId: source.fileId,
    fileName: source.fileName,
    sourceObjectRef: source.sourceObjectRef,
    sha256: source.sha256,
    mediaType: source.mediaType,
    storedSize: source.storedSize,
  };
}

export async function fakeReleaseSource(
  sourceId: string,
  idempotencyKey: string | undefined,
): Promise<ReleaseSourceResult> {
  await fakeDelay(160);
  const key = requireIdempotencyKey(idempotencyKey);
  requireUuidV7(key, 'idempotencyKey');
  requireUuidV7(sourceId, 'sourceId');
  const scope = requireRunContext();
  const source = DB.sources.find((s) => s.fileId === sourceId);
  if (!source || source.companyId !== scope.companyId || source.branchId !== scope.branchId) {
    throw new ApiError(403, 'TRADE.IMPORT.SOURCE_RELEASE_FORBIDDEN');
  }
  const result = (idempotentReplay: boolean): ReleaseSourceResult => ({
    sourceId,
    lifecycleCommandId: key,
    storageState: 'PURGED',
    idempotentReplay,
  });
  if (source.released) return result(true);
  if (DB.runs.some((r) => r.sourceId === sourceId && SOURCE_IN_USE.includes(r.status))) {
    throw new ApiError(409, 'TRADE.IMPORT.SOURCE_IN_USE');
  }
  source.released = true;
  return result(false);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function fakePreviewImport(
  input: PreviewImportInput,
  idempotencyKey?: string,
): Promise<PreviewImportResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(idempotencyKey);
  return idem.run('imports:preview', key, input, () => {
    const scope = requireRunContext();
    const mapping = requireMapping(input.mappingId);
    const version = mapping.versions.find(
      (v) => v.id === mapping.currentPublishedVersionId && v.status === 'PUBLISHED',
    );
    if (!version || version.fields.length === 0) throw mappingInvalid();
    const source = DB.sources.find(
      (s) => s.fileId === input.sourceId && s.companyId === scope.companyId && s.branchId === scope.branchId && !s.released,
    );
    if (!source) throw new ApiError(422, 'TRADE.IMPORT.FILE_REJECTED');

    let skipKeys = new Set<string>();
    if (input.predecessorRunId) {
      const predecessor = DB.runs.find(
        (r) =>
          r.id === input.predecessorRunId &&
          r.mappingId === mapping.id &&
          r.mappingVersionId === version.id &&
          r.companyId === scope.companyId,
      );
      if (
        !predecessor ||
        predecessor.branchId !== (mapping.scopeTarget === 'BRANCH' ? scope.branchId : null) ||
        !TERMINAL.includes(predecessor.status)
      ) {
        throw mappingInvalid();
      }
      skipKeys = new Set(rowsOf(predecessor).filter((r) => r.status === 'SUCCEEDED').map((r) => r.stableRowKey));
    }

    const now = nowIso();
    const run: StoredRun = {
      id: fakeId(),
      mappingId: mapping.id,
      mappingVersionId: version.id,
      predecessorRunId: input.predecessorRunId ?? null,
      companyId: scope.companyId,
      branchId: mapping.scopeTarget === 'BRANCH' ? scope.branchId : null,
      sourceId: source.fileId,
      fileName: source.fileName,
      bulkJobId: null,
      failure: null,
      mediaType: source.mediaType,
      fileSizeBytes: source.storedSize,
      targetDtoCode: version.targetDtoCode,
      targetDtoVersion: version.targetDtoVersion,
      status: 'PENDING',
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      succeededCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      cancelRequested: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      timers: [],
    };
    DB.runs.unshift(run);
    DB.resultsByRun.set(run.id, []);

    const t1 = setTimeout(() => {
      if (run.status !== 'PENDING') return;
      run.status = 'PREVIEWING';
      touch(run);
    }, 1000);
    const t2 = setTimeout(() => {
      if (run.status !== 'PENDING' && run.status !== 'PREVIEWING') return;
      const lower = (source.fileName ?? '').toLowerCase();
      if (lower.includes('fail')) {
        run.status = 'FAILED';
        run.failure = { phase: 'PREVIEW', code: 'WORKER.TRADE_IMPORT.MAPPING_HEADER_MISMATCH' };
      } else if (lower.includes('error')) {
        DB.resultsByRun.set(run.id, buildRowsWithPreviewErrors(1204));
        run.status = 'PREVIEWED';
        run.totalCount = 1204;
        run.validCount = 1198;
        run.invalidCount = 6;
      } else {
        const rows = buildRows(660, 'VALID', null);
        const doneAt = nowIso();
        for (const r of rows) {
          if (skipKeys.has(r.stableRowKey)) {
            r.status = 'SKIPPED';
            r.completedAt = doneAt;
          }
        }
        DB.resultsByRun.set(run.id, rows);
        run.status = 'PREVIEWED';
        run.totalCount = rows.length;
        run.validCount = rows.filter((r) => r.status === 'VALID').length;
        run.invalidCount = 0;
      }
      touch(run);
      clearRunTimers(run);
    }, 3000);
    run.timers.push(t1, t2);

    return {
      runId: run.id,
      status: 'PENDING',
      dispatchStatus: 'QUEUED',
      sourceId: source.fileId,
      mappingVersionId: version.id,
      message: 'Preview job queued; preview performs no owner writes.',
    };
  });
}

export async function fakeExecuteImport(
  runId: string,
  opts: WriteOptions = {},
): Promise<ImportRunCommandResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  return idem.runAsync(`imports:execute:${runId}`, key, { runId, expected }, async () => {
    const run = requireRun(runId);
    checkIfMatch(expected, run.version);
    if (run.status !== 'PREVIEWED' || run.validCount < 1 || run.invalidCount !== 0) {
      const reason =
        run.status !== 'PREVIEWED' ? 'run_not_previewed' : run.validCount < 1 ? 'no_valid_rows' : 'has_invalid_rows';
      throw new ApiError(409, 'TRADE.IMPORT.RUN_NOT_EXECUTABLE', { reason: [reason] });
    }
    const mapping = DB.mappings.find((m) => m.id === run.mappingId);
    const version = mapping?.versions.find((v) => v.id === run.mappingVersionId);
    if (!mapping || !version || version.status !== 'PUBLISHED') throw mappingInvalid();

    let submitted;
    try {
      submitted = await fakeSubmitBulkJob(
        'trading',
        {
          module: 'trading.catalog-import',
          action: 'EXECUTE',
          params: { runId },
          scope: { companyId: run.companyId, ...(run.branchId ? { branchId: run.branchId } : {}) },
          selection: { kind: 'QUERY', query: {} },
        },
        key,
      );
    } catch (error) {
      // The shared bulk fake throws its own error class, so match on the code.
      if ((error as { code?: unknown } | null)?.code === 'BULK_JOB_ACTIVE') {
        throw new ApiError(409, 'BULK_JOB_ACTIVE', { reason: ['active_job_exists'] });
      }
      throw error;
    }
    run.bulkJobId = submitted.jobId;
    run.status = 'EXECUTING';
    touch(run);
    return { runId: run.id, status: run.status, jobId: submitted.jobId };
  });
}

export async function fakeCancelRun(
  runId: string,
  opts: WriteOptions = {},
): Promise<ImportRunCommandResult> {
  await fakeDelay(180);
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  return idem.runAsync(`imports:cancel:${runId}`, key, { runId, expected }, async () => {
    const run = requireRun(runId);
    const result = (): ImportRunCommandResult => ({ runId, status: run.status, jobId: run.bulkJobId });
    if (run.status === 'CANCELLED' || run.cancelRequested) return result();
    if (!['PENDING', 'PREVIEWING', 'EXECUTING'].includes(run.status)) {
      throw new ApiError(409, 'TRADE.IMPORT.RUN_FINISHED');
    }
    checkIfMatch(expected, run.version);
    if (run.status === 'EXECUTING') {
      if (!run.bulkJobId) throw new ApiError(409, 'TRADE.IMPORT.RUN_NOT_EXECUTABLE', { reason: ['bulk_job_missing'] });
      // The run stays EXECUTING until the worker job reports the cancellation.
      await fakeCancelBulkJob('trading', run.bulkJobId);
    } else {
      clearRunTimers(run);
      finalizeRunCancelled(run);
    }
    run.cancelRequested = true;
    touch(run);
    return result();
  });
}

function matchesRunFilters(run: StoredRun, q: ImportRunFilters): boolean {
  const statuses = statusList(q.status);
  if (statuses && !statuses.includes(run.status)) return false;
  if (q.mappingId && run.mappingId !== q.mappingId) return false;
  const needle = q.q?.trim().toLowerCase();
  if (needle && !(run.fileName ?? '').toLowerCase().includes(needle)) return false;
  if (q.createdFrom && run.createdAt < q.createdFrom) return false;
  if (q.createdTo && run.createdAt > q.createdTo) return false;
  return true;
}

function statusList(raw: ImportRunFilters['status']): ImportRunStatus[] | null {
  if (raw === undefined) return null;
  const list = (Array.isArray(raw) ? raw : raw.split(',')).map((s) => s.trim()).filter(Boolean);
  if (list.length < 1 || list.length > 8 || list.some((s) => !RUN_STATUSES.includes(s as ImportRunStatus))) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  return list as ImportRunStatus[];
}

export async function fakeListRuns(q: ListImportRunsQuery = {}): Promise<Page<ImportRun>> {
  await fakeDelay();
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  assertPage(page, limit);
  const items = DB.runs
    .filter((run) => inScope(run) && matchesRunFilters(run, q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map(projectRun);
  return clone(pageOf(items, page, limit));
}

export async function fakeGetRunCounts(q: ImportRunFilters = {}): Promise<ImportRunCounts> {
  await fakeDelay(120);
  const byStatus = Object.fromEntries(RUN_STATUSES.map((s) => [s, 0])) as Record<ImportRunStatus, number>;
  let total = 0;
  for (const run of DB.runs) {
    if (!inScope(run) || !matchesRunFilters(run, q)) continue;
    byStatus[run.status] += 1;
    total += 1;
  }
  return { total, byStatus };
}

export async function fakeGetRun(id: string): Promise<ImportRun> {
  await fakeDelay(140);
  const run = requireRun(id);
  await syncRunWithBulkJob(run);
  advanceSeededExecutingRun(run);
  return clone(projectRun(run));
}

export async function fakeListRowResults(runId: string, q: ListRowResultsQuery = {}): Promise<Page<RowResult>> {
  await fakeDelay(160);
  const run = requireRun(runId);
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  assertPage(page, limit);
  if (q.status && !ROW_STATUSES.includes(q.status)) throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  const rows = rowsOf(run).filter((r) => !q.status || r.status === q.status);
  return clone(pageOf(rows, page, limit));
}
