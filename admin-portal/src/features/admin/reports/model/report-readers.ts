import type {
  BillingReport,
  BillingReportBucket,
  OverviewReport,
  ProvisioningReport,
  ProvisioningReportRow,
  ReportSnapshot,
  ServerReportRow,
  ServersReport,
  TenantReportPage,
  TenantReportRow,
} from "../types/reports";

const WIRE_IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function readOverviewReport(
  payload: unknown,
): ReportSnapshot<OverviewReport> {
  return readEnvelope(payload, (value) => {
    const data = requiredRecord(value);
    const tenantsByStatusValue = requiredRecord(data.tenantsByStatus);
    const tenantsByStatus: Record<string, number> = {};
    for (const [status, count] of Object.entries(tenantsByStatusValue)) {
      if (!WIRE_IDENTIFIER.test(status)) invalid();
      tenantsByStatus[status] = nonNegativeInteger(count);
    }

    const subscriptions = requiredRecord(data.subscriptions);
    const outstandingInvoices = requiredRecord(data.outstandingInvoices);
    return {
      asOf: isoTimestamp(data.asOf),
      tenantsByStatus,
      subscriptions: {
        count: nonNegativeInteger(subscriptions.count),
        totalAllowedUsers: nonNegativeInteger(subscriptions.totalAllowedUsers),
      },
      outstandingInvoices: {
        count: nonNegativeInteger(outstandingInvoices.count),
        total: decimalString(outstandingInvoices.total),
      },
    };
  });
}

export function readTenantReport(
  payload: unknown,
): ReportSnapshot<TenantReportPage> {
  const envelope = envelopeRecord(payload);
  const canonicalMeta = optionalRecord(envelope.meta);

  if (Array.isArray(envelope.data) && canonicalMeta) {
    return snapshotFromEnvelope(envelope, {
      items: envelope.data.map(readTenantRow),
      ...readPaginationMeta(canonicalMeta),
    });
  }

  const current = requiredRecord(envelope.data);
  if (!Array.isArray(current.items)) invalid();
  const total = nonNegativeInteger(current.total);
  const page = positiveInteger(current.page);
  const limit = positiveInteger(current.limit);
  const totalPages = Math.ceil(total / limit);
  return snapshotFromEnvelope(envelope, {
    items: current.items.map(readTenantRow),
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  });
}

export function readServersReport(
  payload: unknown,
): ReportSnapshot<ServersReport> {
  return readEnvelope(payload, (value) => {
    const data = requiredRecord(value);
    if (!Array.isArray(data.items)) invalid();
    return {
      asOf: isoTimestamp(data.asOf),
      items: data.items.map(readServerRow),
    };
  });
}

export function readBillingReport(
  payload: unknown,
): ReportSnapshot<BillingReport> {
  return readEnvelope(payload, (value) => {
    const data = requiredRecord(value);
    if (!Array.isArray(data.buckets)) invalid();
    return {
      asOf: isoTimestamp(data.asOf),
      buckets: data.buckets.map(readBillingBucket),
    };
  });
}

export function readProvisioningReport(
  payload: unknown,
): ReportSnapshot<ProvisioningReport> {
  return readEnvelope(payload, (value) => {
    const data = requiredRecord(value);
    if (!Array.isArray(data.items)) invalid();
    return {
      asOf: isoTimestamp(data.asOf),
      stuck: nonNegativeInteger(data.stuck),
      items: data.items.map(readProvisioningRow),
    };
  });
}

function readEnvelope<T>(
  payload: unknown,
  readData: (value: unknown) => T,
): ReportSnapshot<T> {
  const envelope = envelopeRecord(payload);
  return snapshotFromEnvelope(envelope, readData(envelope.data));
}

function envelopeRecord(payload: unknown): Record<string, unknown> {
  const envelope = requiredRecord(payload);
  if (envelope.success !== true || !("data" in envelope)) invalid();
  isoTimestamp(envelope.timestamp);
  boundedString(envelope.correlationId, 200);
  return envelope;
}

function snapshotFromEnvelope<T>(
  envelope: Record<string, unknown>,
  data: T,
): ReportSnapshot<T> {
  return {
    data,
    correlationId: boundedString(envelope.correlationId, 200),
    responseTimestamp: isoTimestamp(envelope.timestamp),
  };
}

function readPaginationMeta(meta: Record<string, unknown>) {
  const page = positiveInteger(meta.page);
  const limit = positiveInteger(meta.limit);
  const total = nonNegativeInteger(meta.total);
  const totalPages = nonNegativeInteger(meta.totalPages);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: requiredBoolean(meta.hasNext),
    hasPrev: requiredBoolean(meta.hasPrev),
  };
}

function readTenantRow(value: unknown): TenantReportRow {
  const row = requiredRecord(value);
  return {
    id: boundedString(row.id, 200),
    name: boundedString(row.name, 500),
    status: wireIdentifier(row.status),
    allowedUsers: nullableNonNegativeInteger(row.allowedUsers),
    subscriptionStatus: nullableWireIdentifier(row.subscriptionStatus),
    createdAt: isoTimestamp(row.createdAt),
  };
}

function readServerRow(value: unknown): ServerReportRow {
  const row = requiredRecord(value);
  const utilization = finiteNumber(row.utilization);
  if (utilization < 0) invalid();
  return {
    id: boundedString(row.id, 200),
    name: boundedString(row.name, 500),
    databaseEngine: boundedString(row.databaseEngine, 100),
    countryName: nullableString(row.countryName, 200),
    countryIsoCode: nullableString(row.countryIsoCode, 20),
    region: nullableString(row.region, 200),
    status: wireIdentifier(row.status),
    currentTenants: nonNegativeInteger(row.currentTenants),
    maxTenants: nonNegativeInteger(row.maxTenants),
    utilization,
  };
}

function readBillingBucket(value: unknown): BillingReportBucket {
  const bucket = requiredRecord(value);
  return {
    status: wireIdentifier(bucket.status),
    total: decimalString(bucket.total),
    count: nonNegativeInteger(bucket.count),
  };
}

function readProvisioningRow(value: unknown): ProvisioningReportRow {
  const row = requiredRecord(value);
  return {
    id: boundedString(row.id, 200),
    name: boundedString(row.name, 500),
    status: wireIdentifier(row.status),
    createdAt: isoTimestamp(row.createdAt),
  };
}

function requiredRecord(value: unknown): Record<string, unknown> {
  const result = optionalRecord(value);
  if (!result) invalid();
  return result;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string") invalid();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) invalid();
  return trimmed;
}

function nullableString(value: unknown, maximum: number): string | null {
  return value === null ? null : boundedString(value, maximum);
}

function wireIdentifier(value: unknown): string {
  const result = boundedString(value, 100);
  if (!WIRE_IDENTIFIER.test(result)) invalid();
  return result;
}

function nullableWireIdentifier(value: unknown): string | null {
  return value === null ? null : wireIdentifier(value);
}

function decimalString(value: unknown): string {
  const result = boundedString(value, 200);
  if (!DECIMAL.test(result)) invalid();
  return result;
}

function isoTimestamp(value: unknown): string {
  const result = boundedString(value, 100);
  if (Number.isNaN(Date.parse(result))) invalid();
  return result;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  return value;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalid();
  }
  return value;
}

function positiveInteger(value: unknown): number {
  const result = nonNegativeInteger(value);
  if (result < 1) invalid();
  return result;
}

function nullableNonNegativeInteger(value: unknown): number | null {
  return value === null ? null : nonNegativeInteger(value);
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function invalid(): never {
  throw new Error("INVALID_ADMIN_REPORT_RESPONSE");
}
