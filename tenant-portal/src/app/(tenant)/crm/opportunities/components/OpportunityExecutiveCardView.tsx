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
import type { OpportunityStage } from "../hooks/pipeline-types";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import type {
  OpportunityDocumentCountVisibility,
  OpportunityDocumentCounts,
} from "../opportunity-document-counts-contract";
import { OpportunityGridCard } from "./opportunity-grid/OpportunityGridCard";
import { OpportunityGridToolbar } from "./opportunity-grid/OpportunityGridToolbar";
import { useOpportunityExecutiveCardView } from "./opportunity-grid/useOpportunityExecutiveCardView";

const GRID_CLASS =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export interface OpportunityExecutiveCardViewProps {
  items: readonly OpportunityListItem[];
  stages: readonly OpportunityStage[];
  branchId: string | null;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (item: OpportunityListItem) => boolean;
  canDelete: (item: OpportunityListItem) => boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
  sort?: { id: string; direction: "asc" | "desc" };
  onSortChange?: (next: { id: string; direction: "asc" | "desc" }) => void;
  documentCountsByParty?: ReadonlyMap<string, OpportunityDocumentCounts>;
  documentCountVisibility?: OpportunityDocumentCountVisibility;
  onOpenOpportunity: (item: OpportunityListItem) => void;
  onDeleteOpportunity: (item: OpportunityListItem) => void;
  onMoveStage: (item: OpportunityListItem, stageId: string) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityListItem,
  ) => void;
  onBulkMoveStage: (stageId: string) => Promise<void>;
}

export function OpportunityExecutiveCardView({
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
  documentCountVisibility,
  onOpenOpportunity,
  onDeleteOpportunity,
  onMoveStage,
  onCardChange,
  onBulkMoveStage,
}: OpportunityExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const {
    canMutate,
    canUpdateItem,
    canDeleteItem,
    canUpdateAny,
    canExport,
    stageById,
    nonLostStages,
    bulkStageValue,
    selectedOnPageCount,
    isAllSelected,
    isSomeSelected,
    toggleSelectAll,
    toggleOne,
    handleBulkStageChange,
    exportCsv,
    activeSortValue,
    handleSortValueChange,
    moveTargetsForItem,
    rangeFrom,
    rangeTo,
    rangeTotal,
  } = useOpportunityExecutiveCardView({
    items,
    stages,
    selectedIds,
    onSelectionChange,
    canUpdate,
    canDelete,
    page,
    sort,
    onSortChange,
    onBulkMoveStage,
  });

  if (!branchId) {
    return <EmptyState title={t.crmOpportunities.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className={GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={`opp-grid-skeleton-${index}`}
            className="h-72 rounded-card"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t.crmOpportunities.loadFailed}
        onRetry={onRetry}
        retryLabel={t.common.retry}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState title={t.crmOpportunities.empty} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <OpportunityGridToolbar
        selectedCount={selectedIds.size}
        hasSelectedOnPage={selectedOnPageCount > 0}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        canMutate={canMutate}
        canUpdateAny={canUpdateAny}
        canExport={canExport}
        bulkStageValue={bulkStageValue}
        nonLostStages={nonLostStages}
        sortValue={activeSortValue}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        rangeTotal={rangeTotal}
        onToggleSelectAll={toggleSelectAll}
        onBulkStageChange={handleBulkStageChange}
        onExportCsv={exportCsv}
        onSortValueChange={handleSortValueChange}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div data-testid="opportunity-card-grid" className={GRID_CLASS}>
          {items.map((item) => (
            <OpportunityGridCard
              key={item.id}
              item={item}
              stage={stageById.get(item.stageId)}
              stages={stages}
              documentCounts={documentCountsByParty?.get(item.customerPartyId)}
              documentCountVisibility={documentCountVisibility}
              isSelected={selectedIds.has(item.id)}
              canUpdate={canUpdateItem(item)}
              canDelete={canDeleteItem(item)}
              moveTargets={moveTargetsForItem(item)}
              onToggleSelect={() => toggleOne(item.id)}
              onOpenOpportunity={() => onOpenOpportunity(item)}
              onDelete={() => onDeleteOpportunity(item)}
              onMoveStage={(stageId) => onMoveStage(item, stageId)}
              onCardChange={(patch) => onCardChange(item.id, patch, item)}
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
              page: (n) =>
                formatTemplate(t.common.pageNumber, {
                  n: formatNumber(n, lang),
                }),
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
