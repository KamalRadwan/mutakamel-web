export type DashboardMetricKind = "integer" | "money" | "percent" | "ratio";
export type DashboardRangeGranularity = "day" | "month";
export type DashboardMetricTone =
  | "amber"
  | "blue"
  | "cyan"
  | "green"
  | "purple"
  | "red";

export const DASHBOARD_GROUP_KEYS = [
  "tenants",
  "domains",
  "subscriptions",
  "billing",
  "payments",
  "wallets",
  "database",
  "storage",
  "provisioning",
  "catalogue",
  "notifications",
  "usage",
  "security",
  "audit",
] as const;

export type DashboardGroupKey = (typeof DASHBOARD_GROUP_KEYS)[number];

export type DashboardGroupPermission =
  | "admin.reports.tenants"
  | "admin.reports.domains"
  | "admin.reports.subscriptions"
  | "admin.reports.billing"
  | "admin.reports.payments"
  | "admin.reports.wallets"
  | "admin.reports.database-server"
  | "admin.reports.storage"
  | "admin.reports.provisioning"
  | "admin.reports.catalogue"
  | "admin.reports.notifications"
  | "admin.reports.usage"
  | "admin.reports.security"
  | "admin.reports.audit";

export interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  kind: DashboardMetricKind;
  description: string;
  tone: DashboardMetricTone;
}

export interface DashboardGroupAlert {
  key: string;
  severity: "info" | "warning" | "critical";
  count: number;
  message: string;
}

export interface DashboardAvailableGroup {
  key: DashboardGroupKey;
  permission: DashboardGroupPermission;
  available: true;
  asOf: string;
  snapshot: Record<string, unknown>;
  period: Record<string, unknown>;
  breakdowns: Record<string, unknown>;
  alerts: DashboardGroupAlert[];
  cards: DashboardMetric[];
}

export interface DashboardUnavailableGroup {
  key: DashboardGroupKey;
  permission: DashboardGroupPermission;
  available: false;
  asOf: string;
  reasonCode:
    | "SOURCE_NOT_CONFIGURED"
    | "HISTORICAL_DATA_NOT_STORED"
    | "PROJECTION_NOT_ACTIVE";
  message: string;
  alerts: DashboardGroupAlert[];
  cards: DashboardMetric[];
}

export type DashboardGroup =
  | DashboardAvailableGroup
  | DashboardUnavailableGroup;

export type DashboardGroups = Partial<
  Record<DashboardGroupKey, DashboardGroup>
>;

export type DashboardUnavailableReason =
  | "HISTORICAL_DATA_NOT_STORED"
  | "SOURCE_NOT_CONFIGURED"
  | "TARGET_NOT_CONFIGURED";

export interface DashboardAvailableDataset<T> {
  available: true;
  data: T;
}

export interface DashboardUnavailableDataset {
  available: false;
  reasonCode: DashboardUnavailableReason;
  message: string;
}

export type DashboardDataset<T> =
  | DashboardAvailableDataset<T>
  | DashboardUnavailableDataset;

export interface DashboardNamedValue {
  key: string;
  label: string;
  value: number;
}

export interface DashboardTimeSeriesPoint {
  bucket: string;
  label: string;
  value: number;
}

export interface DashboardDualTimeSeriesPoint {
  bucket: string;
  label: string;
  primary: number;
  secondary: number;
}

export interface DashboardBreakdownItem {
  key: string;
  label: string;
  value: number;
  ratio: number; // normalized 0..1, not 0..100
  tone: DashboardMetricTone;
  description?: string;
}

export interface DashboardDatabaseCapacityItem {
  id: string;
  name: string;
  metadata: string;
  status: string;
  countryName: string;
  countryIsoCode: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number;
  tone: DashboardMetricTone;
}

export interface DashboardRegionItem {
  key: string;
  countryName: string;
  countryIsoCode: string;
  count: number;
  ratio: number;
  tone: DashboardMetricTone;
}

export interface DashboardResponse extends DashboardGroups {
  asOf: string;
  authorizedGroups: DashboardGroupKey[];
  range: {
    from: string;
    to: string;
    label: string;
    granularity: DashboardRangeGranularity;
  };

  sections: Array<{
    key: "tenants" | "databaseServers" | "subscriptions" | "invoices" | string;
    title: string;
    cards: DashboardMetric[];
  }>;

