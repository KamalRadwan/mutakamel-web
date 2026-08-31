import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_V1,
  isBoundedString,
  isTradeDecimal,
  isTradeStatus,
  isTradeTimestamp,
  isVersion,
  jsonObject,
  optionalUuid,
  parseTradeDocumentHeader,
  record,
  tradeInvalidResponse,
  type TradeDocumentHeader,
} from "../documents/trade-document-contract";

// Sales orders — 12 routes, feature gate `trade.sales`, every route targeting
// `BRANCH`. Verified against documents.controller.ts, documents.service.ts and
// packages/database/src/entities/tenant/document.entities.ts.

export const SALES_ORDERS_PATH = `${TRADE_V1}/sales-orders`;

export const SALES_ORDER_PERMISSIONS = {
  read: "trade.sales_orders.read",
  create: "trade.sales_orders.create",
  update: "trade.sales_orders.update",
  confirm: "trade.sales_orders.confirm",
  // `hold` and `release-hold` share **one** permission. There is no separate
  // release grant: a user who can hold can always release.
  hold: "trade.sales_orders.hold",
  cancel: "trade.sales_orders.cancel",
} as const;

/**
 * A sales order has **four** independent status axes, not one.
 *
 * There is deliberately no fifth. `SettlementStatus` is an exported enum in
 * `@mutakamel/trade-app-common` with **no column anywhere in the schema** and
 * no writer or reader in `trade-app/src` — a settlement badge would be a field
 * this app invented. trade-documents.md lists it alongside `fulfillment_status`
 * and `billing_status`; only those two exist.
 */
export interface SalesOrder extends TradeDocumentHeader {
  confirmationStatus: string;
  holdStatus: string;
  sourceQuotationId: string | null;
  sourceQuotationRevisionId: string | null;
  /** Null on a converted or legacy draft, which can then never be printed. */
  totalsSnapshot: Record<string, unknown> | null;
}

interface SalesOrderLine {
  id: string;
  clientLineId: string;
  uomId: string;
  orderedQuantity: string;
  unitPrice: string;
  lineTotal: string;
  discountTotal: string | null;
  chargeTotal: string | null;
  taxTotal: string | null;
  printLineNumber: number | null;
}

export interface SalesOrderDetail extends SalesOrder {
  lines: SalesOrderLine[];
}

/**
 * `POST /:id/confirm` — **200 or 202**, decided by the handler from the
 * idempotency record rather than by an `@HttpCode`.
 *
 * On a 202 the handler also sets `Retry-After: 2` and a `Location` that is not
 * a Gateway path and cannot be called (Q34). The poll URL is built from
 * `orderId` and `attemptId` in the body instead.
 */
export interface SalesOrderConfirmation {
  statusCode: number;
  orderId: string;
  attemptId: string;
  status: string;
}

/** `TradeSalesOrderConfirmationAttemptEntity`. */
export interface SalesOrderAttempt {
  id: string;
  version: number;
  status: string;
  deadlineAt: string | null;
  lastErrorCode: string | null;
}

export function parseSalesOrder(payload: unknown): SalesOrder {
  const header = parseTradeDocumentHeader(payload);
  const row = record(payload);
  if (!row || !isTradeStatus(row.confirmationStatus) || !isTradeStatus(row.holdStatus)) {
    tradeInvalidResponse();
  }
  return {
    ...header,
    confirmationStatus: row.confirmationStatus,
    holdStatus: row.holdStatus,
    sourceQuotationId: optionalUuid(row.sourceQuotationId),
    sourceQuotationRevisionId: optionalUuid(row.sourceQuotationRevisionId),
    totalsSnapshot: record(row.totalsSnapshot),
  };
}

export function parseSalesOrderDetail(payload: unknown): SalesOrderDetail {
  const order = parseSalesOrder(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.lines)) tradeInvalidResponse();
  return { ...order, lines: row.lines.map(parseSalesOrderLine) };
}

export function parseSalesOrderConfirmation(payload: unknown): SalesOrderConfirmation {
  const result = record(payload);
  if (
    !result ||
    typeof result.statusCode !== "number" ||
    !isUUIDv7(result.orderId) ||
    !isUUIDv7(result.attemptId) ||
    !isBoundedString(result.status, 32)
  ) {
    tradeInvalidResponse();
  }
  return {
    statusCode: result.statusCode,
    orderId: result.orderId,
    attemptId: result.attemptId,
    status: result.status,
  };
}

export function parseSalesOrderAttempt(payload: unknown): SalesOrderAttempt {
  const attempt = record(payload);
  if (
    !attempt ||
    !isUUIDv7(attempt.id) ||
    !isVersion(attempt.version) ||
    !isTradeStatus(attempt.status)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: attempt.id,
    // The attempt carries its **own** version, and
    // `cancelSalesOrderConfirmationAttempt` asserts `If-Match` against it —
    // not against the order. trade-documents.md says the order's; the service
    // reads `attempt.version`.
    version: attempt.version,
    status: attempt.status,
    deadlineAt: attempt.deadlineAt == null ? null : timestamp(attempt.deadlineAt),
    lastErrorCode:
      attempt.lastErrorCode == null || attempt.lastErrorCode === ""
        ? null
        : String(attempt.lastErrorCode).slice(0, 120),
  };
}

function parseSalesOrderLine(payload: unknown): SalesOrderLine {
  const line = record(payload);
  if (
    !line ||
    !isUUIDv7(line.id) ||
    !isUUIDv7(line.clientLineId) ||
    !isUUIDv7(line.uomId) ||
    !isTradeDecimal(line.orderedQuantity) ||
    !isTradeDecimal(line.unitPrice) ||
    !isTradeDecimal(line.lineTotal)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: line.id,
    clientLineId: line.clientLineId,
    uomId: line.uomId,
    orderedQuantity: line.orderedQuantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    // The three evidence columns are nullable on the order line: a converted
    // or legacy draft has none, and null is not zero.
    discountTotal: optionalDecimal(line.discountTotal),
    chargeTotal: optionalDecimal(line.chargeTotal),
    taxTotal: optionalDecimal(line.taxTotal),
    printLineNumber: typeof line.printLineNumber === "number" ? line.printLineNumber : null,
  };
}

function optionalDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isTradeDecimal(value) ? value : tradeInvalidResponse();
}

function timestamp(value: unknown): string {
  return isTradeTimestamp(value) ? value : tradeInvalidResponse();
}

/** Every snapshot key the order carries, for the totals panel. */
export function salesOrderTotals(order: SalesOrder): Record<string, unknown> {
  return jsonObject(order.totalsSnapshot);
}
