import { readCoreResponse } from "@/lib/api/envelope";
import { commercialUuid7 } from "./commercial-command-fields";
import { parseCommercialOperation } from "./commercial-operation";

export async function readCommercialOperation(operationId: string, signal?: AbortSignal) {
  const target = commercialUuid7.parse(operationId);
  const response = await readCoreResponse(`/api/tenant/core/v1/subscription/operations/${target}`, {
    signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024,
  });
  // This route also accepts bound preview aliases; only the owner can resolve the canonical preparation identity.
  return parseCommercialOperation(response.data);
}