  panels: {
    tenantStatus: {
      title: string;
      subtitle: string;
      items: Array<{
        key: string;
        label: string;
        count: number;
        description: string;
        ratio: number; // normalized 0..1
        tone: DashboardMetricTone;
      }>;
    };
    databaseCapacity: {
      title: string;
      subtitle: string;
      items: DashboardDatabaseCapacityItem[];
    };
  };

  overview: {
    kpis: DashboardMetric[];
    tenantLifecycle: {
      total: number;
      current: number;
      deleted: number;
      items: DashboardBreakdownItem[];
      stats: DashboardMetric[];
    };
    databaseHealth: {
      capacity: {
        current: number;
        maximum: number;
        utilization: number; // normalized 0..1
      };
      stats: DashboardMetric[];
    };
    subscriptionStatus: {
      total: number;
      items: DashboardBreakdownItem[];
      stats: DashboardMetric[];
    };
    billingSummary: {
      totalAmount: number;
      collectedRatio: number; // normalized 0..1
      items: DashboardBreakdownItem[];
    };
    domainHealth: {
      totalDomains: number;
      verifiedDomains: number;
      fullyVerified: number;
      invalidDomains: number;
      countries: number;
      regions: DashboardRegionItem[];
      actionRequired: boolean;
      message: string;
    };
    tenantBillingGrowth: {
      year: number;
      currencyCode: string; // current backend value: "USD"
      granularity: DashboardRangeGranularity;
      points: Array<{
        month: string; // formatted bucket label; may represent a day
        tenants: number;
        collected: number;
      }>;
    };
    recentTenants: {
      items: Array<{
        id: string;
        name: string;
        status: string; // humanized label, not a raw TenantStatusEnum value
        plan: string; // humanized subscription status + " Plan", or "No Plan"
        createdAt: string;
      }>;
    };
  };

  analytics?: {
    subscriptions: {
      recurringRevenue: DashboardDataset<{
        currencyCode: "USD";
        monthlyRecurringRevenue: number;
        annualRecurringRevenue: number;
        byBillingCycle: DashboardNamedValue[];
      }>;
      arrTarget: DashboardDataset<{
        currencyCode: "USD";
        actual: number;
        target: number;
      }>;
      averageCollectedRevenue: DashboardDataset<{
        currencyCode: "USD";
        points: DashboardTimeSeriesPoint[];
      }>;
      paymentHealth: DashboardDataset<DashboardNamedValue[]>;
      churnAndAcquisition: DashboardDataset<{
        points: DashboardDualTimeSeriesPoint[];
      }>;
      upcomingRenewals: DashboardDataset<{
        windowDays: 90;
        points: DashboardTimeSeriesPoint[];
      }>;
      revenueFlow: DashboardUnavailableDataset;
      lifetimeValue: DashboardUnavailableDataset;
      promotionImpact: DashboardUnavailableDataset;
      cohortRetention: DashboardUnavailableDataset;
    };
    billing: {
      aging: DashboardDataset<{
        currencyCode: "USD";
        items: DashboardNamedValue[];
      }>;
      daysSalesOutstanding: DashboardDataset<{
        unit: "days";
        points: DashboardTimeSeriesPoint[];
      }>;
      cashFlow: DashboardDataset<{
        currencyCode: "USD";
        points: DashboardDualTimeSeriesPoint[];
      }>;
      revenueByPurpose: DashboardDataset<{
        currencyCode: "USD";
        items: DashboardNamedValue[];
      }>;
      paymentProviders: DashboardDataset<DashboardNamedValue[]>;
      paymentFailureReasons: DashboardDataset<DashboardNamedValue[]>;
      refunds: DashboardDataset<{
        currencyCode: "USD";
        points: DashboardTimeSeriesPoint[];
      }>;
      taxByCountry: DashboardDataset<{
        currencyCode: "USD";
        items: DashboardNamedValue[];
      }>;
      renewalForecast: DashboardDataset<{
        currencyCode: "USD";
        windowDays: 90;
        points: DashboardTimeSeriesPoint[];
      }>;
      usageOverage: DashboardUnavailableDataset;
      costBreakdown: DashboardUnavailableDataset;
      discountImpact: DashboardUnavailableDataset;
      chargebacks: DashboardUnavailableDataset;
    };
    servers: {
      nodes: DashboardAvailableDataset<DashboardDatabaseCapacityItem[]>;
      regions: DashboardAvailableDataset<DashboardRegionItem[]>;
      latency: DashboardUnavailableDataset;
      capacityHistory: DashboardUnavailableDataset;
    };
    platformHealth: DashboardUnavailableDataset;
  };
}

export interface AdminDashboardQuery {
  date?: string;
  from?: string;
  to?: string;
}
