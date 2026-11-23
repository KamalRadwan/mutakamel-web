import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery } from '../../core/api/core-http';
import type { CorePage } from '../../core/api/core-page';
import { ApiError } from '../../core/api/api-errors';
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

export type BulkJobsTransport = Pick<BulkJobsApi,
  'submitBulkJob' | 'getBulkJob' | 'listBulkJobItems' | 'listBulkJobs' | 'cancelBulkJob' | 'retryBulkJob'>;

const BASES = { core: '/api/tenant/core/v1', crm: '/api/tenant/crm/v1', trading: '/api/tenant/trade/v1' } as const;

export function hasBulkJobsBackend(app: BulkJobApp): app is keyof typeof BASES {
  return app === 'core' || app === 'crm' || app === 'trading';
}

function baseFor(app: BulkJobApp): string {
  if (!hasBulkJobsBackend(app)) throw new ApiError(503, 'BULK_JOBS_UNAVAILABLE');
  return BASES[app];
}

function bulkPage<T>({ data, meta }: CorePage<T>): BulkJobPage<T> {
  return { items: data, total: meta.total, page: meta.page, limit: meta.limit };
}

@Service()
export class BulkJobsApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  async submitBulkJob(app: BulkJobApp, body: BulkJobSubmit, key: string): Promise<BulkJobSubmitResult> {
    const result = await this.http.write<BulkJobSubmitResult>('POST', `${baseFor(app)}/bulk-jobs`, body,
      { key, bare: app === 'crm' });
    return result.data;
  }

  async getBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
    const path = `${baseFor(app)}/bulk-jobs/${encodeURIComponent(id)}`;
    return this.queries.fetchQuery({ queryKey: ['bulk-jobs', app, id],
      queryFn: () => this.http.read<BulkJob>(path, undefined, { bare: app === 'crm' }) });
  }

  listBulkJobItems(app: BulkJobApp, id: string, q: ListBulkJobItemsQuery): Promise<BulkJobPage<BulkJobItem>> {
    return this.readPage(app, `/bulk-jobs/${encodeURIComponent(id)}/items`, { ...q });
  }

  listBulkJobs(app: BulkJobApp, q: ListBulkJobsQuery): Promise<BulkJobPage<BulkJob>> {
    return this.readPage(app, '/bulk-jobs', { ...q });
  }

  async cancelBulkJob(app: BulkJobApp, id: string, revision?: number): Promise<BulkJob> {
    const base = baseFor(app);
    const ifMatch = app === 'trading' ? await this.ifMatch(app, id, revision) : undefined;
    const result = await this.http.write<BulkJob>('POST', `${base}/bulk-jobs/${encodeURIComponent(id)}/cancel`, {},
      { bare: app === 'crm', ifMatch });
    return result.data;
  }

  async retryBulkJob(app: BulkJobApp, id: string, overrides: unknown | null, key: string, revision?: number): Promise<BulkJobSubmitResult> {
    const base = baseFor(app);
    const ifMatch = app === 'trading' ? await this.ifMatch(app, id, revision) : undefined;
    const result = await this.http.write<BulkJobSubmitResult>('POST', `${base}/bulk-jobs/${encodeURIComponent(id)}/retry`,
      overrides === null ? {} : { overrides }, { key, bare: app === 'crm', ifMatch });
    return result.data;
  }

  private async ifMatch(app: BulkJobApp, id: string, revision?: number): Promise<string | undefined> {
    if (app !== 'trading') return undefined;
    // Legacy function callers have no snapshot; tracker callers supply the revision the user saw.
    const expected = revision ?? (await this.getBulkJob(app, id)).revision;
    if (!Number.isSafeInteger(expected) || expected < 1) {
      throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
    }
    return `"${expected}"`;
  }

  private async readPage<T>(app: BulkJobApp, path: string, query: CoreQuery): Promise<BulkJobPage<T>> {
    const base = baseFor(app);
    return this.queries.fetchQuery({ queryKey: ['bulk-jobs', app, path, query], queryFn: async () =>
      app === 'core' ? bulkPage(await this.http.readPage<T>(`${base}${path}`, query))
        : this.http.read<BulkJobPage<T>>(`${base}${path}`, query, { bare: app === 'crm' }) });
  }
}

let resolveTransport: (() => BulkJobsTransport) | undefined;

/** Preserve function callers outside an injection context, using the app's injected transport. */
export function bindBulkJobsApi(resolve: () => BulkJobsTransport): void {
  resolveTransport = resolve;
}

function transport(): BulkJobsTransport {
  if (!resolveTransport) throw new Error('BulkJobsApi is not bound');
  return resolveTransport();
}

/**
 * POST /api/tenant/<app>/v1/bulk-jobs (202);
 * header x-idempotency-key UUIDv7 (same key on network retry, new key per new intent).
 */
export function submitBulkJob(app: BulkJobApp, body: BulkJobSubmit, key: string): Promise<BulkJobSubmitResult> {
  return transport().submitBulkJob(app, body, key);
}

/** GET /api/tenant/<app>/v1/bulk-jobs/:jobId */
export function getBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
  return transport().getBulkJob(app, id);
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
  return transport().listBulkJobItems(app, id, q);
}

/**
 * GET /api/tenant/<app>/v1/bulk-jobs?scope&module&page&limit
 * (scope 'active' | 'recent' default 'recent', optional module, page >= 1 default 1, limit 1..100 default 50).
 */
export function listBulkJobs(app: BulkJobApp, q: ListBulkJobsQuery): Promise<BulkJobPage<BulkJob>> {
  return transport().listBulkJobs(app, q);
}

/** POST cancel with body {}; Trade uses the supplied revision as If-Match. */
export function cancelBulkJob(app: BulkJobApp, id: string, revision?: number): Promise<BulkJob> {
  return transport().cancelBulkJob(app, id, revision);
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
  revision?: number,
): Promise<BulkJobSubmitResult> {
  return transport().retryBulkJob(app, id, overrides, key, revision);
}
