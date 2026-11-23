export type BulkJobApp = 'core' | 'crm' | 'trading' | 'accounting';

export type BulkJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'CANCELLING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'CANCELLED'
  | 'FAILED';

export type BulkJobItemStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'SUCCEEDED'
  | 'UNCHANGED'
  | 'SKIPPED'
  | 'FAILED'
  | 'CANCELLED';

export type BulkJobSelection =
  | { kind: 'IDS'; ids: string[] }
  | { kind: 'QUERY'; query: unknown; excludedIds?: string[] };

export interface BulkJobSubmit {
  module: string;
  action: string;
  scope: { branchId?: string; companyId?: string };
  selection: BulkJobSelection;
  params: unknown;
}

export interface BulkJobSubmitResult {
  jobId: string;
  status: BulkJobStatus;
  total: number;
  skippedAtSubmit: number;
  failedAtSubmit: number;
  chunkCount: number;
  summary?: Record<string, string | number>;
}

export interface BulkJobPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListBulkJobItemsQuery {
  status?: BulkJobItemStatus;
  page: number;
  limit: number;
}

export interface ListBulkJobsQuery {
  scope: 'active' | 'recent';
  module?: string;
  page?: number;
  limit?: number;
}

export const BULK_JOB_LIMITS = {
  maxItems: 10_000,
  chunkSize: 100,
  maxPageSize: 100,
  activeJobsPerUser: 1,
  retentionDays: 30,
} as const;

export interface BulkJobCounts {
  succeeded: number;
  unchanged: number;
  skipped: number;
  failed: number;
  cancelled: number;
}

export interface BulkJob {
  id: string;
  app: BulkJobApp;
  module: string;
  action: string;
  scope: { branchId?: string; companyId?: string };
  status: BulkJobStatus;
  total: number;
  processed: number;
  counts: BulkJobCounts;
  chunkCount: number;
  chunksDone: number;
  paramsSummary: Record<string, string | number | null>;
  summary?: Record<string, string | number>;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  cancelRequestedAt?: string;
  failureCode?: string;
  revision: number;
  /** Trade GET/cancel projection: the ETag version equals revision. */
  version?: number;
}

export interface BulkJobItem {
  ordinal: number;
  entityId: string;
  label: string;
  status: BulkJobItemStatus;
  code?: string;
  field?: string;
  refId?: string;
  data?: Record<string, string | number | null>;
  current?: Record<string, string | number | null> | null;
}

export const BULK_JOB_ACTIVE: readonly BulkJobStatus[] = ['QUEUED', 'RUNNING', 'CANCELLING'];

export function isBulkJobActive(status: BulkJobStatus): boolean {
  return BULK_JOB_ACTIVE.includes(status);
}
