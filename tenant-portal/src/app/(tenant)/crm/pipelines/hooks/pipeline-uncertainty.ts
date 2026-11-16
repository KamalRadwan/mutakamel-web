import type { NormalizedApiError } from "@/lib/api/errors";

export function isUncertainPipelineWrite(error: NormalizedApiError | null): boolean {
  if (!error) return false;
  // Request-build errors are local and never leave the browser.
  return (error.status === 0 && !error.code?.startsWith("PIPELINE_")) || error.status >= 500
    || error.code === "GW.IDEM.IN_FLIGHT" || error.code === "IDEMPOTENCY_REQUEST_PROCESSING";
}
