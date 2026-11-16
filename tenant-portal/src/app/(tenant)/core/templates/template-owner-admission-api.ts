import type { CorePath } from "@/lib/api/envelope";
import { coreGetResponse } from "../core-api";
import { invalidCoreResponse, isMember, record } from "../contracts/core-page";
import { TEMPLATE_ADAPTER_KEYS, type TemplateAdapterKey } from "./template-source-metadata";
import type { TemplateScope } from "./templates-contract";
import { readTemplateResponse } from "./template-wire";
import { readTemplateOwnerAdmission, type TemplateOwnerAdmission, type TemplateOwnerAdmissionHost } from "./template-owner-admission";

/** Full R8 owner context on the existing authorized schema route; host qualification is independent of this response. */
export async function fetchTemplateOwnerAdmission(
  adapterKey: TemplateAdapterKey,
  scope: TemplateScope,
  host: TemplateOwnerAdmissionHost,
  signal?: AbortSignal,
): Promise<TemplateOwnerAdmission | null> {
  if (!isMember(TEMPLATE_ADAPTER_KEYS, adapterKey)) invalidCoreResponse();
  if (!host.isCurrent()) return null;
  const query = new URLSearchParams({ scopeType: scope.type, schemaVersion: "1" });
  if (scope.companyId) query.set("companyId", scope.companyId);
  if (scope.branchId) query.set("branchId", scope.branchId);
  const response = await coreGetResponse(`/api/tenant/core/v1/templates/data-sources/${encodeURIComponent(adapterKey)}/schema?${query}` as CorePath, {
    signal, maxResponseBytes: 900_000, requireExactResponseTarget: true,
  });
  const row = record(readTemplateResponse(response, [200]));
  if (!row || row.adapterKey !== adapterKey) invalidCoreResponse();
  return readTemplateOwnerAdmission(row, host);
}
