"use client";

import {
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type {
  Currency,
  CurrencyListFilter,
  CurrencySortField,
} from "../currency-contract";

const CURRENCY_LIST_FILTERS: readonly CurrencyListFilter[] = [
  "ACTIVE",
  "INACTIVE",
  "DEFAULT",
  "NON_DEFAULT",
];

function parseListFilterValue(raw: string | undefined): CurrencyListFilter | undefined {
  return CURRENCY_LIST_FILTERS.find((allowed) => allowed === raw);
}

interface CurrenciesListCardProps {
  t: Dictionary;
  columns: ColumnDef<Currency>[];
  items: Currency[];
  pageInfo: { page: number; limit: number; total: number };
  sort: { id: CurrencySortField; direction: "asc" | "desc" };
  listFilter: CurrencyListFilter | undefined;
  search: string;
  hasActiveFilters: boolean;
  canManage: boolean;
  isLoading: boolean;
  queryFailure: {
    title: string;
    description: string | undefined;
    retryable: boolean;
  } | null;
  onPageChange: (page: number) => void;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (size: number) => void;
  onSortChange: (sort: { id: string; direction: "asc" | "desc" }) => void;
  onListFilterChange: (next: CurrencyListFilter | undefined) => void;
  onSearchChange: (next: string) => void;
  onClearFilters: () => void;
  onOpenCreate: () => void;
  onRetry: () => void;
}

export function CurrenciesListCard({
  t,
  columns,
  items,
  pageInfo,
  sort,
  listFilter,
  search,
  hasActiveFilters,
  canManage,
  isLoading,
  queryFailure,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  onSortChange,
  onListFilterChange,
  onSearchChange,
  onClearFilters,
  onOpenCreate,
  onRetry,
}: CurrenciesListCardProps) {
  const filterValues: FilterValues = listFilter
    ? { status: { kind: "select", value: listFilter } }
    : {};

  const emptyTitle = hasActiveFilters
    ? t.coreSettings.currencyEmptyFiltered
    : t.coreSettings.currencyEmpty;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <FilterBar
          placement="inline"
          filters={[
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.coreSettings.statusAny,
              allLabel: t.coreSettings.statusAny,
              options: [
                { value: "ACTIVE", label: t.common.active },
                { value: "INACTIVE", label: t.common.inactive },
                { value: "DEFAULT", label: t.coreSettings.currencyFilterDefaultOnly },
                { value: "NON_DEFAULT", label: t.coreSettings.currencyFilterNonDefaultOnly },
              ],
            },
          ]}
          values={filterValues}
          onChange={(next) => {
            const selected = next.status;
            const nextValue =
              selected?.kind === "select" ? parseListFilterValue(selected.value) : undefined;
            if (nextValue !== listFilter) {
              onListFilterChange(nextValue);
            }
          }}
          onReset={onClearFilters}
          searchValue={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={t.coreSettings.currencySearch}
          filtersLabel={t.filters.label}
          clearAllLabel={t.coreSettings.clearFilters}
          removeChipLabel={t.filters.remove}
          moreChipsLabel={t.filters.more}
          overflowChipsLabel={t.filters.overflow}
        />
      </div>

      {queryFailure ? (
        <div className="p-4">
          <ErrorState
            title={queryFailure.title}
            description={queryFailure.description}
            onRetry={queryFailure.retryable ? onRetry : undefined}
            retryLabel={t.common.retry}
          />
        </div>
      ) : (
        <DataTable
          surface="embedded"
          density="compact"
          showRowNumbers={false}
          className={!isLoading && items.length === 0 ? "p-4" : undefined}
          columns={columns}
          rows={items}
          isLoading={isLoading}
          error={null}
          onRetry={onRetry}
          page={pageInfo}
          onPageChange={onPageChange}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={onPageSizeChange}
          hideFirstLast
          sort={sort}
          onSortChange={onSortChange}
          rowKey={(currency) => currency.id}
          emptyState={
            <EmptyState
              title={emptyTitle}
              action={
                hasActiveFilters
                  ? { label: t.coreSettings.clearFilters, onClick: onClearFilters }
                  : canManage
                    ? { label: t.coreSettings.currencyCreate, onClick: onOpenCreate }
                    : undefined
              }
            />
          }
          labels={{
            retry: t.common.retry,
            errorTitle: t.coreSettings.currencyLoadFailed,
            emptyTitle,
            selectAll: t.views.selectAll,
            selectRow: t.views.selectRow,
            sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending,
            notSorted: t.views.notSorted,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              rowsPerPage: t.common.rowsPerPage,
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />
      )}
    </Card>
  );
}
