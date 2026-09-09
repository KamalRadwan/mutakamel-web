import { z } from "zod";
import { commercialSelector, commercialUuid, commercialUuid7 } from "./commercial-command-fields";
import { parseCommercialPreparationRequest, type CommercialPreparationRequest } from "./commercial-command-request";
import { commercialRecoveryRequestSchema } from "./commercial-recovery";
import { definitionAdoptionSourcesSchema, parseDefinitionAdoptionRequest, parseDefinitionAdoptionSources } from "./definition-adoption-command";

const key = commercialUuid7;
const pending = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PREPARE"), key }).strict(),
  z.object({ kind: z.literal("PREVIEW"), key }).strict(),
  z.object({ kind: z.literal("APPLY"), key }).strict(),
  z.object({ kind: z.literal("RECOVER"), key, request: commercialRecoveryRequestSchema }).strict(),
]);
const intent = z.object({ actorId: commercialUuid, subscriptionId: commercialSelector.nullable(),
  purpose: z.enum(["PURCHASE", "ADOPTION"]).default("PURCHASE"),
  adoptionSources: definitionAdoptionSourcesSchema.or(z.tuple([])).default([]),
  request: z.unknown().transform(parseCommercialPreparationRequest), prepareKey: key, operationId: key.nullable(),
  preview: z.object({ id: key, key, identity: z.string().min(1).max(1024).optional() }).strict().nullable(), pending: pending.nullable(),
  expiredApplies: z.array(z.object({ previewId: key, previewKey: key, applyKey: key }).strict()).max(100),
  unresolvedPreviews: z.array(key).max(100),
  // This browser-only history was added after original intents could be saved.
  // An absent history preserves that exact original request and key unchanged.
  rejectedRecoveries: z.array(z.object({ key, request: commercialRecoveryRequestSchema }).strict()).max(100).default([]),
}).strict().refine((value) => (value.operationId !== null || (value.pending?.kind === "PREPARE" && value.preview === null))
  && (value.pending?.kind !== "PREPARE" || value.pending.key === value.prepareKey)
  && (value.pending?.kind !== "APPLY" || value.preview !== null)).refine((value) => {
  if (value.purpose === "PURCHASE") {
    parseTenantCommercialRequest(value.request);
    return value.subscriptionId !== null && value.adoptionSources.length === 0;
  }
  parseDefinitionAdoptionSources(parseDefinitionAdoptionRequest(value.request), value.adoptionSources);
  if (value.subscriptionId !== null && !commercialUuid.safeParse(value.subscriptionId).success) return false;
  return value.preview === null || (value.subscriptionId !== null && value.preview.identity !== undefined);
});
export type CommercialIntent = z.infer<typeof intent>;
export type CommercialPendingCommand = z.infer<typeof pending>;
export type CommercialPurpose = CommercialIntent["purpose"];

export function parseTenantCommercialRequest(value: unknown): CommercialPreparationRequest {
  const request = parseCommercialPreparationRequest(value);
  if (request.changes.some((row) => row.operation === "REMOVE" || row.operation === "ADOPT_DEFINITION"
    || (row.sourceKind === "ADDON" && row.operation === "CHANGE" && row.targetDefinitionVersionId !== undefined))) invalid();
  return request;
}

function storageKey(actorId: string, purpose: CommercialPurpose) {
  commercialUuid.parse(actorId);
  return purpose === "ADOPTION" ? `tenant-definition-adoption-intent:${actorId}` : `tenant-commercial-intent:${actorId}`;
}
function encode(value: CommercialIntent) { return JSON.stringify(intent.parse(value)); }
export function readCommercialIntent(actorId: string, purpose: CommercialPurpose = "PURCHASE"): CommercialIntent | null {
  const saved = sessionStorage.getItem(storageKey(actorId, purpose));
  if (saved === null) return null;
  if (new TextEncoder().encode(saved).byteLength > 262_144) invalid();
  const value = intent.parse(JSON.parse(saved));
  if (value.actorId !== actorId || value.purpose !== purpose) invalid();
  return value;
}
export function retainCommercialIntent(actorId: string, previous: CommercialIntent | null, next: CommercialIntent): CommercialIntent {
  const value = intent.parse(next), current = readCommercialIntent(actorId, value.purpose);
  if (value.actorId !== actorId || (current === null ? previous !== null : previous === null || encode(current) !== encode(previous))) invalid();
  const saved = encode(value);
  if (new TextEncoder().encode(saved).byteLength > 262_144) invalid();
  sessionStorage.setItem(storageKey(actorId, value.purpose), saved);
  return value;
}
export function clearCommercialIntent(actorId: string, expected: CommercialIntent) {
  const current = readCommercialIntent(actorId, expected.purpose);
  if (!current || encode(current) !== encode(expected)) invalid();
  sessionStorage.removeItem(storageKey(actorId, expected.purpose));
}
function invalid(): never { throw new Error("The original commercial intent could not be verified."); }
