import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { isDecimalString, isMemberOf, record } from "../../trade-advanced-validation";
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

interface MovementDisplayContext {
  sourceLabel?: string;
  nodeLabel?: string;
  itemLabel?: string;
  unitLabel?: string;
  lineLabels?: string[];
}

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
  display?: MovementDisplayContext;
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
  display?: MovementDisplayContext;
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
  display?: MovementDisplayContext;
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
  scopeKey?: string;
  id: string;
  kind: MovementKind;
  status: "DRAFT" | "POSTED" | "PARTIALLY_REVERSED" | "REVERSED" | ReservationStatus;
  nodeId: string;
  summary: string;
  version: number;
  recordedAt: string;
  reservation?: ReservationSnapshot;
  lines?: MovementLineSnapshot[];
  display?: MovementDisplayContext;
  requestedQuantity?: string;
  sourceDocumentId?: string;
  sourceLineId?: string;
  serialKeys?: string[];
  /** Client session metadata: a related write invalidated this returned handle. */
  stale?: boolean;
  reservationIds?: string[];
  businessEffectiveAt?: string;
}

export interface MovementLineSnapshot {
  id: string;
  quantity: string;
  serialKeys: string[];
  reversedQuantity?: string;
  uomId?: string;
  normalizedUomId?: string;
  normalizedQuantity?: string;
  normalizedReversedQuantity?: string;
  descriptionSnapshot?: string | null;
  lotKey?: string;
  expiryDate?: string;
  reservationId?: string | null;
}

export interface ReversalLineValues {
  lineId: string;
  quantity: string;
  serialKeys: string;
}

/** Exact display calculation over the immutable original and returned reversed quantities. */
export function movementRemainingQuantity(quantity: string, reversedQuantity: string): string {
  const scaled = (value: string) => {
    if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(value)) invalidResponse();
    const [whole, fraction = ""] = value.split(".");
    return BigInt(`${whole}${fraction.padEnd(8, "0")}`);
  };
  const remaining = scaled(quantity) - scaled(reversedQuantity);
  if (remaining < BigInt(0)) invalidResponse();
  const digits = remaining.toString().padStart(9, "0");
  return `${digits.slice(0, -8)}.${digits.slice(-8)}`;
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
    if (line.reversedQuantity !== undefined && !isDecimalString(line.reversedQuantity)) invalidResponse();
    for (const key of ["uomId", "normalizedUomId"] as const) {
      if (line[key] !== undefined && !isUUIDv7(line[key])) invalidResponse();
    }
    if (line.normalizedQuantity !== undefined && !isDecimalString(line.normalizedQuantity)) invalidResponse();
    if (line.normalizedReversedQuantity !== undefined && !isDecimalString(line.normalizedReversedQuantity)) invalidResponse();
    if (line.descriptionSnapshot != null && (typeof line.descriptionSnapshot !== "string" || !line.descriptionSnapshot.trim())) invalidResponse();
    if (line.reservationId != null && !isUUIDv7(line.reservationId)) invalidResponse();
    if (tracking.lotKey !== undefined && (typeof tracking.lotKey !== "string" || !tracking.lotKey.trim() || tracking.lotKey.length > 120)) invalidResponse();
    if (tracking.expiryDate !== undefined && (typeof tracking.expiryDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tracking.expiryDate) || Number.isNaN(Date.parse(tracking.expiryDate)) ||
      new Date(tracking.expiryDate).toISOString().slice(0, 10) !== tracking.expiryDate)) invalidResponse();
    return { id: line.id, quantity: line.quantity, serialKeys: keys as string[],
      ...(line.reversedQuantity !== undefined ? { reversedQuantity: line.reversedQuantity as string } : {}),
      ...(line.uomId !== undefined ? { uomId: line.uomId as string } : {}),
      ...(line.normalizedUomId !== undefined ? { normalizedUomId: line.normalizedUomId as string } : {}),
      ...(line.normalizedQuantity !== undefined ? { normalizedQuantity: line.normalizedQuantity as string } : {}),
      ...(line.normalizedReversedQuantity !== undefined ? { normalizedReversedQuantity: line.normalizedReversedQuantity as string } : {}),
      ...(line.descriptionSnapshot !== undefined ? { descriptionSnapshot: line.descriptionSnapshot as string | null } : {}),
      ...(tracking.lotKey !== undefined ? { lotKey: tracking.lotKey as string } : {}),
      ...(tracking.expiryDate !== undefined ? { expiryDate: tracking.expiryDate as string } : {}),
      ...(line.reservationId !== undefined ? { reservationId: line.reservationId as string | null } : {}) };
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
  requestedQuantity?: string;
  backorderedQuantity?: string;
  outcome?: "FULL" | "PARTIAL" | "BACKORDER";
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
    ...(row.requestedQuantity !== undefined ? { requestedQuantity: parseQuantity(row.requestedQuantity) } : {}),
    ...(row.backorderedQuantity !== undefined ? { backorderedQuantity: parseQuantity(row.backorderedQuantity) } : {}),
    ...(isMemberOf(row.outcome, ["FULL", "PARTIAL", "BACKORDER"] as const) ? { outcome: row.outcome } : {}),
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
