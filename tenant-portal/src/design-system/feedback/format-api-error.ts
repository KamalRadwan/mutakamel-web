import type { NormalizedApiError } from "@/lib/api/errors";
import { classifyApiOutcome } from "@/lib/api/outcomes";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AppToastType } from "./AppToast";

// The evidence a user report needs to be traceable to a server log — see
// docs/reference/errors.md#normalized-shape. Never drop correlationId.
export function formatApiErrorMessage(error: NormalizedApiError, t: Dictionary): string | undefined {
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (error.correlationId) parts.push(`${t.errors.reference}: ${error.correlationId}`);
  return parts.length > 0 ? parts.join(" — ") : undefined;
}

export interface ApiOutcomeDescription {
  tone: AppToastType;
  title: string;
  description: string;
  /** True when trying the same thing again is a sensible next step. */
  retryable: boolean;
}

// S8 / S9. Four outcomes that all read as "it failed" if they share one
// message, and each needs a different next action from the user:
//
//   429                       wait, then repeat the same action
//   GW.RATE.UNAVAILABLE       the limiter is down — infrastructure, NOT a
//                             permission decision. Rendering this as "access
//                             denied" sends the user to an administrator for
//                             something an administrator cannot fix
//   idempotency in-flight     wait for the first attempt, then refresh
//   idempotency mismatch      reload and start over; resending is unsafe
//
// Returns null for anything else, so a caller keeps its own specific message
// instead of being flattened into a generic one.
export function describeApiOutcome(
  error: NormalizedApiError,
  t: Dictionary,
): ApiOutcomeDescription | null {
  switch (classifyApiOutcome(error)) {
    case "rateLimited":
      return {
        tone: "warning",
        title: t.errors.rateLimitedTitle,
        description: t.errors.rateLimitedDescription,
        retryable: true,
      };
    case "rateLimiterUnavailable":
      return {
        tone: "error",
        title: t.errors.limiterUnavailableTitle,
        description: t.errors.limiterUnavailableDescription,
        retryable: true,
      };
    case "idempotencyProcessing":
      return {
        tone: "warning",
        title: t.errors.idempotencyProcessingTitle,
        description: t.errors.idempotencyProcessingDescription,
        // Resending the same key is exactly what produced this. Waiting is
        // the action, so this is deliberately not retryable.
        retryable: false,
      };
    case "idempotencyMismatch":
      return {
        tone: "error",
        title: t.errors.idempotencyMismatchTitle,
        description: t.errors.idempotencyMismatchDescription,
        retryable: false,
      };
    default:
      return null;
  }
}
