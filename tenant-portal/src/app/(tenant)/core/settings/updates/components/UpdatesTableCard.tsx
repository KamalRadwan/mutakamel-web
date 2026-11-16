"use client";

import { FilterX, PackageOpen } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Checkbox,
  DataTableSort,
  EmptyState,
  Pagination,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  type ColumnDef,
  type PageInfo,
  type SortState,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/I18nContext";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatTemplate } from "@/lib/format/template";
import {
  MAX_PROVISIONING_UPDATE_SELECTIONS,
  type ProvisioningUpdatesSort,
  type ProvisioningUpdatesSortField,
  type TenantAvailableUpdate,
  type TenantProvisioningOperationView,
} from "../provisioning-updates-contract";
import { UpdatesOperationFooter } from "./UpdatesOperationFooter";
import { UpdatesTableRow } from "./UpdatesTableRow";

interface UpdatesTableCardProps {
  t: Dictionary;
  lang: Language;
  canManageEffective: boolean;
  hasActiveFilters: boolean;
  sort: ProvisioningUpdatesSort;
  items: TenantAvailableUpdate[];
  pageInfo: PageInfo;
  selectableItems: TenantAvailableUpdate[];
  selectedKeys: string[];
  selectedItems: TenantAvailableUpdate[];
  isSelectionLocked: boolean;
  isCheckingOperation: boolean;
  isOpenOperationModalDisabled: boolean;
  hasTrackedOperation: boolean;
  activeOperation: TenantProvisioningOperationView | null;
  operationErrorMessage: string | null;
  onSortChange: (sort: ProvisioningUpdatesSort) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onToggleSelection: (componentKey: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpenOperationModal: () => void;
  onRefreshOperation: () => void;
}

export function UpdatesTableCard({
  t,
  lang,
  canManageEffective,
  hasActiveFilters,
  sort,
  items,
  pageInfo,
  selectableItems,
  selectedKeys,
  selectedItems,
  isSelectionLocked,
  isCheckingOperation,
  isOpenOperationModalDisabled,
  hasTrackedOperation,
  activeOperation,
  operationErrorMessage,
  onSortChange,
  onClearFilters,
  onPageChange,
  onToggleSelection,
  onToggleSelectAll,
  onOpenOperationModal,
  onRefreshOperation,
}: UpdatesTableCardProps) {
  const updatesUi = t.coreSettings.updatesUi;
  const formatNumber = (value: number) => new Intl.NumberFormat(INTL_LOCALE[lang]).format(value);
  const selectableCap = Math.min(selectableItems.length, MAX_PROVISIONING_UPDATE_SELECTIONS);
  const allSelectableChecked = selectableCap > 0 && selectedItems.length === selectableCap;
  const someSelectableChecked = selectedItems.length > 0 && selectedItems.length < selectableCap;

  const sortColumns: ColumnDef<TenantAvailableUpdate>[] = [
    {
      id: "publishedAt",
      sortField: "publishedAt",
      header: updatesUi.sortPublishedAt,
      sortable: true,
      cell: () => null,
    },
    {
      id: "componentKey",
      sortField: "componentKey",
      header: updatesUi.colComponent,
      sortable: true,
      cell: () => null,
    },
    {
      id: "riskLevel",
      sortField: "riskLevel",
      header: updatesUi.colRisk,
      sortable: true,
      cell: () => null,
    },
  ];

  const sortValue: SortState = {
    id: sort.sortBy,
    direction: sort.sortDir === "ASC" ? "asc" : "desc",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" size="sm">
            {formatNumber(pageInfo.total)}
          </Badge>

          {selectedItems.length > 0 ? (
            <Badge tone="brand" size="sm">
              {`${formatNumber(selectedItems.length)} · ${updatesUi.statusSelected}`}
            </Badge>
          ) : null}
        </div>

        <DataTableSort
          columns={sortColumns}
          value={sortValue}
          onChange={(next) => {
            onSortChange({
              sortBy: next.id as ProvisioningUpdatesSortField,
              sortDir: next.direction === "asc" ? "ASC" : "DESC",
            });
          }}
          labels={{
            label: t.views.sortBy,
            ascending: t.views.sortAscending,
            descending: t.views.sortDescending,
          }}
        />
      </CardHeader>

      {items.length === 0 ? (
        <CardContent className="py-8">
          {hasActiveFilters ? (
            <EmptyState
              icon={FilterX}
              title={updatesUi.emptyFilteredTitle}
              description={updatesUi.emptyDescription}
              action={{ label: t.coreSettings.clearFilters, onClick: onClearFilters }}
            />
          ) : (
            <EmptyState
              icon={PackageOpen}
              title={updatesUi.emptyTitle}
              description={updatesUi.emptyUnfilteredDescription}
            />
          )}
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {canManageEffective ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allSelectableChecked
                          ? true
                          : someSelectableChecked
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                      disabled={selectableCap === 0 || isSelectionLocked}
                      aria-label={t.views.selectAll}
                    />
                  </TableHead>
                ) : null}
                <TableHead>{updatesUi.colComponent}</TableHead>
                <TableHead>{updatesUi.colCurrent}</TableHead>
                <TableHead>{updatesUi.colTarget}</TableHead>
                <TableHead>{updatesUi.colRisk}</TableHead>
                <TableHead>{updatesUi.colPrerequisites}</TableHead>
                <TableHead>{updatesUi.colStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <UpdatesTableRow
                  key={item.componentKey}
                  t={t}
                  item={item}
                  canManageEffective={canManageEffective}
                  isSelected={selectedKeys.includes(item.componentKey)}
                  selectedCount={selectedKeys.length}
                  isSelectionLocked={isSelectionLocked}
                  onToggleSelection={onToggleSelection}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}

      {items.length > 0 || pageInfo.page > 1 ? (
        <CardFooter className="border-t border-line-divider">
          <Pagination
            className="w-full"
            page={pageInfo}
            onPageChange={onPageChange}
            labels={{
              first: t.common.firstPage,
              previous: t.common.previousPage,
              next: t.common.nextPage,
              last: t.common.lastPage,
              page: (n) => formatTemplate(t.common.pageNumber, { n: formatNumber(n) }),
              summary: (from, to, count) =>
                formatTemplate(t.common.showingOf, {
                  from: formatNumber(from),
                  to: formatNumber(to),
                  total: formatNumber(count),
                }),
            }}
          />
        </CardFooter>
      ) : null}

      {hasTrackedOperation ? (
        <UpdatesOperationFooter
          t={t}
          activeOperation={activeOperation}
          operationErrorMessage={operationErrorMessage}
          isCheckingOperation={isCheckingOperation}
          isOpenModalDisabled={isOpenOperationModalDisabled}
          onOpenOperationModal={onOpenOperationModal}
          onRefreshOperation={onRefreshOperation}
        />
      ) : null}
    </Card>
  );
}
