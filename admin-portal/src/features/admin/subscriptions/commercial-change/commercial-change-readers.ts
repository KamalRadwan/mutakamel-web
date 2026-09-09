import { acceptedAmountUnits, acceptedMoney, readAcceptedPricing, verifyAcceptedPricing } from "@/shared/api/accepted-pricing";
import { array, boolean, contractFailure, integer, nullable, object, oneOf, positiveRevision, text, uuid, uuid7,
  type Reader } from "@/shared/api/commercial-contract";

export const COMMERCIAL_PREVIEW_RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const signedMoney = text(20, /^-?(?:0|[1-9][0-9]{0,13})\.[0-9]{4}$/u);
const instant: Reader<string> = value => {
  const parsed = text(24, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)(value);
  if (!Number.isFinite(Date.parse(parsed)) || new Date(parsed).toISOString() !== parsed) contractFailure();
  return parsed;
};
const unique = (values: string[]) => { if (new Set(values).size !== values.length) contractFailure(); };
const selectionKind = oneOf(["APPLICATION", "ADDON"]);
const operation = oneOf(["ADD", "CHANGE", "REMOVE"]);
const change = object({ ordinal: integer(1, 100), selectionKey: uuid7, sourceKind: selectionKind, operation,
  applicationId: uuid, itemId: nullable(uuid), addonSelectionId: nullable(uuid), parentItemId: nullable(uuid),
  parentSelectionKey: nullable(uuid7), addonId: nullable(uuid), fromSeats: nullable(integer(1, 100000)), toSeats: nullable(integer(1, 100000)),
  fromTierId: nullable(uuid), toTierId: nullable(uuid), fromDefinitionVersionId: nullable(uuid), toDefinitionVersionId: nullable(uuid),
  acceptedPricingBefore: nullable(readAcceptedPricing), acceptedPricingAfter: nullable(readAcceptedPricing),
  previousAmountUsd: acceptedMoney, nextAmountUsd: acceptedMoney, fullPeriodDeltaUsd: signedMoney, proratedAllocationUsd: signedMoney });
const preview = object({ previewId: uuid7, subscriptionId: uuid, subscriptionRevision: positiveRevision, operationId: uuid7,
  actorBindingDigest: text(64, /^[0-9a-f]{64}$/u), targetSetDigest: text(64, /^[0-9a-f]{64}$/u),
  pricedAt: instant, expiresAt: instant, billingCycle: oneOf(["MONTHLY", "ANNUAL"]), currencyCode: oneOf(["USD"]), changes: array(change),
  financial: object({ previousRecurringUsd: acceptedMoney, nextRecurringUsd: acceptedMoney, fullPeriodDeltaUsd: signedMoney,
    direction: oneOf(["CREDIT", "DEBIT", "NONE"]), proratedAmountUsd: acceptedMoney, walletStatus: oneOf(["ACTIVE", "FROZEN", "CLOSED"]),
    walletAvailableUsd: signedMoney, walletShortfallUsd: acceptedMoney, canApply: boolean }),
  preparation: object({ preparationId: uuid7 }) });
export type CommercialPreview = ReturnType<typeof preview>;
export type CommercialPreviewChange = CommercialPreview["changes"][number];

/** Checks retained identity and arithmetic; never computes a price, proration or eligibility. */
export function readCommercialPreview(value: unknown): CommercialPreview {
  const result = preview(value);
  if (!result.changes.length || Date.parse(result.expiresAt) - Date.parse(result.pricedAt) !== 300000) contractFailure();
  unique(result.changes.map(item => item.selectionKey));
  const existingIds = result.changes.flatMap(item => item.itemId ? [item.itemId] : item.addonSelectionId ? [item.addonSelectionId] : []);
  unique(existingIds);
  let delta = ZERO; let allocation = ZERO;
  for (const [index, item] of result.changes.entries()) {
    if (item.ordinal !== index + 1) contractFailure();
    verifyChange(item, result.billingCycle);
    delta += acceptedAmountUnits(item.fullPeriodDeltaUsd);
    allocation += acceptedAmountUnits(item.proratedAllocationUsd);
    if (item.parentSelectionKey) {
      const parent = result.changes.find(parent => parent.selectionKey === item.parentSelectionKey);
      if (!parent || parent.sourceKind !== "APPLICATION" || parent.operation !== "ADD"
        || parent.applicationId !== item.applicationId || item.toSeats! > parent.toSeats!) contractFailure();
    }
  }
  const financial = result.financial;
  const signedSettlement = acceptedAmountUnits(financial.proratedAmountUsd) * (financial.direction === "CREDIT" ? -ONE : ONE);
  if (delta !== acceptedAmountUnits(financial.fullPeriodDeltaUsd)
    || delta !== acceptedAmountUnits(financial.nextRecurringUsd) - acceptedAmountUnits(financial.previousRecurringUsd)
    || allocation !== signedSettlement || (financial.direction === "NONE") !== (signedSettlement === ZERO)) contractFailure();
  return result;
}

