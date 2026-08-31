"use client";

import { useMemo } from "react";
import type { AmbiguousOutcomeLabels } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

/**
 * The label set every CRM `AmbiguousOutcomePanel` uses.
 *
 * The pattern takes its labels as a prop rather than reading the dictionary
 * itself, and five CRM surfaces raise the panel. Assembling the object once
 * keeps the wording identical across all of them instead of drifting per
 * screen.
 */
export function useAmbiguousOutcomeLabels(): AmbiguousOutcomeLabels {
  const { t } = useI18n();
  return useMemo(
    () => ({
      title: t.crmShared.ambiguousTitle,
      operation: t.crmShared.ambiguousOperation,
      idempotencyKey: t.crmShared.ambiguousKey,
      correlationId: t.crmShared.ambiguousReference,
      retry: t.common.retry,
      dismiss: t.common.dismiss,
    }),
    [t],
  );
}
