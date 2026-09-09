import { array, contractFailure, integer, object, oneOf, optional, positiveRevision, record, text, uuid7 } from "@/shared/api/commercial-contract";
import type { CommercialPreview } from "./commercial-change-readers";

/** Source-frozen command bodies for the mounted canonical commercial owner. */
const selector = text(36, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const seats = integer(1, 100000);
const common = { selectionKey: uuid7 };
const applicationAdd = object({ ...common, sourceKind: oneOf(["APPLICATION"]), operation: oneOf(["ADD"]), applicationId: selector, tierId: selector, seats });
const applicationChange = object({ ...common, sourceKind: oneOf(["APPLICATION"]), operation: oneOf(["CHANGE"]), itemId: selector,
  tierId: optional(selector), seats: optional(seats) });
const applicationRemove = object({ ...common, sourceKind: oneOf(["APPLICATION"]), operation: oneOf(["REMOVE"]), itemId: selector });
const addonAdd = object({ ...common, sourceKind: oneOf(["ADDON"]), operation: oneOf(["ADD"]), addonId: selector,
  targetDefinitionVersionId: selector, seats, parentItemId: optional(selector), parentSelectionKey: optional(uuid7) });
const addonChange = object({ ...common, sourceKind: oneOf(["ADDON"]), operation: oneOf(["CHANGE"]), addonSelectionId: selector,
  seats, targetDefinitionVersionId: optional(selector) });
const addonRemove = object({ ...common, sourceKind: oneOf(["ADDON"]), operation: oneOf(["REMOVE"]), addonSelectionId: selector });
const addonAdoption = object({ ...common, sourceKind: oneOf(["ADDON"]), operation: oneOf(["ADOPT_DEFINITION"]),
  addonSelectionId: selector, targetDefinitionVersionId: selector });

function readChange(value: unknown) {
  const source = record(value);
  switch (`${String(source.sourceKind)}:${String(source.operation)}`) {
    case "APPLICATION:ADD": return applicationAdd(value);
    case "APPLICATION:CHANGE": {
      const change = applicationChange(value);
      if (change.tierId === undefined && change.seats === undefined) contractFailure();
      return change;
    }
    case "APPLICATION:REMOVE": return applicationRemove(value);
    case "ADDON:ADD": {
      const change = addonAdd(value);
      if ((change.parentItemId === undefined) === (change.parentSelectionKey === undefined)) contractFailure();
      return change;
    }
    case "ADDON:CHANGE": return addonChange(value);
    case "ADDON:REMOVE": return addonRemove(value);
    case "ADDON:ADOPT_DEFINITION": return addonAdoption(value);
    default: return contractFailure();
  }
}
type DefinedOptionals<T> = T extends unknown ? {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
} & { [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined> } : never;
export type CommercialChange = DefinedOptionals<ReturnType<typeof readChange>>;
export type CommercialPreparationRequest = { expectedSubscriptionRevision: string; changes: CommercialChange[]; reason?: string };
export type CommercialPreviewRequest = CommercialPreparationRequest & { preparationId: string };
const fields = { expectedSubscriptionRevision: positiveRevision, changes: array(readChange), reason: optional(text(256, /\S/u)) };
const preparation = object(fields);
const preview = object({ ...fields, preparationId: selector });

function bounded<T extends CommercialPreparationRequest>(value: T): T {
  if (!value.changes.length || new Set(value.changes.map(change => change.selectionKey)).size !== value.changes.length
    || new TextEncoder().encode(JSON.stringify(value)).length > 256 * 1024) contractFailure();
  return value;
}
export const readCommercialPreparationRequest = (value: unknown): CommercialPreparationRequest => bounded(preparation(value));
export const readCommercialPreviewRequest = (value: unknown): CommercialPreviewRequest => bounded(preview(value));
const recovery = object({ expectedOperationRevision: positiveRevision, action: oneOf(["RECONCILE", "CANCEL_PREPARATION"]), reason: text(256, /\S/u) });
export type CommercialRecoveryRequest = ReturnType<typeof recovery>;
export function readCommercialRecoveryRequest(value: unknown): CommercialRecoveryRequest {
  const result = recovery(value);
  if (result.reason !== result.reason.trim()) contractFailure();
  return result;
}

/** No client translation of an adoption command into a different public operation. */
export function assertCommercialPreviewMatchesRequest(value: CommercialPreview, subscriptionId: string, request: CommercialPreviewRequest): CommercialPreview {
  if (value.subscriptionId !== subscriptionId || value.subscriptionRevision !== request.expectedSubscriptionRevision
    || value.preparation.preparationId !== request.preparationId || value.changes.length !== request.changes.length) contractFailure();
  for (const [index, selected] of request.changes.entries()) {
    const returned = value.changes[index];
    if (returned.selectionKey !== selected.selectionKey || returned.sourceKind !== selected.sourceKind || returned.operation !== selected.operation) contractFailure();
    if (selected.sourceKind === "APPLICATION") {
      if (selected.operation === "ADD") {
        if (returned.applicationId !== selected.applicationId || returned.toTierId !== selected.tierId || returned.toSeats !== selected.seats) contractFailure();
      } else {
        if (returned.itemId !== selected.itemId) contractFailure();
        if (selected.operation === "CHANGE" && (returned.toTierId !== (selected.tierId ?? returned.fromTierId)
          || returned.toSeats !== (selected.seats ?? returned.fromSeats))) contractFailure();
      }
    } else if (selected.operation === "ADD") {
      if (returned.addonId !== selected.addonId || returned.toDefinitionVersionId !== selected.targetDefinitionVersionId || returned.toSeats !== selected.seats
        || returned.parentItemId !== (selected.parentItemId ?? null) || returned.parentSelectionKey !== (selected.parentSelectionKey ?? null)) contractFailure();
    } else {
      if (returned.addonSelectionId !== selected.addonSelectionId) contractFailure();
      if (selected.operation === "CHANGE" && (returned.toSeats !== selected.seats
        || returned.toDefinitionVersionId !== (selected.targetDefinitionVersionId ?? returned.fromDefinitionVersionId))) contractFailure();
    }
  }
  return value;
}
