import type { TradePath } from "@/lib/api/envelope";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { buildSerialSelection } from "./serial-input";
import { INVENTORY_CODE_PATTERN, isDecimalString, isMemberOf, record } from "../../trade-advanced-validation";
import {
  INVENTORY_DELIVERIES_PATH,
  INVENTORY_RECEIPTS_PATH,
  INVENTORY_RESERVATIONS_PATH,
  invalidResponse,
} from "../inventory-contract";

// Inventory movements — opening balances, reservations, receipts, deliveries.
//
// **These eight routes have no GET.** There is no list, no detail and no
// search for any movement (Q37): they can be created, posted and reversed, and
// then only their effect on availability is observable. MASTER-PLAN 12.27 asks
// for receipt and delivery detail pages; the API has no route behind them, so
// this screen states that rather than linking to a page that cannot load.
//
// Every body carries a caller-supplied UUID v7 **inside** it —
// `operationKey` on movements, `intentKey` on reservations — in addition to
// the `x-idempotency-key` header. That key is the movement's business
// identity, so a retry of the same intent must reuse it; a fresh one would
// book the movement twice.

export const MOVEMENT_LINES_MAX = 500;

export type MovementKind = "openingBalance" | "reservation" | "receipt" | "delivery";

export function reservationReleasePath(id: string): TradePath {
  if (!isUUIDv7(id)) throw new Error("INVENTORY_FORM_UOM");
  return `${INVENTORY_RESERVATIONS_PATH}/${encodeURIComponent(id)}/release` as TradePath;
}

export function receiptActionPath(id: string, action: "post" | "reverse"): TradePath {
  if (!isUUIDv7(id)) throw new Error("INVENTORY_FORM_UOM");
  return `${INVENTORY_RECEIPTS_PATH}/${encodeURIComponent(id)}/${action}` as TradePath;
}

export function deliveryActionPath(id: string, action: "post" | "reverse"): TradePath {
  if (!isUUIDv7(id)) throw new Error("INVENTORY_FORM_UOM");
  return `${INVENTORY_DELIVERIES_PATH}/${encodeURIComponent(id)}/${action}` as TradePath;
}

export interface OpeningBalanceFormValues {
  nodeId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  itemProfileVersion: string;
  businessEffectiveAt: string;
  lotKey?: string;
  serialKeys?: string;
  expiresAt?: string;
}

export const EMPTY_OPENING_BALANCE_FORM: OpeningBalanceFormValues = {
  nodeId: "",
  itemId: "",
  uomId: "",
  quantity: "",
  itemProfileVersion: "1",
  businessEffectiveAt: "",
  lotKey: "",
  serialKeys: "",
  expiresAt: "",
};

export interface ReservationFormValues {
  nodeId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  sourceDocumentId: string;
  sourceLineId: string;
  sourceDocumentVersion: string;
  sourceLineVersion: string;
  expiresAt?: string;
  lotKey?: string;
  serialKeys?: string;
}

export const EMPTY_RESERVATION_FORM: ReservationFormValues = {
  nodeId: "",
  itemId: "",
  uomId: "",
  quantity: "",
  sourceDocumentId: "",
  sourceLineId: "",
  sourceDocumentVersion: "1",
  sourceLineVersion: "1",
  expiresAt: "",
  lotKey: "",
  serialKeys: "",
};

export interface MovementLineValues {
  sourceLineId: string;
  sourceLineVersion: string;
  uomId: string;
  quantity: string;
  reservationId?: string;
  lotKey?: string;
  serialKeys?: string;
  expiresAt?: string;
}

export const EMPTY_MOVEMENT_LINE: MovementLineValues = {
  sourceLineId: "",
  sourceLineVersion: "1",
  uomId: "",
  quantity: "",
};

export interface MovementFormValues {
  nodeId: string;
  /** `purchaseOrderId` on a receipt, `salesOrderId` on a delivery. */
  sourceDocumentId: string;
  sourceDocumentVersion: string;
  businessEffectiveAt: string;
  lines: MovementLineValues[];
}

export const EMPTY_MOVEMENT_FORM: MovementFormValues = {
  nodeId: "",
  sourceDocumentId: "",
  sourceDocumentVersion: "1",
  businessEffectiveAt: "",
  lines: [EMPTY_MOVEMENT_LINE],
};

