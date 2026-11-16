"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { CurrencyOption } from "../currency-options";

export type WorkspaceHistoryValueLabels = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

/**
 * Manages on-demand visibility and localized diff value labels for the
 * Workspace Settings audit history modal (`RecordHistoryTab`).
 *
 * No audit network request is sent until the actor holds an audit read grant
 * AND explicitly opens the history modal.
 */
export function useWorkspaceHistory(
  t: Dictionary,
  currencyOptions: readonly CurrencyOption[],
) {
  const canReadAudit = useAuditAccess();
  const [requestedOpen, setRequestedOpen] = useState(false);

  const isHistoryOpen = canReadAudit && requestedOpen;

  const openHistory = useCallback(() => {
    if (!canReadAudit) return;
    setRequestedOpen(true);
  }, [canReadAudit]);

  const setHistoryOpen = useCallback(
    (nextOpen: boolean) => {
      setRequestedOpen(canReadAudit && nextOpen);
    },
    [canReadAudit],
  );

  const historyValueLabels = useMemo<WorkspaceHistoryValueLabels>(() => {
    const currencyLabels: Record<string, string> = {};
    for (const option of currencyOptions) {
      currencyLabels[option.code] = `${option.code} — ${option.name}`;
    }
    return {
      defaultLanguage: {
        en: t.coreSettings.languageNames.en,
        ar: t.coreSettings.languageNames.ar,
      },
      allowSupport: {
        true: t.crmShared.booleanYes,
        false: t.crmShared.booleanNo,
      },
      ...(Object.keys(currencyLabels).length > 0
        ? { defaultCurrencyCode: currencyLabels }
        : {}),
    };
  }, [currencyOptions, t]);

  return {
    canReadAudit,
    isHistoryOpen,
    openHistory,
    setHistoryOpen,
    historyValueLabels,
  };
}
