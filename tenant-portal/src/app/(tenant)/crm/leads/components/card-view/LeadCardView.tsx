"use client";

import { CardView, type PageInfo, type SelectionState, type SortState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { LeadCardPatch } from "../../lead-card-contract";
import type {
  LeadDocumentCounts,
  LeadDocumentCountVisibility,
} from "../../lead-document-counts-contract";
import { useLeadTableViewExport } from "../../hooks/useLeadTableViewExport";
import { useLeadTableViewLabels } from "../../hooks/useLeadTableViewLabels";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadSelectionExport } from "../table-view/LeadSelectionExport";
import { useLeadCardViewSlots } from "./useLeadCardViewSlots";

export interface LeadCardViewProps {
  items: LeadItem[];
  stages: readonly LeadStage[];
  selection: SelectionState;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  isLoading: boolean;
  error: NormalizedApiError | null;
  onRetry: () => void;
  page: PageInfo;
  onPageChange: (page: number) => void;
  sort?: SortState;
  onSortChange: (sort: SortState) => void;
  documentCountsByParty: ReadonlyMap<string, LeadDocumentCounts>;
  documentCountVisibility: LeadDocumentCountVisibility;
  onOpenLead: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
}

export function LeadCardView({
  items,
  stages,
  selection,
  canUpdate,
  canDelete,
  isLoading,
  error,
  onRetry,
  page,
  onPageChange,
  sort,
  onSortChange,
  documentCountsByParty,
  documentCountVisibility,
  onOpenLead,
  onOpenActivities,
  onDeleteLead,
  onMoveStage,
  onCardChange,
}: LeadCardViewProps) {
  const { t } = useI18n();
  const labels = useLeadTableViewLabels();
  const exporter = useLeadTableViewExport(items, stages, selection.selectedIds);
  const slots = useLeadCardViewSlots({
    stages,
    canUpdate,
    canDelete,
    onOpen: onOpenLead,
    onDelete: onDeleteLead,
    onMoveStage,
    onCardChange,
    onOpenActivities,
    documentCountsByParty,
    documentCountVisibility,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <LeadSelectionExport exporter={exporter} />
      <CardView
        items={items}
        itemKey={(lead) => lead.id}
        renderCard={slots.renderCard}
        renderActions={slots.renderActions}
        renderFooter={slots.renderFooter}
        cardClassName={slots.cardClassName}
        density="compact"
        onActivate={onOpenLead}
        selection={selection}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        page={page}
        onPageChange={onPageChange}
        sort={sort}
        onSortChange={onSortChange}
        sortOptions={[
          { id: "createdAt", label: t.crmLeads.advancedSearch.fields.createdAt },
          { id: "displayName", label: t.crmLeads.name },
        ]}
        labels={{ ...labels, sortBy: t.views.sortBy }}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
