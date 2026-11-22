import type { Page } from '../shared/trade-foundation.model';
import {
  fakeCancelRun,
  fakeCreateMapping,
  fakeDiscardMappingDraft,
  fakeExecuteImport,
  fakeGetImportTargets,
  fakeGetMapping,
  fakeGetRun,
  fakeGetRunCounts,
  fakeListMappings,
  fakeListRowResults,
  fakeListRuns,
  fakePreviewImport,
  fakePublishMapping,
  fakeReleaseSource,
  fakeUpdateMapping,
  fakeUploadSource,
} from './imports.fake';
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

/** Request body column: the backend rejects lookupCode null, so it is left out when there is none. */
export function toMappingFieldInput(field: MappingField | MappingFieldInput): MappingFieldInput {
  return {
    sourceColumnCode: field.sourceColumnCode.trim(),
    sourceOrdinal: field.sourceOrdinal,
    targetFieldCode: field.targetFieldCode,
    transformCode: field.transformCode,
    ...(field.lookupCode ? { lookupCode: field.lookupCode } : {}),
    isRequired: Boolean(field.isRequired),
  };
}

// GET /trade/v1/import-mappings/targets
export function getImportTargets(): Promise<ImportTargetsResponse> {
  return fakeGetImportTargets();
}

// GET /trade/v1/import-mappings?page&limit&status&targetCode
export function listMappings(q: ListImportMappingsQuery = {}): Promise<Page<ImportMapping>> {
  return fakeListMappings(q);
}

// GET /trade/v1/import-mappings/:id
export function getMapping(id: string): Promise<ImportMappingDetail> {
  return fakeGetMapping(id);
}

// POST /trade/v1/import-mappings (X-Idempotency-Key) -> 201
export function createMapping(
  input: CreateImportMappingInput,
  idempotencyKey: string,
): Promise<CreateImportMappingResult> {
  return fakeCreateMapping({ ...input, fields: input.fields.map(toMappingFieldInput) }, idempotencyKey);
}

// PATCH /trade/v1/import-mappings/:id (X-Idempotency-Key, If-Match)
export function updateMapping(
  id: string,
  input: UpdateImportMappingInput,
  ifMatch: number,
  idempotencyKey: string,
): Promise<UpdateImportMappingResult> {
  return fakeUpdateMapping(
    id,
    { executionMode: input.executionMode ?? 'PER_ROW', fields: input.fields.map(toMappingFieldInput) },
    { ifMatch, idempotencyKey },
  );
}

// POST /trade/v1/import-mappings/:id/publish (X-Idempotency-Key, If-Match)
export function publishMapping(id: string, ifMatch: number, idempotencyKey: string): Promise<PublishImportMappingResult> {
  return fakePublishMapping(id, { ifMatch, idempotencyKey });
}

// DELETE /trade/v1/import-mappings/:id/draft (X-Idempotency-Key, If-Match)
export function discardMappingDraft(
  id: string,
  ifMatch: number,
  idempotencyKey: string,
): Promise<DiscardMappingDraftResult> {
  return fakeDiscardMappingDraft(id, { ifMatch, idempotencyKey });
}

// POST /trade/v1/imports/sources (multipart "file", X-Idempotency-Key UUIDv7)
export function uploadSource(
  file: File,
  idempotencyKey: string,
  onProgress?: (percent: number) => void,
): Promise<ImportSource> {
  return fakeUploadSource(file, idempotencyKey, onProgress);
}

// POST /trade/v1/imports/sources/:id/release (X-Idempotency-Key UUIDv7) -> 202
export function releaseSource(sourceId: string, idempotencyKey: string): Promise<ReleaseSourceResult> {
  return fakeReleaseSource(sourceId, idempotencyKey);
}

// POST /trade/v1/imports/preview (X-Idempotency-Key) -> 202
export function preview(input: PreviewImportInput, idempotencyKey: string): Promise<PreviewImportResult> {
  return fakePreviewImport(input, idempotencyKey);
}

// POST /trade/v1/imports/:runId/execute (X-Idempotency-Key, If-Match) -> 202
export function execute(runId: string, ifMatch: number, idempotencyKey: string): Promise<ImportRunCommandResult> {
  return fakeExecuteImport(runId, { ifMatch, idempotencyKey });
}

// POST /trade/v1/imports/:runId/cancel (X-Idempotency-Key, If-Match) -> 202
export function cancelRun(runId: string, ifMatch: number, idempotencyKey: string): Promise<ImportRunCommandResult> {
  return fakeCancelRun(runId, { ifMatch, idempotencyKey });
}

// GET /trade/v1/imports/counts?status&mappingId&q&createdFrom&createdTo
export function getRunCounts(q: ImportRunFilters = {}): Promise<ImportRunCounts> {
  return fakeGetRunCounts(q);
}

// GET /trade/v1/imports?status&mappingId&q&createdFrom&createdTo&page&limit
export function listRuns(q: ListImportRunsQuery = {}): Promise<Page<ImportRun>> {
  return fakeListRuns(q);
}

// GET /trade/v1/imports/:runId
export function getRun(id: string): Promise<ImportRun> {
  return fakeGetRun(id);
}

// GET /trade/v1/imports/:runId/results?status&page&limit
export function listResults(runId: string, q: ListRowResultsQuery = {}): Promise<Page<RowResult>> {
  return fakeListRowResults(runId, q);
}

// GET /trade/v1/imports/:runId/results.csv?status= (columns row_number,status,field,error_code,owner_id)
export function resultsCsvUrl(runId: string, status?: RowResultStatus | null): string {
  const base = `/api/tenant/trade/v1/imports/${encodeURIComponent(runId)}/results.csv`;
  return status ? `${base}?status=${encodeURIComponent(status)}` : base;
}
