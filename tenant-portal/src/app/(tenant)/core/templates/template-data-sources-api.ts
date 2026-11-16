import type { CorePath } from "@/lib/api/envelope";
import { coreGetResponse } from "../core-api";
import { invalidCoreResponse, record } from "../contracts/core-page";
import type { TemplateScope } from "./templates-contract";
import { MAX_TEMPLATE_DATA_SOURCES, parseTemplateSourceMetadata, type TemplateSourceMetadata } from "./template-source-metadata";
import { readTemplateResponse } from "./template-wire";

export async function fetchTemplateDataSources(
  scope: TemplateScope,
  signal?: AbortSignal,
  assertCurrent?: () => void,
): Promise<TemplateSourceMetadata[]> {
  const query = new URLSearchParams({ scopeType: scope.type });
  if (scope.companyId) query.set("companyId", scope.companyId);
  if (scope.branchId) query.set("branchId", scope.branchId);
  const response = await coreGetResponse(`/api/tenant/core/v1/templates/data-sources?${query}` as CorePath, {
    signal, maxResponseBytes: 900_000, requireExactResponseTarget: true,
    ...(assertCurrent ? { assertCurrent } : {}),
  });
  const body = record(readTemplateResponse(response, [200]));
  if (!body || !Array.isArray(body.items) || body.items.length > MAX_TEMPLATE_DATA_SOURCES) invalidCoreResponse();
  const items = body.items.map(parseTemplateSourceMetadata);
  if (new Set(items.map(item => item.adapterKey)).size !== items.length) invalidCoreResponse();
  return items;
}
