import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_V1,
  isTradeDate,
  isTradeDecimal,
  isTradeStatus,
  jsonObject,
  nullableJsonObject,
  nullableString,
  optionalUuid,
  parseTradeDocumentHeader,
  record,
  tradeInvalidResponse,
  type TradeDocumentHeader,
} from "../documents/trade-document-contract";

// Purchase orders — 12 routes, feature gate `trade.purchasing`, every route
// targeting `BRANCH`. Verified against purchasing.controller.ts,
// purchasing.service.ts and dto/purchasing.dto.ts.

export const PURCHASE_ORDERS_PATH = `${TRADE_V1}/purchase-orders`;

export const PURCHASE_ORDER_PERMISSIONS = {
  read: "trade.purchase_orders.read",
  create: "trade.purchase_orders.create",
  update: "trade.purchase_orders.update",
  // **Submit and withdraw share one grant; approve and reject share another.**
  // The ladder is two grants wide, not six.
  submit: "trade.purchase_orders.submit",
  approve: "trade.purchase_orders.approve",
  confirm: "trade.purchase_orders.confirm",
  cancel: "trade.purchase_orders.cancel",
} as const;

/**
 * A purchase order carries **three** persisted axes, not the two the contract
 * page lists: `lifecycle_status`, `approval_status` and `dispatch_status`,
 * which defaults to `NOT_REQUESTED` on `TradePurchaseOrderEntity`.
 *
 * PurchasingService records REQUESTED with a durable intent. Worker evidence
 * advances it to SENT or FAILED independently of commercial confirmation.
 */
export interface PurchaseOrder extends TradeDocumentHeader {
  approvalReady: boolean;
  dispatchStatus: string;
  supplierAccountId: string | null;
  receivingNodeId: string | null;
  totalsSnapshot: Record<string, unknown> | null;
}

interface PurchaseOrderLine {
  id: string;
  clientLineId: string;
  uomId: string;
  descriptionSnapshot: string | null;
  receiptDescriptionSnapshot: string | null;
  orderedQuantity: string;
  unitPrice: string;
  lineTotal: string;
  taxSnapshot: Record<string, unknown> | null;
  expectedDate: string | null;
  printLineNumber: number | null;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  lines: PurchaseOrderLine[];
  delivery?: {
    status: "PDF_REQUESTED" | "EMAIL_REQUESTED" | "COMPLETED" | "FAILED";
    attemptCount: number;
    lastErrorCode: string | null;
  } | null;
}

/** The six ladder steps, in the order `PurchasingService` allows them. */
export type PurchaseOrderAction =
  | "submit"
  | "withdraw"
  | "approve"
  | "reject"
  | "confirm"
  | "cancel";

/**
 * Which actions the current actor may attempt, from the order's own state.
 *
 * The maker–checker rule is not advisory decoration: `withdraw` requires
 * `order.createdBy === actor`, and `approve` and `reject` require
 * `order.createdBy !== actor`. Both are 409s
 * (`APPROVAL_INVALID` / `APPROVAL_MAKER_CHECKER_REQUIRED`), so offering the
 * control to the wrong person guarantees a refusal they cannot act on.
 */
export function purchaseOrderLadder(
  order: PurchaseOrder,
  actorUserId: string | null,
  canWrite: (permission: string) => boolean,
): Record<PurchaseOrderAction, boolean> {
  const isMaker = actorUserId !== null && order.createdBy === actorUserId;
  const isDraft = order.lifecycleStatus === "DRAFT";
  const isPending = order.approvalStatus === "PENDING";
  return {
    submit:
      isDraft && order.approvalStatus === "NOT_REQUIRED" && canWrite(PURCHASE_ORDER_PERMISSIONS.submit),
    withdraw: isPending && isMaker && canWrite(PURCHASE_ORDER_PERMISSIONS.submit),
    approve: isPending && !isMaker && canWrite(PURCHASE_ORDER_PERMISSIONS.approve),
    reject: isPending && !isMaker && canWrite(PURCHASE_ORDER_PERMISSIONS.approve),
    confirm:
      isDraft &&
      order.approvalReady &&
      ["APPROVED", "NOT_REQUIRED"].includes(order.approvalStatus) &&
      canWrite(PURCHASE_ORDER_PERMISSIONS.confirm),
    cancel:
      order.lifecycleStatus !== "CANCELLED" && canWrite(PURCHASE_ORDER_PERMISSIONS.cancel),
  };
}

/**
 * The two actions the service refuses without a `reasonCode`.
 *
 * `PurchaseActionDto` marks both fields optional, and `cancel` **and** `reject`
 * then require one at the service — each as a 409, not a validation error. The
 * contract page names only `cancel`.
 */
export const PURCHASE_ORDER_REASON_REQUIRED: readonly PurchaseOrderAction[] = ["reject", "cancel"];

