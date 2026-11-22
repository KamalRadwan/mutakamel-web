import {
  fakeCancelBulkJob,
  fakeGetBulkJob,
  fakeListBulkJobItems,
  fakeListBulkJobs,
  fakeRetryBulkJob,
  fakeSubmitBulkJob,
} from './bulk-jobs.fake';
import {
  BulkJob,
  BulkJobApp,
  BulkJobItem,
  BulkJobPage,
  BulkJobSubmit,
  BulkJobSubmitResult,
  ListBulkJobItemsQuery,
  ListBulkJobsQuery,
} from './bulk-jobs.model';

/**
 * POST /api/tenant/<app>/v1/bulk-jobs (202);
 * header x-idempotency-key UUIDv7 (same key on network retry, new key per new intent).
 */
export function submitBulkJob(app: BulkJobApp, body: BulkJobSubmit, key: string): Promise<BulkJobSubmitResult> {
  return fakeSubmitBulkJob(app, body, key);
}

/** GET /api/tenant/<app>/v1/bulk-jobs/:jobId */
export function getBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
  return fakeGetBulkJob(app, id);
}

/**
 * GET /api/tenant/<app>/v1/bulk-jobs/:jobId/items?page&limit&status
 * (page >= 1 default 1, limit 1..100 default 50, single optional status).
 */
export function listBulkJobItems(
  app: BulkJobApp,
  id: string,
  q: ListBulkJobItemsQuery,
): Promise<BulkJobPage<BulkJobItem>> {
  return fakeListBulkJobItems(app, id, q);
}

/**
 * GET /api/tenant/<app>/v1/bulk-jobs?scope&module&page&limit
 * (scope 'active' | 'recent' default 'recent', optional module, page >= 1 default 1, limit 1..100 default 50).
 */
export function listBulkJobs(app: BulkJobApp, q: ListBulkJobsQuery): Promise<BulkJobPage<BulkJob>> {
  return fakeListBulkJobs(app, q);
}

/** POST /api/tenant/<app>/v1/bulk-jobs/:jobId/cancel (200); body {}. */
export function cancelBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
  return fakeCancelBulkJob(app, id);
}

/**
 * POST /api/tenant/<app>/v1/bulk-jobs/:jobId/retry (202);
 * body { overrides? } (omit overrides when null); header x-idempotency-key UUIDv7.
 */
export function retryBulkJob(
  app: BulkJobApp,
  id: string,
  overrides: unknown | null,
  key: string,
): Promise<BulkJobSubmitResult> {
  return fakeRetryBulkJob(app, id, overrides, key);
}
