import type { Dictionary } from "@/i18n/dictionaries/ar";
import { isUUIDv7 } from "@/lib/uuid";
import type { InventoryReferenceItem } from "../inventory-reference-contract";
import type { MovementFormValues, OpeningBalanceFormValues, ReservationFormValues } from "./movements-contract";
import { buildSerialSelection } from "./serial-input";

export type MovementFieldErrors = Record<string, string | undefined>;
const positiveQuantity = (value: string) => /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(value.trim()) && /[1-9]/.test(value.trim());
const version = (value: string) => Number.isSafeInteger(Number(value)) && Number(value) >= 1;
const expiry = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const instant = (value: string) => expiry(value.trim().slice(0, 10)) && !Number.isNaN(new Date(value.trim()).getTime());

function trackingErrors(values: { quantity: string; lotKey?: string; serialKeys?: string; expiresAt?: string }, item: InventoryReferenceItem | null | undefined, t: Dictionary): MovementFieldErrors {
  const errors: MovementFieldErrors = {};
  const lot = values.lotKey?.trim() ?? "";
  if (item?.trackingMode === "LOT" && (!lot || lot.length > 120)) errors.lotKey = t.tradeInventory.formTrackingInvalid;
  if (item?.trackingMode === "SERIAL") {
    try {
      if (!buildSerialSelection(values.serialKeys ?? "", values.quantity.trim() || undefined)) errors.serialKeys = t.tradeInventory.serialSelectionInvalid;
    } catch { errors.serialKeys = t.tradeInventory.serialSelectionInvalid; }
  }
  if (values.expiresAt?.trim() && !expiry(values.expiresAt.trim())) errors.expiresAt = t.tradeInventory.formDateInvalid;
  return errors;
}

export function openingFormErrors(values: OpeningBalanceFormValues, item: InventoryReferenceItem | null, t: Dictionary): MovementFieldErrors {
  const errors = trackingErrors(values, item, t);
  if (!isUUIDv7(values.nodeId.trim())) errors.nodeId = t.tradeInventory.formNodeInvalid;
  if (!isUUIDv7(values.itemId.trim()) || !item?.trackInventory || !version(values.itemProfileVersion)) errors.itemId = t.tradeInventory.formItemInvalid;
  if (!isUUIDv7(values.uomId.trim())) errors.uomId = t.tradeInventory.formUomInvalid;
  if (!positiveQuantity(values.quantity)) errors.quantity = t.tradeInventory.formQuantityInvalid;
  if (!instant(values.businessEffectiveAt)) errors.businessEffectiveAt = t.tradeInventory.formDateInvalid;
  return errors;
}

export function reservationFormErrors(values: ReservationFormValues, item: InventoryReferenceItem | null, t: Dictionary): MovementFieldErrors {
  const errors = trackingErrors({ ...values, expiresAt: undefined }, item, t);
  if (!isUUIDv7(values.sourceDocumentId.trim()) || !version(values.sourceDocumentVersion)) errors.sourceDocumentId = t.tradeInventory.formLinesInvalid;
  if (!isUUIDv7(values.sourceLineId.trim()) || !version(values.sourceLineVersion)) errors.sourceLineId = t.tradeInventory.formLinesInvalid;
  if (!isUUIDv7(values.nodeId.trim())) errors.nodeId = t.tradeInventory.formNodeInvalid;
  if (!isUUIDv7(values.itemId.trim()) || !item?.trackInventory) errors.itemId = t.tradeInventory.formItemInvalid;
  if (!isUUIDv7(values.uomId.trim())) errors.uomId = t.tradeInventory.formUomInvalid;
  if (!positiveQuantity(values.quantity)) errors.quantity = t.tradeInventory.formQuantityInvalid;
  if (values.expiresAt?.trim() && !instant(values.expiresAt)) errors.expiresAt = t.tradeInventory.formDateInvalid;
  return errors;
}

export function documentFormErrors(values: MovementFormValues, items: Record<string, InventoryReferenceItem>, isDelivery: boolean, t: Dictionary): MovementFieldErrors {
  const errors: MovementFieldErrors = {};
  if (!isUUIDv7(values.sourceDocumentId.trim()) || !version(values.sourceDocumentVersion)) errors.sourceDocumentId = t.tradeInventory.formLinesInvalid;
  if (!isUUIDv7(values.nodeId.trim())) errors.nodeId = t.tradeInventory.formNodeInvalid;
  if (!instant(values.businessEffectiveAt)) errors.businessEffectiveAt = t.tradeInventory.formDateInvalid;
  const serialCount = values.lines.reduce((total, line) => total + (line.serialKeys?.trim() ? line.serialKeys.trim().split(/\r?\n/).length : 0), 0);
  values.lines.forEach((line, index) => {
    const key = `lines.${index}.`;
    const item = items[line.sourceLineId];
    for (const [field, message] of Object.entries(trackingErrors(line, item, t))) errors[key + field] = message;
    if (!isUUIDv7(line.sourceLineId.trim()) || !version(line.sourceLineVersion)
      || values.lines.some((other, position) => position !== index && other.sourceLineId === line.sourceLineId)) errors[key + "sourceLineId"] = t.tradeInventory.formLinesInvalid;
    if (!item?.trackInventory) errors[key + "itemId"] = t.tradeInventory.formItemInvalid;
    if (!isUUIDv7(line.uomId.trim())) errors[key + "uomId"] = t.tradeInventory.formUomInvalid;
    if (!positiveQuantity(line.quantity)) errors[key + "quantity"] = t.tradeInventory.formQuantityInvalid;
    if (serialCount > 1_000) errors[key + "serialKeys"] = t.tradeInventory.serialSelectionInvalid;
    if (isDelivery && (line.reservationId?.trim() ? !isUUIDv7(line.reservationId.trim()) : item?.trackingMode === "SERIAL")) errors[key + "reservationId"] = t.tradeInventory.formLinesInvalid;
  });
  return errors;
}
