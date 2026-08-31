"use client";

import { useCallback } from "react";
import { describeApiOutcome } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { useCoreErrorText } from "./useCoreErrorText";

/**
 * Turns one directory / template / activity / audit failure into a sentence.
 *
 * Only the codes this phase's routes actually raise live in
 * `t.coreOperations.errors`; everything cross-cutting — the rate-limit and
 * idempotency outcomes, `ACCESS_POLICY_BLOCKED`, offline, the unmapped
 * fallback that keeps the server's own message and correlation id — is already
 * resolved by `useCoreErrorText`, so this delegates rather than restating it.
 */
export function useCoreOperationsErrorText(): (
  error: NormalizedApiError | null,
) => string | undefined {
  const { t } = useI18n();
  const describeCoreError = useCoreErrorText();

  return useCallback(
    (error) => {
      if (!error) return undefined;
      // An outcome is not a failure and outranks any domain code (S8/S9).
      if (describeApiOutcome(error, t)) return describeCoreError(error);
      const mapped = error.code ? t.coreOperations.errors[error.code] : undefined;
      return mapped ?? describeCoreError(error);
    },
    [t, describeCoreError],
  );
}
