import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_V1,
  isTradeDate,
  isTradeDecimal,
  isTradeStatus,
  jsonObject,
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
 * `dispatch_status` has no exported enum, no check constraint and no writer in
 * `trade-app/src` — only the column default is proven — so it is carried here
 * and rendered as an unknown-tolerant value rather than mapped.
 */
export interface PurchaseOrder extends TradeDocumentHeader {
  dispatchStatus: string;
  supplierAccountId: string | null;
  receivingNodeId: string | null;
  totalsSnapshot: Record<string, unknown> | null;
}

interface PurchaseOrderLine {
  id: string;
  clientLineId: string;
  uomId: string;
  orderedQuantity: string;
  unitPrice: string;
  lineTotal: string;
  expectedDate: string | null;
  printLineNumber: number | null;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  lines: PurchaseOrderLine[];
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
  return {
    ...header,
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
  return { ...order, lines: row.lines.map(parsePurchaseOrderLine) };
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
    orderedQuantity: line.orderedQuantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
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
