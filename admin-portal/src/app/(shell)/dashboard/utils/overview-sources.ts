import type {
  DashboardMetricTone,
  DashboardRegionItem,
  DashboardResponse,
} from "@/types/dashboard";

/**
 * The overview's charts used to read `overview.tenantLifecycle`,
 * `overview.domainHealth`, `overview.subscriptionStatus`,
 * `overview.billingSummary`, and `panels.databaseCapacity` — five parallel
 * structures restating what the groups already report. Core no longer sends
 * them, so the overview derives the same inputs from the groups themselves.
 */

export interface OverviewBreakdownItem {
  key: string;
  label: string;
  value: number;
  ratio: number;
  tone: DashboardMetricTone;
}

export interface OverviewServerRow {
  id: string;
  name: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number;
  tone?: DashboardMetricTone;
}

const TENANT_TONES: Record<string, DashboardMetricTone> = {
  ACTIVE: "green",
  SUSPENDED: "amber",
  PROVISIONING: "cyan",
  PROVISIONING_FAILED: "red",
  DELETED: "red",
};

const SUBSCRIPTION_TONES: Record<string, DashboardMetricTone> = {
  ACTIVE: "green",
  TRIAL: "blue",
  PAST_DUE: "red",
  CANCELLED: "amber",
};

const INVOICE_TONES: Record<string, DashboardMetricTone> = {
  PAID: "green",
  OVERDUE: "red",
  ISSUED: "blue",
  PARTIALLY_PAID: "cyan",
  DRAFT: "purple",
  VOID: "purple",
};

export function tenantStatusItems(
  data: DashboardResponse,
): OverviewBreakdownItem[] {
  return breakdownItems(
    readNumberMap(groupBreakdown(data, "tenants", "byStatus")),
    TENANT_TONES,
  );
}

export function tenantLifecycleTotal(data: DashboardResponse): number {
  const group = data.tenants;
  if (!group?.available) return 0;
  return readNumber(group.snapshot["lifecycleTotal"]);
}

export function domainHealth(data: DashboardResponse): {
  verifiedDomains: number;
  invalidDomains: number;
  totalDomains: number;
} {
  const group = data.domains;
  if (!group?.available) {
    return { verifiedDomains: 0, invalidDomains: 0, totalDomains: 0 };
  }
  return {
    verifiedDomains: readNumber(group.snapshot["verified"]),
    invalidDomains: readNumber(group.snapshot["invalid"]),
    totalDomains: readNumber(group.snapshot["total"]),
  };
}

export function tenantRegions(data: DashboardResponse): DashboardRegionItem[] {
  const rows = groupBreakdown(data, "tenants", "byCountry");
  return Array.isArray(rows) ? (rows as DashboardRegionItem[]) : [];
}

export function databaseServerRows(
  data: DashboardResponse,
): OverviewServerRow[] {
  const rows = groupBreakdown(data, "database", "servers");
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    return [
      {
        id: String(row["id"] ?? ""),
        name: String(row["name"] ?? row["id"] ?? ""),
        currentTenants: readNumber(row["currentTenants"]),
        maxTenants: readNumber(row["maxTenants"]),
        utilization: readNumber(row["utilization"]),
        tone: row["tone"] as DashboardMetricTone | undefined,
      },
    ];
  });
}

export function subscriptionStatusItems(
  data: DashboardResponse,
): OverviewBreakdownItem[] {
  return breakdownItems(
    readNumberMap(groupBreakdown(data, "subscriptions", "byStatus")),
    SUBSCRIPTION_TONES,
  );
}

export function subscriptionTotal(data: DashboardResponse): number {
  const group = data.subscriptions;
  if (!group?.available) return 0;
  return readNumber(group.snapshot["total"]);
}

/**
 * Billing's `byStatus` is a map of objects keyed by invoice status, and the
 * settlement value per status is what this donut is made of.
 *
 * UI-001. It was titled "Revenue Distribution by Plan". There is no by-plan
 * breakdown anywhere in the response - the provider emits only
 * `billing.byStatusValue` and `billing.byStatusCount`, and labels them by
 * status itself - so the chart named a dimension its data does not have. An
 * operator reading plan performance off invoice statuses is reading a
 * different question's answer. The title now says what is plotted.
 */
export function billingValueItems(
  data: DashboardResponse,
): OverviewBreakdownItem[] {
  const group = data.billing;
  if (!group?.available) return [];
  const source = group.breakdowns["byStatus"];
  if (!isRecord(source)) return [];

  const entries = Object.entries(source).flatMap(([status, value]) => {
    if (!isRecord(value)) return [];
    return [{ key: status, value: readNumber(value["settlementUsd"]) }];
  });
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  return entries.map((entry) => ({
    key: entry.key,
    label: humanizeStatus(entry.key),
    value: entry.value,
    ratio: total > 0 ? entry.value / total : 0,
    tone: INVOICE_TONES[entry.key] ?? "blue",
  }));
}

export function collectedRatio(data: DashboardResponse): number {
  const group = data.billing;
  if (!group?.available) return 0;
  return readNumber(group.snapshot["collectionRatio"]);
}

/* ------------------------------------------------------------ helpers -- */

function groupBreakdown(
  data: DashboardResponse,
  key: "tenants" | "domains" | "subscriptions" | "database" | "billing",
  field: string,
): unknown {
  const group = data[key];
  return group?.available ? group.breakdowns[field] : undefined;
}

function breakdownItems(
  counts: Array<{ key: string; value: number }>,
  tones: Record<string, DashboardMetricTone>,
): OverviewBreakdownItem[] {
  const total = counts.reduce((sum, entry) => sum + entry.value, 0);
  return counts.map((entry) => ({
    key: entry.key,
    label: humanizeStatus(entry.key),
    value: entry.value,
    ratio: total > 0 ? entry.value / total : 0,
    tone: tones[entry.key] ?? "blue",
  }));
}

function readNumberMap(value: unknown): Array<{ key: string; value: number }> {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, entry]) => ({
    key,
    value: readNumber(entry),
  }));
}

/** Money arrives as a fixed-point string from Core's `toDashboardDecimal`. */
function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function humanizeStatus(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
