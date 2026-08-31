"use client";

import { useMemo } from "react";
import type { DataTableLabels } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";

/**
 * The label block every commercial-document table needs.
 *
 * `emptyTitle` and `errorTitle` are per-screen, because "no quotations yet" and
 * "no contracts yet" name different next actions and a shared string would say
 * neither.
 */
export function useTradeTableLabels(emptyTitle: string, errorTitle: string): DataTableLabels {
  const { t } = useI18n();
  return useMemo(
    () => ({
      retry: t.common.retry,
      errorTitle,
      emptyTitle,
      selectAll: t.views.selectAll,
      selectRow: t.views.selectItem,
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
    [t, emptyTitle, errorTitle],
  );
}
