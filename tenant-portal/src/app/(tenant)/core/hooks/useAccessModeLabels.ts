"use client";

import { useMemo } from "react";
import type { ReadOnlyGateLabels } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

/**
 * The four strings `ReadOnlyGate` needs, in one place.
 *
 * Billing and subscription are both wrapped in the gate and both read the same
 * `accessMode` off the same subscription, so the copy has to match — two
 * hand-written label objects is how "read-only" and "restricted" end up saying
 * different things about one state.
 */
export function useAccessModeLabels(): ReadOnlyGateLabels {
  const { t } = useI18n();
  return useMemo(
    () => ({
      blockedTitle: t.coreBilling.accessBlockedTitle,
      blockedDescription: t.coreBilling.accessBlockedDescription,
      readOnlyNotice: t.coreBilling.accessReadOnlyNotice,
      dunningNotice: t.coreBilling.accessDunningNotice,
    }),
    [t],
  );
}
