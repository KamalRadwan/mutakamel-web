import { invalidCoreResponse, record } from "../contracts/core-page";

export const TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES = 3_000_000;

export class InvalidVersionRestoreReply extends Error {
  constructor(readonly correlationId?: string) {
    super("Invalid Core version restore response.");
  }
}

export class InvalidRecoveryRestoreReply extends Error {
  constructor(readonly correlationId?: string) {
    super("Invalid Core recovery snapshot restore response.");
  }
}

/** Validate transport evidence before unwrapping the single current Core envelope. */
export function readTemplateResponse(
  response: { status: number; data: unknown },
  statuses: readonly number[],
  readDomainStatus?: (payload: Record<string, unknown>) => boolean,
): unknown {
  if (!statuses.includes(response.status)) invalidCoreResponse();
  const outer = record(response.data);
  if (!outer) invalidCoreResponse();
  const wrapped = Object.hasOwn(outer, "data");
  if (wrapped && ["items", "templateId", "renderJobId", "draft", "scopes"].some(key => Object.hasOwn(outer, key))) {
    invalidCoreResponse();
  }
  const payload = wrapped ? record(outer.data) : outer;
  if (!payload || Object.hasOwn(payload, "data")) invalidCoreResponse();
  for (const layer of wrapped ? [outer, payload] : [outer]) {
    if ((Object.hasOwn(layer, "success") && layer.success !== true) ||
      (Object.hasOwn(layer, "statusCode") && layer.statusCode !== response.status) ||
      // Preview jobs and validation runs have their own string-valued domain status.
      (Object.hasOwn(layer, "status") && typeof layer.status !== "string" && layer.status !== response.status) ||
      ["errorCode", "errorCategory", "errors", "details", "type", "title", "detail"].some(key => Object.hasOwn(layer, key)) ||
      (Object.hasOwn(layer, "code") && !Object.hasOwn(layer, "templateId"))) {
      invalidCoreResponse();
    }
    if (Object.hasOwn(layer, "status") && typeof layer.status === "string" &&
      (layer !== payload || !(readDomainStatus?.(layer) ??
        ((Object.hasOwn(layer, "renderJobId") || Object.hasOwn(layer, "validationRunId")) &&
          ["PENDING", "RETRYING", "COMPLETED", "FAILED", "PASSED"].includes(layer.status))))) invalidCoreResponse();
  }
  return payload;
}
