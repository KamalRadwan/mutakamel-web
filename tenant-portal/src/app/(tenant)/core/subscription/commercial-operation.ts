import { z } from "zod";
import { commercialEnvelope, commercialInstant, commercialRevision, commercialUuid7, invalidCommercialRead } from "./commercial-command-fields";

// Core purchase/commercial-operation.contract.ts and CommercialOperationService.snapshot.
const receipt = z.object({
  operationId: commercialUuid7, operationRevision: commercialRevision, intentKind: z.literal("COMMERCIAL_CHANGE"),
  state: z.enum(["PREPARING", "BLOCKED", "READY", "CONFIRMING", "COMMITTED", "ABORTED", "NEEDS_REVIEW"]),
  phase: z.string().regex(/^[A-Z][A-Z0-9_]{0,95}$/u), createdAt: commercialInstant, updatedAt: commercialInstant,
  terminalAt: commercialInstant.nullable(), safeReasonCode: z.string().regex(/^[A-Z][A-Z0-9_.]{0,95}$/u).nullable(),
  retryAfterSeconds: z.number().int().min(1).max(3600).nullable(), relatedPreviewId: commercialUuid7.nullable(),
  committedReceiptRef: commercialUuid7.nullable(), projectionState: z.enum(["NOT_REQUIRED", "PENDING", "READY", "BLOCKED"]),
}).strict().refine((value) => {
  const terminal = value.state === "COMMITTED" || value.state === "ABORTED";
  return value.updatedAt >= value.createdAt && terminal === (value.terminalAt !== null)
    && (value.terminalAt === null || (value.terminalAt >= value.createdAt && value.terminalAt <= value.updatedAt))
    && (value.state === "COMMITTED"
      ? value.committedReceiptRef !== null && value.relatedPreviewId === value.committedReceiptRef && value.projectionState !== "NOT_REQUIRED"
      : value.committedReceiptRef === null && value.projectionState === "NOT_REQUIRED");
});
const envelope = z.object({ ...commercialEnvelope, data: receipt }).strict();
export type CommercialOperationReceipt = z.infer<typeof receipt>;

/** operationId in this receipt is the canonical preparation id, including when
 * the server accepted a preview operation alias as its GET selector. */
export function parseCommercialOperation(body: unknown, expectedPreparationId?: string): CommercialOperationReceipt {
  const result = envelope.safeParse(body);
  if (!result.success || (expectedPreparationId !== undefined
    && (!commercialUuid7.safeParse(expectedPreparationId).success || result.data.data.operationId !== expectedPreparationId))) invalidCommercialRead();
  return Object.freeze(result.data.data);
}
