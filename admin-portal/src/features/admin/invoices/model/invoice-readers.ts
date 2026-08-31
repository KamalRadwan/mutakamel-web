import {
  INVOICE_PURPOSES,
  INVOICE_STATUSES,
  INVOICE_TENANT_STATUSES,
  type CoreSnapshot,
  type Invoice,
  type InvoiceLine,
  type InvoicePage,
  type InvoicePurpose,
  type InvoiceStatus,
  type InvoiceTenantSummary,
} from "../types/invoices";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_18_4 = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
const QUANTITY_12_2 =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;
const FX_24_12 = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,12})?$/;
const CURRENCY = /^[A-Z]{3}$/;

export function readInvoicePage(payload: unknown): CoreSnapshot<InvoicePage> {
  const envelope = readEnvelope(payload);
  if (Array.isArray(envelope.data)) {
    const meta = record(envelope.meta);
    if (!meta) invalid();
    return snapshot(envelope, {
      items: envelope.data.map((item) => readInvoice(item, false)),
      page: positiveInteger(meta.page),
      limit: positiveInteger(meta.limit),
      total: nonNegativeInteger(meta.total),
      totalPages: nonNegativeInteger(meta.totalPages),
      hasNext: requiredBoolean(meta.hasNext),
      hasPrev: requiredBoolean(meta.hasPrev),
    });
  }

  // Compatibility for a direct service invocation without the global
  // pagination interceptor. Production Core currently emits the canonical
  // data[] + meta shape above.
  const current = requiredRecord(envelope.data);
  if (!Array.isArray(current.items)) invalid();
  return snapshot(envelope, {
    items: current.items.map((item) => readInvoice(item, false)),
    page: positiveInteger(current.page),
    limit: positiveInteger(current.limit),
    total: nonNegativeInteger(current.total),
    totalPages: nonNegativeInteger(current.totalPages),
    hasNext: requiredBoolean(current.hasNext),
    hasPrev: requiredBoolean(current.hasPrev),
  });
}

export function readInvoiceSnapshot(payload: unknown): CoreSnapshot<Invoice> {
  const envelope = readEnvelope(payload);
  return snapshot(envelope, readInvoice(envelope.data, true));
}

function readInvoice(value: unknown, detail = true): Invoice {
  const row = requiredRecord(value);
  const purpose = oneOf(row.purpose, INVOICE_PURPOSES);
  const status = oneOf(row.status, INVOICE_STATUSES);
  const tenantId = uuidV7(row.tenantId);
  const linesValue = row.lines;
  if (detail && !Array.isArray(linesValue)) invalid();
  if (!detail && linesValue !== undefined && !Array.isArray(linesValue)) invalid();

  return {
    id: uuidV7(row.id),
    subscriptionId: uuidV7(row.subscriptionId),
    tenantId,
    tenant: readInvoiceTenant(row.tenant, tenantId),
    number: boundedString(row.number, 40),
    status: status as InvoiceStatus,
    purpose: purpose as InvoicePurpose,
    currencyCode: currency(row.currencyCode),
    subtotal: money(row.subtotal),
    taxTotal: money(row.taxTotal),
    total: money(row.total),
    settlementCurrencyCode: currency(row.settlementCurrencyCode),
    settlementSubtotalUsd: nullableMoney(row.settlementSubtotalUsd),
    settlementTaxTotalUsd: nullableMoney(row.settlementTaxTotalUsd),
    settlementTotalUsd: nullableMoney(row.settlementTotalUsd),
    amountPaidUsd: money(row.amountPaidUsd),
    fxUnitsPerUsd: nullableFx(row.fxUnitsPerUsd),
    fxRateRevisionId: nullableUuidV7(row.fxRateRevisionId),
    fxObservedAt: nullableTimestamp(row.fxObservedAt),
    settlementLockedAt: nullableTimestamp(row.settlementLockedAt),
    periodStart: nullableTimestamp(row.periodStart),
    periodEnd: nullableTimestamp(row.periodEnd),
    issuedAt: nullableTimestamp(row.issuedAt),
    dueAt: nullableTimestamp(row.dueAt),
    paidAt: nullableTimestamp(row.paidAt),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
    ...(Array.isArray(linesValue)
      ? { lines: linesValue.map(readInvoiceLine) }
      : {}),
  };
}

