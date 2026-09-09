import { z } from "zod";
import { parseAccessCommandReceipt, parseApplicationAddonCompanyActivationStatus, parseApplicationAddonCompanyConfigurationStatus,
  type ApplicationAccessCommandReceipt, type ApplicationAddonCompanyActivationStatus, type ApplicationAddonCompanyConfigurationStatus,
} from "@mutakamel/core-app-contracts/public/application-access";
import { axiosClient } from "@/lib/api/axiosClient";
import { applicationAccessSchemas, validateApplicationAccessRequest, type ApplicationAccessRequest } from "./application-access-contract";

export type CompanyCommandStatus = ApplicationAddonCompanyActivationStatus | ApplicationAddonCompanyConfigurationStatus;
export type CompanyCommandPending = Extract<CompanyCommandStatus, { state: "PENDING" }>;
export type CompanyCommandOutcome = Exclude<CompanyCommandStatus, { state: "COMMITTED" }>;
export type AccessCommandReceipt = ApplicationAccessCommandReceipt;
const uuid7 = applicationAccessSchemas.uuid.refine((value) => value[14] === "7");
const referenceSchema = z.object({ commandId: uuid7, observedResourceId: uuid7.nullable(),
  target: z.unknown().transform(validateApplicationAccessRequest).refine((target) => target.kind === "ADDON_ACTIVATION" || target.kind === "COMPANY_CONFIGURATION"),
}).strict();
export type CompanyCommandReference = z.infer<typeof referenceSchema>;
const envelope = z.object({ success: z.literal(true), data: z.unknown(), correlationId: z.string().max(36), timestamp: z.iso.datetime({ offset: true }).max(30) }).strict();

export function companyCommandReference(target: ApplicationAccessRequest, commandId: string, observedResourceId: string | null): CompanyCommandReference | null {
  if (target.kind !== "ADDON_ACTIVATION" && target.kind !== "COMPANY_CONFIGURATION") return null;
  return referenceSchema.parse({ target, commandId, observedResourceId });
}
export function parseCommandReceiptResponse(body: unknown, operationKind: AccessCommandReceipt["operationKind"], resourceId: string | null): AccessCommandReceipt {
  const receipt = parseAccessCommandReceipt(envelope.parse(body).data);
  if (receipt.operationKind !== operationKind || (resourceId !== null && receipt.resourceId !== resourceId)) invalid();
  return receipt;
}
function parseStatus(data: unknown, reference: CompanyCommandReference): CompanyCommandStatus {
  const result = reference.target.kind === "ADDON_ACTIVATION"
    ? parseApplicationAddonCompanyActivationStatus(data) : parseApplicationAddonCompanyConfigurationStatus(data);
  if (result.state === "COMMITTED") {
    if (reference.observedResourceId !== null && result.resourceId !== reference.observedResourceId) invalid();
  } else if (result.commandId !== reference.commandId) invalid();
  return result;
}
export function parseCompanySubmission(body: unknown, status: number, reference: CompanyCommandReference): AccessCommandReceipt | CompanyCommandPending {
  const result = parseStatus(envelope.parse(body).data, referenceSchema.parse(reference));
  if (status === 200 && result.state === "COMMITTED") return result;
  if (status === 202 && result.state === "PENDING") return result;
  return invalid();
}
export async function readCompanyCommandStatus(value: CompanyCommandReference, observed: CompanyCommandPending, signal: AbortSignal): Promise<CompanyCommandStatus> {
  const reference = referenceSchema.parse(value), target = reference.target;
  const previous = parseStatus(observed, reference);
  if (previous.state !== "PENDING") return invalid();
  if (target.kind !== "ADDON_ACTIVATION" && target.kind !== "COMPANY_CONFIGURATION") return invalid();
  const path = target.kind === "ADDON_ACTIVATION"
    ? `/api/tenant/core/v1/companies/${target.companyId}/application-activations/${target.applicationKey}/addons/${target.addonKey}/activation-commands/${reference.commandId}` as const
    : `/api/tenant/core/v1/companies/${target.companyId}/application-activations/${target.applicationKey}/addons/${target.addonKey}/configuration-commands/${reference.commandId}` as const;
  const response = await axiosClient.get<unknown>(path, { signal, cache: "no-store", maxResponseBytes: 1_048_576 });
  if (response.status !== 200) invalid();
  const result = parseStatus(envelope.parse(response.data).data, reference);
  // Both owner rejection writers advance the command revision. The committed
  // receipt has its own operation identity/revision and is not compared here.
  if (result.state !== "COMMITTED" && (BigInt(result.revision) < BigInt(previous.revision)
    || (result.state === "REJECTED" && result.revision === previous.revision))) invalid();
  return result;
}

const retained = z.object({ actorId: applicationAccessSchemas.uuid, reference: referenceSchema, pending: z.unknown() }).strict();
function storageKey(actorId: string, value: CompanyCommandReference): string {
  applicationAccessSchemas.uuid.parse(actorId);
  const reference = referenceSchema.parse(value), target = reference.target;
  if (target.kind !== "ADDON_ACTIVATION" && target.kind !== "COMPANY_CONFIGURATION") return invalid();
  return `tenant-company-command:${actorId}:${target.kind}:${target.companyId}:${target.applicationKey}:${target.addonKey}:${reference.commandId}`;
}
/** Only a verified 202/status observation creates this nonsecret reference.
 * Absence never licenses guessing a status route from an uncertain PATCH key. */
export function readCompanyCommandContinuation(actorId: string, reference: CompanyCommandReference): CompanyCommandPending | null {
  const text = sessionStorage.getItem(storageKey(actorId, reference));
  if (text === null) return null;
  if (text.length > 32_768) invalid();
  const record = retained.parse(JSON.parse(text));
  if (record.actorId !== actorId || JSON.stringify(record.reference) !== JSON.stringify(referenceSchema.parse(reference))) invalid();
  const pending = parseStatus(record.pending, reference);
  if (pending.state !== "PENDING") return invalid();
  return pending;
}
export function retainCompanyCommandContinuation(actorId: string, reference: CompanyCommandReference, value: CompanyCommandPending): CompanyCommandPending {
  const pending = parseStatus(value, referenceSchema.parse(reference));
  if (pending.state !== "PENDING") return invalid();
  const previous = readCompanyCommandContinuation(actorId, reference);
  if (previous && (BigInt(pending.revision) < BigInt(previous.revision)
    || BigInt(pending.progress.pageNumber) < BigInt(previous.progress.pageNumber)
    || BigInt(pending.progress.validatedBranchCount) < BigInt(previous.progress.validatedBranchCount)
    || (pending.revision === previous.revision && (pending.progress.pageNumber !== previous.progress.pageNumber
      || pending.progress.validatedBranchCount !== previous.progress.validatedBranchCount)))) invalid();
  const key = storageKey(actorId, reference), text = JSON.stringify({ actorId, reference, pending });
  sessionStorage.setItem(key, text);
  if (sessionStorage.getItem(key) !== text) invalid();
  return pending;
}
export function clearCompanyCommandContinuation(actorId: string, reference: CompanyCommandReference): void {
  readCompanyCommandContinuation(actorId, reference);
  const key = storageKey(actorId, reference);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null) invalid();
}
function invalid(): never { throw new Error("The original Company command status could not be verified."); }
