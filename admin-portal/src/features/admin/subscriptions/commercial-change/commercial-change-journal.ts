import { safeSessionStorage } from "@/lib/safeStorage";
import { contractFailure, nullable, object, oneOf, positiveRevision, text, uuid7 } from "@/shared/api/commercial-contract";
import { readCommercialPreparationRequest, type CommercialPreparationRequest } from "./commercial-change-request";

const pending = object({ kind: oneOf(["PREPARE", "PREVIEW", "APPLY", "RECOVER"]), key: uuid7,
  recovery: nullable(object({ expectedOperationRevision: positiveRevision, action: oneOf(["RECONCILE", "CANCEL_PREPARATION"]), reasonHash: text(64, /^[0-9a-f]{64}$/u) })) });
const reader = object({ request: nullable(readCommercialPreparationRequest), preparationId: nullable(uuid7), previewKey: nullable(uuid7), previewId: nullable(uuid7), pending: nullable(pending) });
export type CommercialJournal = ReturnType<typeof reader>;
export const emptyCommercialJournal = (): CommercialJournal => ({ request: null, preparationId: null, previewKey: null, previewId: null, pending: null });

/** Only replay selectors, quantities, revision and keys are retained in this tab.
 * No auth, financial snapshots, actor digests, free-text reasons or receipts. */
export function readCommercialJournal(key: string): CommercialJournal {
  const saved = safeSessionStorage.getItem(key);
  if (saved === null) return emptyCommercialJournal();
  if (new TextEncoder().encode(saved).length > 270 * 1024) contractFailure();
  const result = reader(JSON.parse(saved));
  if (result.request?.reason !== undefined || (result.previewId && !result.previewKey)
    || result.request?.changes.some(change => change.operation === "ADOPT_DEFINITION" || (change.sourceKind === "ADDON" && change.operation === "CHANGE" && change.targetDefinitionVersionId !== undefined))
    || (result.previewKey && (!result.request || !result.preparationId))
    || (result.pending?.kind === "PREPARE" && !result.request)
    || (result.pending?.kind === "APPLY" && !result.previewId)
    || (result.pending?.kind === "RECOVER") !== Boolean(result.pending?.recovery)) contractFailure();
  return result;
}
export function saveCommercialJournal(key: string, value: CommercialJournal) {
  const serialized = JSON.stringify(value);
  safeSessionStorage.setItem(key, serialized);
  if (safeSessionStorage.getItem(key) !== serialized) throw new Error("COMMAND_RECOVERY_STORAGE_UNAVAILABLE");
}
export function newPreparationJournal(request: CommercialPreparationRequest, key: string): CommercialJournal {
  return { ...emptyCommercialJournal(), request, pending: { kind: "PREPARE", key, recovery: null } };
}
