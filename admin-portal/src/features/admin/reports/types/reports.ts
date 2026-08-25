export const REPORT_KINDS = [
  "OVERVIEW",
  "TENANTS",
  "SERVERS",
  "BILLING",
  "PROVISIONING",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export const TENANT_REPORT_STATUSES = [
  "PROVISIONING",
  "PROVISIONING_FAILED",
  "ACTIVE",
  "SUSPENDED",
  "DELETED",
] as const;

export type TenantReportStatus = (typeof TENANT_REPORT_STATUSES)[number];

export interface ReportWindowQuery {
  from?: string;
  to?: string;
}

export interface TenantReportQuery {
  page?: number;
  limit?: number;
  status?: TenantReportStatus;
  serverId?: string;
}

export interface ProvisioningReportQuery extends ReportWindowQuery {
  limit?: number;
}

export interface ReportSnapshot<T> {
  data: T;
  correlationId: string;
  responseTimestamp: string;
}

export interface OverviewReport {
  asOf: string;
  tenantsByStatus: Record<string, number>;
  subscriptions: {
    count: number;
    totalAllowedUsers: number;
  };
  outstandingInvoices: {
    count: number;
    total: string;
  };
}

export interface TenantReportRow {
  id: string;
  name: string;
  status: string;
  allowedUsers: number | null;
  subscriptionStatus: string | null;
  createdAt: string;
}

export interface TenantReportPage {
  items: TenantReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ServerReportRow {
  id: string;
  name: string;
  databaseEngine: string;
  countryName: string | null;
  countryIsoCode: string | null;
  region: string | null;
  status: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number;
}

export interface ServersReport {
  asOf: string;
  items: ServerReportRow[];
}

export interface BillingReportBucket {
  status: string;
  total: string;
  count: number;
}

export interface BillingReport {
  asOf: string;
  buckets: BillingReportBucket[];
}

export interface ProvisioningReportRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface ProvisioningReport {
  asOf: string;
  stuck: number;
  items: ProvisioningReportRow[];
}

export type ReportData =
  | { kind: "OVERVIEW"; snapshot: ReportSnapshot<OverviewReport> }
  | { kind: "TENANTS"; snapshot: ReportSnapshot<TenantReportPage> }
  | { kind: "SERVERS"; snapshot: ReportSnapshot<ServersReport> }
  | { kind: "BILLING"; snapshot: ReportSnapshot<BillingReport> }
  | { kind: "PROVISIONING"; snapshot: ReportSnapshot<ProvisioningReport> };

export interface ReportFilterDraft {
  from: string;
  to: string;
  status: "" | TenantReportStatus;
  serverId: string;
  limit: string;
}

export type ReportValidationCode =
  | "INVALID_FROM"
  | "INVALID_TO"
  | "RANGE_REVERSED"
  | "INVALID_SERVER_UUID_V7"
  | "INVALID_LIMIT";

export type ReportFilterErrors = Partial<
  Record<keyof ReportFilterDraft | "dateRange", ReportValidationCode>
>;

export type ReportsRequestState =
  "LOADING" | "READY" | "EMPTY" | "FORBIDDEN" | "UNAVAILABLE" | "ERROR";
