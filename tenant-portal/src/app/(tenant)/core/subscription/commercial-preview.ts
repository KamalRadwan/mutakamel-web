import { z } from "zod";
import { acceptedPricingConsistent, acceptedPricingSchema, moneyUnits } from "./subscription-pricing";
import { commercialEnvelope, commercialInstant, commercialMoney as money, commercialRevision, commercialSeats as seats,
  commercialSelector as selector, commercialSignedMoney as signed, commercialUuid, commercialUuid7, invalidCommercialRead } from "./commercial-command-fields";
import { parseCommercialPreviewRequest, type CommercialChange, type CommercialPreviewRequest } from "./commercial-command-request";
import { parseDefinitionAdoptionRequest, parseDefinitionAdoptionSources, type DefinitionAdoptionSource } from "./definition-adoption-command";

// Core commercial-preview.contract.ts plus the actual retained preview/calculator owners.
const change = z.object({
  ordinal: z.number().int().min(1).max(100), selectionKey: commercialUuid7,
  sourceKind: z.enum(["APPLICATION", "ADDON"]), operation: z.enum(["ADD", "CHANGE", "REMOVE", "ADOPT_DEFINITION"]), applicationId: selector,
  itemId: selector.nullable(), addonSelectionId: selector.nullable(), parentItemId: selector.nullable(), parentSelectionKey: commercialUuid7.nullable(), addonId: selector.nullable(),
  fromSeats: seats.nullable(), toSeats: seats.nullable(), fromTierId: selector.nullable(), toTierId: selector.nullable(),
  fromDefinitionVersionId: selector.nullable(), toDefinitionVersionId: selector.nullable(),
  acceptedPricingBefore: acceptedPricingSchema.nullable(), acceptedPricingAfter: acceptedPricingSchema.nullable(),
  previousAmountUsd: money, nextAmountUsd: money, fullPeriodDeltaUsd: signed, proratedAllocationUsd: signed,
}).strict();
const preview = z.object({
  previewId: commercialUuid7, subscriptionId: selector, subscriptionRevision: commercialRevision, operationId: commercialUuid7,
  actorBindingDigest: z.string().regex(/^[0-9a-f]{64}$/u), targetSetDigest: z.string().regex(/^[0-9a-f]{64}$/u),
  pricedAt: commercialInstant, expiresAt: commercialInstant, billingCycle: z.enum(["MONTHLY", "ANNUAL"]), currencyCode: z.literal("USD"),
  changes: z.array(change).min(1).max(100), financial: z.object({
    previousRecurringUsd: money, nextRecurringUsd: money, fullPeriodDeltaUsd: signed,
    direction: z.enum(["CREDIT", "DEBIT", "NONE"]), proratedAmountUsd: money,
    walletStatus: z.enum(["ACTIVE", "FROZEN", "CLOSED", "NOT_APPLICABLE"]), walletAvailableUsd: signed.nullable(), walletShortfallUsd: money.nullable(), canApply: z.boolean(),
  }).strict(), preparation: z.object({ preparationId: commercialUuid7 }).strict(),
}).strict();
const envelope = z.object({ ...commercialEnvelope, data: preview }).strict();
export type CommercialPreviewChange = z.infer<typeof change>;
export type CommercialPreview = z.infer<typeof preview>;

export function parseCommercialPreview(body: unknown, expected: { subscriptionId: string; request: CommercialPreviewRequest }): CommercialPreview {
  const request = parseCommercialPreviewRequest(expected.request);
  if (!selector.safeParse(expected.subscriptionId).success || request.changes.some((row) => row.operation === "ADOPT_DEFINITION")) invalidCommercialRead();
  return parsePreview(body, request, expected.subscriptionId);
}

