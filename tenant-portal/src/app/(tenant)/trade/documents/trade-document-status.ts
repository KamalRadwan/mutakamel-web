// The status vocabulary of the six commercial-document families, and the tone
// each value takes.
//
// Provenance differs per family and the difference matters:
//
//   PINNED BY THE DATABASE — a check constraint enumerates the set, so it is
//   closed and a value outside it cannot be stored.
//     purchase quotation  ck_trade_purchase_quotations_final   DRAFT · ISSUED
//     invoice             ck_trade_sales_invoices_final        DRAFT · ISSUED
//     contract            ck_trade_contracts_final             DRAFT · ACTIVE · SIGNED
//     approval step       ck_trade_approval_steps_status       six values
//
//   PROVEN FROM SERVICE LITERALS ONLY — `varchar(24)` with no enum, no @IsIn
//   and no constraint. The sets below are every literal assigned or compared
//   in documents.service.ts / purchasing.service.ts. They are exhaustive with
//   respect to the code, not guaranteed by a schema, so an unknown value is
//   rendered rather than swallowed.
//     quotation lifecycle · quotation revision status · sales-order lifecycle
//     · purchase-order lifecycle · hold
//
//   EXPORTED ENUMS in @mutakamel/trade-app-common.
//     ConfirmationOrchestrationStatus · FulfillmentStatus · BillingStatus ·
//     ApprovalStatus · DocumentLifecycleStatus
//
// A tone is an OUTCOME, never a category. DRAFT and SENT are positions in a
// process and take no hue; ACCEPTED and REJECTED are outcomes and do.
// docs/design/tokens.md#non-outcome-values--never-a-hue.

type TradeStatusRole = "positive" | "negative" | "caution" | "pending";

export type TradeStatusKind =
  | "TradeQuotationStatus"
  | "TradeQuotationRevisionStatus"
  | "TradeSalesOrderStatus"
  | "TradeConfirmationStatus"
  | "TradeHoldStatus"
  | "TradeFulfillmentStatus"
  | "TradeBillingStatus"
  | "TradePurchaseOrderStatus"
  | "TradeApprovalStatus"
  | "TradePurchaseQuotationStatus"
  | "TradeInvoiceStatus"
  | "TradeContractStatus"
  | "TradeRenderJobStatus";

const STATUS_ROLES: Record<TradeStatusKind, Record<string, TradeStatusRole | null>> = {
  // documents.service.ts `quotationAction` — the five literals it writes.
  TradeQuotationStatus: {
    DRAFT: null,
    SENT: null,
    ACCEPTED: "positive",
    REJECTED: "negative",
    CANCELLED: "negative",
  },
  // The revision carries its own status. `DRAFT` is the literal
  // `createQuotationRevision` assigns and the one `send` requires.
  TradeQuotationRevisionStatus: {
    DRAFT: null,
    SENT: null,
    ACCEPTED: "positive",
    REJECTED: "negative",
    CANCELLED: "negative",
  },
  // `DocumentLifecycleStatus` has four members. CLOSED is exported and never
  // assigned anywhere in trade-app/src; it is listed so a projection that sets
  // it renders a label instead of a raw literal.
  TradeSalesOrderStatus: {
    DRAFT: null,
    CONFIRMED: "positive",
    CANCELLED: "negative",
    CLOSED: null,
  },
  TradeConfirmationStatus: {
    NOT_STARTED: null,
    PENDING: "pending",
    READY_TO_FINALIZE: "pending",
    COMPLETED: "positive",
    REJECTED: "negative",
    FAILED: "negative",
    CANCELLED: "negative",
  },
  TradeHoldStatus: {
    NONE: null,
    HELD: "caution",
  },
  TradeFulfillmentStatus: {
    NOT_APPLICABLE: null,
    UNPLANNED: null,
    PLANNED: null,
    PARTIALLY_FULFILLED: "caution",
    FULFILLED: "positive",
    BLOCKED: "negative",
  },
  TradeBillingStatus: {
    NOT_APPLICABLE: null,
    NOT_BILLED: null,
    PARTIALLY_BILLED: "caution",
    BILLED: "positive",
    CREDIT_PENDING: "caution",
  },
  TradePurchaseOrderStatus: {
    DRAFT: null,
    CONFIRMED: "positive",
    CANCELLED: "negative",
    CLOSED: null,
  },
  // The order row only ever holds the first four. WITHDRAWN and EXPIRED live on
  // the approval instance and step rows, where the check constraint pins all
  // six — `withdraw` resets the ORDER back to NOT_REQUIRED, so a withdrawn
  // order is indistinguishable from one never submitted on the order badge.
  TradeApprovalStatus: {
    NOT_REQUIRED: null,
    PENDING: "pending",
    APPROVED: "positive",
    REJECTED: "negative",
    WITHDRAWN: "caution",
    EXPIRED: "caution",
  },
  TradePurchaseQuotationStatus: {
    DRAFT: null,
    ISSUED: "positive",
  },
  TradeInvoiceStatus: {
    DRAFT: null,
    ISSUED: "positive",
  },
  // SIGNED is allowed by ck_trade_contracts_final and written by nothing in
  // trade-app/src (Q35). Rendered because a row can carry it; never offered.
  TradeContractStatus: {
    DRAFT: null,
    ACTIVE: "positive",
    SIGNED: "positive",
  },
  // QuotationPdfRenderStatus, shared by both PDF job tables.
  TradeRenderJobStatus: {
    PENDING: "pending",
    RETRYING: "pending",
    COMPLETED: "positive",
    FAILED: "negative",
  },
};

export interface TradeStatusResolution {
  known: boolean;
  role: TradeStatusRole | null;
}

/**
 * Resolves a wire value to its tone, and says whether the value was known at
 * all.
 *
 * The distinction is the point: three of these sets are not closed by any
 * schema (Q31), so "known with no tone" and "not in the documented set" are
 * different facts and the badge renders them differently.
 */
export function resolveTradeStatus(kind: TradeStatusKind, value: string): TradeStatusResolution {
  const roles = STATUS_ROLES[kind];
  return Object.hasOwn(roles, value)
    ? { known: true, role: roles[value] }
    : { known: false, role: null };
}

/** The documented values of one axis, for a filter that must not invent options. */
export function tradeStatusValues(kind: TradeStatusKind): string[] {
  return Object.keys(STATUS_ROLES[kind]);
}
