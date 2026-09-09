import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { axiosClient } from "@/lib/api/axiosClient";
import { applicationAccessSchemas, type ApplicationAccessView } from "./application-access-contract";
import { configurationSafeValues, configurationSchemaRef } from "./application-configuration-read";
import { configurationTarget, type ConfigurationInputView, type ConfigurationTarget } from "./configuration-input-api";
import { companyCommandReference, parseCommandReceiptResponse, parseCompanySubmission, type AccessCommandReceipt, type CompanyCommandPending } from "./company-command-status";

const uuid = applicationAccessSchemas.uuid, uuid7 = uuid.refine((value) => value[14] === "7"), revision = applicationAccessSchemas.revision;
export const configurationReason = z.string().min(3).max(500).refine((value) => value === value.trim()
  && !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127));
const body = z.object({ expectedConfigRevision: z.union([z.literal("0"), revision]), definitionVersionId: uuid,
  schemaRef: configurationSchemaRef, values: configurationSafeValues, reason: configurationReason }).strict();
const commandSchema = z.object({ idempotencyKey: uuid7, target: z.unknown().transform(configurationTarget), observedResourceId: uuid7.nullable(), body }).strict()
  .refine((value) => (value.observedResourceId === null) === (value.body.expectedConfigRevision === "0"));
export type ConfigurationCommand = z.infer<typeof commandSchema>;
export type ConfigurationReceipt = AccessCommandReceipt;

export function configurationInputMatches(current: ApplicationAccessView, input: ConfigurationInputView): boolean {
  if (current.resource.kind !== "CONFIGURATION" || JSON.stringify(current.scope) !== JSON.stringify(input.scope)
    || JSON.stringify(current.target) !== JSON.stringify(input.target) || current.source.selectedDefinitionVersionId !== input.definitionVersionId
    || current.source.adoptionPending) return false;
  const version = current.resource.currentVersion;
  return !version || (version.definitionVersionId === input.definitionVersionId && JSON.stringify(version.schemaRef) === JSON.stringify(input.schemaRef));
}

export function captureConfigurationCommand(target: ConfigurationTarget, current: ApplicationAccessView, input: ConfigurationInputView,
  values: Record<string, unknown>, reason: string, idempotencyKey: string): ConfigurationCommand {
  if (current.resource.kind !== "CONFIGURATION" || !configurationInputMatches(current, input)) invalid();
  return commandSchema.parse({ idempotencyKey, target, observedResourceId: current.resource.bindingId,
    body: { expectedConfigRevision: current.resource.revision, definitionVersionId: input.definitionVersionId,
      schemaRef: input.schemaRef, values, reason } });
}

export async function sendConfigurationCommand(value: ConfigurationCommand, signal: AbortSignal): Promise<ConfigurationReceipt | CompanyCommandPending> {
  const command = commandSchema.parse(value), target = command.target;
  const path = target.kind === "COMPANY_CONFIGURATION"
    ? `/api/tenant/core/v1/companies/${target.companyId}/application-activations/${target.applicationKey}/addons/${target.addonKey}/configuration` as const
    : `/api/tenant/core/v1/branches/${target.branchId}/application-activations/${target.applicationKey}/addons/${target.addonKey}/configuration` as const;
  const response = await axiosClient.patch<unknown>(path, command.body, { signal, cache: "no-store", maxResponseBytes: 1_048_576,
    headers: { "x-idempotency-key": command.idempotencyKey } });
  const reference = companyCommandReference(target, command.idempotencyKey, command.observedResourceId);
  if (reference) return parseCompanySubmission(response.data, response.status, reference);
  const kind = target.kind === "COMPANY_CONFIGURATION" ? "SET_COMPANY_CONFIGURATION" : "SET_BRANCH_CONFIGURATION";
  if (response.status !== 200) invalid();
  return parseCommandReceiptResponse(response.data, kind, command.observedResourceId);
}

const intentSchema = z.object({ idempotencyKey: uuid7, target: z.unknown().transform(configurationTarget), observedResourceId: uuid7.nullable(),
  body: body.omit({ values: true, reason: true }), digest: z.string().regex(/^[0-9a-f]{64}$/u) }).strict()
  .refine((value) => (value.observedResourceId === null) === (value.body.expectedConfigRevision === "0"));
