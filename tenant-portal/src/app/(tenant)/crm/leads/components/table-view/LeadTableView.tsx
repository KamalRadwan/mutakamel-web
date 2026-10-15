"use client";

import { TableView, type PageInfo, type SelectionState, type SortState } from "@/design-system";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { LeadCardPatch } from "../../lead-card-contract";
import { useLeadInlinePhone } from "../../hooks/useLeadInlinePhone";
import { useLeadTableViewExport } from "../../hooks/useLeadTableViewExport";
import { useLeadTableViewLabels } from "../../hooks/useLeadTableViewLabels";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadSelectionExport } from "./LeadSelectionExport";
import { useLeadTableColumns } from "./useLeadTableColumns";

export interface LeadTableViewProps {
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
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onInlinePhoneSave: (lead: LeadItem, nextPhone: string) => void;
}

export function LeadTableView({
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
  onOpenActivities,
  onDeleteLead,
  onMoveStage,
  onCardChange,
  onInlinePhoneSave,
}: LeadTableViewProps) {
  const labels = useLeadTableViewLabels();
  const phoneEditor = useLeadInlinePhone(onInlinePhoneSave);
  const exporter = useLeadTableViewExport(items, stages, selection.selectedIds);
  const columns = useLeadTableColumns({
    stages,
    canUpdate,
    canDelete,
    onDelete: onDeleteLead,
    onMoveStage,
    onRatingChange: (lead, rating) => onCardChange(lead.id, { rating }, lead),
    onOpenActivities,
    phoneEditor,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <LeadSelectionExport exporter={exporter} />
      <TableView
        columns={columns}
        density="compact"
        items={items}
        itemKey={(lead) => lead.id}
        selection={selection}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        page={page}
        onPageChange={onPageChange}
        sort={sort}
        onSortChange={onSortChange}
        labels={labels}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