function verifyChange(item: CommercialPreviewChange, cycle: CommercialPreview["billingCycle"]) {
  const before = item.operation !== "ADD";
  const after = item.operation !== "REMOVE";
  if ((item.fromSeats !== null) !== before || (item.acceptedPricingBefore !== null) !== before
    || (item.toSeats !== null) !== after || (item.acceptedPricingAfter !== null) !== after) contractFailure();
  if (item.sourceKind === "APPLICATION") {
    if ((item.itemId !== null) !== before || item.addonSelectionId !== null || item.addonId !== null
      || item.parentItemId !== null || item.parentSelectionKey !== null || item.fromDefinitionVersionId !== null || item.toDefinitionVersionId !== null
      || (item.fromTierId !== null) !== before || (item.toTierId !== null) !== after) contractFailure();
  } else if (item.itemId !== null || item.addonId === null || (item.addonSelectionId !== null) !== before
    || item.fromTierId !== null || item.toTierId !== null
    || (item.fromDefinitionVersionId !== null) !== before || (item.toDefinitionVersionId !== null) !== after
    || (item.parentItemId === null) === (item.parentSelectionKey === null)
    || before && (item.parentItemId === null || item.parentSelectionKey !== null)) contractFailure();
  if (item.acceptedPricingBefore) verifyAcceptedPricing(item.acceptedPricingBefore, item.fromSeats!, item.sourceKind, cycle);
  if (item.acceptedPricingAfter) verifyAcceptedPricing(item.acceptedPricingAfter, item.toSeats!, item.sourceKind, cycle);
  if (item.previousAmountUsd !== (item.acceptedPricingBefore?.recurringAmountUsd ?? "0.0000")
    || item.nextAmountUsd !== (item.acceptedPricingAfter?.recurringAmountUsd ?? "0.0000")
    || acceptedAmountUnits(item.fullPeriodDeltaUsd) !== acceptedAmountUnits(item.nextAmountUsd) - acceptedAmountUnits(item.previousAmountUsd)) contractFailure();
}

const receipt = object({ previewId: uuid7, operationId: uuid7, appliedAt: instant,
  changes: array(object({ selectionKey: uuid7, sourceKind: selectionKind,
    operation: oneOf(["ADD", "CHANGE", "REMOVE", "ADOPT_DEFINITION"]), selectionId: uuid })),
  removedSelectionIds: array(uuid), subscriptionRevision: positiveRevision,
  totals: object({ baseRecurringUsd: acceptedMoney, addonRecurringUsd: acceptedMoney, combinedRecurringUsd: acceptedMoney }),
  settlement: nullable(object({ walletLedgerEntryId: uuid7, walletId: uuid, currencyCode: oneOf(["USD"]), direction: oneOf(["CREDIT", "DEBIT"]),
    amountUsd: acceptedMoney, balanceAfterUsd: acceptedMoney })),
  projection: object({ state: oneOf(["PENDING"]), preparationId: uuid7 }) });
export type CommercialApplyReceipt = ReturnType<typeof receipt>;
export const COMMERCIAL_RECEIPT_PAYLOAD_MAX_BYTES = 65536;

