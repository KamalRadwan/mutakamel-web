import { z } from "zod";
import { axiosClient } from "@/lib/api/axiosClient";
import { applicationAccessSchemas, validateApplicationAccessRequest, type ApplicationAccessRequest, type ApplicationAccessView } from "./application-access-contract";
import { companyCommandReference, parseCommandReceiptResponse, parseCompanySubmission, type AccessCommandReceipt, type CompanyCommandPending } from "./company-command-status";

// Core Company Application/Addon activation and Branch override controllers; one closed command codec.
const { uuid, revision } = applicationAccessSchemas;
const uuid7 = uuid.refine((value) => value[14] === "7");
const applicationKey = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u);
const addonKey = z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u);
const observedRevision = z.union([z.literal("0"), revision]);
export const activationReason = z.string().min(3).max(500).refine((value) => value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value));
const commandSchema = z.discriminatedUnion("operationKind", [
  z.object({ operationKind: z.literal("SET_APPLICATION_ACTIVATION"), idempotencyKey: uuid7,
    target: z.object({ kind: z.literal("APPLICATION_ACTIVATION"), companyId: uuid, applicationKey }).strict(),
    body: z.object({ expectedActivationRevision: observedRevision, enabled: z.boolean(), reason: activationReason }).strict(),
    observedResourceId: uuid7.nullable(),
  }).strict(),
  z.object({ operationKind: z.literal("SET_ADDON_ACTIVATION"), idempotencyKey: uuid7,
    target: z.object({ kind: z.literal("ADDON_ACTIVATION"), companyId: uuid, applicationKey, addonKey }).strict()
      .refine((value) => value.addonKey.split(".")[0] === value.applicationKey),
    body: z.object({ expectedActivationRevision: observedRevision, enabled: z.boolean(), definitionVersionId: uuid, reason: activationReason }).strict(),
    observedResourceId: uuid7.nullable(),
  }).strict(),
  z.object({ operationKind: z.literal("SET_BRANCH_OVERRIDE"), idempotencyKey: uuid7,
    target: z.object({ kind: z.literal("BRANCH_OVERRIDE"), branchId: uuid, applicationKey, addonKey }).strict()
      .refine((value) => value.addonKey.split(".")[0] === value.applicationKey),
    body: z.object({ expectedOverrideRevision: observedRevision, mode: z.enum(["INHERIT", "DISABLED"]), reason: activationReason }).strict(),
    observedResourceId: uuid7.nullable(),
  }).strict(),
]).refine((value) => (value.observedResourceId === null) === (("expectedActivationRevision" in value.body
  ? value.body.expectedActivationRevision : value.body.expectedOverrideRevision) === "0"));
export type ActivationCommand = z.infer<typeof commandSchema>;
export type ActivationReceipt = AccessCommandReceipt;

export function captureActivationCommand(request: ApplicationAccessRequest, view: ApplicationAccessView, reason: string, key: string, enabled: boolean): ActivationCommand {
  const target = validateApplicationAccessRequest(request);
  if (target.applicationKey !== view.target.applicationKey) invalid();
  if (target.kind === "APPLICATION_ACTIVATION" && view.scope.kind === "COMPANY" && target.companyId === view.scope.companyId
    && view.resource.kind === "APPLICATION_ACTIVATION") {
    return commandSchema.parse({ operationKind: "SET_APPLICATION_ACTIVATION", idempotencyKey: key, target,
      observedResourceId: view.resource.id, body: { expectedActivationRevision: view.resource.revision, enabled, reason } });
  }
  if (target.kind === "ADDON_ACTIVATION" && view.scope.kind === "COMPANY" && target.companyId === view.scope.companyId
    && target.addonKey === view.target.addonKey && view.resource.kind === "ADDON_ACTIVATION") {
    if (!enabled && view.resource.id === null) invalid();
    return commandSchema.parse({ operationKind: "SET_ADDON_ACTIVATION", idempotencyKey: key, target,
      observedResourceId: view.resource.id, body: { expectedActivationRevision: view.resource.revision, enabled, reason,
        definitionVersionId: view.resource.definitionVersionId ?? view.source.selectedDefinitionVersionId } });
  }
  if (target.kind === "BRANCH_OVERRIDE" && view.scope.kind === "BRANCH" && target.branchId === view.scope.branchId
    && target.addonKey === view.target.addonKey && view.resource.kind === "BRANCH_OVERRIDE") {
    return commandSchema.parse({ operationKind: "SET_BRANCH_OVERRIDE", idempotencyKey: key, target,
      observedResourceId: view.resource.id, body: { expectedOverrideRevision: view.resource.revision, mode: enabled ? "INHERIT" : "DISABLED", reason } });
  }
  return invalid();
}

