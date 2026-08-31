"use client";

import { useCallback } from "react";
import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";

/**
 * Turns one Core identity failure into the sentence a user can act on.
 *
 * The order matters. The cross-cutting outcomes (429, the limiter being down,
 * an idempotency replay) are checked first because each needs a different next
 * step from the user and none of them means "your input was wrong". Only then
 * does the domain code table apply. Anything unmapped keeps the server's own
 * localized message plus its correlation id, which is the only link back to a
 * server log — it is never swallowed into a generic string.
 *
 * Every key below is a code read from core-app source; see
 * docs/api/core-identity.md for the route each one belongs to.
 */
export function useCoreErrorText(): (error: NormalizedApiError | null) => string | undefined {
  const { t } = useI18n();

  return useCallback(
    (error) => {
      if (!error) return undefined;

      const outcome = describeApiOutcome(error, t);
      if (outcome) return `${outcome.title} — ${outcome.description}`;

      const mapped = error.code ? t.coreIdentity.errors[error.code] : undefined;
      if (mapped) return mapped;

      if (error.status === 0) return t.coreIdentity.errors.OFFLINE;

      return formatApiErrorMessage(error, t) ?? t.coreIdentity.errors.UNKNOWN;
    },
    [t],
  );
}