/** Lost-preview recovery reads original evidence without inventing an expected preview. */
export function readOriginalCommercialReceipt(value: unknown, expected: { previewId: string; preparationId?: string }): CommercialApplyReceipt {
  const result = receipt(value);
  if (result.previewId !== uuid7(expected.previewId) || expected.preparationId !== undefined && result.projection.preparationId !== uuid7(expected.preparationId)
    || !result.changes.length || new TextEncoder().encode(JSON.stringify(result)).length > COMMERCIAL_RECEIPT_PAYLOAD_MAX_BYTES) contractFailure();
  unique(result.changes.map(item => item.selectionKey)); unique(result.changes.map(item => item.selectionId));
  if (JSON.stringify(result.removedSelectionIds) !== JSON.stringify(result.changes.filter(item => item.operation === "REMOVE").map(item => item.selectionId))
    || acceptedAmountUnits(result.totals.baseRecurringUsd) + acceptedAmountUnits(result.totals.addonRecurringUsd) !== acceptedAmountUnits(result.totals.combinedRecurringUsd)
    || result.settlement !== null && acceptedAmountUnits(result.settlement.amountUsd) <= ZERO) contractFailure();
  // Original reads also accept Tenant-created pure Addon adoption receipts.
  if (result.changes.some(item => item.operation === "ADOPT_DEFINITION")
    && (result.settlement !== null || result.changes.some(item => item.sourceKind !== "ADDON" || item.operation !== "ADOPT_DEFINITION"))) contractFailure();
  return result;
}

/** Original financial evidence must bind the exact reviewed preview, including ADD mappings. */
export function readCommercialApplyReceipt(value: unknown, reviewed: CommercialPreview): CommercialApplyReceipt {
  const result = readOriginalCommercialReceipt(value, { previewId: reviewed.previewId, preparationId: reviewed.preparation.preparationId });
  if (result.operationId !== reviewed.operationId
    || BigInt(result.subscriptionRevision) !== BigInt(reviewed.subscriptionRevision) + ONE
    || Date.parse(result.appliedAt) < Date.parse(reviewed.pricedAt) || result.changes.length !== reviewed.changes.length) contractFailure();
  for (const [index, item] of result.changes.entries()) {
    const expected = reviewed.changes[index];
    if (item.selectionKey !== expected.selectionKey || item.sourceKind !== expected.sourceKind || item.operation !== expected.operation
      || expected.operation !== "ADD" && item.selectionId !== (expected.itemId ?? expected.addonSelectionId)) contractFailure();
  }
  if (result.totals.combinedRecurringUsd !== reviewed.financial.nextRecurringUsd) contractFailure();
  if (reviewed.financial.direction === "NONE") {
    if (result.settlement !== null || reviewed.financial.proratedAmountUsd !== "0.0000") contractFailure();
  } else if (!result.settlement || result.settlement.direction !== reviewed.financial.direction
    || result.settlement.amountUsd !== reviewed.financial.proratedAmountUsd) contractFailure();
  return result;
}

const operationReceipt = object({ operationId: uuid7, operationRevision: positiveRevision, intentKind: oneOf(["COMMERCIAL_CHANGE"]),
  state: oneOf(["PREPARING", "BLOCKED", "READY", "CONFIRMING", "COMMITTED", "ABORTED", "NEEDS_REVIEW"]),
  phase: text(96, /^[A-Z][A-Z0-9_]{0,95}$/u), createdAt: instant, updatedAt: instant, terminalAt: nullable(instant),
  safeReasonCode: nullable(text(96, /^[A-Z][A-Z0-9_.]{0,95}$/u)), retryAfterSeconds: nullable(integer(1, 3600)),
  relatedPreviewId: nullable(uuid7), committedReceiptRef: nullable(uuid7), projectionState: oneOf(["NOT_REQUIRED", "PENDING", "READY", "BLOCKED"]) });
export type CommercialOperationReceipt = ReturnType<typeof operationReceipt>;

/** Durable historical progress. READY never establishes current operational access. */
export function readCommercialOperationReceipt(value: unknown): CommercialOperationReceipt {
  const result = operationReceipt(value);
  if (result.updatedAt < result.createdAt || result.terminalAt !== null && (result.terminalAt < result.createdAt || result.terminalAt > result.updatedAt)
    || (result.state === "COMMITTED" || result.state === "ABORTED") !== (result.terminalAt !== null)
    || (result.state === "COMMITTED" ? result.committedReceiptRef === null || result.relatedPreviewId !== result.committedReceiptRef
      || result.projectionState === "NOT_REQUIRED" : result.committedReceiptRef !== null || result.projectionState !== "NOT_REQUIRED")) contractFailure();
  return result;
}
