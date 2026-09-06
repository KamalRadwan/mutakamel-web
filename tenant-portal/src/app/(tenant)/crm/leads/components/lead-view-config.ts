"use client";

import {
  resolveStatusRole,
  type BoardColumnDef,
  type WorkspaceViewLabels,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { leadActivitySegments } from "./lead-card/activity-tone";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

/**
 * One label set, three views — the shared contract, so switching view can no
 * longer drop pagination or selection. See
 * docs/design/views.md#the-shared-contract.
 */
export function useLeadViewLabels(): WorkspaceViewLabels {
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

/**
 * The board's columns: the stage catalogue in server order, each carrying the
 * leads currently grouped into it.
 *
 * The activity bar under each heading is a summary of THE CARDS ON SCREEN, not
 * of the stage. The board is paginated — `items` is one page of leads across
 * every column — so the four counts describe what a reader can see beneath the
 * bar and nothing more. A tenant-wide figure would need an endpoint that
 * aggregates activities per stage, which does not exist; presenting a page's
 * counts as the pipeline's would be worse than presenting nothing, so the
 * bar's own label says "loaded".
 */
export function useLeadBoardColumns(stages: LeadStage[], items: LeadItem[]): BoardColumnDef[] {
  const { t, lang } = useI18n();

  return stages.map((stage) => {
    const role = resolveStatusRole("LeadStageFlag", stage.flag);
    const inStage = items.filter((item) => item.stageId === stage.id);

    return {
      id: stage.id,
      label: localizedName(stage, lang),
      count: inStage.length,
      outcomeRole:
        role === "positive" || role === "negative" || role === "caution" ? role : undefined,
      segments: leadActivitySegments(inStage, t.crmLeads.card.activityStates),
      segmentsLabel: t.crmLeads.card.activityBar,
    };
  });
}
