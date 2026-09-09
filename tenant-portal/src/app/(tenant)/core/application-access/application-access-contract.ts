import { z } from "zod";
import { configurationSafeValues, configurationSchemaRef } from "./application-configuration-read";

// Core tenant/application-access/application-access-read.{contract,swagger}.ts.
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const bindingUuid = uuid.refine((value) => value[14] === "7");
const applicationKey = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u);
const addonKey = z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u);
const revision = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine((value) => /^[1-9][0-9]{0,18}$/u.test(value) && BigInt(value) <= BigInt("9223372036854775807"));
const timestamp = z.iso.datetime().max(30);
const lifecycle = z.enum(["DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]).nullable();
const company = { companyId: uuid, applicationKey };
const branch = { branchId: uuid, applicationKey, addonKey };
const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("APPLICATION_ACTIVATION"), ...company }).strict(),
  z.object({ kind: z.literal("ADDON_ACTIVATION"), ...company, addonKey }).strict(),
  z.object({ kind: z.literal("BRANCH_OVERRIDE"), ...branch }).strict(),
  z.object({ kind: z.literal("COMPANY_CONFIGURATION"), ...company, addonKey }).strict(),
  z.object({ kind: z.literal("BRANCH_CONFIGURATION"), ...branch }).strict(),
]).refine((value) => !("addonKey" in value) || value.addonKey.split(".")[0] === value.applicationKey);

export type ApplicationAccessRequest = z.infer<typeof requestSchema>;

const absent = { state: z.literal("NOT_CREATED"), id: z.null(), revision: z.literal("0") };
const stored = { state: z.literal("STORED"), id: bindingUuid, revision };
const absentAddon = { definitionVersionId: z.null(), configVersionId: z.null() };
const storedAddon = { definitionVersionId: uuid, configVersionId: bindingUuid.nullable() };
const companyFlags = { companyApplicationEnabled: z.boolean(), companyAddonEnabled: z.boolean() };
const configuration = {
  kind: z.literal("CONFIGURATION"), configurationState: z.literal("NOT_CONFIGURED"), currentVersion: z.null(),
};
const configurationVersion = z.object({
  id: bindingUuid, revision, definitionVersionId: uuid, schemaRef: configurationSchemaRef,
  configHash: z.string().regex(/^[0-9a-f]{64}$/u), values: configurationSafeValues,
}).strict();
const resource = z.union([
  z.object({ kind: z.literal("APPLICATION_ACTIVATION"), ...absent, enabled: z.null() }).strict(),
  z.object({ kind: z.literal("APPLICATION_ACTIVATION"), ...stored, enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal("ADDON_ACTIVATION"), ...absent, ...absentAddon, enabled: z.null() }).strict(),
  z.object({ kind: z.literal("ADDON_ACTIVATION"), ...stored, ...storedAddon, enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal("BRANCH_OVERRIDE"), ...absent, ...absentAddon, ...companyFlags, mode: z.null() }).strict(),
  z.object({ kind: z.literal("BRANCH_OVERRIDE"), ...stored, ...storedAddon, ...companyFlags, mode: z.enum(["INHERIT", "DISABLED"]) }).strict(),
  z.object({ ...configuration, bindingState: z.literal("NOT_CREATED"), bindingId: z.null(), revision: z.literal("0") }).strict(),
  z.object({ ...configuration, bindingState: z.literal("STORED"), bindingId: bindingUuid, revision }).strict(),
  z.object({ kind: z.literal("CONFIGURATION"), bindingState: z.literal("STORED"), bindingId: bindingUuid, revision,
    configurationState: z.literal("CONFIGURED"), currentVersion: configurationVersion }).strict(),
]);
const viewSchema = z.object({
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("COMPANY"), companyId: uuid, branchId: z.null() }).strict(),
    z.object({ kind: z.literal("BRANCH"), companyId: uuid, branchId: uuid }).strict(),
  ]),
  target: z.object({ applicationId: uuid, applicationKey, addonId: uuid.nullable(), addonKey: addonKey.nullable() }).strict(),
  resource,
  source: z.object({
    observedAt: timestamp, selectionState: z.enum(["SELECTED", "NOT_SELECTED"]),
    applicationLifecycleStatus: lifecycle, addonLifecycleStatus: lifecycle,
    selectedDefinitionVersionId: uuid.nullable(),
    definitionState: z.enum(["NOT_APPLICABLE", "PUBLISHED", "REVOKED", "UNAVAILABLE"]),
    localSourceState: z.enum(["MISSING", "MATCHED", "UNMATCHED"]), adoptionPending: z.boolean(),
  }).strict(),
  operationalUse: z.literal("NOT_EVALUATED"),
}).strict();
const envelopeSchema = z.object({
  success: z.literal(true), data: viewSchema, correlationId: z.string().max(36), timestamp,
}).strict();

export type ApplicationAccessView = z.infer<typeof viewSchema>;

// The frozen list contract deliberately reuses these exact singleton projections.
export const applicationAccessSchemas = { uuid, revision, scope: viewSchema.shape.scope, target: viewSchema.shape.target,
  activationResource: z.union([resource.options[0], resource.options[1], resource.options[2], resource.options[3], resource.options[4], resource.options[5]]) };

export function validateApplicationAccessRequest(value: unknown): ApplicationAccessRequest {
  const result = requestSchema.safeParse(value);
  if (!result.success) throw new Error("Invalid scoped Application read target.");
  return result.data;
}

export function parseApplicationAccessResponse(
  body: unknown, input: ApplicationAccessRequest,
): ApplicationAccessView {
  const request = validateApplicationAccessRequest(input);
  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) invalidResponse();
  const view = parsed.data.data;
  const branchRead = "branchId" in request;
  const expectedKind = request.kind.endsWith("_CONFIGURATION") ? "CONFIGURATION" : request.kind;
  if (view.resource.kind !== expectedKind || view.target.applicationKey !== request.applicationKey
    || (branchRead ? view.scope.kind !== "BRANCH" || view.scope.branchId !== request.branchId
      : view.scope.kind !== "COMPANY" || view.scope.companyId !== request.companyId)) invalidResponse();
  if (request.kind === "APPLICATION_ACTIVATION") {
    if (view.target.addonId !== null || view.target.addonKey !== null || view.source.addonLifecycleStatus !== null
      || view.source.selectedDefinitionVersionId !== null || view.source.definitionState !== "NOT_APPLICABLE") invalidResponse();
  } else if (view.target.addonId === null || view.target.addonKey !== request.addonKey
    || view.source.definitionState === "NOT_APPLICABLE") invalidResponse();
  return view;
}

function invalidResponse(): never {
  // Do not carry an unexpected response's keys or values into user-visible errors.
  throw new Error("The scoped Application response could not be verified.");
}
