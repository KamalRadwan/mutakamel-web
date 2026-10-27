"use client";

import {
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  type PageInfo,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import type { LeadCardPatch } from "../lead-card-contract";
import type { LeadDocumentCounts } from "../lead-document-counts-contract";
import { LeadGridCard } from "./lead-grid/LeadGridCard";
import { LeadGridToolbar } from "./lead-grid/LeadGridToolbar";
import { useLeadExecutiveCardView } from "./lead-grid/useLeadExecutiveCardView";

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export interface LeadExecutiveCardViewProps {
  items: readonly LeadItem[];
  stages: readonly LeadStage[];
  branchId: string | null;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
  sort?: { id: string; direction: "asc" | "desc" };
  onSortChange?: (next: { id: string; direction: "asc" | "desc" }) => void;
  documentCountsByParty?: ReadonlyMap<string, LeadDocumentCounts>;
  onOpenLead: (lead: LeadItem) => void;
  onOpenQuickModal: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
}

export function LeadExecutiveCardView({
  items,
  stages,
  branchId,
  selectedIds,
  onSelectionChange,
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
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDeleteLead,
  onMoveStage,
  onCardChange,
}: LeadExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const {
    canUpdateLead,
    canDeleteLead,
    canOpenActivities,
    canExport,
    stageById,
    selectedOnPageCount,
    isAllSelected,
    isSomeSelected,
    toggleSelectAll,
    toggleOne,
    exportCsv,
    activeSortValue,
    handleSortValueChange,
    moveTargetsForLead,
  } = useLeadExecutiveCardView({
    items,
    stages,
    selectedIds,
    onSelectionChange,
    canUpdate,
    canDelete,
    sort,
    onSortChange,
  });

  if (!branchId) {
    return <EmptyState title={t.crmLeads.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className={GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={`lead-grid-skeleton-${index}`} className="h-72 rounded-card" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title={t.crmLeads.loadFailed} onRetry={onRetry} retryLabel={t.common.retry} />;
  }

  if (items.length === 0) {
    return <EmptyState title={t.crmLeads.empty} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <LeadGridToolbar
        selectedCount={selectedIds.size}
        hasSelectedOnPage={selectedOnPageCount > 0}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        canExport={canExport}
        canSort={onSortChange !== undefined}
        sortValue={activeSortValue}
        loadedCount={items.length}
        totalCount={page?.total ?? items.length}
        onToggleSelectAll={toggleSelectAll}
        onExportCsv={exportCsv}
        onSortValueChange={handleSortValueChange}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div data-testid="lead-card-grid" className={GRID_CLASS}>
          {items.map((lead) => (
            <LeadGridCard
              key={lead.id}
              lead={lead}
              stage={stageById.get(lead.stageId)}
              documentCounts={documentCountsByParty?.get(lead.partyId)}
              isSelected={selectedIds.has(lead.id)}
              canUpdate={canUpdateLead(lead)}
              canDelete={canDeleteLead(lead)}
              showActivityEntry={canOpenActivities}
              moveTargets={moveTargetsForLead(lead)}
              onToggleSelect={() => toggleOne(lead.id)}
              onOpenLead={() => onOpenLead(lead)}
              onOpenQuickModal={() => onOpenQuickModal(lead)}
              onOpenActivities={() => onOpenActivities(lead)}
              onDelete={() => onDeleteLead(lead)}
              onMoveStage={(stageId) => onMoveStage(lead, stageId)}
              onCardChange={(patch) => onCardChange(lead.id, patch, lead)}
            />
          ))}
        </div>
      </div>

      {page && onPageChange && (
        <div className="mt-auto shrink-0 border-t border-line-divider pt-2">
          <Pagination
            page={page}
            onPageChange={onPageChange}
            labels={{
              previous: t.common.previousPage,
              next: t.common.nextPage,
              first: t.common.firstPage,
              last: t.common.lastPage,
              page: (n) => formatTemplate(t.common.pageNumber, { n: formatNumber(n, lang) }),
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, {
                  from: formatNumber(from, lang),
                  to: formatNumber(to, lang),
                  total: formatNumber(total, lang),
                }),
            }}
          />
        </div>
      )}
    </div>
  );
}
