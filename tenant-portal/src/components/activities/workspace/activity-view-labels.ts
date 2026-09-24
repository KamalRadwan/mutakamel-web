import type { WorkspaceViewLabels } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";

/** The strings the board and the table share. Their empty states are the workspace's own, so the title is a fallback. */
export function activityViewLabels(t: Dictionary, lang: Language): WorkspaceViewLabels {
  return {
    retry: t.common.retry,
    errorTitle: t.activities.workspace.loadFailed,
    emptyTitle: t.activities.workspace.empty.title,
    selectAll: t.views.selectAll,
    selectRow: t.views.selectItem,
    sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending,
    notSorted: t.views.notSorted,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from, to, total) => formatTemplate(t.common.showingOf, {
        from: formatNumber(from, lang),
        to: formatNumber(to, lang),
        total: formatNumber(total, lang),
      }),
    },
  };
}
