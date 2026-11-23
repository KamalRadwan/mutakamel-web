import type { InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { listWholeCatalogue } from '../catalogue/catalogue.api';
import { isReportDisabled } from '../catalogue/catalogue.model';
import { listAllDashboards } from '../report/report.api';
import type {
  CreateSubscription,
  Delivery,
  DeliveryCapabilities,
  ScheduleTargets,
  Subscription,
  SubscriptionListPage,
  UpdateSubscription,
} from './schedules.model';

const subscriptionsKey = ['crm-analytics', 'subscriptions'] as const;
const path = '/analytics/subscriptions';
const pendingWrites = new Map<string, { bodyJson: string; key: string }>();

async function writeSubscription<T>(method: 'POST' | 'PATCH' | 'DELETE', route: string,
  body: UpdateSubscription | { revision: number }): Promise<T> {
  const action = `${method}:${route}`;
  const bodyJson = JSON.stringify(body);
  const previous = pendingWrites.get(action);
  const key = previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey();
  pendingWrites.set(action, { bodyJson, key });
  await crmQueries().cancelQueries({ queryKey: subscriptionsKey });
  try {
    const id = route.split('/')[3];
    const result = await crmHttp().write<T>(method, route, body, {
      key, ifMatch: `"subscription:${id}:${body.revision}"`,
    });
    pendingWrites.delete(action);
    return result.data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      pendingWrites.delete(action);
    }
    throw error;
  } finally {
    await crmQueries().invalidateQueries({ queryKey: subscriptionsKey, refetchType: 'none' });
  }
}

// GET /api/v1/crm/analytics/subscriptions (box=owned by default; limit 1–100, default 25)
export function listSubscriptions(cursor: string | null = null, limit?: number): Promise<SubscriptionListPage> {
  return crmQueries().fetchQuery({
    queryKey: [...subscriptionsKey, 'list', cursor, limit],
    queryFn: () => crmHttp().read<SubscriptionListPage>(path, { box: 'owned', cursor, limit }),
    staleTime: 0,
  });
}

// GET /api/v1/crm/analytics/subscriptions/:id
export function getSubscription(id: string): Promise<Subscription> {
  return crmQueries().fetchQuery({
    queryKey: [...subscriptionsKey, 'detail', id],
    queryFn: () => crmHttp().read<Subscription>(`${path}/${encodeURIComponent(id)}`),
    staleTime: 0,
  });
}

// POST /api/v1/crm/analytics/subscriptions (201, header x-idempotency-key)
export async function createSubscription(
  body: CreateSubscription,
  key: string,
): Promise<Subscription & { capabilities: DeliveryCapabilities }> {
  await crmQueries().cancelQueries({ queryKey: subscriptionsKey });
  try {
    return (await crmHttp().write<Subscription & { capabilities: DeliveryCapabilities }>('POST', path, body, { key })).data;
  } finally {
    await crmQueries().invalidateQueries({ queryKey: subscriptionsKey, refetchType: 'none' });
  }
}

// PATCH /api/v1/crm/analytics/subscriptions/:id
export function updateSubscription(id: string, body: UpdateSubscription): Promise<Subscription> {
  return writeSubscription('PATCH', `${path}/${encodeURIComponent(id)}`, body);
}

// POST /api/v1/crm/analytics/subscriptions/:id/enable
export function enableSubscription(id: string, revision: number): Promise<Subscription> {
  return writeSubscription('POST', `${path}/${encodeURIComponent(id)}/enable`, { revision });
}

// POST /api/v1/crm/analytics/subscriptions/:id/disable
export function disableSubscription(id: string, revision: number): Promise<Subscription> {
  return writeSubscription('POST', `${path}/${encodeURIComponent(id)}/disable`, { revision });
}

// POST /api/v1/crm/analytics/subscriptions/:id/resume
export function resumeSubscription(id: string, revision: number): Promise<Subscription> {
  return writeSubscription('POST', `${path}/${encodeURIComponent(id)}/resume`, { revision });
}

// DELETE /api/v1/crm/analytics/subscriptions/:id (204, body { revision })
export function deleteSubscription(id: string, revision: number): Promise<void> {
  return writeSubscription('DELETE', `${path}/${encodeURIComponent(id)}`, { revision });
}

// GET /api/v1/crm/analytics/subscriptions/:id/deliveries
export function listDeliveries(id: string, cursor: string | null = null, limit?: number): Promise<InfoPage<Delivery>> {
  return crmQueries().fetchQuery({
    queryKey: [...subscriptionsKey, 'deliveries', id, cursor, limit],
    queryFn: () => crmHttp().read<InfoPage<Delivery>>(`${path}/${encodeURIComponent(id)}/deliveries`, { cursor, limit }),
    staleTime: 0,
  });
}

/**
 * The target picker (lead decision): dashboards from `GET /api/v1/crm/dashboards?kind=DASHBOARD` (cursor rows; a
 * subscription needs VIEW, which every listed row has) and reports from `GET .../reports/catalogue` (cursor pages;
 * a report that is not available is listed but cannot be picked).
 */
export async function listScheduleTargets(): Promise<ScheduleTargets> {
  const [dashboards, reports] = await Promise.all([listAllDashboards(), listWholeCatalogue()]);
  return {
    dashboards: dashboards.map((row) => ({ id: row.id, label: { en: row.name, ar: row.name } })),
    reports: reports.map((report) => ({
      id: report.reportKey,
      label: { en: report.title.en, ar: report.title.ar },
      ...(isReportDisabled(report.readiness) ? { disabled: true } : {}),
    })),
  };
}

export function reportSubscriptionsAvailable(): boolean {
  return can('crm.subscriptions.manage');
}
