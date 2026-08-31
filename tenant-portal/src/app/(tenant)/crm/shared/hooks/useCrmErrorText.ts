"use client";

import { useCallback } from "react";
import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";

/**
 * One translated sentence for a CRM failure.
 *
 * Order matters. The rate-limit and idempotency outcomes are checked first,
 * because each needs a different next action from the user and flattening them
 * into "something went wrong" loses that. Only then do the ordinary statuses
 * get their own copy, and only then does the server's own message show — which
 * is server-authored English prose, so it is rendered as evidence beneath a
 * translated headline rather than as the headline itself.
 */
export function useCrmErrorText() {
  const { t } = useI18n();

  return useCallback(
    (error: NormalizedApiError | null | undefined): string | null => {
      if (!error) return null;
      const outcome = describeApiOutcome(error, t);
      if (outcome) return outcome.description;

      if (error.status === 0) return t.crmShared.errorOffline;
      if (error.status === 403) return t.crmShared.errorForbidden;
      if (error.status === 404) return t.crmShared.errorNotFound;
      if (error.status === 409) return t.crmShared.errorConflict;
      if (error.status === 422) {
        return formatApiErrorMessage(error, t) ?? t.crmShared.errorValidation;
      }
      return formatApiErrorMessage(error, t) ?? t.crmShared.errorGeneric;
    },
    [t],
  );
}
