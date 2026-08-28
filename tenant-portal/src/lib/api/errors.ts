import { TenantApiClientError } from "./axiosClient";

// docs/reference/errors.md#normalized-shape — the shape every error surface
// (ErrorState, Field, toast.errorFromApi) branches on. Built from what
// TenantApiClientError throws; never edits axiosClient.ts itself.
export interface NormalizedApiError {
  status: number;
  code?: string;
  message?: string;
  correlationId?: string;
  fieldErrors?: Record<string, string[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFieldErrors(details: unknown): Record<string, string[]> | undefined {
  if (!isRecord(details)) return undefined;
  const keys = Object.keys(details);
  // Core's ValidationPipe has no custom exceptionFactory, so field names are
  // already lost by the time the filter sees them — everything lands under
  // the literal key "_". That is not field-mappable; treat it as absent so
  // callers fall back to an in-body summary instead of a phantom Field.
  if (keys.length === 0 || (keys.length === 1 && keys[0] === "_")) return undefined;

  const fieldErrors: Record<string, string[]> = {};
  for (const key of keys) {
    const value = details[key];
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      fieldErrors[key] = value;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof TenantApiClientError) {
    const { status, data } = error.response;
    const code = typeof data.errorCode === "string" ? data.errorCode : typeof data.code === "string" ? data.code : undefined;
    const message = typeof data.message === "string" ? data.message : undefined;
    const correlationId = typeof data.correlationId === "string" ? data.correlationId : undefined;

    return {
      status,
      code,
      message,
      correlationId,
      fieldErrors: readFieldErrors(data.details),
    };
  }

  // Network failure, timeout, or anything that never reached a server
  // response — status 0 signals "no HTTP response at all" to callers.
  return {
    status: 0,
    message: error instanceof Error ? error.message : undefined,
  };
}
