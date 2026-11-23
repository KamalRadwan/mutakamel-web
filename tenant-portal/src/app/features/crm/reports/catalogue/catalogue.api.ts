import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { InfoPage, validationFailed } from '../../../../shared/widgets/dashboard/analytics-api';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import { ReportCatalogueItem, ReportDomain, isReportDisabled } from './catalogue.model';
import { reportWriteRetryable } from '../report/report-errors';

const favouriteRetries = new WeakMap<CrmHttpTransport, Map<string, { favorite: boolean; key: string }>>();

export interface ReportCatalogueQuery {
  domain?: ReportDomain;
  q?: string;
  favourite?: boolean;
  cursor?: string | null;
  limit?: number;
}

/** Availability is filtered locally; the backend has no availableOnly query. */
export interface ListCatalogueQuery extends ReportCatalogueQuery {
  availableOnly?: boolean;
}

export interface ReportFavouriteResult {
  dashboardId: string | null;
  favorite: boolean;
}

export function assertReportKey(reportKey: string): void {
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(reportKey)) throw validationFailed('reportKey', 'matches');
}

export async function listCatalogue(query: ListCatalogueQuery = {}): Promise<InfoPage<ReportCatalogueItem>> {
  const { availableOnly, ...backendQuery } = query;
  const page = await crmQueries().fetchQuery<InfoPage<ReportCatalogueItem>>({
    queryKey: ['crm-analytics', 'reports', 'catalogue', backendQuery],
    queryFn: () => crmHttp().read('/dashboards/reports/catalogue', { ...backendQuery }),
    staleTime: 0,
  });
  const items = page.items.map((item) => item.available === false ? { ...item, readiness: 'UNAVAILABLE' as const } : item);
  return { ...page, items: availableOnly ? items.filter((item) => !isReportDisabled(item.readiness)) : items };
}

export async function setReportFavourite(reportKey: string, favorite: boolean): Promise<ReportFavouriteResult> {
  assertReportKey(reportKey);
  const http = crmHttp();
  let favouriteAttempts = favouriteRetries.get(http);
  if (!favouriteAttempts) {
    favouriteAttempts = new Map();
    favouriteRetries.set(http, favouriteAttempts);
  }
  const queries = crmQueries();
  let attempt = favouriteAttempts.get(reportKey);
  if (!attempt || attempt.favorite !== favorite) {
    attempt = { favorite, key: newIdempotencyKey() };
    favouriteAttempts.set(reportKey, attempt);
  }
  await queries.cancelQueries({ queryKey: ['crm-analytics'] });
  try {
    const result = await http.write<ReportFavouriteResult>('PUT',
      `/dashboards/reports/${encodeURIComponent(reportKey)}/favorite`, { favorite }, { key: attempt.key });
    favouriteAttempts.delete(reportKey);
    await queries.invalidateQueries({ queryKey: ['crm-analytics'] });
    return result.data;
  } catch (error) {
    if (!reportWriteRetryable(error)) favouriteAttempts.delete(reportKey);
    throw error;
  }
}

/** Counts have no endpoint: read the same filtered catalogue by cursor. */
export async function listWholeCatalogue(
  query: Omit<ListCatalogueQuery, 'cursor' | 'limit'> = {},
): Promise<ReportCatalogueItem[]> {
  const items: ReportCatalogueItem[] = [];
  let cursor: string | null = null;
  do {
    const page = await listCatalogue({ ...query, cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.pageInfo.hasMore ? page.pageInfo.nextCursor : null;
  } while (cursor);
  return items;
}

/** Synchronous compatibility snapshot from live catalogue queries, never a seed. */
export function peekCatalogueReport(reportKey: string): ReportCatalogueItem | undefined {
  for (const [, page] of crmQueries().getQueriesData<InfoPage<ReportCatalogueItem>>({
    queryKey: ['crm-analytics', 'reports', 'catalogue'],
  })) {
    const item = page?.items.find((entry) => entry.reportKey === reportKey);
    if (item) return item;
  }
  return undefined;
}