export interface SessionMovementEntry {
  id: string;
  kind: MovementKind;
  status: "DRAFT" | "POSTED" | "PARTIALLY_REVERSED" | "REVERSED" | ReservationStatus;
  nodeId: string;
  summary: string;
  version: number;
  recordedAt: string;
  reservation?: ReservationSnapshot;
  lines?: MovementLineSnapshot[];
}

export interface MovementLineSnapshot {
  id: string;
  quantity: string;
  serialKeys: string[];
}

export interface ReversalLineValues {
  lineId: string;
  quantity: string;
  serialKeys: string;
}

export function parseMovementLines(payload: unknown): MovementLineSnapshot[] {
  const row = record(payload);
  if (!row || !Array.isArray(row.lines)) invalidResponse();
  return row.lines.map((value: unknown) => {
    const line = record(value);
    const tracking = record(line?.tracking);
    if (!line || !isUUIDv7(line.id) || !isDecimalString(line.quantity) || !tracking) invalidResponse();
    const keys = tracking.serialKeys ?? [];
    if (!Array.isArray(keys) || keys.some((key: unknown) => typeof key !== "string" ||
      !key || key.length > 120 || key !== key.trim() || key === "none") ||
      new Set(keys).size !== keys.length) invalidResponse();
    return { id: line.id, quantity: line.quantity, serialKeys: keys as string[] };
  });
}

export function parseMovementStatus(payload: unknown): "DRAFT" | "POSTED" | "PARTIALLY_REVERSED" | "REVERSED" {
  const row = record(payload);
  if (!row || !isMemberOf(row.status, ["DRAFT", "POSTED", "PARTIALLY_REVERSED", "REVERSED"] as const)) invalidResponse();
  return row.status;
}

// inventory.service.ts: reservationStatus() and reserve()'s BACKORDER outcome.
const RESERVATION_STATUSES = [
  "ACTIVE", "PARTIALLY_RELEASED", "PARTIALLY_CONSUMED", "RELEASED",
  "CONSUMED", "CLOSED", "BACKORDERED",
] as const;
type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface ReservationSnapshot {
  id: string;
  fulfillmentNodeId: string;
  status: ReservationStatus;
  version: number;
  quantity: string;
  releasedQuantity: string;
  consumedQuantity: string;
  remainingQuantity: string;
}

/** The entity response has no remainingQuantity; match reservationRemaining exactly. */
export function parseReservation(payload: unknown, expectedId?: string): ReservationSnapshot {
  const row = record(payload);
  if (
    !row || !isUUIDv7(row.id) || !isUUIDv7(row.fulfillmentNodeId) ||
    (expectedId !== undefined && row.id !== expectedId) ||
    !isMemberOf(row.status, RESERVATION_STATUSES) ||
    typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1
  ) invalidResponse();

  const parseQuantity = (value: unknown): string => {
    if (!isDecimalString(value) || value.startsWith("-") || value.length > 25) invalidResponse();
    return value;
  };
  const quantity = parseQuantity(row.quantity);
  const releasedQuantity = parseQuantity(row.releasedQuantity);
  const consumedQuantity = parseQuantity(row.consumedQuantity);
  // numeric(24,8): integer arithmetic preserves quantities beyond Number's precision.
  const scaled = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(`${whole}${fraction.padEnd(8, "0")}`);
  };
  const remaining = scaled(quantity) - scaled(releasedQuantity) - scaled(consumedQuantity);
  if (remaining < BigInt(0)) invalidResponse();
  const digits = remaining.toString().padStart(9, "0");
  const remainingQuantity = `${digits.slice(0, -8)}.${digits.slice(-8)}`;
  return {
    id: row.id, fulfillmentNodeId: row.fulfillmentNodeId, status: row.status, version: row.version,
    quantity, releasedQuantity, consumedQuantity, remainingQuantity,
  };
}

export const RELEASE_REASON_PRESETS = [
  "CUSTOMER_CANCELLED",
  "CUSTOMER_QTY_REDUCTION",
  "ORDER_EXPIRED",
  "ALLOCATION_REBALANCE",
] as const;