export function parseDefinitionAdoptionPreview(body: unknown, expected: { subscriptionId: string | null;
  request: CommercialPreviewRequest; sources: DefinitionAdoptionSource[] }): CommercialPreview {
  const request = parseCommercialPreviewRequest(expected.request);
  const sources = parseDefinitionAdoptionSources(parseDefinitionAdoptionRequest({
    expectedSubscriptionRevision: request.expectedSubscriptionRevision, changes: request.changes,
    ...(request.reason === undefined ? {} : { reason: request.reason }),
  }), expected.sources);
  if (expected.subscriptionId !== null && !commercialUuid.safeParse(expected.subscriptionId).success) invalidCommercialRead();
  // The initial subscription ID is an owner observation. Preparation, request
  // and discovery source pins are independently known before the first preview.
  const value = parsePreview(body, request, expected.subscriptionId);
  if (!commercialUuid.safeParse(value.subscriptionId).success || value.changes.some((row, index) =>
    row.fromDefinitionVersionId !== sources[index].fromDefinitionVersionId
    || [row.applicationId, row.addonId, row.parentItemId].some((id) => !commercialUuid.safeParse(id).success))) invalidCommercialRead();
  return value;
}

function parsePreview(body: unknown, request: CommercialPreviewRequest, subscriptionId: string | null): CommercialPreview {
  const parsed = envelope.safeParse(body);
  if (!parsed.success) invalidCommercialRead();
  const value = parsed.data.data, financial = value.financial;
  if ((subscriptionId !== null && value.subscriptionId !== subscriptionId) || value.subscriptionRevision !== request.expectedSubscriptionRevision
    || value.preparation.preparationId !== request.preparationId || value.changes.length !== request.changes.length
    || Date.parse(value.expiresAt) - Date.parse(value.pricedAt) !== 300_000
    || new Set(value.changes.map((row) => row.selectionKey)).size !== value.changes.length
    || value.changes.some((row, index) => row.ordinal !== index + 1 || !validChange(row, value.billingCycle)
      || !matchesCommand(row, request.changes[index])) || !validParents(value.changes)) invalidCommercialRead();
  const delta = value.changes.reduce((sum, row) => sum + moneyUnits(row.fullPeriodDeltaUsd), BigInt(0));
  const allocated = value.changes.reduce((sum, row) => sum + moneyUnits(row.proratedAllocationUsd), BigInt(0));
  const settlement = moneyUnits(financial.proratedAmountUsd) * (financial.direction === "CREDIT" ? BigInt(-1) : BigInt(1));
  if (delta !== moneyUnits(financial.fullPeriodDeltaUsd) || moneyUnits(financial.previousRecurringUsd) + delta !== moneyUnits(financial.nextRecurringUsd)
    || allocated !== settlement || (financial.direction === "NONE") !== (settlement === BigInt(0))) invalidCommercialRead();
  if (request.changes.every((row) => row.operation === "ADOPT_DEFINITION")) {
    if (financial.walletStatus !== "NOT_APPLICABLE" || financial.walletAvailableUsd !== null || financial.walletShortfallUsd !== null
      || financial.previousRecurringUsd !== financial.nextRecurringUsd || financial.fullPeriodDeltaUsd !== "0.0000"
      || financial.proratedAmountUsd !== "0.0000" || financial.direction !== "NONE") invalidCommercialRead();
  } else {
    if (request.changes.some((row) => row.operation === "ADOPT_DEFINITION") || financial.walletStatus === "NOT_APPLICABLE"
      || financial.walletAvailableUsd === null || financial.walletShortfallUsd === null) invalidCommercialRead();
    const available = moneyUnits(financial.walletAvailableUsd), due = financial.direction === "DEBIT" ? settlement : BigInt(0);
    if (moneyUnits(financial.walletShortfallUsd) !== (due > available ? due - available : BigInt(0))) invalidCommercialRead();
  }
  // canApply and every displayed amount remain the exact original owner observation.
  return value;
}