export type ConfigurationIntent = z.infer<typeof intentSchema>;
const saved = z.object({ actorId: uuid, intent: intentSchema }).strict();
const previousSaved = z.object({ actorId: uuid, command: commandSchema }).strict();
function storageKey(actorId: string, request: ConfigurationTarget) {
  uuid.parse(actorId); const target = configurationTarget(request);
  return `tenant-configuration-intent:${actorId}:${target.kind}:${"companyId" in target ? target.companyId : target.branchId}:${target.applicationKey}:${target.addonKey}`;
}
export function readConfigurationIntent(actorId: string, target: ConfigurationTarget): ConfigurationIntent | null {
  const key = storageKey(actorId, target), text = sessionStorage.getItem(key);
  if (text === null) return null;
  try {
    if (text.length > 262_144) invalid();
    const parsed: unknown = JSON.parse(text), current = saved.safeParse(parsed);
    if (current.success) {
      if (current.data.actorId !== actorId || JSON.stringify(current.data.intent.target) !== JSON.stringify(configurationTarget(target))) invalid();
      return current.data.intent;
    }
    // Migrate only browser-local entries written by the earlier editor. Never
    // restore their values into React state or send a command during this read.
    const previous = previousSaved.parse(parsed);
    if (previous.actorId !== actorId || JSON.stringify(previous.command.target) !== JSON.stringify(configurationTarget(target))) invalid();
    const intent = describeConfigurationIntent(previous.command);
    sessionStorage.setItem(key, JSON.stringify(saved.parse({ actorId, intent })));
    return intent;
  } catch {
    // An unreadable original still blocks replacement. Scrub a possibly secret
    // payload while retaining an unavailable marker rather than an empty slot.
    sessionStorage.setItem(key, JSON.stringify({ actorId, unavailable: true }));
    invalid();
  }
}
export function retainConfigurationIntent(actorId: string, command: ConfigurationCommand) {
  const intent = describeConfigurationIntent(command), value = saved.parse({ actorId, intent });
  const previous = readConfigurationIntent(actorId, intent.target);
  if (previous && JSON.stringify(previous) !== JSON.stringify(intent)) invalid();
  // Values and free-text reasons can contain secrets. Persist only a digest and
  // the original routing/revision/key; a remount must prove matching re-entry.
  sessionStorage.setItem(storageKey(actorId, intent.target), JSON.stringify(value));
  return intent;
}
export function clearConfigurationIntent(actorId: string, command: ConfigurationCommand) {
  clearConfigurationMetadata(actorId, describeConfigurationIntent(command));
}
/** A verified terminal status can resolve the original without secret re-entry. */
export function clearConfigurationMetadata(actorId: string, intent: ConfigurationIntent) {
  const previous = readConfigurationIntent(actorId, intent.target);
  if (!previous || JSON.stringify(previous) !== JSON.stringify(intentSchema.parse(intent))) invalid();
  const key = storageKey(actorId, intent.target);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null) invalid();
}
export function restoreConfigurationCommand(intent: ConfigurationIntent, values: Record<string, unknown>, reason: string): ConfigurationCommand {
  const command = commandSchema.parse({ idempotencyKey: intent.idempotencyKey, target: intent.target, observedResourceId: intent.observedResourceId,
    body: { ...intent.body, values, reason } });
  if (JSON.stringify(describeConfigurationIntent(command)) !== JSON.stringify(intentSchema.parse(intent))) invalid();
  return command;
}
export function configurationRestoreInputMatches(intent: ConfigurationIntent, input: ConfigurationInputView): boolean {
  return intent.body.definitionVersionId === input.definitionVersionId && JSON.stringify(intent.body.schemaRef) === JSON.stringify(input.schemaRef);
}
function describeConfigurationIntent(value: ConfigurationCommand): ConfigurationIntent {
  const command = commandSchema.parse(value);
  const digest = Array.from(sha256(new TextEncoder().encode(canonical(command))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return intentSchema.parse({ idempotencyKey: command.idempotencyKey, target: command.target, observedResourceId: command.observedResourceId,
    body: { expectedConfigRevision: command.body.expectedConfigRevision, definitionVersionId: command.body.definitionVersionId, schemaRef: command.body.schemaRef }, digest });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function invalid(): never { throw new Error("The configuration command could not be verified."); }
