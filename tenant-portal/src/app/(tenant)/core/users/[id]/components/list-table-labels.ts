import type { DataTableLabels } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";

/**
 * The `DataTable` label bag for the sub-resource tables on the user detail
 * screen. They are unpaginated collections (`GET /users/:id/team-memberships`
 * and friends return a bounded array, not a page), so only the error and empty
 * titles differ between them.
 */
export function listTableLabels(
  t: Dictionary,
  errorTitle: string,
  emptyTitle: string,
): DataTableLabels {
  return {
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
      summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };
}
