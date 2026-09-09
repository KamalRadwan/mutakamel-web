import { axiosClient } from "@/lib/api/axiosClient";
import type { CorePath } from "@/lib/api/envelope";
import { commercialSelector, commercialUuid7, invalidCommercialRead } from "./commercial-command-fields";
import { parseCommercialPreparationRequest, parseCommercialPreviewRequest, type CommercialPreparationRequest, type CommercialPreviewRequest } from "./commercial-command-request";
import { parseCommercialOperation } from "./commercial-operation";
import { parseCommercialPreview, parseDefinitionAdoptionPreview, type CommercialPreview } from "./commercial-preview";
import { parseDefinitionAdoptionRequest, parseDefinitionAdoptionSources, type DefinitionAdoptionSource } from "./definition-adoption-command";
import { parseCommercialApply } from "./commercial-apply";
import { commercialRecoveryRequestSchema, type CommercialRecoveryRequest } from "./commercial-recovery";

async function send(path: CorePath, body: unknown, key: string, status: number, signal: AbortSignal) {
  commercialUuid7.parse(key);
  const response = await axiosClient.post<unknown>(path, body, {
    signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024, headers: { "x-idempotency-key": key },
  });
  if (response.status !== status) invalidCommercialRead();
  return response.data;
}

export async function prepareCommercialChange(request: CommercialPreparationRequest, key: string, signal: AbortSignal) {
  const input = parseCommercialPreparationRequest(request);
  const body = await send("/api/tenant/core/v1/subscription/preparations", input, key, 202, signal);
  return parseCommercialOperation(body);
}

export async function previewCommercialChange(subscriptionId: string, request: CommercialPreviewRequest, key: string, signal: AbortSignal) {
  commercialSelector.parse(subscriptionId);
  const input = parseCommercialPreviewRequest(request);
  const body = await send("/api/tenant/core/v1/subscription/plan-change-previews", input, key, 201, signal);
  return parseCommercialPreview(body, { subscriptionId, request: input });
}

export async function applyCommercialChange(preview: CommercialPreview, key: string, signal: AbortSignal) {
  const previewId = commercialUuid7.parse(preview.previewId);
  const body = await send(`/api/tenant/core/v1/subscription/plan-change-previews/${previewId}/apply`, {}, key, 200, signal);
  return parseCommercialApply(body, preview);
}

export async function previewDefinitionAdoptionChange(subscriptionId: string | null, request: CommercialPreviewRequest,
  sources: DefinitionAdoptionSource[], key: string, signal: AbortSignal) {
  const input = parseCommercialPreviewRequest(request);
  parseDefinitionAdoptionSources(parseDefinitionAdoptionRequest({ expectedSubscriptionRevision: input.expectedSubscriptionRevision,
    changes: input.changes, ...(input.reason === undefined ? {} : { reason: input.reason }) }), sources);
  const body = await send("/api/tenant/core/v1/subscription/plan-change-previews", input, key, 201, signal);
  return parseDefinitionAdoptionPreview(body, { subscriptionId, request: input, sources });
}

export async function recoverCommercialOperation(operationId: string, request: CommercialRecoveryRequest, key: string, signal: AbortSignal) {
  const target = commercialUuid7.parse(operationId), input = commercialRecoveryRequestSchema.parse(request);
  const body = await send(`/api/tenant/core/v1/subscription/operations/${target}/recovery`, input, key, 202, signal);
  return parseCommercialOperation(body, target);
}
