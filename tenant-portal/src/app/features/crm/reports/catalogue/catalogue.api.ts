import { ApiError, InfoPage, fakeDelay, pageOf, validationFailed } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_REPORTS } from './catalogue.fake';
import { ReportCatalogueItem, ReportDomain, isReportDisabled } from './catalogue.model';

/** Query of `GET /api/v1/crm/dashboards/reports/catalogue` (backend `ReportCatalogueQueryDto`). */
export interface ReportCatalogueQuery {
  domain?: ReportDomain;
  q?: string;
  favourite?: boolean;
  cursor?: string | null;
  limit?: number;
}

/**
 * The catalogue query plus `availableOnly`, which the backend does not have (lead decision): the client keeps
 * the entries whose `readiness` is available (not NOT_READY / UNAVAILABLE) from each returned page.
 */
export interface ListCatalogueQuery extends ReportCatalogueQuery {
  availableOnly?: boolean;
}

/** `PUT .../reports/:reportKey/favorite` response (backend `ReportFavouriteResult`). */
export interface ReportFavouriteResult {
  dashboardId: string | null;
  favorite: boolean;
}

const REPORT_KEY = /^[a-z][a-z0-9-]{0,79}$/;
const Q_MAX_LENGTH = 120;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const store: ReportCatalogueItem[] = structuredClone(FAKE_REPORTS);

const STABLE_DASHBOARD_IDS = new Map<string, string>(
  FAKE_REPORTS.map((report, index) => [
    report.reportKey,
    report.dashboardId ?? `01934b60-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
  ]),
);

/** `ReportKeyParamsDto`: the `:reportKey` path segment. */
export function assertReportKey(reportKey: string): void {
  if (!REPORT_KEY.test(reportKey)) throw validationFailed('reportKey', 'matches');
}

function normalizedSearch(rawQuery: string | undefined): string {
  // The DTO trims before `@MaxLength(120)`.
  const value = (rawQuery ?? '').trim();
  if (value.length > Q_MAX_LENGTH) throw validationFailed('q', 'max_length');
  return value.toLowerCase();
}

function normalizedLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit)) throw validationFailed('limit', 'is_int');
  if (limit < 1) throw validationFailed('limit', 'min');
  if (limit > MAX_LIMIT) throw validationFailed('limit', 'max');
  return limit;
}

function matchesQuery(
  item: ReportCatalogueItem,
  search: string,
  filter: { domain?: ReportDomain; favourite?: boolean },
): boolean {
  if (filter.domain && item.domain !== filter.domain) return false;
  if (filter.favourite !== undefined && item.favourite !== filter.favourite) return false;
  if (!search) return true;
  return (
    item.reportKey.toLowerCase().includes(search) ||
    (item.code ?? '').toLowerCase().includes(search) ||
    item.title.en.toLowerCase().includes(search) ||
    item.title.ar.toLowerCase().includes(search)
  );
}

/** Backend keyset order: `catalogue_domain, COALESCE(catalogue_code, ''), blueprint_key`. */
function compareReports(a: ReportCatalogueItem, b: ReportCatalogueItem): number {
  const keyA = [a.domain, a.code ?? '', a.reportKey];
  const keyB = [b.domain, b.code ?? '', b.reportKey];
  for (let i = 0; i < keyA.length; i++) {
    if (keyA[i] !== keyB[i]) return keyA[i] < keyB[i] ? -1 : 1;
  }
  return 0;
}

// GET /api/v1/crm/dashboards/reports/catalogue
async function fakeCatalogue(query: ReportCatalogueQuery): Promise<InfoPage<ReportCatalogueItem>> {
  await fakeDelay();
  const search = normalizedSearch(query.q);
  const limit = normalizedLimit(query.limit);
  const filtered = store.filter((item) => matchesQuery(item, search, query)).sort(compareReports);
  return structuredClone(pageOf(filtered, query.cursor ?? null, limit));
}

export async function listCatalogue(query: ListCatalogueQuery = {}): Promise<InfoPage<ReportCatalogueItem>> {
  const { availableOnly, ...backendQuery } = query;
  const page = await fakeCatalogue(backendQuery);
  if (!availableOnly) return page;
  return { ...page, items: page.items.filter((item) => !isReportDisabled(item.readiness)) };
}

// PUT /api/v1/crm/dashboards/reports/:reportKey/favorite
export async function setReportFavourite(reportKey: string, favorite: boolean): Promise<ReportFavouriteResult> {
  await fakeDelay();
  assertReportKey(reportKey);
  const item = store.find((entry) => entry.reportKey === reportKey);
  if (!item) {
    throw new ApiError(404, 'CRM_REPORT_NOT_FOUND');
  }
  // The caller's REPORT row is created on the first favourite and kept afterwards.
  if (!item.dashboardId) {
    if (!favorite) return { dashboardId: null, favorite: false };
    item.dashboardId = STABLE_DASHBOARD_IDS.get(reportKey) ?? null;
  }
  item.favourite = favorite;
  return structuredClone({ dashboardId: item.dashboardId, favorite });
}

/**
 * Every catalogue entry for one query, read page by page (limit 100, by cursor). The backend has no per-domain
 * counts (lead decision): callers count each entry's `domain` on the client (`countByDomain`).
 */
export async function listWholeCatalogue(
  query: Omit<ListCatalogueQuery, 'cursor' | 'limit'> = {},
): Promise<ReportCatalogueItem[]> {
  const items: ReportCatalogueItem[] = [];
  let cursor: string | null = null;
  do {
    const page = await listCatalogue({ ...query, cursor, limit: MAX_LIMIT });
    items.push(...page.items);
    cursor = page.pageInfo.hasMore ? page.pageInfo.nextCursor : null;
  } while (cursor);
  return items;
}

/** Reads one row from the catalogue store (favourite flag included), so pages never touch the seed. */
export function peekCatalogueReport(reportKey: string): ReportCatalogueItem | undefined {
  return store.find((entry) => entry.reportKey === reportKey);
}