export const REVERSAL_REASON_PRESETS = [
  "DAMAGED_SHIPMENT_RETURN",
  "WRONG_ITEM_DISPATCHED",
  "DATA_ENTRY_CORRECTION",
  "QUALITY_HOLD_REJECTED",
] as const;

function requireUuid(value: string, reason: string): string {
  const trimmed = value.trim();
  if (!isUUIDv7(trimmed)) throw new Error(reason);
  return trimmed;
}

/** `POSITIVE_DECIMAL` on every movement quantity — zero and negatives are 400s. */
function requirePositiveDecimal(value: string): string {
  const trimmed = value.trim();
  if (!isDecimalString(trimmed) || Number(trimmed) <= 0) {
    throw new Error("INVENTORY_FORM_QUANTITY");
  }
  return trimmed;
}

function requireVersion(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("INVENTORY_FORM_LINES");
  return parsed;
}

/** `@IsISO8601({ strict: true })` — a `datetime-local` value is not one. */
function requireIsoInstant(value: string): string {
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (trimmed.length === 0 || Number.isNaN(parsed.getTime())) throw new Error("INVENTORY_FORM_DATE");
  return parsed.toISOString();
}

function buildOptionalTracking(
  quantity: string,
  lotKey?: string,
  serialKeys?: string,
  expiresAt?: string,
): Record<string, unknown> | undefined {
  const lot = lotKey?.trim() ?? "";
  const serials = buildSerialSelection(serialKeys ?? "", quantity);
  const exp = expiresAt?.trim() || undefined;
  if (exp && (!/^\d{4}-\d{2}-\d{2}$/.test(exp) ||
    Number.isNaN(Date.parse(exp)) || new Date(exp).toISOString().slice(0, 10) !== exp)) {
    throw new Error("INVENTORY_FORM_DATE");
  }
  if (lot.length > 120) {
    throw new Error("INVENTORY_FORM_TRACKING");
  }
  if (!lot && !serials && !exp) return undefined;
  const tracking: Record<string, unknown> = {};
  if (lot) tracking.lotKey = lot;
  if (serials) tracking.serialKeys = serials;
  if (exp) tracking.expiryDate = exp;
  return tracking;
}

export function buildOpeningBalanceRequest(values: OpeningBalanceFormValues) {
  const tracking = buildOptionalTracking(values.quantity, values.lotKey, values.serialKeys, values.expiresAt);
  return {
    nodeId: requireUuid(values.nodeId, "INVENTORY_FORM_NODE"),
    itemId: requireUuid(values.itemId, "INVENTORY_FORM_ITEM"),
    uomId: requireUuid(values.uomId, "INVENTORY_FORM_UOM"),
    quantity: requirePositiveDecimal(values.quantity),
    itemProfileVersion: requireVersion(values.itemProfileVersion),
    businessEffectiveAt: requireIsoInstant(values.businessEffectiveAt),
    operationKey: generateUUIDv7(),
    ...(tracking ? { tracking } : {}),
  };
}

export function buildReservationRequest(values: ReservationFormValues) {
  const tracking = buildOptionalTracking(values.quantity, values.lotKey, values.serialKeys);
  const expiresAt = values.expiresAt?.trim()
    ? requireIsoInstant(values.expiresAt)
    : undefined;
  return {
    nodeId: requireUuid(values.nodeId, "INVENTORY_FORM_NODE"),
    itemId: requireUuid(values.itemId, "INVENTORY_FORM_ITEM"),
    uomId: requireUuid(values.uomId, "INVENTORY_FORM_UOM"),
    quantity: requirePositiveDecimal(values.quantity),
    sourceDocumentId: requireUuid(values.sourceDocumentId, "INVENTORY_FORM_LINES"),
    sourceLineId: requireUuid(values.sourceLineId, "INVENTORY_FORM_LINES"),
    sourceDocumentVersion: requireVersion(values.sourceDocumentVersion),
    sourceLineVersion: requireVersion(values.sourceLineVersion),
    intentKey: generateUUIDv7(),
    ...(expiresAt ? { expiresAt } : {}),
    ...(tracking ? { tracking } : {}),
  };
}

