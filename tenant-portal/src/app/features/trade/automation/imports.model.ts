import type {
  ImportLookupCode,
  ImportTargetCode,
  ImportTransformCode,
} from './imports.registry';

export type ImportMappingStatus = 'DRAFT' | 'ACTIVE';
export type MappingVersionStatus = 'DRAFT' | 'PUBLISHED';
export type ImportScopeTarget = 'COMPANY' | 'BRANCH';

/** One mapping column as the backend returns it (lookupCode is null when the field has none). */
export interface MappingField {
  sourceColumnCode: string;
  sourceOrdinal: number;
  targetFieldCode: string;
  transformCode: ImportTransformCode;
  lookupCode?: ImportLookupCode | null;
  isRequired: boolean;
}

/** Request body column: lookupCode is omitted (never null) when the field has no lookup. */
export interface MappingFieldInput {
  sourceColumnCode: string;
  sourceOrdinal: number;
  targetFieldCode: string;
  transformCode: ImportTransformCode;
  lookupCode?: ImportLookupCode;
  isRequired?: boolean;
}

export interface MappingVersion {
  id: string;
  versionNumber: number;
  targetDtoCode: string;
  targetDtoVersion: number;
  transformRegistryVersion: number;
  mappingHash: string;
  executionMode: 'PER_ROW';
  status: MappingVersionStatus;
  publishedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  fields: MappingField[];
}

/** GET /import-mappings list item (projectMapping). */
export interface ImportMapping {
  id: string;
  code: string;
  targetCode: ImportTargetCode;
  scopeTarget: ImportScopeTarget;
  companyId: string;
  branchId: string | null;
  currentPublishedVersionId: string | null;
  status: ImportMappingStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /import-mappings/:id */
export interface ImportMappingDetail extends ImportMapping {
  versions: MappingVersion[];
}

/** Draft version entity returned inside create, update and publish responses. */
export interface MappingVersionEntity {
  id: string;
  mappingId: string;
  versionNumber: number;
  targetDtoCode: string;
  targetDtoVersion: number;
  transformRegistryVersion: number;
  mappingHash: string;
  executionMode: 'PER_ROW';
  status: MappingVersionStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** POST /import-mappings (201): mapping entity + draft version + saved fields. */
export interface CreateImportMappingResult extends ImportMapping {
  draftVersion: MappingVersionEntity;
  fields: MappingField[];
}

/** PATCH /import-mappings/:id */
export interface UpdateImportMappingResult extends CreateImportMappingResult {
  createdDraftVersion: boolean;
}

/** POST /import-mappings/:id/publish */
export interface PublishImportMappingResult extends ImportMapping {
  publishedVersion: MappingVersionEntity;
}

/** DELETE /import-mappings/:id/draft */
export interface DiscardMappingDraftResult {
  id: string;
  version: number;
  discardedVersionId: string;
}

/** POST /imports/sources */
export interface ImportSource {
  fileId: string;
  fileName: string | null;
  sourceObjectRef: string;
  sha256: string;
  mediaType: string;
  storedSize: number;
}

/** POST /imports/sources/:id/release (202) */
export interface ReleaseSourceResult {
  sourceId: string;
  lifecycleCommandId: string;
  storageState: 'PURGED';
  idempotentReplay: boolean;
}

export type ImportRunStatus =
  | 'PENDING'
  | 'PREVIEWING'
  | 'PREVIEWED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';

export interface ImportRunFailure {
  phase: 'PREVIEW' | 'EXECUTE';
  code: string;
}

export interface ImportRunProgress {
  phase: 'PREVIEW' | 'EXECUTE' | null;
  processed: number;
  total: number | null;
}

/** GET /imports/:runId and list items (projectRun). */
export interface ImportRun {
  id: string;
  mappingId: string;
  mappingVersionId: string;
  predecessorRunId: string | null;
  companyId: string;
  branchId: string | null;
  sourceId: string;
  fileName: string | null;
  bulkJobId: string | null;
  cancelledCount: string;
  failure: ImportRunFailure | null;
  progress: ImportRunProgress;
  mediaType: string;
  fileSizeBytes: string;
  targetDtoCode: string;
  targetDtoVersion: number;
  mode: 'PER_ROW';
  status: ImportRunStatus;
  totalCount: string;
  validCount: string;
  invalidCount: string;
  succeededCount: string;
  failedCount: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type RowResultStatus =
  | 'VALID'
  | 'INVALID'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export interface RowResult {
  rowNumber: number;
  stableRowKey: string;
  status: RowResultStatus;
  errorCode: string | null;
  errorFieldCode: string | null;
  ownerAggregateType: string | null;
  ownerAggregateId: string | null;
  ownerAggregateVersion: number | null;
  completedAt: string | null;
}

/** GET /imports/counts */
export interface ImportRunCounts {
  total: number;
  byStatus: Record<ImportRunStatus, number>;
}

/** POST /imports/preview (202) */
export interface PreviewImportResult {
  runId: string;
  status: 'PENDING';
  dispatchStatus: 'QUEUED';
  sourceId: string;
  mappingVersionId: string;
  message: string;
}

/** POST /imports/:runId/execute and /cancel (202) */
export interface ImportRunCommandResult {
  runId: string;
  status: ImportRunStatus;
  jobId: string | null;
}

export interface ListImportMappingsQuery {
  targetCode?: ImportTargetCode;
  status?: ImportMappingStatus;
  page?: number;
  limit?: number;
}

export interface CreateImportMappingInput {
  code: string;
  targetCode: ImportTargetCode;
  scopeTarget: ImportScopeTarget;
  branchId?: string;
  executionMode?: 'PER_ROW';
  fields: MappingFieldInput[];
}

export interface UpdateImportMappingInput {
  executionMode?: 'PER_ROW';
  fields: MappingFieldInput[];
}

export interface PreviewImportInput {
  mappingId: string;
  sourceId: string;
  predecessorRunId?: string;
}

export interface ImportRunFilters {
  /** One status or a comma list. */
  status?: ImportRunStatus | ImportRunStatus[] | string;
  mappingId?: string;
  /** File name contains (case-insensitive). */
  q?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ListImportRunsQuery extends ImportRunFilters {
  page?: number;
  limit?: number;
}

export interface ListRowResultsQuery {
  status?: RowResultStatus;
  page?: number;
  limit?: number;
}