/**
 * Reads the tenant identity Core attaches to list rows. Absent on single
 * invoice reads and null once the billed tenant is gone, so the caller must
 * keep rendering the tenant UUID as its fallback. A summary whose id does not
 * match the invoice's own tenantId is a mismatched billing recipient, not a
 * cosmetic defect, so it fails the whole response closed.
 */
function readInvoiceTenant(
  value: unknown,
  tenantId: string,
): InvoiceTenantSummary | null {
  if (value === null || value === undefined) return null;
  const row = requiredRecord(value);
  const id = uuidV7(row.id);
  if (id !== tenantId) invalid();
  return {
    id,
    name: boundedString(row.name, 160),
    companyName: boundedString(row.companyName, 160),
    status: oneOf(row.status, INVOICE_TENANT_STATUSES),
  };
}

function readInvoiceLine(value: unknown): InvoiceLine {
  const row = requiredRecord(value);
  const description = boundedString(row.description, 255);
  const descriptionI18n = record(row.descriptionI18n);
  return {
    id: uuidV7(row.id),
    invoiceId: uuidV7(row.invoiceId),
    description,
    descriptionI18n: descriptionI18n
      ? {
          en: boundedString(descriptionI18n.en, 500),
          ar: boundedString(descriptionI18n.ar, 500),
        }
      : { en: description, ar: description },
    quantity: quantity(row.quantity),
    unitPrice: money(row.unitPrice),
    lineTotal: money(row.lineTotal),
  };
}

function readEnvelope(payload: unknown): Record<string, unknown> {
  const envelope = requiredRecord(payload);
  if (envelope.success !== true || !("data" in envelope)) invalid();
  boundedString(envelope.correlationId, 200);
  timestamp(envelope.timestamp);
  return envelope;
}

function snapshot<T>(
  envelope: Record<string, unknown>,
  data: T,
): CoreSnapshot<T> {
  return {
    data,
    correlationId: boundedString(envelope.correlationId, 200),
    responseTimestamp: timestamp(envelope.timestamp),
  };
}

function requiredRecord(value: unknown): Record<string, unknown> {
  const result = record(value);
  if (!result) invalid();
  return result;
}

function record(value: unknown): Record<string, unknown> | null {
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

function uuidV7(value: unknown): string {
  const result = boundedString(value, 36);
  if (!UUID_V7.test(result)) invalid();
  return result.toLowerCase();
}

function nullableUuidV7(value: unknown): string | null {
  return value === null || value === undefined ? null : uuidV7(value);
}

function timestamp(value: unknown): string {
  const result = boundedString(value, 100);
  if (Number.isNaN(Date.parse(result))) invalid();
  return result;
}

function nullableTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : timestamp(value);
}

function currency(value: unknown): string {
  const result = boundedString(value, 3);
  if (!CURRENCY.test(result)) invalid();
  return result;
}

function money(value: unknown): string {
  const result = boundedString(value, 19);
  if (!MONEY_18_4.test(result)) invalid();
  return result;
}

function nullableMoney(value: unknown): string | null {
  return value === null || value === undefined ? null : money(value);
}

function quantity(value: unknown): string {
  const result = boundedString(value, 13);
  if (!QUANTITY_12_2.test(result)) invalid();
  return result;
}

function nullableFx(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = boundedString(value, 25);
  if (!FX_24_12.test(result) || /^0(?:\.0+)?$/.test(result)) invalid();
  return result;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) invalid();
  return value as T;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    invalid();
  }
  return value;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalid();
  }
  return value;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function invalid(): never {
  throw new Error("INVALID_ADMIN_INVOICE_RESPONSE");
}
