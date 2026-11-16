import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { INVENTORY_CODE_PATTERN } from "../../trade-advanced-validation";
import { buildSerialSelection } from "./serial-input";
import { MOVEMENT_LINES_MAX, type OpeningBalanceFormValues, type ReservationFormValues,
  type MovementFormValues, type ReversalLineValues } from "./movements-contract";

function requireUuid(value: string, reason: string): string {
  const trimmed = value.trim();
  if (!isUUIDv7(trimmed)) throw new Error(reason);
  return trimmed;
}

/** `POSITIVE_DECIMAL` on every movement quantity — zero and negatives are 400s. */
function requirePositiveDecimal(value: string): string {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(trimmed) || !/[1-9]/.test(trimmed)) {
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
  const calendarDay = /^\d{4}-\d{2}-\d{2}T/u.test(trimmed) ? trimmed.slice(0, 10) : "";
  const day = new Date(`${calendarDay}T00:00:00.000Z`);
  const parsed = new Date(trimmed);
  if (!calendarDay || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== calendarDay || Number.isNaN(parsed.getTime())) {
    throw new Error("INVENTORY_FORM_DATE");
  }
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
  if (new Set(values.lines.map(line => line.sourceLineId.trim())).size !== values.lines.length ||
    values.lines.reduce((total, line) => total + (line.serialKeys?.trim() ? line.serialKeys.trim().split(/\r?\n/).length : 0), 0) > 1_000) {
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