/** Omitted quantity uses the selected serial count, or all remaining stock without a selection. */
export function buildReleaseRequest(quantity: string, reasonCode: string, serialKeys = "") {
  const request: { quantity?: string; reasonCode?: string; serialKeys?: string[] } = {};
  const trimmedQuantity = quantity.trim();
  if (trimmedQuantity.length > 0) request.quantity = requirePositiveDecimal(trimmedQuantity);
  const selection = buildSerialSelection(serialKeys, request.quantity);
  if (selection) request.serialKeys = selection;
  const trimmedReason = reasonCode.trim().toUpperCase();
  if (trimmedReason.length > 0) {
    if (!INVENTORY_CODE_PATTERN.test(trimmedReason)) throw new Error("INVENTORY_FORM_REASON");
    request.reasonCode = trimmedReason;
  }
  return request;
}

function buildLines(
  values: MovementFormValues,
  lineIdKey: "purchaseOrderLineId" | "salesOrderLineId",
) {
  if (values.lines.length < 1 || values.lines.length > MOVEMENT_LINES_MAX) {
    throw new Error("INVENTORY_FORM_LINES");
  }
  return values.lines.map((line) => {
    const tracking = buildOptionalTracking(line.quantity, line.lotKey, line.serialKeys, line.expiresAt);
    const reservationId =
      lineIdKey === "salesOrderLineId" && line.reservationId?.trim()
        ? requireUuid(line.reservationId, "INVENTORY_FORM_LINES")
        : undefined;
    return {
      [lineIdKey]: requireUuid(line.sourceLineId, "INVENTORY_FORM_LINES"),
      sourceLineVersion: requireVersion(line.sourceLineVersion),
      uomId: requireUuid(line.uomId, "INVENTORY_FORM_UOM"),
      quantity: requirePositiveDecimal(line.quantity),
      ...(reservationId ? { reservationId } : {}),
      ...(tracking ? { tracking } : {}),
    };
  });
}

export function buildReceiptRequest(values: MovementFormValues) {
  return {
    nodeId: requireUuid(values.nodeId, "INVENTORY_FORM_NODE"),
    purchaseOrderId: requireUuid(values.sourceDocumentId, "INVENTORY_FORM_LINES"),
    operationKey: generateUUIDv7(),
    sourceDocumentVersion: requireVersion(values.sourceDocumentVersion),
    businessEffectiveAt: requireIsoInstant(values.businessEffectiveAt),
    lines: buildLines(values, "purchaseOrderLineId"),
  };
}

export function buildDeliveryRequest(values: MovementFormValues) {
  return {
    nodeId: requireUuid(values.nodeId, "INVENTORY_FORM_NODE"),
    salesOrderId: requireUuid(values.sourceDocumentId, "INVENTORY_FORM_LINES"),
    operationKey: generateUUIDv7(),
    sourceDocumentVersion: requireVersion(values.sourceDocumentVersion),
    businessEffectiveAt: requireIsoInstant(values.businessEffectiveAt),
    lines: buildLines(values, "salesOrderLineId"),
  };
}

/** `ReverseMovementDto` — both fields required; `lines` omitted reverses in full. */
export function buildReversalRequest(reasonCode: string, businessEffectiveAt: string, lines: ReversalLineValues[] = []) {
  const reason = reasonCode.trim().toUpperCase();
  if (!INVENTORY_CODE_PATTERN.test(reason)) throw new Error("INVENTORY_FORM_REASON");
  if (lines.length > MOVEMENT_LINES_MAX || new Set(lines.map((line) => line.lineId.trim())).size !== lines.length) {
    throw new Error("INVENTORY_FORM_LINES");
  }
  return {
    reasonCode: reason,
    businessEffectiveAt: requireIsoInstant(businessEffectiveAt),
    ...(lines.length ? { lines: lines.map((line) => {
      const quantity = requirePositiveDecimal(line.quantity);
      const serialKeys = buildSerialSelection(line.serialKeys, quantity);
      return { lineId: requireUuid(line.lineId, "INVENTORY_FORM_LINES"), quantity,
        ...(serialKeys ? { serialKeys } : {}) };
    }) } : {}),
  };
}

/**
 * The id of a movement the server just created.
 *
 * A create answers with the record, and its id is the ONLY way to reach the
 * post and reverse routes — there is no lookup. Losing it means the movement
 * can no longer be acted on from the portal.
 */
export function parseMovementId(payload: unknown): string {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const id = row?.id;
  if (!isUUIDv7(id)) invalidResponse();
  return id;
}