export async function sendActivationCommand(value: ActivationCommand, signal: AbortSignal): Promise<ActivationReceipt | CompanyCommandPending> {
  const command = commandSchema.parse(value), target = command.target;
  const path = target.kind === "APPLICATION_ACTIVATION"
    ? `/api/tenant/core/v1/companies/${target.companyId}/application-activations/${target.applicationKey}` as const
    : target.kind === "ADDON_ACTIVATION"
      ? `/api/tenant/core/v1/companies/${target.companyId}/application-activations/${target.applicationKey}/addons/${target.addonKey}` as const
      : `/api/tenant/core/v1/branches/${target.branchId}/application-activations/${target.applicationKey}/addons/${target.addonKey}` as const;
  const response = await axiosClient.patch<unknown>(path, command.body, {
    signal, cache: "no-store", maxResponseBytes: 1_048_576, headers: { "x-idempotency-key": command.idempotencyKey },
  });
  const reference = companyCommandReference(target, command.idempotencyKey, command.observedResourceId);
  if (reference) return parseCompanySubmission(response.data, response.status, reference);
  if (response.status !== 200) invalid();
  return parseCommandReceiptResponse(response.data, command.operationKind, command.observedResourceId);
}

function storageKey(actorId: string, request: ApplicationAccessRequest): string {
  uuid.parse(actorId);
  const target = validateApplicationAccessRequest(request);
  if (target.kind !== "APPLICATION_ACTIVATION" && target.kind !== "ADDON_ACTIVATION" && target.kind !== "BRANCH_OVERRIDE") invalid();
  return `tenant-activation-intent:${actorId}:${target.kind}:${"companyId" in target ? target.companyId : target.branchId}:${target.applicationKey}:${"addonKey" in target ? target.addonKey : ""}`;
}
const retainedSchema = z.object({ actorId: uuid, command: commandSchema }).strict();
export function readActivationIntent(actorId: string, request: ApplicationAccessRequest): ActivationCommand | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(storageKey(actorId, request));
  if (raw === null) return null;
  if (raw.length > 4096) invalid();
  const record = retainedSchema.parse(JSON.parse(raw));
  if (record.actorId !== actorId || storageKey(actorId, record.command.target) !== storageKey(actorId, request)) invalid();
  return record.command;
}
export function retainActivationIntent(actorId: string, command: ActivationCommand): void {
  const value = commandSchema.parse(command), previous = readActivationIntent(actorId, value.target);
  if (previous !== null && JSON.stringify(previous) !== JSON.stringify(value)) invalid();
  const text = JSON.stringify({ actorId, command: value }), key = storageKey(actorId, value.target);
  window.sessionStorage.setItem(key, text);
  if (window.sessionStorage.getItem(key) !== text) invalid();
}
export function clearActivationIntent(actorId: string, command: ActivationCommand): void {
  const original = readActivationIntent(actorId, command.target);
  if (original !== null && JSON.stringify(original) !== JSON.stringify(command)) invalid();
  const key = storageKey(actorId, command.target);
  window.sessionStorage.removeItem(key);
  if (window.sessionStorage.getItem(key) !== null) invalid();
}
function invalid(): never { throw new Error("The original activation request or receipt could not be verified."); }
