import { applyCommercialChange, prepareCommercialChange, previewCommercialChange, previewDefinitionAdoptionChange, recoverCommercialOperation } from "./commercial-command-api";
import { normalizeApiError } from "@/lib/api/errors";
import { invalidCommercialRead } from "./commercial-command-fields";
import type { CommercialIntent } from "./commercial-intent";
import { readCommercialOperation } from "./commercial-operation-read";
import type { CommercialPreview } from "./commercial-preview";
import { readCommercialReceipt } from "./commercial-receipt-read";

/** Original quoted prices need not occupy browser storage. An apply retry can
 * recover that exact preview using its original request/key before resending. */
export async function executeCommercialIntent(intent: CommercialIntent, signal: AbortSignal, observedPreview: CommercialPreview | null) {
  const pending = intent.pending;
  if (!pending) invalidCommercialRead();
  if (pending.kind === "PREPARE") return { kind: "operation" as const,
    value: await prepareCommercialChange(intent.request, pending.key, signal) };
  if (!intent.operationId) invalidCommercialRead();
  if (pending.kind === "RECOVER") {
    try { return { kind: "operation" as const, value: await recoverCommercialOperation(intent.operationId, pending.request, pending.key, signal) }; }
    catch (error) {
      const normalized = normalizeApiError(error);
      // The owner emits this only for the exact new-command INSERT rejection
      // after same-key lookup under its locks, with the transaction rolled back.
      if (normalized.status === 409 && normalized.code === "COMMERCIAL_RECOVERY_REVISION_STALE")
        return { kind: "recoveryRejected" as const, error: normalized, command: pending };
      throw error;
    }
  }
  const request = { ...intent.request, preparationId: intent.operationId };
  const quote = (key: string) => {
    if (intent.purpose === "ADOPTION") return previewDefinitionAdoptionChange(intent.subscriptionId, request, intent.adoptionSources, key, signal);
    if (intent.subscriptionId === null) invalidCommercialRead();
    return previewCommercialChange(intent.subscriptionId, request, key, signal);
  };
  if (pending.kind === "PREVIEW") return { kind: "preview" as const,
    value: await quote(pending.key) };
  if (!intent.preview) invalidCommercialRead();
  const preview = observedPreview?.previewId === intent.preview.id ? observedPreview
    : await quote(intent.preview.key);
  if (preview.previewId !== intent.preview.id || preview.preparation.preparationId !== intent.operationId) invalidCommercialRead();
  if (intent.purpose === "ADOPTION" && commercialPreviewIdentity(preview) !== intent.preview.identity) invalidCommercialRead();
  try { return { kind: "receipt" as const, value: await applyCommercialChange(preview, pending.key, signal) }; }
  catch (error) {
    const normalized = normalizeApiError(error);
    // Core commercial-capacity-apply.service.ts checks immutable same-key
    // committed replay before expiry. Only this apply rejection permits requoting.
    if (normalized.status === 409 && normalized.code === "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED")
      return { kind: "expired" as const, error: normalized };
    throw error;
  }
}

export async function readCommercialHistory(intent: CommercialIntent, signal: AbortSignal) {
  if (!intent.operationId) invalidCommercialRead();
  const operation = await readCommercialOperation(intent.operationId, signal);
  if (operation.operationId !== intent.operationId) invalidCommercialRead();
  try {
    const receipt = operation.state === "COMMITTED" && operation.committedReceiptRef
      ? await readCommercialReceipt({ previewId: operation.committedReceiptRef, preparationId: operation.operationId }, signal) : null;
    if (receipt && intent.purpose === "ADOPTION" && (receipt.settlement !== null
      || BigInt(receipt.subscriptionRevision) !== BigInt(intent.request.expectedSubscriptionRevision) + BigInt(1)
      || receipt.changes.length !== intent.request.changes.length || receipt.changes.some((row, index) => {
        const original = intent.request.changes[index];
        return original.sourceKind !== "ADDON" || original.operation !== "ADOPT_DEFINITION" || row.operation !== "ADOPT_DEFINITION"
          || row.sourceKind !== "ADDON" || row.selectionKey !== original.selectionKey || row.selectionId !== original.addonSelectionId;
      }))) invalidCommercialRead();
    return { operation, receipt, receiptError: null };
  } catch (error) {
    if (intent.purpose !== "ADOPTION") throw error;
    // Full receipt access also checks every affected Company. Its refusal must
    // not erase progress already verified under the narrower Tenant ADOPT read.
    return { operation, receipt: null, receiptError: normalizeApiError(error) };
  }
}

export function commercialPreviewIdentity(preview: CommercialPreview): string {
  return JSON.stringify([preview.subscriptionId, preview.operationId, preview.actorBindingDigest,
    preview.targetSetDigest, preview.pricedAt, preview.expiresAt]);
}
