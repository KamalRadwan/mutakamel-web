import { axiosClient } from "@/lib/api/axiosClient";
import type { CorePath } from "@/lib/api/envelope";
import { commercialUuid, invalidCommercialRead } from "./commercial-command-fields";
import { parseDefinitionAdoptionSelections, parseDefinitionAdoptionTargets } from "./definition-adoption-discovery";

async function read(path: CorePath, after: string | null, signal: AbortSignal) {
  if (after !== null) commercialUuid.parse(after);
  const url = after === null ? path : `${path}?${new URLSearchParams({ after })}`;
  const response = await axiosClient.get<unknown>(url, { signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024 });
  if (response.status !== 200) invalidCommercialRead();
  return response.data;
}

export async function readDefinitionAdoptionSelections(after: string | null, signal: AbortSignal) {
  const body = await read("/api/tenant/core/v1/subscription/definition-adoption-selections", after, signal);
  return parseDefinitionAdoptionSelections(body, after);
}

export async function readDefinitionAdoptionTargets(addonSelectionId: string, after: string | null, signal: AbortSignal) {
  const selected = commercialUuid.parse(addonSelectionId);
  const body = await read(`/api/tenant/core/v1/subscription/definition-adoption-selections/${selected}/targets`, after, signal);
  return parseDefinitionAdoptionTargets(body, selected, after);
}
