"use client";

import { EmptyState, Pagination, type PageInfo } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type {
  PartyDocumentCountVisibility,
  PartyDocumentCounts,
} from "../../shared/party-document-counts-contract";
import type { CustomerProfileCardPatch } from "../customer-profile-card-contract";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { CustomerGridCard } from "./customer-grid/CustomerGridCard";
import { CustomerGridToolbar } from "./customer-grid/CustomerGridToolbar";
import { useCustomerExecutiveCardView } from "./customer-grid/useCustomerExecutiveCardView";

const GRID_CLASS =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export interface CustomerExecutiveCardViewProps {
  items: readonly CustomerProfileItem[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onOpen: (item: CustomerProfileItem) => void;
  onOpenQuickModal?: (item: CustomerProfileItem) => void;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities?: (item: CustomerProfileItem) => void;
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => void;
  onMoveStatus: (item: CustomerProfileItem, status: CustomerProfileStatus) => void;
  documentCountsByParty?: ReadonlyMap<string, PartyDocumentCounts>;
  documentCountVisibility?: PartyDocumentCountVisibility;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
}

export function CustomerExecutiveCardView({
  items,
  selectedIds,
  onSelectionChange,
  canUpdate,
  canDelete,
  onOpen,
  onOpenQuickModal,
  onDelete,
  onOpenActivities,
  onCardChange,
  onMoveStatus,
  documentCountsByParty,
  documentCountVisibility,
  page,
  onPageChange,
}: CustomerExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const {
    quickSort,
    setQuickSort,
    localStatusFilter,
    setLocalStatusFilter,
    statusCounts,
    displayedItems,
    exportCount,
    isAllSelected,
    isSomeSelected,
    canExport,
    canUpdateCustomer,
    canDeleteCustomer,
    toggleSelectAll,
    toggleSelectOne,
    exportCsv,
    moveTargetsForCustomer,
  } = useCustomerExecutiveCardView({
    items,
    selectedIds,
    onSelectionChange,
    canUpdate,
    canDelete,
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <CustomerGridToolbar
        totalItemsCount={items.length}
        selectedCount={selectedIds.size}
        exportCount={exportCount}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        canExport={canExport}
        quickSort={quickSort}
        localStatusFilter={localStatusFilter}
        statusCounts={statusCounts}
        onToggleSelectAll={toggleSelectAll}
        onQuickSortChange={setQuickSort}
        onStatusFilterChange={setLocalStatusFilter}
        onExportCsv={exportCsv}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {displayedItems.length === 0 ? (
          <EmptyState title={t.common.noData} />
        ) : (
          <div data-testid="customer-card-grid" className={GRID_CLASS}>
            {displayedItems.map((item) => (
              <CustomerGridCard
                key={item.id}
                item={item}
                documentCounts={documentCountsByParty?.get(item.partyId)}
                documentCountVisibility={documentCountVisibility}
                isSelected={selectedIds.has(item.id)}
                canUpdate={canUpdateCustomer(item)}
                canDelete={canDeleteCustomer(item)}
                moveTargets={moveTargetsForCustomer(item)}
                onToggleSelect={() => toggleSelectOne(item.id)}
                onOpen={() => onOpen(item)}
                onOpenQuickModal={
                  onOpenQuickModal ? () => onOpenQuickModal(item) : undefined
                }
                onOpenActivities={
                  onOpenActivities ? () => onOpenActivities(item) : undefined
                }
                onDelete={onDelete ? () => onDelete(item) : undefined}
                onMoveStatus={(status) => onMoveStatus(item, status)}
                onCardChange={(patch) => onCardChange(item, patch)}
              />
            ))}
          </div>
        )}
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
