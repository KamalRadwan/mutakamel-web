// Contract of /api/v1/crm/analytics/subscriptions (crm-app delivery/subscriptions/subscriptions.dto.ts).

/** UI grouping only: the backend derives it from `reportKey` (a report subscription carries one). */
export type SubscriptionTargetType = 'DASHBOARD' | 'REPORT';

export type SubscriptionRecurrence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type SubscriptionPeriodToken =
  | 'PREVIOUS_DAY'
  | 'LAST_COMPLETED_WEEK'
  | 'LAST_COMPLETED_MONTH'
  | 'LAST_COMPLETED_QUARTER'
  | 'WEEK_TO_DATE'
  | 'MONTH_TO_DATE'
  | 'QUARTER_TO_DATE'
  | 'YEAR_TO_DATE';

export const SUBSCRIPTION_PERIOD_TOKENS: readonly SubscriptionPeriodToken[] = [
  'PREVIOUS_DAY',
  'LAST_COMPLETED_WEEK',
  'LAST_COMPLETED_MONTH',
  'LAST_COMPLETED_QUARTER',
  'WEEK_TO_DATE',
  'MONTH_TO_DATE',
  'QUARTER_TO_DATE',
  'YEAR_TO_DATE',
];

export type SubscriptionAttachmentFormat = 'PDF' | 'XLSX' | 'CSV';

export type SubscriptionLocale = 'ar' | 'en';

/** `suspendedReason` values the backend documents (subscriptions.openapi.ts). */
export type SubscriptionSuspendedReason = 'OWNER_INACTIVE' | 'REPORT_DELETED' | 'OWNER_ACCESS_LOST';

export type DeliveryStatus = 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';

/** deliveries/entitlement-check.ts `DeliverySkipReason`. */
export type DeliverySkipReason =
  | 'ENTITLEMENT_EXPIRED'
  | 'ENTITLEMENT_REVOKED'
  | 'PERMISSION_CHANGED'
  | 'RECIPIENT_INACTIVE'
  | 'REPORT_UNAVAILABLE'
  | 'SOURCE_NOT_READY'
  | 'OWNER_INACTIVE'
  | 'NO_DELIVERY_ADDRESS';

/** One choice of the schedule target picker. A report that is not available cannot be picked. */
export interface ScheduleTargetOption {
  id: string;
  label: { en: string; ar: string };
  disabled?: boolean;
}

/** The target picker lists: dashboards from `GET /crm/dashboards`, reports from `GET .../reports/catalogue`. */
export interface ScheduleTargets {
  dashboards: ScheduleTargetOption[];
  reports: ScheduleTargetOption[];
}

export const EMPTY_SCHEDULE_TARGETS: ScheduleTargets = { dashboards: [], reports: [] };

/** Target name of a subscription from the picker lists; the id when the target is not listed. */
export function scheduleTargetName(
  sub: Pick<Subscription, 'dashboardId' | 'reportKey'>,
  targets: ScheduleTargets,
  lang: 'ar' | 'en',
): string {
  const id = sub.reportKey ?? sub.dashboardId;
  const list = sub.reportKey ? targets.reports : targets.dashboards;
  return list.find((item) => item.id === id)?.label[lang] ?? id;
}

/** Read-only attachment format availability returned with the list and the create response. */
export interface DeliveryCapabilities {
  formats: { format: SubscriptionAttachmentFormat; available: boolean; reason?: string }[];
}

/** `SubscriptionDto`. `dashboardId` is always set: a report subscription points at the owner's REPORT row. */
export interface Subscription {
  id: string;
  name: string;
  ownerUserId: string;
  enabled: boolean;
  suspendedReason: SubscriptionSuspendedReason | null;
  dashboardId: string;
  reportKey: string | null;
  periodToken: SubscriptionPeriodToken;
  filters: Record<string, unknown>;
  locale: SubscriptionLocale;
  recurrence: SubscriptionRecurrence;
  scheduleWeekday: number | null;
  scheduleMonthDay: number | null;
  scheduleMinute: number;
  timeZone: string;
  startsOn: string;
  endsOn: string | null;
  recipients: string[];
  attachmentFormats: SubscriptionAttachmentFormat[];
  linkTtlHours: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/** `GET` list: the page plus current format availability. */
export interface SubscriptionListPage {
  items: Subscription[];
  pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null };
  capabilities: DeliveryCapabilities;
}

/** `CreateSubscriptionDto`: exactly one of `dashboardId` / `reportKey`. */
export interface CreateSubscription {
  name: string;
  dashboardId?: string;
  reportKey?: string;
  filters?: Record<string, unknown>;
  periodToken: SubscriptionPeriodToken;
  recurrence: SubscriptionRecurrence;
  scheduleWeekday?: number;
  scheduleMonthDay?: number;
  scheduleMinute: number;
  timeZone: string;
  startsOn: string;
  endsOn?: string | null;
  recipients: string[];
  attachmentFormats?: SubscriptionAttachmentFormat[];
  linkTtlHours?: number;
  locale?: SubscriptionLocale;
}

/** `UpdateSubscriptionDto`: every body field optional, no target fields; `revision` is the concurrency token. */
export interface UpdateSubscription extends Partial<Omit<CreateSubscription, 'dashboardId' | 'reportKey'>> {
  revision: number;
}

/** One row of `GET .../:id/deliveries`; optional fields are absent when the column is null. */
export interface Delivery {
  id: string;
  recipientUserId: string;
  scheduledFor: string;
  status: DeliveryStatus;
  skipReason?: DeliverySkipReason;
  attempts: number;
  sentAt?: string;
  openedCount: number;
  lastOpenedAt?: string;
}

export function subscriptionTargetType(sub: Pick<Subscription, 'reportKey'>): SubscriptionTargetType {
  return sub.reportKey ? 'REPORT' : 'DASHBOARD';
}
