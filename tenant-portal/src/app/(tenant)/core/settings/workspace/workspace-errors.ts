import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";

/**
 * Thrown exclusively when Core answered with HTTP 200 OK, yet the JSON payload
 * failed our runtime contract validator (malformed schema, inconsistent
 * pagination metadata, or cross-page duplicate overlap).
 *
 * Kept distinct from `NormalizedApiError` rather than inventing a synthetic
 * backend `errorCode`, because a schema failure after HTTP 200 is neither a
 * status-0 offline outage nor an authoritative backend domain code.
 */
export class WorkspaceInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceInvalidResponseError";
  }
}

export function isWorkspaceInvalidResponseError(
  error: unknown,
): error is WorkspaceInvalidResponseError {
  return error instanceof WorkspaceInvalidResponseError;
}

export type WorkspaceQueryFailure =
  | { readonly kind: "invalid-response" }
  | { readonly kind: "api"; readonly error: NormalizedApiError };

export function classifyWorkspaceFailure(error: unknown): WorkspaceQueryFailure {
  if (isWorkspaceInvalidResponseError(error)) {
    return { kind: "invalid-response" };
  }
  return { kind: "api", error: normalizeApiError(error) };
}

interface WorkspaceFailureCopy {
  readonly title: string;
  readonly description: string | undefined;
  readonly retryable: boolean;
}

export function describeWorkspaceLoadFailure(
  failure: WorkspaceQueryFailure,
  t: Dictionary,
  describeError: (error: NormalizedApiError | null) => string | undefined,
): WorkspaceFailureCopy {
  if (failure.kind === "invalid-response") {
    return {
      title: t.coreSettings.workspaceLoadFailed,
      description: t.coreSettings.invalidResponseDescription,
      retryable: true,
    };
  }

  return {
    title: t.coreSettings.workspaceLoadFailed,
    description: describeError(failure.error),
    retryable: failure.error.status !== 403,
  };
}

export function describeCurrencyOptionsFailure(
  failure: WorkspaceQueryFailure,
  t: Dictionary,
  describeError: (error: NormalizedApiError | null) => string | undefined,
): WorkspaceFailureCopy {
  if (failure.kind === "invalid-response") {
    return {
      title: t.coreSettings.currencyLoadFailed,
      description: t.coreSettings.invalidResponseDescription,
      retryable: true,
    };
  }

  const { error } = failure;
  if (error.status === 403) {
    return {
      title: t.coreSettings.currencyLoadFailed,
      description: describeError(error) ?? t.errors.accessDeniedMessage,
      retryable: false,
    };
  }

  if (
    error.status === 0 ||
    error.status === 504 ||
    error.code === "CLIENT_REQUEST_TIMEOUT" ||
    error.code === "REQUEST_TIMED_OUT"
  ) {
    return {
      title: t.coreSettings.currencyLoadFailed,
      description: describeError(error),
      retryable: true,
    };
  }

  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    return {
      title: t.coreSettings.currencyLoadFailed,
      description: formatApiErrorMessage(
        {
          status: error.status,
          message: `${outcome.title} — ${outcome.description}`,
          correlationId: error.correlationId,
        },
        t,
      ),
      retryable: outcome.retryable,
    };
  }

  return {
    title: t.coreSettings.currencyLoadFailed,
    description: formatApiErrorMessage(
      {
        status: error.status,
        message: t.coreSettings.currencyOptionsLoadFailedDescription,
        correlationId: error.correlationId,
      },
      t,
    ),
    retryable: true,
  };
}

export function isAbortError(error: unknown): boolean {
  return (
    ((error instanceof Error || error instanceof DOMException) && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_CANCELED")
  );
}
