import { z } from "zod";
import { readCoreResponse, type CorePath } from "@/lib/api/envelope";
import { applicationAccessSchemas as schemas } from "./application-access-contract";
import { accessPageEnvelope, accessPagination, matchesAccessPagination } from "./application-access-pagination";

const inputSchema = z.object({ scope: z.enum(["COMPANY", "BRANCH"]), scopeId: schemas.uuid,
  ...accessPagination }).strict();
export type ApplicationAccessListRequest = z.infer<typeof inputSchema>;
const itemSchema = z.object({ scope: schemas.scope, target: schemas.target,
  resourceScope: z.enum(["COMPANY", "BRANCH"]), resource: schemas.activationResource,
  observation: z.literal("LOCAL_PROJECTION"), operationalUse: z.literal("NOT_EVALUATED") }).strict();
const envelopeSchema = accessPageEnvelope(itemSchema);
export type ApplicationAccessListItem = z.infer<typeof itemSchema>;
export interface ApplicationAccessListPage { items: ApplicationAccessListItem[]; meta: z.infer<typeof envelopeSchema>["meta"] }

export function parseApplicationAccessList(body: unknown, request: ApplicationAccessListRequest): ApplicationAccessListPage {
  const target = inputSchema.parse(request);
  const result = envelopeSchema.safeParse(body);
  if (!result.success) invalidList();
  const { data, meta } = result.data;
  if (!matchesAccessPagination(meta, data.length, target)) invalidList();
  const seen = new Set<string>();
  for (const item of data) {
    const base = item.target.addonKey === null;
    const identity = `${item.target.applicationId}:${item.target.addonId}`;
    const scopeMatches = item.scope.kind === target.scope && (target.scope === "COMPANY" ? item.scope.companyId : item.scope.branchId) === target.scopeId;
    if (!scopeMatches || item.scope.companyId !== data[0]?.scope.companyId || seen.has(identity) || (item.target.addonId === null) !== base
      || (!base && item.target.addonKey?.split(".")[0] !== item.target.applicationKey)
      || item.resource.kind !== (base ? "APPLICATION_ACTIVATION" : target.scope === "COMPANY" ? "ADDON_ACTIVATION" : "BRANCH_OVERRIDE")
      || item.resourceScope !== (base || target.scope === "COMPANY" ? "COMPANY" : "BRANCH")) invalidList();
    seen.add(identity);
  }
  return { items: data, meta };
}

export async function readApplicationAccessList(request: ApplicationAccessListRequest, signal?: AbortSignal): Promise<ApplicationAccessListPage> {
  const input = inputSchema.parse(request);
  const path: CorePath = input.scope === "COMPANY"
    ? `/api/tenant/core/v1/companies/${input.scopeId}/application-activations`
    : `/api/tenant/core/v1/branches/${input.scopeId}/application-activations`;
  const query = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
  const response = await readCoreResponse(`${path}?${query}`, { signal, cache: "no-store", maxResponseBytes: 1_048_576 });
  return parseApplicationAccessList(response.data, input);
}

function invalidList(): never { throw new Error("The scoped Application directory could not be verified."); }
