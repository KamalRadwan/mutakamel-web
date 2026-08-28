import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";

// The evidence a user report needs to be traceable to a server log — see
// docs/reference/errors.md#normalized-shape. Never drop correlationId.
export function formatApiErrorMessage(error: NormalizedApiError, t: Dictionary): string | undefined {
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (error.correlationId) parts.push(`${t.errors.reference}: ${error.correlationId}`);
  return parts.length > 0 ? parts.join(" — ") : undefined;
}
