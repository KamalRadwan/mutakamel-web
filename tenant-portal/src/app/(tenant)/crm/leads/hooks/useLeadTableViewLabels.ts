"use client";

import type { WorkspaceViewLabels } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";

/** The shared view label set, so the card grid and the table cannot drift apart. */
export function useLeadTableViewLabels(): WorkspaceViewLabels {
  const { t } = useI18n();

  return {
    retry: t.common.retry,
    errorTitle: t.crmLeads.loadFailed,
    emptyTitle: t.crmLeads.empty,
    selectAll: t.views.selectAll,
    selectRow: t.views.selectItem,
    sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending,
    notSorted: t.views.notSorted,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };
}
