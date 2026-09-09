import { z } from "zod";
import { readCoreResponse } from "@/lib/api/envelope";
import { applicationAccessSchemas, validateApplicationAccessRequest, type ApplicationAccessRequest } from "./application-access-contract";
import { configurationSchemaRef } from "./application-configuration-read";
import { parseConfigurationInputSchema } from "./configuration-input-schema";

const uuid = applicationAccessSchemas.uuid;
const data = z.object({
  scope: applicationAccessSchemas.scope,
  target: z.object({ applicationId: uuid, applicationKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/u), addonId: uuid,
    addonKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u) }).strict(),
  definitionVersionId: uuid, schemaRef: configurationSchemaRef, inputSchema: z.unknown().transform(parseConfigurationInputSchema),
}).strict();
const envelope = z.object({ success: z.literal(true), data, correlationId: z.string().max(36), timestamp: z.iso.datetime().max(30) }).strict();
export type ConfigurationInputView = z.infer<typeof data>;
export type ConfigurationTarget = Extract<ApplicationAccessRequest, { kind: "COMPANY_CONFIGURATION" | "BRANCH_CONFIGURATION" }>;

export function configurationTarget(value: unknown): ConfigurationTarget {
  const target = validateApplicationAccessRequest(value);
  if (target.kind !== "COMPANY_CONFIGURATION" && target.kind !== "BRANCH_CONFIGURATION") throw new Error("Invalid configuration scope.");
  return target;
}

export async function readConfigurationInput(input: ConfigurationTarget, signal?: AbortSignal): Promise<ConfigurationInputView> {
  const target = configurationTarget(input);
  const path = target.kind === "COMPANY_CONFIGURATION"
    ? `/api/tenant/core/v1/companies/${target.companyId}/application-activations/${target.applicationKey}/addons/${target.addonKey}/configuration/input-schema` as const
    : `/api/tenant/core/v1/branches/${target.branchId}/application-activations/${target.applicationKey}/addons/${target.addonKey}/configuration/input-schema` as const;
  const response = await readCoreResponse(path, { signal, cache: "no-store", maxResponseBytes: 1_048_576 });
  const parsed = envelope.safeParse(response.data);
  if (!parsed.success) throw new Error("The configuration input response could not be verified.");
  const view = parsed.data.data;
  if (view.target.applicationKey !== target.applicationKey || view.target.addonKey !== target.addonKey
    || (target.kind === "COMPANY_CONFIGURATION" ? view.scope.kind !== "COMPANY" || view.scope.companyId !== target.companyId
      : view.scope.kind !== "BRANCH" || view.scope.branchId !== target.branchId)) throw new Error("The configuration input scope could not be verified.");
  return view;
}
