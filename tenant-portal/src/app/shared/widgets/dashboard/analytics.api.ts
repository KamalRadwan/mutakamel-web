import { crmHttp, crmQueries } from '../../../features/crm/shared/crm-http';
import {
  getReadiness as settingsReadiness,
  listReadiness as settingsReadinessList,
} from '../../../features/crm/settings/data-readiness/readiness.api';
import type { ReadinessDetail } from '../../../features/crm/settings/data-readiness/readiness.api';
import { ApiError, isUuidV7, validationFailed, type FlatPage, type InfoPage } from './analytics-api';
import type {
  Catalog, Explain, GovernedTargetOption, MetricStatsQuery, MetricStat, Receipt, ShareTarget, SourceReadiness,
} from './analytics.model';

export type { ReadinessDetail };

// Analytics reads have no organization scope headers; the server resolves dataset access.
export function getCatalog(): Promise<Catalog> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'catalog', 'dashboards'],
    queryFn: () => crmHttp().read('/dashboards/catalog'),
  });
}

export function getWidgetCatalog(): Promise<Catalog> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'catalog', 'widgets'],
    queryFn: () => crmHttp().read('/widgets/catalog'),
  });
}

export async function listReadiness(status?: SourceReadiness['status']): Promise<{ items: SourceReadiness[] }> {
  const result = await settingsReadinessList();
  // The settings API has no status argument. Keep the existing shared caller contract.
  return status ? { items: result.items.filter((item) => item.status === status) } : result;
}

export function getReadiness(key: string, cursor: string | null = null, limit = 20): Promise<ReadinessDetail> {
  return settingsReadiness(key, { cursor, limit });
}

export function getReceipt(id: string): Promise<Receipt> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'receipt', id],
    queryFn: () => crmHttp().read(`/dashboards/receipts/${encodeURIComponent(id)}`),
  });
}

/** Heavy read: invoked only when the caller opens or refreshes the explanation. */
export function explainReceipt(id: string, compareTo?: string): Promise<Explain> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'explain', id, compareTo],
    queryFn: () => crmHttp().read(`/dashboards/receipts/${encodeURIComponent(id)}/explain`, { compareTo }),
    staleTime: 0,
  });
}

export function listShareTargets(
  kind: 'dashboards' | 'widgets', search = '', offset = 0, limit = 50,
): Promise<{ items: ShareTarget[]; nextOffset?: number }> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'share-targets', kind, search, offset, limit],
    queryFn: () => crmHttp().read(`/${kind}/share-targets`, { search, offset, limit }),
  });
}

export async function listMetricStats(query: MetricStatsQuery): Promise<InfoPage<MetricStat>> {
  const civilTime = (value: string): number => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  };
  const days = (civilTime(query.to) - civilTime(query.from)) / 86_400_000 + 1;
  if (!(days >= 1 && days <= 92)) throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'metric-stats', query],
    queryFn: () => crmHttp().read('/analytics/metric-stats', { ...query }),
  });
}

/** The target list requires a branch even though dashboard permissions are tenant-level. */
export async function listGovernedTargets(
  metricKey: string, periodGrain: 'MONTH' | 'QUARTER' | 'YEAR', branchId: string,
): Promise<GovernedTargetOption[]> {
  if (!isUuidV7(branchId)) throw validationFailed('branchId', 'is_uuid');
  const items: GovernedTargetOption[] = [];
  for (let page = 1; ; page++) {
    const query = { branchId, metricKey, periodGrain, approvalState: 'APPROVED', page, limit: 100 };
    const result = await crmQueries().fetchQuery({
      queryKey: ['crm-analytics', 'governed-targets', query],
      queryFn: () => crmHttp().read<FlatPage<GovernedTargetOption>>('/targets', query),
    });
    items.push(...result.items);
    if (!result.hasNext) return items;
  }
}
