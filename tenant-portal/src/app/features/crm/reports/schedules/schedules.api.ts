import type { InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { listWholeCatalogue } from '../catalogue/catalogue.api';
import { isReportDisabled } from '../catalogue/catalogue.model';
import { listAllDashboards } from '../report/report.api';
import {
  REPORT_SUBSCRIPTIONS_WIRED,
  fakeCreateSubscription,
  fakeDeleteSubscription,
  fakeDisableSubscription,
  fakeEnableSubscription,
  fakeGetSubscription,
  fakeListDeliveries,
  fakeListSubscriptions,
  fakeResumeSubscription,
  fakeUpdateSubscription,
} from './schedules.fake';
import type {
  CreateSubscription,
  Delivery,
  DeliveryCapabilities,
  ScheduleTargets,
  Subscription,
  SubscriptionListPage,
  UpdateSubscription,
} from './schedules.model';

// GET /api/v1/crm/analytics/subscriptions (box=owned by default; limit 1–100, default 25)
export function listSubscriptions(cursor: string | null = null, limit?: number): Promise<SubscriptionListPage> {
  return fakeListSubscriptions(cursor, limit);
}

// GET /api/v1/crm/analytics/subscriptions/:id
export function getSubscription(id: string): Promise<Subscription> {
  return fakeGetSubscription(id);
}

// POST /api/v1/crm/analytics/subscriptions (201, header x-idempotency-key)
export function createSubscription(
  body: CreateSubscription,
  key: string,
): Promise<Subscription & { capabilities: DeliveryCapabilities }> {
  return fakeCreateSubscription(body, key);
}

// PATCH /api/v1/crm/analytics/subscriptions/:id
export function updateSubscription(id: string, body: UpdateSubscription): Promise<Subscription> {
  return fakeUpdateSubscription(id, body);
}

// POST /api/v1/crm/analytics/subscriptions/:id/enable
export function enableSubscription(id: string, revision: number): Promise<Subscription> {
  return fakeEnableSubscription(id, revision);
}

// POST /api/v1/crm/analytics/subscriptions/:id/disable
export function disableSubscription(id: string, revision: number): Promise<Subscription> {
  return fakeDisableSubscription(id, revision);
}

// POST /api/v1/crm/analytics/subscriptions/:id/resume
export function resumeSubscription(id: string, revision: number): Promise<Subscription> {
  return fakeResumeSubscription(id, revision);
}

// DELETE /api/v1/crm/analytics/subscriptions/:id (204, body { revision })
export function deleteSubscription(id: string, revision: number): Promise<void> {
  return fakeDeleteSubscription(id, revision);
}

// GET /api/v1/crm/analytics/subscriptions/:id/deliveries
export function listDeliveries(id: string, cursor: string | null = null, limit?: number): Promise<InfoPage<Delivery>> {
  return fakeListDeliveries(id, cursor, limit);
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
  return REPORT_SUBSCRIPTIONS_WIRED;
}
