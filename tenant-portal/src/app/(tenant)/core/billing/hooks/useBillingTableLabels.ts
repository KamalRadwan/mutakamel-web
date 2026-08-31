"use client";

import { useMemo } from "react";
import type { DataTableLabels } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";

/**
 * One `DataTableLabels` builder for the four billing tables (invoices,
 * payments, wallet ledger, invoice lines). Repeating the twelve-key object per
 * table is the duplicated-logic case file-architecture.md#cleanliness-rules
 * names — and it is how one table ends up with an untranslated sort label.
 */
export function useBillingTableLabels(errorTitle: string, emptyTitle: string): DataTableLabels {
  const { t } = useI18n();
  return useMemo(
    () => ({
      retry: t.common.retry,
      errorTitle,
      emptyTitle,
      selectAll: t.common.actions,
      selectRow: t.common.actions,
      sortAscending: t.views.sortAscending,
      sortDescending: t.views.sortDescending,
      notSorted: t.views.notSorted,
      pagination: {
        previous: t.common.previousPage,
        next: t.common.nextPage,
        summary: (from: number, to: number, total: number) =>
          formatTemplate(t.common.showingOf, { from, to, total }),
      },
    }),
    [t, errorTitle, emptyTitle],
  );
}
