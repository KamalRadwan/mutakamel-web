"use client";

import { Plus, RefreshCw } from "lucide-react";
import {
  Button,
  DegradedBanner,
  PageHeader,
  PermissionGate,
  TooltipProvider,
} from "@/design-system";
import { CreateCurrencyModal } from "./components/CreateCurrencyModal";
import { CurrenciesListCard } from "./components/CurrenciesListCard";
import { CurrencyBlockerModal } from "./components/CurrencyBlockerModal";
import { buildCurrencyColumns } from "./components/CurrencyTableColumns";
import { DeactivateCurrencyConfirmModal } from "./components/DeactivateCurrencyConfirmModal";
import { EditCurrencyModal } from "./components/EditCurrencyModal";
import { SetDefaultCurrencyConfirmModal } from "./components/SetDefaultCurrencyConfirmModal";
import { CURRENCY_PAGE_SIZE_OPTIONS } from "./currency-contract";
import { describeCurrencyQueryError } from "./hooks/currency-errors";
import { useCurrencies } from "./hooks/useCurrencies";

export default function CurrenciesPage() {
  const {
    t,
    lang,
    canRead,
    canManage,
    visibleItems,
    visiblePageInfo,
    listFilter,
    search,
    hasActiveFilters,
    hasRetainedRows,
    isQueryForbidden,
    isLoading,
    isRefreshing,
    isSubmitting,
    pendingId,
    queryError,
    baseCurrency,
    baseStatus,
    isBaseLoading,
    reloadBaseCurrency,
    formError,
    formErrorCode,
    createOpen,
    editing,
    isReactivatingInEdit,
    settingDefault,
    deactivating,
    blocker,
    setPage,
    setPageSize,
    setListFilter,
    setSearch,
    clearFilters,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    openSetDefault,
    closeSetDefault,
    openDeactivate,
    closeDeactivate,
    closeBlocker,
    create,
    update,
    confirmSetDefault,
    deactivate,
    reactivate,
    reload,
    sort,
    setSort,
  } = useCurrencies();

  const loadFailure =
    queryError && !isQueryForbidden ? describeCurrencyQueryError(queryError, t) : null;
  const baseCurrencyCode = baseCurrency?.code ?? null;

  const columns = buildCurrencyColumns({
    t,
    lang,
    canManage,
    pendingId,
    baseCurrencyCode,
    onEdit: openEdit,
    onSetDefault: openSetDefault,
    onDeactivate: openDeactivate,
    onReactivate: (currency) => void reactivate(currency),
  });

  const queryFailure = !isLoading && !hasRetainedRows ? loadFailure : null;
  const refreshFailure = !isLoading && hasRetainedRows ? loadFailure : null;

  return (
    <PermissionGate
      require="currencies.currency.read"
      denied={!canRead || (!isLoading && isQueryForbidden)}
    >
      <TooltipProvider>
        <div className="flex flex-col gap-3">
          <PageHeader
            className="sr-only"
            title={t.coreSettings.currenciesTitle}
            primaryAction={
              canManage
                ? {
                    label: t.coreSettings.currencyCreate,
                    icon: <Plus className="size-4" aria-hidden="true" />,
                    onClick: openCreate,
                    disabled: isSubmitting || pendingId !== null,
                  }
                : undefined
            }
            secondaryActions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void reload()}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                  aria-hidden="true"
                />
                {t.coreSettings.reload}
              </Button>
            }
          />

          {baseStatus === "unknown" && !isLoading && !queryFailure && !isQueryForbidden ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DegradedBanner
                message={t.coreSettings.currencyBaseLoadFailed}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void reloadBaseCurrency()}
                disabled={isBaseLoading}
              >
                {t.coreSettings.currencyBaseRetry}
              </Button>
            </div>
          ) : null}

          {refreshFailure ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DegradedBanner
                message={
                  refreshFailure.description
                    ? `${refreshFailure.title} — ${refreshFailure.description}`
                    : refreshFailure.title
                }
                className="flex-1"
              />
              {refreshFailure.retryable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void reload()}
                  disabled={isRefreshing}
                >
                  {t.common.retry}
                </Button>
              ) : null}
            </div>
          ) : null}

          <CurrenciesListCard
            t={t}
            columns={columns}
            items={visibleItems}
            pageInfo={visiblePageInfo}
            sort={sort}
            listFilter={listFilter}
            search={search}
            hasActiveFilters={hasActiveFilters}
            canManage={canManage}
            isLoading={isLoading}
            queryFailure={queryFailure}
            onPageChange={setPage}
            pageSizeOptions={CURRENCY_PAGE_SIZE_OPTIONS}
            onPageSizeChange={setPageSize}
            onSortChange={setSort}
            onListFilterChange={setListFilter}
            onSearchChange={setSearch}
            onClearFilters={clearFilters}
            onOpenCreate={openCreate}
            onRetry={() => void reload()}
          />

          <CreateCurrencyModal
            key={createOpen ? "create-open" : "create-closed"}
            isOpen={createOpen}
            onClose={closeCreate}
            onSubmit={create}
            isSubmitting={isSubmitting}
            error={formError}
            errorCode={formErrorCode}
            baseStatus={baseStatus}
            baseCurrencyCode={baseCurrencyCode}
          />

          {editing ? (
            <EditCurrencyModal
              key={`edit-${editing.id}-${isReactivatingInEdit ? "activate" : "edit"}`}
              currency={editing}
              onClose={closeEdit}
              onSubmit={update}
              isSubmitting={isSubmitting}
              error={formError}
              errorCode={formErrorCode}
              baseCurrencyCode={baseCurrencyCode}
              activateOnSubmit={isReactivatingInEdit}
            />
          ) : null}

          <SetDefaultCurrencyConfirmModal
            currency={settingDefault}
            baseCurrency={baseCurrency}
            baseStatus={baseStatus}
            onClose={closeSetDefault}
            onConfirm={() => void confirmSetDefault()}
            isSubmitting={
              pendingId !== null && settingDefault !== null && pendingId === settingDefault.id
            }
          />

          <DeactivateCurrencyConfirmModal
            currency={deactivating}
            onClose={closeDeactivate}
            onConfirm={() => void deactivate()}
            isSubmitting={
              pendingId !== null && deactivating !== null && pendingId === deactivating.id
            }
          />

          <CurrencyBlockerModal blocker={blocker} onClose={closeBlocker} />
        </div>
      </TooltipProvider>
    </PermissionGate>
  );
}
