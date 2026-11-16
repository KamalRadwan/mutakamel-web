"use client";

import { useCallback } from "react";
import { describeApiOutcome } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";

export function useLeadStageErrorText() {
  const { t } = useI18n();
  return useCallback((error: NormalizedApiError): string => {
    const outcome = describeApiOutcome(error, t);
    if (outcome) return outcome.description;
    const known = error.code
      ? t.crmLeadStages.errors[error.code as keyof typeof t.crmLeadStages.errors]
      : undefined;
    if (known) return known;
    if (error.status === 0) return t.crmShared.errorOffline;
    if (error.status === 403) return t.crmShared.errorForbidden;
    if (error.status === 404) return t.crmShared.errorNotFound;
    if (error.status === 409) return t.crmShared.errorConflict;
    if (error.status === 400 || error.status === 422) return t.crmShared.errorValidation;
    return t.crmShared.errorGeneric;
  }, [t]);
}
