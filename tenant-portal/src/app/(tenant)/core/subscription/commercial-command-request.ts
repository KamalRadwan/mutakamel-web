import { z } from "zod";
import { commercialRevision, commercialSeats, commercialSelector, commercialUuid7 } from "./commercial-command-fields";

// Core commercial-preview.request.ts. This codec does not authorize a Tenant operation.
const application = { sourceKind: z.literal("APPLICATION"), selectionKey: commercialUuid7 };
const addon = { sourceKind: z.literal("ADDON"), selectionKey: commercialUuid7 };
const addonAdd = { ...addon, operation: z.literal("ADD"), addonId: commercialSelector,
  targetDefinitionVersionId: commercialSelector, seats: commercialSeats };
const change = z.union([
  z.object({ ...application, operation: z.literal("ADD"), applicationId: commercialSelector, tierId: commercialSelector, seats: commercialSeats }).strict(),
  z.object({ ...application, operation: z.literal("CHANGE"), itemId: commercialSelector,
    tierId: commercialSelector.optional(), seats: commercialSeats.optional() }).strict().refine((value) => value.tierId !== undefined || value.seats !== undefined),
  z.object({ ...application, operation: z.literal("REMOVE"), itemId: commercialSelector }).strict(),
  z.object({ ...addonAdd, parentItemId: commercialSelector }).strict(),
  z.object({ ...addonAdd, parentSelectionKey: commercialUuid7 }).strict(),
  z.object({ ...addon, operation: z.literal("CHANGE"), addonSelectionId: commercialSelector, seats: commercialSeats,
    targetDefinitionVersionId: commercialSelector.optional() }).strict(),
  z.object({ ...addon, operation: z.literal("REMOVE"), addonSelectionId: commercialSelector }).strict(),
  z.object({ ...addon, operation: z.literal("ADOPT_DEFINITION"), addonSelectionId: commercialSelector, targetDefinitionVersionId: commercialSelector }).strict(),
]);
const changes = z.array(change).min(1).max(100).refine((rows) => new Set(rows.map((row) => row.selectionKey)).size === rows.length);
const request = { expectedSubscriptionRevision: commercialRevision, changes,
  reason: z.string().max(256).refine((value) => value.trim().length > 0).optional() };
export const commercialPreparationRequestSchema = z.object(request).strict();
export const commercialPreviewRequestSchema = z.object({ ...request, preparationId: commercialSelector }).strict();
export type CommercialChange = z.infer<typeof change>;
export type CommercialPreparationRequest = z.infer<typeof commercialPreparationRequestSchema>;
export type CommercialPreviewRequest = z.infer<typeof commercialPreviewRequestSchema>;

export function parseCommercialPreparationRequest(value: unknown): CommercialPreparationRequest {
  const input = commercialPreparationRequestSchema.parse(value);
  checkBodyBound(input);
  return input;
}
export function parseCommercialPreviewRequest(value: unknown): CommercialPreviewRequest {
  const input = commercialPreviewRequestSchema.parse(value);
  checkBodyBound(input);
  return input;
}
function checkBodyBound(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 262_144) throw new Error("The commercial request exceeds its supported size.");
}
