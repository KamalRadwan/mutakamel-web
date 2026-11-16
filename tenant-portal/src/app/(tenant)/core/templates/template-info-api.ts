import type { CorePath } from "@/lib/api/envelope";
import { coreGetResponse } from "../core-api";
import { invalidCoreResponse, isMember } from "../contracts/core-page";
import { TEMPLATE_ADAPTER_KEYS, type TemplateAdapterKey } from "./template-source-metadata";
import type { TemplateScope } from "./templates-contract";
import { readTemplateInfoResponse, type TemplateInfo, type TemplateInfoCanonical } from "./template-info";

/** Existing guarded owner schema route; no derived descriptor, new endpoint or fallback checksum. */
export async function fetchTemplateInfo(adapterKey: TemplateAdapterKey, scope: TemplateScope, canonical: TemplateInfoCanonical, signal?: AbortSignal): Promise<TemplateInfo> {
  if (!isMember(TEMPLATE_ADAPTER_KEYS, adapterKey)) invalidCoreResponse();
  const query = new URLSearchParams({ scopeType: scope.type, schemaVersion: "1" });
  if (scope.companyId) query.set("companyId", scope.companyId);
  if (scope.branchId) query.set("branchId", scope.branchId);
  const response = await coreGetResponse(`/api/tenant/core/v1/templates/data-sources/${encodeURIComponent(adapterKey)}/schema?${query}` as CorePath, {
    signal, maxResponseBytes: 900_000, requireExactResponseTarget: true,
  });
  return readTemplateInfoResponse(response, adapterKey, canonical);
}