function validChange(row: CommercialPreviewChange, cycle: CommercialPreview["billingCycle"]): boolean {
  const added = row.operation === "ADD", removed = row.operation === "REMOVE", addon = row.sourceKind === "ADDON";
  if (row.operation === "ADOPT_DEFINITION" && (!addon || row.fromSeats !== row.toSeats
    || row.fromDefinitionVersionId === row.toDefinitionVersionId || row.fullPeriodDeltaUsd !== "0.0000" || row.proratedAllocationUsd !== "0.0000"
    || JSON.stringify(row.acceptedPricingBefore) !== JSON.stringify(row.acceptedPricingAfter))) return false;
  if (added !== (row.fromSeats === null) || removed !== (row.toSeats === null)
    || added !== (row.acceptedPricingBefore === null) || removed !== (row.acceptedPricingAfter === null)) return false;
  if (row.acceptedPricingBefore && (row.acceptedPricingBefore.billingCycle !== cycle || !acceptedPricingConsistent(row.acceptedPricingBefore, row.fromSeats!, addon))) return false;
  if (row.acceptedPricingAfter && (row.acceptedPricingAfter.billingCycle !== cycle || !acceptedPricingConsistent(row.acceptedPricingAfter, row.toSeats!, addon))) return false;
  if (row.previousAmountUsd !== (row.acceptedPricingBefore?.recurringAmountUsd ?? "0.0000")
    || row.nextAmountUsd !== (row.acceptedPricingAfter?.recurringAmountUsd ?? "0.0000")
    || moneyUnits(row.nextAmountUsd) - moneyUnits(row.previousAmountUsd) !== moneyUnits(row.fullPeriodDeltaUsd)) return false;
  if (!addon) return row.addonId === null && row.addonSelectionId === null && row.parentItemId === null && row.parentSelectionKey === null
    && row.fromDefinitionVersionId === null && row.toDefinitionVersionId === null
    && added === (row.itemId === null) && added === (row.fromTierId === null) && removed === (row.toTierId === null);
  return row.addonId !== null && row.itemId === null && row.fromTierId === null && row.toTierId === null
    && added === (row.addonSelectionId === null) && added === (row.fromDefinitionVersionId === null) && removed === (row.toDefinitionVersionId === null)
    && (added ? (row.parentItemId === null) !== (row.parentSelectionKey === null) : row.parentItemId !== null && row.parentSelectionKey === null);
}

function matchesCommand(row: CommercialPreviewChange, command: CommercialChange): boolean {
  if (row.selectionKey !== command.selectionKey || row.sourceKind !== command.sourceKind || row.operation !== command.operation) return false;
  if (command.sourceKind === "APPLICATION") {
    if (command.operation === "ADD") return row.applicationId === command.applicationId && row.toTierId === command.tierId && row.toSeats === command.seats;
    if (row.itemId !== command.itemId) return false;
    return command.operation === "REMOVE" || (row.toTierId === (command.tierId ?? row.fromTierId) && row.toSeats === (command.seats ?? row.fromSeats));
  }
  if (command.operation === "ADD") return row.addonId === command.addonId && row.toSeats === command.seats && row.toDefinitionVersionId === command.targetDefinitionVersionId
    && ("parentItemId" in command ? row.parentItemId === command.parentItemId && row.parentSelectionKey === null : row.parentItemId === null && row.parentSelectionKey === command.parentSelectionKey);
  if (row.addonSelectionId !== command.addonSelectionId) return false;
  if (command.operation === "ADOPT_DEFINITION") return row.toDefinitionVersionId === command.targetDefinitionVersionId && row.toSeats === row.fromSeats;
  return command.operation === "REMOVE" || (row.toSeats === command.seats && row.toDefinitionVersionId === (command.targetDefinitionVersionId ?? row.fromDefinitionVersionId));
}

function validParents(rows: CommercialPreviewChange[]): boolean {
  return rows.every((row) => {
    if (row.sourceKind !== "ADDON") return true;
    const parent = rows.find((candidate) => candidate.sourceKind === "APPLICATION" && (row.parentSelectionKey !== null
      ? candidate.operation === "ADD" && candidate.selectionKey === row.parentSelectionKey : candidate.itemId === row.parentItemId));
    // An unchanged existing parent is outside this change list; the owner checks its actual allowance.
    if (!parent) return row.parentSelectionKey === null;
    return parent.applicationId === row.applicationId
      && (row.toSeats === null || (parent.toSeats !== null && row.toSeats <= parent.toSeats))
      && (row.fromSeats === null || (parent.fromSeats !== null && row.fromSeats <= parent.fromSeats));
  });
}
