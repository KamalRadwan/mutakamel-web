export type DashboardMetricKind = "integer" | "money" | "percent" | "ratio";
export type DashboardRangeGranularity = "day" | "month";
export type DashboardMetricTone =
  | "amber"
  | "blue"
  | "cyan"
  | "green"
  | "purple"
  | "red";

export interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  kind: DashboardMetricKind;
  description: string;
  tone: DashboardMetricTone;
}

export interface DashboardBreakdownItem {
  key: string;
  label: string;
  value: number;
  ratio: number; // normalized 0..1, not 0..100
  tone: DashboardMetricTone;
  description?: string;
}

export interface DashboardResponse {
  asOf: string;
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
      items: Array<{
        id: string;
        name: string;
        metadata: string;
        currentTenants: number;
        maxTenants: number;
        utilization: number; // normalized 0..1
        tone: DashboardMetricTone;
      }>;
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
      regions: Array<{
        key: string;
        countryName: string;
        countryIsoCode: string;
        count: number;
        ratio: number; // normalized 0..1
        tone: DashboardMetricTone;
      }>;
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
}

export interface AdminDashboardQuery {
  date?: string;
  from?: string;
  to?: string;
}
