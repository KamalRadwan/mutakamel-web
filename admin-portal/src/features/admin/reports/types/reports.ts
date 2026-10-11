import type { PageResult } from "@/types/common";
import type {
  TENANT_OPERATION_TYPES,
  TenantOperationStall,
  TenantOperationStatus,
} from "@/features/admin/tenant-workspace/provisioning/types";

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

type TenantReportStatus = (typeof TENANT_REPORT_STATUSES)[number];

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

/**
 * The provisioning report is current state, so it takes no reporting window:
 * Core rejects `from`/`to` on it. `limit` bounds the stalled tenants listed.
 */
export interface ProvisioningReportQuery {
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

export type TenantReportPage = PageResult<TenantReportRow>;

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

/** The stalled tenant's open operation. */
export interface ProvisioningReportOperation {
  id: string;
  type: (typeof TENANT_OPERATION_TYPES)[number];
  status: TenantOperationStatus;
  currentPhase: string;
  generation: number;
}

/** A tenant whose open operation Core reports stalled at `asOf`. */
export interface ProvisioningReportRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  operation: ProvisioningReportOperation;
  /** The operation detail's own `stall` object. */
  stall: TenantOperationStall;
}

export interface ProvisioningReport {
  asOf: string;
  /** Tenants whose open operation is stalled; `items` lists the longest stalls. */
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
