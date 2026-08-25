import type {
  ProvisioningReportQuery,
  ReportFilterDraft,
  ReportFilterErrors,
  ReportKind,
  ReportWindowQuery,
  TenantReportQuery,
} from "../types/reports";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_LIMITS = new Set([10, 20, 25, 50, 100]);

export const DEFAULT_REPORT_FILTERS: Record<ReportKind, ReportFilterDraft> = {
  OVERVIEW: emptyDraft("20"),
  TENANTS: emptyDraft("20"),
  SERVERS: emptyDraft("20"),
  BILLING: emptyDraft("20"),
  PROVISIONING: emptyDraft("50"),
};

export function copyDefaultReportFilters(): Record<
  ReportKind,
  ReportFilterDraft
> {
  return {
    OVERVIEW: { ...DEFAULT_REPORT_FILTERS.OVERVIEW },
    TENANTS: { ...DEFAULT_REPORT_FILTERS.TENANTS },
    SERVERS: { ...DEFAULT_REPORT_FILTERS.SERVERS },
    BILLING: { ...DEFAULT_REPORT_FILTERS.BILLING },
    PROVISIONING: { ...DEFAULT_REPORT_FILTERS.PROVISIONING },
  };
}

export function validateReportFilters(
  kind: ReportKind,
  draft: ReportFilterDraft,
): ReportFilterErrors {
  const errors: ReportFilterErrors = {};
  if (kind === "OVERVIEW" || kind === "BILLING" || kind === "PROVISIONING") {
    if (draft.from && !isValidDateInput(draft.from)) {
      errors.from = "INVALID_FROM";
    }
    if (draft.to && !isValidDateInput(draft.to)) {
      errors.to = "INVALID_TO";
    }
    if (
      !errors.from &&
      !errors.to &&
      draft.from &&
      draft.to &&
      draft.from > draft.to
    ) {
      errors.dateRange = "RANGE_REVERSED";
    }
  }

  if (kind === "TENANTS" && draft.serverId && !UUID_V7.test(draft.serverId)) {
    errors.serverId = "INVALID_SERVER_UUID_V7";
  }

  if (kind === "TENANTS" || kind === "PROVISIONING") {
    const limit = Number(draft.limit);
    if (!Number.isInteger(limit) || !PAGE_LIMITS.has(limit)) {
      errors.limit = "INVALID_LIMIT";
    }
  }
  return errors;
}

export function buildWindowQuery(draft: ReportFilterDraft): ReportWindowQuery {
  return {
    ...(draft.from ? { from: dateInputToIso(draft.from, "START") } : {}),
    ...(draft.to ? { to: dateInputToIso(draft.to, "END") } : {}),
  };
}

export function buildTenantQuery(
  draft: ReportFilterDraft,
  page: number,
): TenantReportQuery {
  return {
    page,
    limit: Number(draft.limit),
    ...(draft.status ? { status: draft.status } : {}),
    ...(draft.serverId ? { serverId: draft.serverId.toLowerCase() } : {}),
  };
}

export function buildProvisioningQuery(
  draft: ReportFilterDraft,
): ProvisioningReportQuery {
  return {
    ...buildWindowQuery(draft),
    limit: Number(draft.limit),
  };
}

export function dateInputToIso(
  value: string,
  boundary: "START" | "END",
): string {
  if (!isValidDateInput(value)) {
    throw new Error("INVALID_REPORT_DATE_INPUT");
  }
  return `${value}T${boundary === "START" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

export function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function formatDecimalString(value: string): string {
  const match = /^(\d+)(\.\d+)?$/.exec(value);
  if (!match) return value;
  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${integer}${match[2] ?? ""}`;
}

function emptyDraft(limit: string): ReportFilterDraft {
  return { from: "", to: "", status: "", serverId: "", limit };
}
