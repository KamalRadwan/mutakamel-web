import type { CoreQuery } from '../../../core/api/core-http';
import {
  ApiError,
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../shared/trade-api';
import type { Page } from '../shared/trade-foundation.model';
import { tradeHttp } from '../shared/trade-http';
import type {
  CreateImportMappingInput,
  CreateImportMappingResult,
  DiscardMappingDraftResult,
  ImportMapping,
  ImportMappingDetail,
  ImportRun,
  ImportRunCommandResult,
  ImportRunCounts,
  ImportRunFilters,
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
import type { ImportTargetsResponse } from './imports.registry';

// Routes: trade-app ExtensionsAutomationController, base /api/tenant/trade/v1.

export const IMPORTS_QUERY_KEYS = {
  all: ['trade', 'automation', 'imports'] as const,
  targets: () => ['trade', 'automation', 'imports', 'targets'] as const,
  mappings: (q?: ListImportMappingsQuery) =>
    ['trade', 'automation', 'imports', 'mappings', q ?? {}] as const,
  mapping: (id: string) => ['trade', 'automation', 'imports', 'mapping', id] as const,
  runCounts: (q?: ImportRunFilters) => ['trade', 'automation', 'imports', 'run-counts', q ?? {}] as const,
  runs: (q?: ListImportRunsQuery) =>
    ['trade', 'automation', 'imports', 'runs', q ?? {}] as const,
  run: (id: string) => ['trade', 'automation', 'imports', 'run', id] as const,
  results: (runId: string, q?: ListRowResultsQuery) =>
    ['trade', 'automation', 'imports', 'results', runId, q ?? {}] as const,
};

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function compactQuery(
  entries: Record<string, string | number | boolean | undefined>,
): CoreQuery | undefined {
  const result: CoreQuery = {};
  let count = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    result[k] = v;
    count += 1;
  }
  return count > 0 ? result : undefined;
}

function requireIfMatchHeader(version: number): string {
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  return ifMatch(version);
}

function normalizeStatusFilter(status?: ImportRunFilters['status']): string | undefined {
  if (Array.isArray(status)) {
    const joined = status.map((s) => s.trim()).filter(Boolean).join(',');
    return joined || undefined;
  }
  const trimmed = status?.trim();
  return trimmed || undefined;
}

function mapMappingField(field: MappingField): MappingField {
  return {
    sourceColumnCode: field.sourceColumnCode,
    sourceOrdinal: Number(field.sourceOrdinal),
    targetFieldCode: field.targetFieldCode,
    transformCode: field.transformCode,
    lookupCode: field.lookupCode ?? null,
    isRequired: Boolean(field.isRequired),
  };
}

function mapMappingVersionEntity(version: MappingVersionEntity): MappingVersionEntity {
  return {
    ...version,
    publishedAt: version.publishedAt ?? null,
    publishedBy: version.publishedBy ?? null,
  };
}

function mapMappingVersion(version: MappingVersion): MappingVersion {
  return {
    ...version,
    publishedAt: version.publishedAt ?? null,
    fields: (version.fields ?? []).map(mapMappingField),
  };
}

function mapMapping(mapping: ImportMapping): ImportMapping {
  return {
    ...mapping,
    branchId: mapping.branchId ?? null,
    currentPublishedVersionId: mapping.currentPublishedVersionId ?? null,
  };
}

function mapMappingDetail(detail: ImportMappingDetail): ImportMappingDetail {
  return {
    ...mapMapping(detail),
    versions: (detail.versions ?? []).map(mapMappingVersion),
  };
}

function mapSource(source: ImportSource): ImportSource {
  return {
    ...source,
    fileName: source.fileName ?? null,
    storedSize: Number(source.storedSize),
  };
}

function mapRun(run: ImportRun): ImportRun {
  return {
    ...run,
    predecessorRunId: run.predecessorRunId ?? null,
    branchId: run.branchId ?? null,
    fileName: run.fileName ?? null,
    bulkJobId: run.bulkJobId ?? null,
    cancelledCount: run.cancelledCount ?? '0',
    failure: run.failure ?? null,
    progress: run.progress ?? { phase: null, processed: 0, total: null },
  };
}

function mapRowResult(row: RowResult): RowResult {
  return {
    ...row,
    // Backend TradeImportRowResultEntity.rowNumber is a Postgres bigint string on the wire.
    rowNumber: Number(row.rowNumber),
    errorCode: row.errorCode ?? null,
    errorFieldCode: row.errorFieldCode ?? null,
    ownerAggregateType: row.ownerAggregateType ?? null,
    ownerAggregateId: row.ownerAggregateId ?? null,
    ownerAggregateVersion: row.ownerAggregateVersion ?? null,
    completedAt: row.completedAt ?? null,
  };
}

/** Request body column: the backend rejects lookupCode null, so it is left out when there is none. */
export function toMappingFieldInput(field: MappingField | MappingFieldInput): MappingFieldInput {
  assertBodyBooleans(field, ['isRequired']);
  const lookup = typeof field.lookupCode === 'string' ? field.lookupCode.trim() : '';
  return {
    sourceColumnCode: field.sourceColumnCode.trim(),
    sourceOrdinal: field.sourceOrdinal,
    targetFieldCode: field.targetFieldCode,
    transformCode: field.transformCode,
    ...(lookup ? { lookupCode: lookup } : {}),
    isRequired: Boolean(field.isRequired),
  };
}

// GET /api/tenant/trade/v1/import-mappings/targets
export function getImportTargets(ctx: TradeContext = {}): Promise<ImportTargetsResponse> {
  return tradeHttp().read<ImportTargetsResponse>('/import-mappings/targets', undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// GET /api/tenant/trade/v1/import-mappings?page&limit&status&targetCode
export async function listMappings(
  q: ListImportMappingsQuery = {},
  ctx: TradeContext = {},
): Promise<Page<ImportMapping>> {
  const res = await tradeHttp().read<Page<ImportMapping>>(
    '/import-mappings',
    compactQuery({
      page: q.page,
      limit: q.limit,
      status: q.status,
      targetCode: q.targetCode,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return {
    items: (res.items ?? []).map(mapMapping),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/import-mappings/:id
export async function getMapping(
  id: string,
  ctx: TradeContext = {},
): Promise<ImportMappingDetail> {
  const raw = await tradeHttp().read<ImportMappingDetail>(
    `/import-mappings/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapMappingDetail(raw);
}

// POST /api/tenant/trade/v1/import-mappings (x-idempotency-key) -> 201
export async function createMapping(
  input: CreateImportMappingInput,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<CreateImportMappingResult> {
  const body: CreateImportMappingInput = {
    code: input.code,
    targetCode: input.targetCode,
    scopeTarget: input.scopeTarget,
    ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    executionMode: input.executionMode ?? 'PER_ROW',
    fields: input.fields.map(toMappingFieldInput),
  };
  const { data } = await tradeHttp().write<CreateImportMappingResult>(
    'POST',
    '/import-mappings',
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return {
    ...mapMapping(data),
    draftVersion: mapMappingVersionEntity(data.draftVersion),
    fields: (data.fields ?? []).map(mapMappingField),
  };
}

// PATCH /api/tenant/trade/v1/import-mappings/:id (x-idempotency-key, If-Match)
export async function updateMapping(
  id: string,
  input: UpdateImportMappingInput,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<UpdateImportMappingResult> {
  const body: UpdateImportMappingInput = {
    executionMode: input.executionMode ?? 'PER_ROW',
    fields: input.fields.map(toMappingFieldInput),
  };
  const { data } = await tradeHttp().write<UpdateImportMappingResult>(
    'PATCH',
    `/import-mappings/${encodeSeg(id)}`,
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return {
    ...mapMapping(data),
    draftVersion: mapMappingVersionEntity(data.draftVersion),
    fields: (data.fields ?? []).map(mapMappingField),
    createdDraftVersion: Boolean(data.createdDraftVersion),
  };
}

// POST /api/tenant/trade/v1/import-mappings/:id/publish (x-idempotency-key, If-Match)
export async function publishMapping(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<PublishImportMappingResult> {
  const { data } = await tradeHttp().write<PublishImportMappingResult>(
    'POST',
    `/import-mappings/${encodeSeg(id)}/publish`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return {
    ...mapMapping(data),
    publishedVersion: mapMappingVersionEntity(data.publishedVersion),
  };
}

// DELETE /api/tenant/trade/v1/import-mappings/:id/draft (x-idempotency-key, If-Match)
export async function discardMappingDraft(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<DiscardMappingDraftResult> {
  const { data } = await tradeHttp().write<DiscardMappingDraftResult>(
    'DELETE',
    `/import-mappings/${encodeSeg(id)}/draft`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/imports/sources (multipart "file", x-idempotency-key UUIDv7)
export async function uploadSource(
  file: File,
  idempotencyKey: string = newIdempotencyKey(),
  onProgress?: (percent: number) => void,
  ctx: TradeContext = {},
): Promise<ImportSource> {
  const form = new FormData();
  form.append('file', file, file.name);
  const { data } = await tradeHttp().writeMultipart<ImportSource>(
    '/imports/sources',
    form,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  onProgress?.(100);
  return mapSource(data);
}

// POST /api/tenant/trade/v1/imports/sources/:id/release (x-idempotency-key UUIDv7) -> 202
export async function releaseSource(
  sourceId: string,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ReleaseSourceResult> {
  const { data } = await tradeHttp().write<ReleaseSourceResult>(
    'POST',
    `/imports/sources/${encodeSeg(sourceId)}/release`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/imports/preview (x-idempotency-key) -> 202
export async function preview(
  input: PreviewImportInput,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<PreviewImportResult> {
  const body: PreviewImportInput = {
    mappingId: input.mappingId,
    sourceId: input.sourceId,
    ...(input.predecessorRunId ? { predecessorRunId: input.predecessorRunId } : {}),
  };
  const { data } = await tradeHttp().write<PreviewImportResult>(
    'POST',
    '/imports/preview',
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/imports/:runId/execute (x-idempotency-key, If-Match) -> 202
export async function execute(
  runId: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ImportRunCommandResult> {
  const { data } = await tradeHttp().write<ImportRunCommandResult>(
    'POST',
    `/imports/${encodeSeg(runId)}/execute`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return {
    ...data,
    jobId: data.jobId ?? null,
  };
}

// POST /api/tenant/trade/v1/imports/:runId/cancel (x-idempotency-key, If-Match) -> 202
export async function cancelRun(
  runId: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ImportRunCommandResult> {
  const { data } = await tradeHttp().write<ImportRunCommandResult>(
    'POST',
    `/imports/${encodeSeg(runId)}/cancel`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return {
    ...data,
    jobId: data.jobId ?? null,
  };
}

// GET /api/tenant/trade/v1/imports/counts?status&mappingId&q&createdFrom&createdTo
export function getRunCounts(
  q: ImportRunFilters = {},
  ctx: TradeContext = {},
): Promise<ImportRunCounts> {
  return tradeHttp().read<ImportRunCounts>(
    '/imports/counts',
    compactQuery({
      status: normalizeStatusFilter(q.status),
      mappingId: q.mappingId,
      q: q.q?.trim() || undefined,
      createdFrom: q.createdFrom,
      createdTo: q.createdTo,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/imports?status&mappingId&q&createdFrom&createdTo&page&limit
export async function listRuns(
  q: ListImportRunsQuery = {},
  ctx: TradeContext = {},
): Promise<Page<ImportRun>> {
  const res = await tradeHttp().read<Page<ImportRun>>(
    '/imports',
    compactQuery({
      status: normalizeStatusFilter(q.status),
      mappingId: q.mappingId,
      q: q.q?.trim() || undefined,
      createdFrom: q.createdFrom,
      createdTo: q.createdTo,
      page: q.page,
      limit: q.limit,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return {
    items: (res.items ?? []).map(mapRun),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/imports/:runId
export async function getRun(id: string, ctx: TradeContext = {}): Promise<ImportRun> {
  const raw = await tradeHttp().read<ImportRun>(`/imports/${encodeSeg(id)}`, undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
  return mapRun(raw);
}

// GET /api/tenant/trade/v1/imports/:runId/results?status&page&limit
export async function listResults(
  runId: string,
  q: ListRowResultsQuery = {},
  ctx: TradeContext = {},
): Promise<Page<RowResult>> {
  const res = await tradeHttp().read<Page<RowResult>>(
    `/imports/${encodeSeg(runId)}/results`,
    compactQuery({
      status: q.status,
      page: q.page,
      limit: q.limit,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return {
    items: (res.items ?? []).map(mapRowResult),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/imports/:runId/results.csv?status= (columns row_number,status,field,error_code,owner_id)
export function readResultsCsv(
  runId: string,
  status?: RowResultStatus | null,
  ctx: TradeContext = {},
): Promise<Blob> {
  return tradeHttp().readBlob(
    `/imports/${encodeSeg(runId)}/results.csv`,
    compactQuery({ status: status ?? undefined }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

/** Reads the filtered results CSV as a Blob with scope headers and returns an object URL (caller revokes). */
export async function resultsCsvUrl(
  runId: string,
  status?: RowResultStatus | null,
  ctx: TradeContext = {},
): Promise<string> {
  const blob = await readResultsCsv(runId, status, ctx);
  return URL.createObjectURL(blob);
}
