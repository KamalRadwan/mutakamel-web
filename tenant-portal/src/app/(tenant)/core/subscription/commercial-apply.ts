import { z } from "zod";
import { moneyUnits } from "./subscription-pricing";
import { commercialEnvelope, commercialInstant, commercialMoney as money, commercialRevision, commercialUuid as uuid,
  commercialUuid7 as uuid7, invalidCommercialRead } from "./commercial-command-fields";
import type { CommercialPreview } from "./commercial-preview";

// Core commercial-apply-receipt.codec.ts. New ADD identities exist only in the committed owner receipt.
const receipt = z.object({
  previewId: uuid7, operationId: uuid7, appliedAt: commercialInstant,
  changes: z.array(z.object({ selectionKey: uuid7, sourceKind: z.enum(["APPLICATION", "ADDON"]),
    operation: z.enum(["ADD", "CHANGE", "REMOVE", "ADOPT_DEFINITION"]), selectionId: uuid }).strict()).min(1).max(100),
  removedSelectionIds: z.array(uuid).max(100), subscriptionRevision: commercialRevision,
  totals: z.object({ baseRecurringUsd: money, addonRecurringUsd: money, combinedRecurringUsd: money }).strict(),
  settlement: z.object({ walletLedgerEntryId: uuid7, walletId: uuid, currencyCode: z.literal("USD"), direction: z.enum(["CREDIT", "DEBIT"]),
    amountUsd: money.refine((value) => moneyUnits(value) > BigInt(0)), balanceAfterUsd: money }).strict().nullable(),
  projection: z.object({ state: z.literal("PENDING"), preparationId: uuid7 }).strict(),
}).strict();
const envelope = z.object({ ...commercialEnvelope, data: receipt }).strict();
export type CommercialApplyReceipt = z.infer<typeof receipt>;
export const commercialReceiptReferenceSchema = z.object({ previewId: uuid7, preparationId: uuid7.optional() }).strict();
export type CommercialReceiptReference = z.infer<typeof commercialReceiptReferenceSchema>;

/** Standalone recovery of the same original receipt. The actual read owner
 * validates stored preview/outcome and current tenant authority; no preview is
 * fabricated here. An optional preparation pin comes from verified status. */
export function parseCommercialReceipt(body: unknown, expected: CommercialReceiptReference): CommercialApplyReceipt {
  const reference = commercialReceiptReferenceSchema.safeParse(expected), result = envelope.safeParse(body);
  if (!reference.success || !result.success) invalidCommercialRead();
  const value = result.data.data;
  if (value.changes.some((row) => row.operation === "ADOPT_DEFINITION")
    && (value.changes.some((row) => row.sourceKind !== "ADDON" || row.operation !== "ADOPT_DEFINITION") || value.settlement !== null)) invalidCommercialRead();
  // Core purchase/receipts/commercial-applied-receipt.snapshot.ts bounds saved data, excluding envelope overhead.
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 65_536) invalidCommercialRead();
  if (value.previewId !== reference.data.previewId
    || (reference.data.preparationId !== undefined && value.projection.preparationId !== reference.data.preparationId)
    || new Set(value.changes.map((row) => row.selectionKey)).size !== value.changes.length
    || new Set(value.changes.map((row) => row.selectionId)).size !== value.changes.length
    || JSON.stringify(value.removedSelectionIds) !== JSON.stringify(value.changes.filter((row) => row.operation === "REMOVE").map((row) => row.selectionId))
    || moneyUnits(value.totals.baseRecurringUsd) + moneyUnits(value.totals.addonRecurringUsd) !== moneyUnits(value.totals.combinedRecurringUsd)) invalidCommercialRead();
  return value;
}

export function parseCommercialApply(body: unknown, preview: CommercialPreview): CommercialApplyReceipt {
  const value = parseCommercialReceipt(body, { previewId: preview.previewId, preparationId: preview.preparation.preparationId });
  if (value.operationId !== preview.operationId || BigInt(value.subscriptionRevision) !== BigInt(preview.subscriptionRevision) + BigInt(1)
    || value.changes.length !== preview.changes.length
    || value.changes.some((row, index) => {
      const original = preview.changes[index];
      return row.selectionKey !== original.selectionKey || row.sourceKind !== original.sourceKind || row.operation !== original.operation
        || (row.operation !== "ADD" && row.selectionId !== (original.sourceKind === "APPLICATION" ? original.itemId : original.addonSelectionId));
    })) invalidCommercialRead();
  if (value.totals.combinedRecurringUsd !== preview.financial.nextRecurringUsd) invalidCommercialRead();
  if (preview.financial.direction === "NONE" ? value.settlement !== null || preview.financial.proratedAmountUsd !== "0.0000"
    : value.settlement === null || value.settlement.direction !== preview.financial.direction || value.settlement.amountUsd !== preview.financial.proratedAmountUsd) invalidCommercialRead();
  return value;
}
