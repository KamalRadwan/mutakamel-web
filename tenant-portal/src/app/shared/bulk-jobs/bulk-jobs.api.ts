import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery } from '../../core/api/core-http';
import type { CorePage } from '../../core/api/core-page';
import { fakeBulkJobsTransport } from './bulk-jobs.fake';
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

const BASES = { core: '/api/tenant/core/v1', crm: '/api/tenant/crm/v1' } as const;

function hasHttpRoutes(app: BulkJobApp): app is keyof typeof BASES {
  // FAKE-ONLY, no backend route: accounting; Trade bulk gateway rows have not landed.
  return app === 'core' || app === 'crm';
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
    if (!hasHttpRoutes(app)) return fakeBulkJobsTransport.submitBulkJob(app, body, key);
    const result = await this.http.write<BulkJobSubmitResult>('POST', `${BASES[app]}/bulk-jobs`, body,
      { key, bare: app !== 'core' });
    return result.data;
  }

  getBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
    if (!hasHttpRoutes(app)) return fakeBulkJobsTransport.getBulkJob(app, id);
    const path = `${BASES[app]}/bulk-jobs/${encodeURIComponent(id)}`;
    return this.queries.fetchQuery({ queryKey: ['bulk-jobs', app, id],
      queryFn: () => this.http.read<BulkJob>(path, undefined, { bare: app !== 'core' }) });
  }

  listBulkJobItems(app: BulkJobApp, id: string, q: ListBulkJobItemsQuery): Promise<BulkJobPage<BulkJobItem>> {
    if (!hasHttpRoutes(app)) return fakeBulkJobsTransport.listBulkJobItems(app, id, q);
    return this.readPage(app, `/bulk-jobs/${encodeURIComponent(id)}/items`, { ...q });
  }

  listBulkJobs(app: BulkJobApp, q: ListBulkJobsQuery): Promise<BulkJobPage<BulkJob>> {
    if (!hasHttpRoutes(app)) return fakeBulkJobsTransport.listBulkJobs(app, q);
    return this.readPage(app, '/bulk-jobs', { ...q });
  }

  async cancelBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
    if (!hasHttpRoutes(app)) return fakeBulkJobsTransport.cancelBulkJob(app, id);
    const result = await this.http.write<BulkJob>('POST', `${BASES[app]}/bulk-jobs/${encodeURIComponent(id)}/cancel`, {},
      { bare: app !== 'core' });
    return result.data;
  }

  async retryBulkJob(app: BulkJobApp, id: string, overrides: unknown | null, key: string): Promise<BulkJobSubmitResult> {
    if (!hasHttpRoutes(app)) return fakeBulkJobsTransport.retryBulkJob(app, id, overrides, key);
    const result = await this.http.write<BulkJobSubmitResult>('POST', `${BASES[app]}/bulk-jobs/${encodeURIComponent(id)}/retry`,
      overrides === null ? {} : { overrides }, { key, bare: app !== 'core' });
    return result.data;
  }

  private readPage<T>(app: keyof typeof BASES, path: string, query: CoreQuery): Promise<BulkJobPage<T>> {
    return this.queries.fetchQuery({ queryKey: ['bulk-jobs', app, path, query], queryFn: async () =>
      app === 'core' ? bulkPage(await this.http.readPage<T>(`${BASES[app]}${path}`, query))
        : this.http.read<BulkJobPage<T>>(`${BASES[app]}${path}`, query, { bare: true }) });
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

/** POST /api/tenant/<app>/v1/bulk-jobs/:jobId/cancel (200); body {}. */
export function cancelBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
  return transport().cancelBulkJob(app, id);
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
  return transport().retryBulkJob(app, id, overrides, key);
}