export function parsePurchaseOrder(payload: unknown): PurchaseOrder {
  const header = parseTradeDocumentHeader(payload);
  const row = record(payload);
  if (!row || !isTradeStatus(row.dispatchStatus)) tradeInvalidResponse();
  if (row.approvalReady !== undefined && typeof row.approvalReady !== "boolean") {
    tradeInvalidResponse();
  }
  return {
    ...header,
    approvalReady: row.approvalReady === true,
    dispatchStatus: row.dispatchStatus,
    supplierAccountId: optionalUuid(row.supplierAccountId),
    receivingNodeId: optionalUuid(row.receivingNodeId),
    totalsSnapshot: record(row.totalsSnapshot),
  };
}

export function parsePurchaseOrderDetail(payload: unknown): PurchaseOrderDetail {
  const order = parsePurchaseOrder(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.lines)) tradeInvalidResponse();
  const delivery = record(row.delivery);
  if (row.delivery != null && (
    !delivery || typeof delivery.status !== "string" ||
    !["PDF_REQUESTED", "EMAIL_REQUESTED", "COMPLETED", "FAILED"].includes(delivery.status) ||
    !Number.isSafeInteger(delivery.attemptCount) || Number(delivery.attemptCount) < 0 ||
    (delivery.lastErrorCode !== null && typeof delivery.lastErrorCode !== "string")
  )) tradeInvalidResponse();
  return {
    ...order, lines: row.lines.map(parsePurchaseOrderLine),
    delivery: delivery ? {
      status: delivery.status as "PDF_REQUESTED" | "EMAIL_REQUESTED" | "COMPLETED" | "FAILED",
      attemptCount: Number(delivery.attemptCount),
      lastErrorCode: delivery.lastErrorCode as string | null,
    } : null,
  };
}

function parsePurchaseOrderLine(payload: unknown): PurchaseOrderLine {
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
    descriptionSnapshot: nullableString(line.descriptionSnapshot, 500),
    receiptDescriptionSnapshot: nullableString(line.receiptDescriptionSnapshot, 500),
    orderedQuantity: line.orderedQuantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    taxSnapshot: nullableJsonObject(line.taxSnapshot),
    expectedDate:
      line.expectedDate == null
        ? null
        : isTradeDate(line.expectedDate)
          ? line.expectedDate
          : tradeInvalidResponse(),
    printLineNumber: typeof line.printLineNumber === "number" ? line.printLineNumber : null,
  };
}

export function purchaseOrderTotals(order: PurchaseOrder): Record<string, unknown> {
  return jsonObject(order.totalsSnapshot);
}

export interface CreatePurchaseOrderLinePayload {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  expectedDate?: string;
  receivingNodeId?: string;
  financial: {
    discountTotal: string;
    chargeTotal: string;
    taxTotal: string;
    lineTotal: string;
    taxSnapshot: Record<string, unknown>;
  };
}

export interface CreatePurchaseOrderRequest {
  supplierPartyId: string;
  supplierAccountId: string;
  currencyCode: string;
  receivingNodeId: string;
  draftReference?: string;
  lines: CreatePurchaseOrderLinePayload[];
  totals: {
    subtotal: string;
    discountTotal: string;
    chargeTotal: string;
    taxTotal: string;
    roundingTotal: string;
    grandTotal: string;
    amountPaid: string;
    amountDue: string;
  };
  terms: Record<string, unknown>;
}

export function buildCreatePurchaseOrder(input: {
  supplierPartyId: string;
  supplierAccountId: string;
  currencyCode: string;
  receivingNodeId: string;
  draftReference?: string;
  lines: CreatePurchaseOrderLinePayload[];
  totals: CreatePurchaseOrderRequest["totals"];
  terms?: Record<string, unknown>;
}): CreatePurchaseOrderRequest {
  const code = input.currencyCode.trim().toUpperCase();
  if (
    !isUUIDv7(input.supplierPartyId.trim()) ||
    !isUUIDv7(input.supplierAccountId.trim())
  ) {
    throw new Error("PURCHASE_ORDER_FORM_SUPPLIER");
  }
  if (!isUUIDv7(input.receivingNodeId.trim())) {
    throw new Error("PURCHASE_ORDER_FORM_RECEIVING_NODE");
  }
  if (!/^[A-Z]{3}$/u.test(code)) {
    throw new Error("PURCHASE_ORDER_FORM_CURRENCY");
  }
  const ref = input.draftReference?.trim() ?? "";
  return {
    supplierPartyId: input.supplierPartyId.trim(),
    supplierAccountId: input.supplierAccountId.trim(),
    currencyCode: code,
    receivingNodeId: input.receivingNodeId.trim(),
    ...(ref ? { draftReference: ref.slice(0, 80) } : {}),
    lines: input.lines,
    totals: input.totals,
    terms:
      input.terms && Object.keys(input.terms).length > 0
        ? input.terms
        : { paymentTermsCode: "NET_30", incoterm: "DDP" },
  };
}

